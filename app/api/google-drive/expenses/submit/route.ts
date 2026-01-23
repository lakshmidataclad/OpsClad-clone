// app/api/google-drive/expenses/submit/route.ts
import { NextResponse } from "next/server"
import {
  uploadInvoiceToDrive,
  isDriveConnected,
} from "@/lib/google-drive"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(req: Request) {
  try {
    if (!(await isDriveConnected())) {
      return NextResponse.json(
        { error: "Google Drive is not connected" },
        { status: 409 }
      )
    }

    const form = await req.formData()
    const file = form.get("invoice") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Missing invoice file" },
        { status: 400 }
      )
    }

    const employee_id = String(form.get("employee_id") ?? "")
    const employee_name = String(form.get("employee_name") ?? "")
    const sender_email = String(form.get("sender_email") ?? "")
    const amount = String(form.get("amount") ?? "")
    const currency = String(form.get("currency") ?? "")
    const reimbursement_type = String(form.get("reimbursement_type") ?? "")
    const transaction_id = String(form.get("transaction_id") ?? "")
    const request_reason = String(form.get("request_reason") ?? "")

    const missing = [
      ["employee_id", employee_id],
      ["employee_name", employee_name],
      ["sender_email", sender_email],
      ["amount", amount],
      ["currency", currency],
      ["reimbursement_type", reimbursement_type],
      ["transaction_id", transaction_id],
      ["request_reason", request_reason],
    ].filter(([, v]) => !v)

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.map(([k]) => k).join(", ")}` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const safeTx = transaction_id.replace(/[^a-zA-Z0-9-_]/g, "_")
    const filename = `${employee_id}_${safeTx}_${file.name}`

    const uploaded = await uploadInvoiceToDrive({
      filename,
      mimeType: file.type || "application/octet-stream",
      bytes,
    })

    const { data, error } = await supabaseAdmin
      .from("expenses")
      .insert({
        employee_id,
        employee_name,
        sender_email,
        amount,
        currency,
        reimbursement_type,
        transaction_id,
        status: "pending",
        invoice_url: uploaded.webViewLink,
        google_drive_file_id: uploaded.id,
        request_reason,
        invoice_folder: "pending",
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, expense: data })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
