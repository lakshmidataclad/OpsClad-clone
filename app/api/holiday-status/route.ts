// /api/holiday-status/route.ts
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ uploaded: false })
  }

  const { count } = await supabase
    .from("holidays")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId)

  return NextResponse.json({
    uploaded: (count ?? 0) > 0,
    record_count: count ?? 0,
  })
}
