import crypto from "crypto"

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

let cachedToken: { token: string; exp: number } | null = null

export async function getDriveAccessToken() {
  // reuse token if still valid
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

  cachedToken = {
    token: data.access_token,
    exp: Date.now() + 55 * 60 * 1000,
  }

  return data.access_token as string
}
