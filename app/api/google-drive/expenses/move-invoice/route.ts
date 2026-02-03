import { NextResponse } from "next/server"
import { getValidAccessToken } from "@/lib/google-drive"

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

    // 2️⃣ Resolve target folder ID by name
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${targetFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
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
