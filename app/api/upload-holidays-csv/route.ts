// /api/upload-holidays-csv/route.ts
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { parse } from "papaparse"

export async function POST(request: Request) {
  const formData = await request.formData()
  const userId = formData.get("userId") as string
  const file = formData.get("file") as File

  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  if (!file) {
    return NextResponse.json({ success: false, message: "No file" }, { status: 400 })
  }

  const text = await file.text()
  const { data, errors } = parse(text, { header: true, skipEmptyLines: true })

  if (errors.length) {
    return NextResponse.json({ success: false, message: "CSV parsing error" }, { status: 400 })
  }

  const required = ["holiday", "holiday_date", "holiday_description"]
  const headers = Object.keys(data[0]).map(h => h.toLowerCase())
  const missing = required.filter(c => !headers.includes(c))

  if (missing.length) {
    return NextResponse.json(
      { success: false, message: `Missing: ${missing.join(", ")}` },
      { status: 400 }
    )
  }

  // ✅ DELETE ONLY THIS USER'S HOLIDAYS
  await supabase
    .from("holidays")
    .delete()
    .eq("created_by", userId)

  const rows = data.map(r => ({
    holiday: r.holiday,
    holiday_date: r.holiday_date,
    holiday_description: r.holiday_description,
    created_by: userId, // ✅ REQUIRED
  }))

  const { error } = await supabase.from("holidays").insert(rows)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: "Holiday CSV uploaded",
    record_count: rows.length,
  })
}
