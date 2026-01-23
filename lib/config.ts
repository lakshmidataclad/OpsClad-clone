// lib/config.ts
export const Config = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI!,

  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  
}

// lib/config.ts
export const googleOAuthConfig = {
  client_id: process.env.GOOGLE_CLIENT_ID as string,
  client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
  auth_uri: "https://accounts.google.com/o/oauth2/v2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  scope: "https://www.googleapis.com/auth/drive.file",
}

// Fail fast if missing (important on Render)
for (const [key, value] of Object.entries(googleOAuthConfig)) {
  if (!value) {
    throw new Error(`Missing Google OAuth config: ${key}`)
  }
}

export function assertConfig() {
  const missing = Object.entries(Config)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`)
  }
}

/**
 * This mirrors your Python-style config.
 * It's not "used" directly by Google, but it represents the same info.
 */
export const client_config = {
  web: {
    client_id: Config.GOOGLE_CLIENT_ID,
    project_id: "opsclad",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: Config.GOOGLE_CLIENT_SECRET,
  },
} as const
