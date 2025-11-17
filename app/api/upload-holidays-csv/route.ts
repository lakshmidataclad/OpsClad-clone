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

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ success: false, message: "Please upload a CSV file" }, { status: 400 })
    }

    // Read and parse the CSV file
    const fileContent = await file.text()
    const { data, errors } = parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    })

    if (errors.length > 0) {
      return NextResponse.json({ success: false, message: "Error parsing CSV file" }, { status: 400 })
    }

    // Validate required columns
    const headers = Object.keys(data[0]).map((header) => header.toLowerCase())
    const requiredColumns = ["holiday","holiday_date","holiday_description"]
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col.toLowerCase()))

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `CSV is missing required columns: ${missingColumns.join(", ")}`,
        },
        { status: 400 },
      )
    }

    // Clear existing data 
    await supabase.from("holidays").delete().neq("id", 0)

    // Process CSV data
    const processedData = data.map((row: any) => {
      const holidayKey = Object.keys(row).find((key) => key.toLowerCase() === "holiday") || "holiday"
      const holiday_dateKey = Object.keys(row).find((key) => key.toLowerCase() === "holiday_date") || "holiday_date"
      const holiday_descriptionKey = Object.keys(row).find((key) => key.toLowerCase() === "holiday_description") || "holiday_description"

      return {
        holiday: row[holidayKey].trim().toLowerCase(),
        holiday_date: row[holiday_dateKey] ? new Date(row[holiday_dateKey]).toISOString().split('T')[0] : null, // Store as 'YYYY-MM-DD' or null
        holiday_description: row[holiday_descriptionKey].trim(),
      }
    })

    // Create unique employees data (remove duplicates)
    const uniqueHolidays = new Map()
    processedData.forEach(row => {
      const key = `${row.holiday}-${row.holiday_date}`
      if (!uniqueHolidays.has(key)) {
        uniqueHolidays.set(key, {
          holiday: row.holiday,
          holiday_date: row.holiday_date,
          holiday_description: row.holiday_description
        })
      }
    })

    const holidayData = Array.from(uniqueHolidays.values())
    return NextResponse.json({
      success: true,
      message: `CSV uploaded successfully. Found ${holidayData.length} unique holiday records`,
      columns: headers,
      employee_count: holidayData.length,
    })
  } catch (error) {
    console.error("CSV upload error:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}