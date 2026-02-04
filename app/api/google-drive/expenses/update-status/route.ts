import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { moveInvoiceFile } from "@/lib/google-drive"

/*
  Expected body:
  {
    expenseId: string,
    status: "approved" | "rejected"
  }
*/

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { expenseId, status } = body

    if (!expenseId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid expenseId or status" },
        { status: 400 }
      )
    }

    /* --------------------------------------------------
       1️⃣ Fetch expense (to get Drive file ID)
    --------------------------------------------------- */
    const { data: expense, error: fetchError } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .single()

    if (fetchError || !expense) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      )
    }

    /* --------------------------------------------------
       2️⃣ Update DB status + folder
    --------------------------------------------------- */
    const folderName = status === "approved" ? "Approved" : "Rejected"

    const { error: updateError } = await supabaseAdmin
    .from("expenses")
    .update({
      status,
      invoice_folder: folderName,
      approved_at: new Date().toISOString(),
      approved_by: "manager", // or req user email if available
    })
    .eq("id", expenseId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    /* --------------------------------------------------
       3️⃣ Move Google Drive file (if exists)
    --------------------------------------------------- */
    if (expense.google_drive_file_id) {
      await moveInvoiceFile(
        expense.google_drive_file_id,
        folderName
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Update expense status error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    )
  }
}
