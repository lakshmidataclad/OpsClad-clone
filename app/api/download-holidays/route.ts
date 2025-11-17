import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("holidays").select("*");

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const csvRows = [];
  csvRows.push("holiday,holiday_date,holiday_description");

  data.forEach((h) => {
    csvRows.push(
      `${h.holiday},${h.holiday_date},${h.holiday_description || ""}`
    );
  });

  const csv = csvRows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=holidays.csv`,
    },
  });
}
