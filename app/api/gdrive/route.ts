import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"

/* -------------------------------------------------------
   GET — Fetch active Google Drive configuration
-------------------------------------------------------- */
export async function GET() {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies })

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from("google_drive_settings")
      .select("connected_email")
      .eq("is_default", true)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email: data?.connected_email ?? null,
    })
  } catch (err) {
    console.error("GET /api/gdrive error:", err)
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    )
  }
}

/* -------------------------------------------------------
   POST — Save / Update Google Drive configuration
-------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, message: "Valid email is required" },
        { status: 400 }
      )
    }

    const supabaseAuth = createRouteHandlerClient({ cookies })

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    /* ---------------------------------------------------
       Ensure only ONE default Drive config exists
    --------------------------------------------------- */
    await supabase
      .from("google_drive_settings")
      .update({ is_default: false })
      .eq("is_default", true)

    const { error } = await supabase
      .from("google_drive_settings")
      .insert({
        connected_email: email,
        credentials: {}, // placeholder (service account handled via env)
        is_default: true,
        created_by: user.id,
      })

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Google Drive configured successfully",
    })
  } catch (err) {
    console.error("POST /api/gdrive error:", err)
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    )
  }
}
