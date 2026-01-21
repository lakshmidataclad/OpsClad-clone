import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  // 1. Get current user from Supabase auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Get profile using user_id (NOT id)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("employee_id, user_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  // 3. Fetch timesheet data using employee_id
  const { data: timesheetData, error: timesheetError } = await supabase
    .from("timesheets")
    .select("*")
    .eq("employee_id", profile.employee_id)

  if (timesheetError) {
    return NextResponse.json({ error: timesheetError.message }, { status: 500 })
  }

  // 4. Fetch PTO records for the same employee
  const { data: ptoData, error: ptoError } = await supabase
    .from("pto_records")
    .select("*")
    .eq("employee_id", profile.employee_id)

  // Don't fail if PTO data is unavailable, just log the error
  if (ptoError) {
    console.error("PTO data error:", ptoError)
  }

  // 5. Transform PTO data to match timesheet structure
  const transformedPtoData = (ptoData || []).map(pto => ({
    id: pto.id,
    employee_id: pto.employee_id,
    employee_name: pto.employee_name,
    sender_email: pto.sender_email,
    date: pto.date,
    day: pto.day,
    hours: pto.hours,
    activity: "PTO", // Set activity as "PTO"
    client: "", // Leave client blank
    project: "", // Leave project blank
    required_hours: 8, // Standard workday
    created_at: pto.created_at,
    updated_at: pto.updated_at
  }))






  //Fetch Holidays (holiday_date only)
  const { data: holidays, error: holidayError } = await supabase
    .from("holidays")
    .select("*")

  if (holidayError) console.error("Holiday data error:", holidayError)

  //Transform holidays → Auto PTO entries
  const transformedHolidayData = (holidays || []).map(h => ({
    id: `HOLIDAY-${h.holiday}-${h.holiday_date}`,
    employee_id: profile.employee_id,
    employee_name: "", // or fetch from profile if needed
    sender_email: user.email,
    date: h.holiday_date,
    day: new Date(h.holiday_date).toLocaleDateString("en-US", { weekday: "long" }),
    hours: 8,
    activity: `Holiday – ${h.holiday}`,
    client: "",
    project: "",
    required_hours: 8,
    created_at: h.created_at,
    updated_at: h.updated_at,
    holiday_description: h.holiday_description,
  }))








  // 6. Combine timesheet and PTO data
  const combinedData = [
    ...(timesheetData || []),
    ...transformedPtoData,
    //holiday data
    ...transformedHolidayData

  ]
  

  // 7. Sort by date (most recent first)
  combinedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 8. Return user, profile, and combined data
  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      employee_id: profile.employee_id,
    },
    data: combinedData,
  })
}