//import nextresponse and supabase client
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"


//start a get handler
export async function GET() {
  try {

    // Check if employee data exists in Supabase
    const { data, error, count } = await supabase
    // fetch 1 row of data from the employee table
      .from("employees")
      .select("*", { count: "exact" })
      // limit to 1 row to know if data exist
      .limit(1)


    //handle any supabase error
    if (error) {
      return NextResponse.json({ uploaded: false, message: error.message }, { status: 500 })
    }

    // if table is empty no upload of CSV
    if (!data || data.length === 0) {
      return NextResponse.json({ uploaded: false })
    }


    // to know what columns exist
    const { data: columnData } = await supabase
      .from("employees")
      .select("*")
      .limit(1)

    
    const columns =
      columnData && columnData.length > 0
        ? Object.keys(columnData[0]).filter((col) => !["id", "created_at"].includes(col))
        : []

    return NextResponse.json({
      uploaded: true,
      record_count: count || 0,
      columns: columns,
    })
  } catch (error) {
    console.error("CSV status error:", error)
    return NextResponse.json({ uploaded: false })
  }
}
