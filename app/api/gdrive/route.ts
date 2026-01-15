import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  const { email, userRole, userId } = await req.json()

  if (userRole !== "manager") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
  }

  if (!email) {
    return NextResponse.json({ success: false, message: "Email required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("google_drive_settings")
    .upsert({
      id: 1,
      drive_email: email,
      is_default: true,
      created_by: userId,
    })

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const { data } = await supabase
    .from("google_drive_settings")
    .select("drive_email")
    .eq("is_default", true)
    .single()

  return NextResponse.json({
    success: true,
    email: data?.drive_email || null,
  })
}
