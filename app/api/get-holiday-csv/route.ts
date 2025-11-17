// pages/api/get-csv-content/route.ts
// This API route fetches all employee and project data from Supabase
// and combines it into a single response.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    // 1. Fetch all holiday records
    // We select all columns from the holidays table.
    const { data: holidays, error: holidaysError } = await supabase
      .from("holidays")
      .select("*");

    if (holidaysError) {
      console.error("Error fetching holidays:", holidaysError);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch holiday data." 
      }, { status: 500 });
    }
    // 2. Return the final structured data
    return NextResponse.json({
      success: true,
      data: holidays,
    });
  } catch (error) {
    console.error("Unexpected error in get-csv-content API:", error);
    return NextResponse.json({ 
      success: false, 
      message: "An unexpected error occurred." 
    }, { status: 500 });
  }
}