import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"

export async function requireManager() {
  const supabaseAuth = createRouteHandlerClient({ cookies })

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  const { data: userRole, error } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .single()

  if (error || !userRole) {
    throw new Error("Role not found")
  }

  if (!userRole.is_active) {
    throw new Error("Role inactive")
  }

  if (userRole.role !== "manager") {
    throw new Error("Forbidden")
  }

  return user
}
