import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import path from "path"
import fs from "fs/promises"
import { spawn } from "child_process"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const dateFrom = formData.get("dateFrom") as string
    const dateTo = formData.get("dateTo") as string
    const files = formData.getAll("files") as File[]
    const employee = formData.get("employee") as string
    const client = formData.get("client") as string
    const project = formData.get("project") as string

    // 🔒 Basic validation (still OK to 400 here)
    if (!dateFrom || !dateTo || files.length === 0) {
      return NextResponse.json(
        { error: "Missing date range or files", pdfEntries: [], dbEntries: [] },
        { status: 200 }
      )
    }

    // 📂 temp folder
    const uploadDir = path.join(process.cwd(), "tmp/pdf-compare")
    await fs.mkdir(uploadDir, { recursive: true })

    const extractedEntries: any[] = []

    // 🔁 process each file using EXISTING python scripts
    for (const file of files) {
      console.log("Processing file:", {
        name: file.name,
        type: file.type,
        size: file.size,
      })

      const buffer = Buffer.from(await file.arrayBuffer())
      const filePath = path.join(uploadDir, file.name)
      await fs.writeFile(filePath, buffer)

      const ext = file.name.split(".").pop()?.toLowerCase()

      let script = ""

      if (ext === "pdf") {
        script = "pdfextract.py"
      } else if (["png", "jpg", "jpeg"].includes(ext || "")) {
        script = "pngextract.py"
      } else {
        console.warn("Unsupported file type:", file.name)
        continue
      }

      const python = spawn(
        process.platform === "win32" ? "python" : "python3",
        [path.join(process.cwd(), "scripts", script), filePath]
      )

      let stdout = ""
      let stderr = ""

      python.stdout.on("data", d => (stdout += d.toString()))
      python.stderr.on("data", d => (stderr += d.toString()))

      const exitCode = await new Promise<number>(res =>
        python.on("close", res)
      )

      // ⚠️ Python failure should NOT crash API
      if (exitCode !== 0) {
        console.warn(`Python failed for ${file.name}:`, stderr)
        continue
      }

      let parsed: any = {}
      try {
        parsed = JSON.parse(stdout)
      } catch {
        console.warn(`Invalid JSON from ${script} for ${file.name}`)
        continue
      }

      extractedEntries.push(
        ...(parsed.work_entries || parsed["Work Entries"] || []),
        ...(parsed.pto_entries || parsed["PTO Data"] || [])
      )
    }

    // 🗄 fetch DB timesheets
    let dbQuery = supabase
      .from("timesheets")
      .select("*")
      .gte("date", dateFrom)
      .lte("date", dateTo)

    // 👤 Employee filter
    if (employee && employee !== "all") {
      dbQuery = dbQuery.eq("employee_name", employee)
    }

    // 🏢 Client filter
    if (client && client !== "all") {
      dbQuery = dbQuery.eq("client", client)
    }

    // 🧩 Project filter
    if (project && project !== "all") {
      dbQuery = dbQuery.eq("project", project)
    }

    const { data: dbData, error: dbError } = await dbQuery

    if (dbError) {
      console.error("DB query error:", dbError)
    }

    // 🔎 Filter extracted entries by same filters
    const filteredPdfEntries = extractedEntries.filter(e => {
      if (employee && employee !== "all" && e.employee_name !== employee) {
        return false
      }

      if (client && client !== "all" && e.client !== client) {
        return false
      }

      if (project && project !== "all" && e.project !== project) {
        return false
      }

      // Date safety (PDFs / OCR may include extra days)
      if (e.date < dateFrom || e.date > dateTo) {
        return false
      }

      return true
    })

    // ✅ ALWAYS return a valid JSON shape
    return NextResponse.json({
      pdfEntries: filteredPdfEntries,
      dbEntries: dbData || [],
    })

  } catch (e: any) {
    console.error("Compare API fatal error:", e)

    // ❗ Never break frontend flow with 500
    return NextResponse.json(
      {
        error: e.message,
        pdfEntries: [],
        dbEntries: [],
      },
      { status: 200 }
    )
  }
}
