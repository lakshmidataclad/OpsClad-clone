import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"

/* -------------------------------------------------------
   GET — Fetch active (default) Google Drive configuration
   Used by Expenses UI & upload logic
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
   Shared (global), latest wins, no role checks
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
        credentials: {}, // service account handled via env
        is_default: true,
        created_by: user.id,
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
