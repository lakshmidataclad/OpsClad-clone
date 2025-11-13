
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { parse } from "papaparse"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    const { data, errors } = parse(text, { header: true, skipEmptyLines: true })

    if (errors.length > 0) {
      return NextResponse.json({ success: false, message: "Error parsing CSV file" }, { status: 400 })
    }

    if (data.length === 0) {
      return NextResponse.json({ success: false, message: "CSV file is empty" }, { status: 400 })
    }

    const headers = Object.keys(data[0]).map((h) => h.toLowerCase())
    const required = ["holiday name", "start date", "end date"]
    const missing = required.filter((c) => !headers.includes(c))
    if (missing.length > 0)
      return NextResponse.json({ success: false, message: `Missing columns: ${missing.join(", ")}` }, { status: 400 })

    await supabase.from("holidays").delete().neq("id", 0)

    const formatted = data.map((row: any) => ({
      holiday_name: row["holiday name"]?.trim(),
      start_date: row["start date"]?.trim(),
      end_date: row["end date"]?.trim(),
      description: row["description"]?.trim() || null,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from("holidays").insert(formatted)
    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Uploaded ${formatted.length} holiday records successfully.`,
    })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ success: false, message: error.message || "Upload failed" }, { status: 500 })
  }
}
