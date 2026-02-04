// lib/google-drive.ts
import { googleOAuthConfig } from "@/lib/config"
import { supabaseAdmin } from "@/lib/supabase-admin"

/* --------------------------------------------------
   BUILD GOOGLE AUTH URL
--------------------------------------------------- */
export function buildGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: googleOAuthConfig.client_id,
    response_type: "code",
    scope: googleOAuthConfig.scope,
    redirect_uri: googleOAuthConfig.redirect_uri,
    access_type: "offline",
    prompt: "consent",
  })

  return `${googleOAuthConfig.auth_uri}?${params.toString()}`
}

/* --------------------------------------------------
   EXCHANGE CODE → TOKENS
--------------------------------------------------- */
export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(googleOAuthConfig.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleOAuthConfig.client_id,
      client_secret: googleOAuthConfig.client_secret,
      redirect_uri: googleOAuthConfig.redirect_uri,
      grant_type: "authorization_code",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${text}`)
  }

  return res.json()
}

/* --------------------------------------------------
   SAVE TOKENS
--------------------------------------------------- */
export async function saveDriveTokens(tokens: {
  access_token: string
  refresh_token?: string
  expires_in: number
}) {
  const token_expiry = new Date(Date.now() + tokens.expires_in * 1000)

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not set")
  }

  const { error } = await supabaseAdmin
    .from("google_drive_settings")
    .upsert({
      id: 1,
      folder_id: rootFolderId, // 🔥 synced from env
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
}


/* --------------------------------------------------
   DRIVE CONNECTION CHECK
--------------------------------------------------- */
export async function isDriveConnected() {
  const { data } = await supabaseAdmin
    .from("google_drive_settings")
    .select("access_token")
    .eq("id", 1)
    .single()

  return Boolean(data?.access_token)
}

/* --------------------------------------------------
   GET VALID ACCESS TOKEN
--------------------------------------------------- */
export async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("google_drive_settings")
    .select("*")
    .eq("id", 1)
    .single()

  if (error || !data?.access_token) {
    throw new Error("Google Drive not connected")
  }

  if (new Date(data.token_expiry) > new Date()) {
    return data.access_token
  }

  const res = await fetch(googleOAuthConfig.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleOAuthConfig.client_id,
      client_secret: googleOAuthConfig.client_secret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${text}`)
  }

  const refreshed = await res.json()
  const token_expiry = new Date(Date.now() + refreshed.expires_in * 1000)

  await supabaseAdmin
    .from("google_drive_settings")
    .update({
      access_token: refreshed.access_token,
      token_expiry,
    })
    .eq("id", 1)

  return refreshed.access_token
}

/* --------------------------------------------------
   RESOLVE CHILD FOLDER (Expenses/Pending/etc.)
--------------------------------------------------- */
export async function getChildFolderId(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string> {
  const q = [
    `'${parentId}' in parents`,
    `name='${name}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
  ].join(" and ")

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  const data = await res.json()

  if (!res.ok || !data.files?.length) {
    throw new Error(`Folder '${name}' not found under Expenses`)
  }

  return data.files[0].id
}

/* --------------------------------------------------
   UPLOAD INVOICE → Expenses/Pending
--------------------------------------------------- */
export async function uploadInvoiceToDrive({
  filename,
  mimeType,
  bytes,
}: {
  filename: string
  mimeType: string
  bytes: ArrayBuffer
}) {
  const accessToken = await getValidAccessToken()

  // 1️⃣ Get Expenses root
  const { data: settings } = await supabaseAdmin
    .from("google_drive_settings")
    .select("folder_id")
    .single()

  if (!settings?.folder_id) {
    throw new Error("Expenses folder not configured")
  }

  // 2️⃣ Resolve Pending folder
  const pendingFolderId = await getChildFolderId(
    accessToken,
    settings.folder_id,
    "Pending"
  )

  // 3️⃣ Multipart upload
  const metadata = {
    name: filename,
    parents: [pendingFolderId],
  }

  const boundary = "----opscladboundary"

  const body = new Blob(
    [
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  )

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive upload failed: ${text}`)
  }

  return res.json()
}
