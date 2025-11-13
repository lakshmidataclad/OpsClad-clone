
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("holidays")
      .select("holiday_name, start_date, end_date, description")
      .order("start_date", { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Get holiday CSV error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
