import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Check if employee data exists in Supabase
    const { data, error, count } = await supabase.from("employees").select("*", { count: "exact" }).limit(1)

    if (error) {
      return NextResponse.json({ uploaded: false, message: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ uploaded: false })
    }

    // Get column names
    const { data: columnData } = await supabase.from("employees").select("*").limit(1)

    const columns =
      columnData && columnData.length > 0
        ? Object.keys(columnData[0]).filter((col) => !["id", "created_at"].includes(col))
        : []

    return NextResponse.json({
      uploaded: true,
      record_count: count || 0,
      columns: columns,
    })
  } catch (error) {
    console.error("CSV status error:", error)
    return NextResponse.json({ uploaded: false })
  }
}
