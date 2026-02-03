import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  const { data } = await supabaseAdmin
    .from("google_drive_settings")
    .select("access_token")
    .eq("id", 1)
    .single()

  return NextResponse.json({
    connected: Boolean(data?.access_token),
  })
}
