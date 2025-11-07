import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const { email, password, userId } = await request.json()

    if (!email || !password || !userId) {
      return NextResponse.json({ success: false, message: "Email, password, and userId are required" }, { status: 400 })
    }

    // Store Gmail credentials (in production, encrypt the password)
    const { error } = await supabase.from("gmail_settings").upsert({
      user_id: userId,
      gmail_email: email,
      gmail_password: password, // In production, encrypt this
      updated_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Gmail settings saved successfully" })
  } catch (error) {
    console.error("Gmail settings error:", error)
    return NextResponse.json({ success: false, message: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ success: false, message: "User ID is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("gmail_settings")
      .select("gmail_email, created_at")
      .eq("user_id", userId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, connected: false })
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      connected: true,
      email: data.gmail_email,
      connectedAt: data.created_at,
    })
  } catch (error) {
    console.error("Gmail settings fetch error:", error)
    return NextResponse.json({ success: false, message: "An unexpected error occurred" }, { status: 500 })
  }
}