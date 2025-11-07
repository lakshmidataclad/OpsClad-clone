import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { username, email, password, employee_id } = await request.json();

    // Correctly check for falsy values for all required fields
    if (!username || !email || !password || !employee_id) {
      return NextResponse.json(
        { message: "Employee name, employee id, email, and password are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters long" }, { status: 400 });
    }

    // Check if username already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (existingProfile) {
      return NextResponse.json({ message: "Employee already exists" }, { status: 400 });
    }

    // First, create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for development
    });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ message: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
    }

    // Then, create the profile using admin client
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id,
      username,
      email,
      employee_id,
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ message: "Failed to create user profile" }, { status: 500 });
    }

    // --- NEW: Insert default role into the user_roles table ---
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: authData.user.id,
      role: "employee", // Assign a default role
    });

    if (roleError) {
      console.error("Role creation error:", roleError);
      // Clean up both the profile and auth user if role creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from("profiles").delete().eq("id", authData.user.id);
      return NextResponse.json({ message: "Failed to assign user role" }, { status: 500 });
    }

    return NextResponse.json({ message: "User registered successfully!" }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "An unexpected error occurred" }, { status: 500 });
  }
}
