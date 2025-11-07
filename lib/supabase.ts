import { createClient } from "@supabase/supabase-js"

// These environment variables need to be set in your Vercel project
// or in a .env.local file for local development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a singleton for client-side usage to prevent multiple instances
let clientSideSupabase: ReturnType<typeof createClient> | null = null

export const getClientSupabase = () => {
  if (clientSideSupabase) return clientSideSupabase

  clientSideSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  )

  return clientSideSupabase
}
