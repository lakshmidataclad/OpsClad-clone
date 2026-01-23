// lib/google-drive.ts
import { googleOAuthConfig } from "@/lib/config"
import { supabaseAdmin } from "@/lib/supabase-admin"

/* --------------------------------------------------
   BUILD GOOGLE AUTH URL
--------------------------------------------------- */
export function buildGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: googleOAuthConfig.client_id,
    redirect_uri: googleOAuthConfig.redirect_uri,
    response_type: "code",
    scope: googleOAuthConfig.scope,
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
   SAVE TOKENS TO DB
--------------------------------------------------- */
export async function saveDriveTokens(tokens: {
  access_token: string
  refresh_token?: string
  expires_in: number
}) {
  const expires_at = new Date(Date.now() + tokens.expires_in * 1000)

  const { error } = await supabaseAdmin
    .from("google_drive_settings")
    .upsert({
      id: 1,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at,
    })

  if (error) {
    throw new Error(error.message)
  }
}

/* --------------------------------------------------
   CHECK DRIVE CONNECTED
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
   GET VALID ACCESS TOKEN (AUTO REFRESH)
--------------------------------------------------- */
async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("google_drive_settings")
    .select("*")
    .eq("id", 1)
    .single()

  if (error || !data?.access_token) {
    throw new Error("Google Drive not connected")
  }

  // Token still valid
  if (new Date(data.expires_at) > new Date()) {
    return data.access_token
  }

  // Refresh token
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
  const expires_at = new Date(Date.now() + refreshed.expires_in * 1000)

  await supabaseAdmin
    .from("google_drive_settings")
    .update({
      access_token: refreshed.access_token,
      expires_at,
    })
    .eq("id", 1)

  return refreshed.access_token
}

/* --------------------------------------------------
   UPLOAD FILE TO GOOGLE DRIVE
--------------------------------------------------- */
export async function uploadInvoiceToDrive(params: {
  filename: string
  mimeType: string
  bytes: ArrayBuffer
}) {
  const accessToken = await getValidAccessToken()

  const metadata = {
    name: params.filename,
  }

  const boundary = "----opscladboundary"

  const body = new Blob(
    [
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${params.mimeType}\r\n\r\n`,
      params.bytes,
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
