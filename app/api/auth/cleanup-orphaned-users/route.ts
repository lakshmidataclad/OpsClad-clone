import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST() {
  try {
    // Get all auth users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      return NextResponse.json({ message: "Failed to fetch auth users" }, { status: 500 })
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await supabaseAdmin.from("profiles").select("id")

    if (profileError) {
      return NextResponse.json({ message: "Failed to fetch profiles" }, { status: 500 })
    }

    const profileIds = new Set(profiles?.map((p) => p.id) || [])
    const orphanedUsers = authUsers.users.filter((user) => !profileIds.has(user.id))

    let deletedCount = 0
    let createdCount = 0

    for (const user of orphanedUsers) {
      // Try to create a profile first
      const { error: createError } = await supabaseAdmin.from("profiles").insert({
        id: user.id,
        username: user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`,
        email: user.email || "",
      })

      if (createError) {
        // If profile creation fails, delete the orphaned auth user
        console.log(`Deleting orphaned user: ${user.email}`)
        await supabaseAdmin.auth.admin.deleteUser(user.id)
        deletedCount++
      } else {
        console.log(`Created profile for user: ${user.email}`)
        createdCount++
      }
    }

    return NextResponse.json({
      message: `Cleanup complete. Created ${createdCount} profiles, deleted ${deletedCount} orphaned users.`,
      orphanedUsers: orphanedUsers.length,
      deletedCount,
      createdCount,
    })
  } catch (error) {
    console.error("Cleanup error:", error)
    return NextResponse.json({ message: "An unexpected error occurred" }, { status: 500 })
  }
}
