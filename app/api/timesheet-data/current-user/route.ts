import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Fetch profile to get employee_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("employee_id, user_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  // 3. Fetch ONLY timesheet data
  const { data: timesheetData, error: timesheetError } = await supabase
    .from("timesheets")
    .select("*")
    .eq("employee_id", profile.employee_id)

  if (timesheetError) {
    return NextResponse.json(
      { error: timesheetError.message },
      { status: 500 }
    )
  }

  // 4. Sort by date (latest first)
  const sortedData = (timesheetData || []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // 5. Return response
  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      employee_id: profile.employee_id,
    },
    data: sortedData,
  })
}
