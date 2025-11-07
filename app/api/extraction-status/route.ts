import { NextResponse } from "next/server"

// This should be imported from a shared location in a real app
// For simplicity, we're duplicating it here
const processingStatus = {
  is_processing: false,
  progress: 0,
  message: "",
  error: null,
  result: null,
}

export async function GET() {
  return NextResponse.json(processingStatus)
}
