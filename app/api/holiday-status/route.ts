import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error, count } = await supabase
    .from("holidays")
    .select("*", { count: "exact" })
    .limit(1);

  return NextResponse.json({
    uploaded: !!data?.length,
    record_count: count || 0,
  });
}