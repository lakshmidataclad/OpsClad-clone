import { NextResponse } from "next/server"
import { getValidAccessToken } from "@/lib/google-drive"
import { supabaseAdmin } from "@/lib/supabase-admin"


interface MoveInvoiceBody {
  fileId: string
  targetFolder: "Approved" | "Rejected"
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MoveInvoiceBody
    const { fileId, targetFolder } = body

    if (!fileId || !targetFolder) {
      return NextResponse.json(
        { success: false, error: "Missing fileId or targetFolder" },
        { status: 400 }
      )
    }

    // 1️⃣ Get valid Google Drive access token (auto-refresh safe)
    const accessToken = await getValidAccessToken()

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Google Drive not authenticated" },
        { status: 401 }
      )
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("google_drive_settings")
      .select("folder_id")
      .eq("id", 1)
      .single()

    if (settingsError || !settings?.folder_id) {
      return NextResponse.json(
        { success: false, error: "Expenses root folder not configured" },
        { status: 500 }
      )
    }

    const parentId = settings.folder_id.trim()

    // 2️⃣ Resolve target folder ID by name
    const q = [
      `'${parentId}' in parents`,
      `name='${targetFolder}'`,
      `mimeType='application/vnd.google-apps.folder'`,
      `trashed=false`,
    ].join(" and ")

    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const folderData = await folderRes.json()

    if (!folderRes.ok || !folderData.files?.length) {
      return NextResponse.json(
        { success: false, error: `Target folder '${targetFolder}' not found` },
        { status: 404 }
      )
    }

    const targetFolderId = folderData.files[0].id

    // 3️⃣ Get current parents of the file
    const parentsRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const parentsData = await parentsRes.json()

    if (!parentsRes.ok || !parentsData.parents?.length) {
      return NextResponse.json(
        { success: false, error: "Unable to determine current file parents" },
        { status: 400 }
      )
    }

    const previousParents = parentsData.parents.join(",")

    // 4️⃣ Move file to new folder
    const moveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${previousParents}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!moveRes.ok) {
      const errText = await moveRes.text()
      return NextResponse.json(
        { success: false, error: errText },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Move invoice error:", err)
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal error" },
      { status: 500 }
    )
  }
}
