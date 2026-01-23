// app/api/google/drive/callback/route.ts
import { NextResponse } from "next/server"
import { exchangeCodeForTokens, saveDriveTokens } from "@/lib/google-drive"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 })
  }

  const tokens = await exchangeCodeForTokens(code)

  await saveDriveTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  })

  return NextResponse.redirect(new URL("/settings?drive=connected", req.url))
}
