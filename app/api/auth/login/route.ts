// app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 })
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Login error:", error)
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 })
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ message: "Authentication failed" }, { status: 401 })
    }

    // Get user profile data
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username, email")
      .eq("id", data.user.id)
      .single()

    if (profileError && profileError.code === "PGRST116") {
      // Create profile if it doesn't exist
      const { error: createProfileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: data.user.email?.split("@")[0] || "user",
        email: data.user.email || "",
      })

      if (createProfileError) {
        console.error("Failed to create profile:", createProfileError)
      }
    }

    // Return the session data that the client can use
    return NextResponse.json({
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
      }
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "An unexpected error occurred" }, { status: 500 })
  }
}