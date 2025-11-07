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
    const requiredColumns = ["email id", "project", "client", "name", "emp id", "hours"]
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

    // Clear existing data from both tables
    await supabase.from("projects").delete().neq("id", 0)
    await supabase.from("employees").delete().neq("id", 0)

    // Process CSV data
    const processedData = data.map((row: any) => {
      const emailKey = Object.keys(row).find((key) => key.toLowerCase() === "email id") || "email id"
      const projectKey = Object.keys(row).find((key) => key.toLowerCase() === "project") || "project"
      const clientKey = Object.keys(row).find((key) => key.toLowerCase() === "client") || "client"
      const nameKey = Object.keys(row).find((key) => key.toLowerCase() === "name") || "name"
      const idKey = Object.keys(row).find((key) => key.toLowerCase() === "emp id") || "emp id"
      const hoursKey = Object.keys(row).find((key) => key.toLowerCase() === "hours") || "hours"
      const birthdayKey = Object.keys(row).find((key) => key.toLowerCase() === "birthday") || "birthday"

      return {
        email_id: row[emailKey].trim().toLowerCase(),
        project: row[projectKey].trim(),
        client: row[clientKey].trim(),
        name: row[nameKey].trim(),
        employee_id: row[idKey].trim(),
        hours: parseFloat(row[hoursKey]) || 0,
        birthday: row[birthdayKey] ? new Date(row[birthdayKey]).toISOString().split('T')[0] : null, // Store as 'YYYY-MM-DD' or null
      }
    })

    // Create unique employees data (remove duplicates)
    const uniqueEmployees = new Map()
    processedData.forEach(row => {
      const key = `${row.employee_id}-${row.email_id}`
      if (!uniqueEmployees.has(key)) {
        uniqueEmployees.set(key, {
          employee_id: row.employee_id,
          name: row.name,
          email_id: row.email_id,
          birthday: row.birthday, 
        })
      }
    })

    const employeeData = Array.from(uniqueEmployees.values())

    // Prepare projects data (all rows)
    const projectData = processedData.map(row => ({
      employee_id: row.employee_id,
      employee_name: row.name,
      employee_email: row.email_id,
      project: row.project,
      client: row.client,
      hours: row.hours,
    }))

    // Insert employees data
    const { error: employeeError } = await supabase.from("employees").insert(employeeData)

    if (employeeError) {
      return NextResponse.json({ 
        success: false, 
        message: `Database error inserting employees: ${employeeError.message}` 
      }, { status: 500 })
    }

    // Insert projects data
    const { error: projectError } = await supabase.from("projects").insert(projectData)

    if (projectError) {
      return NextResponse.json({ 
        success: false, 
        message: `Database error inserting projects: ${projectError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `CSV uploaded successfully. Found ${employeeData.length} unique employees and ${projectData.length} project records.`,
      columns: headers,
      employee_count: employeeData.length,
      project_count: projectData.length,
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