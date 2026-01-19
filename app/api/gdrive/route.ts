import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"

/* -------------------------------------------------------
   POST — Set default Google Drive email (MANAGER ONLY)
-------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email required" },
        { status: 400 }
      )
    }

    /* 🔐 Authenticated Supabase user */
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    /* 🔐 Fetch role from DB (never trust frontend) */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || profile?.role !== "manager") {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      )
    }

    /* ✅ Upsert single-row config */
    const { error } = await supabase
      .from("google_drive_settings")
      .upsert({
        id: 1,
        drive_email: email,
        is_default: true,
        created_by: user.id,
      })

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request" },
      { status: 400 }
    )
  }
}

/* -------------------------------------------------------
   GET — Fetch default Google Drive email (AUTHENTICATED)
-------------------------------------------------------- */
export async function GET() {
  try {
    /* 🔐 Authenticated Supabase user */
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

    /* ✅ Fetch default Drive email */
    const { data, error } = await supabase
      .from("google_drive_settings")
      .select("drive_email")
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
      email: data?.drive_email ?? null,
    })

  } catch {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    )
  }
}
