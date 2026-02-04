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

    if (!dateFrom || !dateTo || files.length === 0) {
      return NextResponse.json(
        { error: "Missing date range or files" },
        { status: 400 }
      )
    }

    // 📂 temp folder
    const uploadDir = path.join(process.cwd(), "tmp/pdf-compare")
    await fs.mkdir(uploadDir, { recursive: true })

    const extractedEntries: any[] = []

    // 🔁 process each PDF using EXISTING python
    for (const file of files) {
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
        continue // unsupported
      }

      const python = spawn("python3", [script, filePath])

      let output = ""
      python.stdout.on("data", d => (output += d.toString()))
      await new Promise(res => python.on("close", res))

      const parsed = JSON.parse(output)

      extractedEntries.push(
        ...(parsed.work_entries || parsed["Work Entries"] || []),
        ...(parsed.pto_entries || parsed["PTO Data"] || [])
      )
    }


    // 🗄 fetch DB timesheets
    const { data: dbData } = await supabase
      .from("timesheets")
      .select("*")
      .gte("date", dateFrom)
      .lte("date", dateTo)

    return NextResponse.json({
      pdfEntries: extractedEntries,
      dbEntries: dbData || []
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
