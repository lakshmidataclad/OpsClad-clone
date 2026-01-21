import { NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { getDriveAccessToken } from "@/lib/google-drive"
import { supabase } from "@/lib/supabase"

/* -------------------------------------------------------
   Constants
-------------------------------------------------------- */
const DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"

const DRIVE_FILES_URL =
  "https://www.googleapis.com/drive/v3/files"

const MAX_FILE_SIZE_MB = 10

/* -------------------------------------------------------
   POST — Upload expense invoice
-------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    /* ---------------------------------------------------
       AUTH — must be logged in
    --------------------------------------------------- */
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    /* ---------------------------------------------------
       Parse form data
    --------------------------------------------------- */
    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const transactionId = formData.get("transaction_id") as string | null

    if (!file || !transactionId) {
      return NextResponse.json(
        { success: false, message: "Missing file or transaction ID" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "File too large (max 10MB)" },
        { status: 400 }
      )
    }

    /* ---------------------------------------------------
       Load active Google Drive configuration
    --------------------------------------------------- */
    const { data: driveConfig, error: driveError } = await supabase
      .from("google_drive_settings")
      .select("connected_email")
      .eq("is_default", true)
      .single()

    if (driveError || !driveConfig) {
      return NextResponse.json(
        { success: false, message: "Google Drive not configured" },
        { status: 400 }
      )
    }

    /* ---------------------------------------------------
       Auth + root folder
    --------------------------------------------------- */
    const accessToken = await getDriveAccessToken()

    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) {
      throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID missing")
    }

    /* ---------------------------------------------------
       Ensure 'Pending' folder exists
    --------------------------------------------------- */
    const searchRes = await fetch(
      `${DRIVE_FILES_URL}?q=` +
        encodeURIComponent(
          `name='Pending' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`
        ) +
        `&fields=files(id)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const searchData = await searchRes.json()
    let pendingFolderId = searchData.files?.[0]?.id

    if (!pendingFolderId) {
      const createFolderRes = await fetch(DRIVE_FILES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Pending",
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootFolderId],
        }),
      })

      const folderData = await createFolderRes.json()
      pendingFolderId = folderData.id
    }

    /* ---------------------------------------------------
       Multipart upload
    --------------------------------------------------- */
    const boundary = `-------${crypto.randomUUID()}`

    const metadata = {
      name: `${transactionId}-${file.name}`,
      parents: [pendingFolderId],
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n`
      ),
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": multipartBody.length.toString(),
      },
      body: multipartBody,
    })

    const uploadData = await uploadRes.json()

    if (!uploadRes.ok) {
      console.error("Drive upload failed:", uploadData)
      return NextResponse.json(
        { success: false, message: "Google Drive upload failed" },
        { status: 500 }
      )
    }

    /* ---------------------------------------------------
       Success
    --------------------------------------------------- */
    const fileId = uploadData.id
    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`

    return NextResponse.json({
      success: true,
      fileId,
      driveUrl,
      connectedEmail: driveConfig.connected_email,
    })
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json(
      { success: false, message: "Upload failed" },
      { status: 500 }
    )
  }
}
