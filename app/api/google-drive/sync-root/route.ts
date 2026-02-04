// app/api/google-drive/sync-root/route.ts
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST() {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.replace(/[\r\n]+/g, "").trim()

  if (!rootFolderId) {
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_ROOT_FOLDER_ID not set" },
      { status: 500 }
    )
  }

  await supabaseAdmin
    .from("google_drive_settings")
    .update({
      folder_id: rootFolderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)

  return NextResponse.json({ success: true })
}
