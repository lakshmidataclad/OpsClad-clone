// /api/download-holidays/route.ts
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("holidays")
    .select("holiday, holiday_date, holiday_description")
    .eq("created_by", userId)
    .order("holiday_date", { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  const rows = [
    "holiday,holiday_date,holiday_description",
    ...data.map(h =>
      `"${h.holiday.replace(/"/g, '""')}",${h.holiday_date},"${(h.holiday_description ?? "").replace(/"/g, '""')}"`
    ),
  ]

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=holidays.csv",
    },
  })
}
