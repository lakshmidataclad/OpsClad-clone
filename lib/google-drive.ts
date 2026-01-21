import crypto from "crypto"

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function assertDriveEnv() {
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY ||
    !process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  ) {
    throw new Error(
      "Google Drive env vars missing. Check GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_ROOT_FOLDER_ID"
    )
  }
}

let cachedToken: { token: string; exp: number } | null = null

export async function getDriveAccessToken() {
  // ✅ validate env at runtime (NOT build time)
  assertDriveEnv()

  // reuse cached token if valid
  if (cachedToken && cachedToken.exp > Date.now()) {
    return cachedToken.token
  }

  const now = Math.floor(Date.now() / 1000)

  const header = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
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

  if (!data.access_token) {
    console.error("Google token error:", data)
    throw new Error("Failed to get Drive access token")
  }

  cachedToken = {
    token: data.access_token,
    exp: Date.now() + (data.expires_in - 300) * 1000, // refresh 5 mins early
  }

  return data.access_token
}
