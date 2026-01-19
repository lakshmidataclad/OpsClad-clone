import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"

export async function requireManager() {
  const supabaseAuth = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "manager") {
    throw new Error("Forbidden")
  }

  return user
}
