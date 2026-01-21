import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"

/* -------------------------------------------------------
   Helper — ensure user is authenticated & manager
-------------------------------------------------------- */
async function requireManager() {
  const supabaseAuth = createRouteHandlerClient({ cookies })

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    throw new Error("UNAUTHORIZED")
  }

  const { data: role, error } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .single()

  if (error || !role || !role.is_active || role.role !== "manager") {
    throw new Error("FORBIDDEN")
  }

  return user
}

/* -------------------------------------------------------
   GET — Fetch active Google Drive configuration
   Used by Expenses UI
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
      .select("connected_email, created_at")
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
   Manager-only
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

    const user = await requireManager()

    /* ---------------------------------------------------
       Ensure only ONE default Drive config exists
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
        credentials: {}, // handled via env / service account
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
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    if (err.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Manager access required" },
        { status: 403 }
      )
    }

    console.error("POST /api/gdrive error:", err)
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    )
  }
}
