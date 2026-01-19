import { NextResponse } from "next/server"
import crypto from "crypto"
import { getDriveAccessToken } from "@/lib/google-drive"

/* -------------------------------------------------------
   Constants
-------------------------------------------------------- */
const DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
const DRIVE_FILES_URL =
  "https://www.googleapis.com/drive/v3/files"

/* -------------------------------------------------------
   POST — Upload expense invoice
-------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const transactionId = formData.get("transaction_id") as string | null

    if (!file || !transactionId) {
      return NextResponse.json(
        { success: false, message: "Missing fields" },
        { status: 400 }
      )
    }

    const accessToken = await getDriveAccessToken()
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

    /* ---------------------------------------------------
       Ensure Pending folder exists
    --------------------------------------------------- */
    const searchRes = await fetch(
      `${DRIVE_FILES_URL}?q=name='Pending' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
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

      const folder = await createFolderRes.json()
      pendingFolderId = folder.id
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
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`
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
        { success: false, message: uploadData.error || "Drive upload failed" },
        { status: 500 }
      )
    }

    const fileId = uploadData.id
    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`

    return NextResponse.json({
      success: true,
      fileId,
      driveUrl,
    })

  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json(
      { success: false, message: "Upload failed" },
      { status: 500 }
    )
  }
}
