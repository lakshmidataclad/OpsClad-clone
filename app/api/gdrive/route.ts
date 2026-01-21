import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

/* -------------------------------------------------------
   GET — Fetch active (default) Google Drive configuration
   Used by Expenses UI & upload logic
-------------------------------------------------------- */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("google_drive_settings")
      .select("connected_email, created_at, created_by")
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
      connected: !!data,
      email: data?.connected_email ?? null,
      connectedAt: data?.created_at ?? null,
      createdBy: data?.created_by ?? null,
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
   POST — Set / Change Google Drive configuration
   Shared (global), latest wins, NO role checks, NO cookies
-------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const { email, userId } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, message: "Valid email is required" },
        { status: 400 }
      )
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, message: "userId is required" },
        { status: 400 }
      )
    }

    /* ---------------------------------------------------
       Ensure only ONE default Drive exists
       (latest submission wins)
    --------------------------------------------------- */
    const { error: resetError } = await supabase
      .from("google_drive_settings")
      .update({ is_default: false })
      .eq("is_default", true)

    if (resetError) {
      return NextResponse.json(
        { success: false, message: resetError.message },
        { status: 500 }
      )
    }

    /* ---------------------------------------------------
       Insert new default Drive config
    --------------------------------------------------- */
    const { error: insertError } = await supabase
      .from("google_drive_settings")
      .insert({
        connected_email: email,
        credentials: {}, // handled via Render env / service account
        is_default: true,
        created_by: userId,
      })

    if (insertError) {
      return NextResponse.json(
        { success: false, message: insertError.message },
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
