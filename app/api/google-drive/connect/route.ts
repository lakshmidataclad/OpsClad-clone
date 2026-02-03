// app/api/google-drive/connect/route.ts
import { NextResponse } from "next/server"
import { buildGoogleAuthUrl } from "@/lib/google-drive"

export async function GET() {
  return NextResponse.redirect(buildGoogleAuthUrl())
}
