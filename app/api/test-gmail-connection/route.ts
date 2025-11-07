import { NextResponse } from "next/server"
import { GmailTimesheetDetector } from "@/lib/gmailconnector"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 })
    }

    // Test connection
    const detector = new GmailTimesheetDetector(email, password)
    const connected = await detector.connect()

    if (connected) {
      await detector.disconnect()
      return NextResponse.json({
        success: true,
        message: "Gmail connection successful",
      })
    } else {
      return NextResponse.json({
        success: false,
        message: "Failed to connect to Gmail. Check credentials.",
      })
    }
  } catch (error) {
    console.error("Gmail connection error:", error)
    return NextResponse.json({
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    })
  }
}
