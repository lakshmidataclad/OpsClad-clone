import { NextResponse } from "next/server"
import crypto from "crypto"

/* -------------------------------------------------------
   Helpers
-------------------------------------------------------- */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

/* -------------------------------------------------------
   Get OAuth access token (Service Account, JWT flow)
-------------------------------------------------------- */
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }

  const unsignedJwt =
    `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedJwt)
    .sign(
      process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      "base64"
    )

  const jwt = `${unsignedJwt}.${base64url(signature)}`

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })

  const data = await res.json()
  return data.access_token as string
}

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

    const accessToken = await getAccessToken()
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

    /* ---------------------------------------------------
       Ensure Pending folder exists
    --------------------------------------------------- */
    const searchRes = await fetch(
      `${DRIVE_FILES_URL}?q=name='Pending' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
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
