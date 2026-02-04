// app/api/google-drive/callback/route.ts
import { NextResponse } from "next/server"
import { ensureExpenseFolders, exchangeCodeForTokens, saveDriveTokens } from "@/lib/google-drive"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const code = searchParams.get("code")
    const error = searchParams.get("error")

    // Google returned an OAuth error
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    // Missing authorization code
    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      )
    }

    // Exchange authorization code → access + refresh tokens
    const tokens = await exchangeCodeForTokens(code)

    // Persist tokens in DB
    await saveDriveTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    })

        // ✅ NEW: ensure folders exist under the configured root
    const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.replace(/[\r\n]+/g, "").trim()
      if (rootId) {
        await ensureExpenseFolders(tokens.access_token, rootId)
      }

    // IMPORTANT:
    // Do NOT use req.url here (Render may resolve to localhost internally)
    // Always redirect to the public app URL
    return NextResponse.redirect(
      "https://opsclad-clone.onrender.com/dashboard?tab=settings&drive=connected"
    )

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "OAuth callback failed" },
      { status: 500 }
    )
  }
}
