import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";

/* ======================================================
   NOTIFICATIONS
====================================================== */
async function createTimesheetExtractionNotification(
  employees: any[],
  extractedBy: string
) {
  try {
    const notificationsToInsert = employees.map((employee) => ({
      user_email: employee.email_id,
      type: "timesheet_extraction",
      title: "Timesheet Extraction Completed",
      message: `${extractedBy} has performed a timesheet extraction. Please check your reports for updates.`,
      timestamp: new Date().toISOString(),
      read: false,
      recipient_role: "employee",
      action_url: "/dashboard?tab=employee-reports",
    }));

    const { error } = await supabase
      .from("notifications")
      .insert(notificationsToInsert);

    if (error) {
      console.error("Notification insert error:", error);
    }
  } catch (err) {
    console.error("Notification creation failed:", err);
  }
}

/* ======================================================
   EXTRACTION PROGRESS HELPERS
====================================================== */
async function updateExtractionProgress(
  extractionId: string,
  updates: any
) {
  await supabase
    .from("extraction_progress")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("extraction_id", extractionId);
}

async function createExtractionProgress(
  userId: string,
  extractionId: string,
  searchMethod: string,
  extractedBy: string
) {
  await supabase.from("extraction_progress").insert({
    user_id: userId,
    extraction_id: extractionId,
    is_processing: true,
    progress: 5,
    message: "Starting extraction...",
    search_method: searchMethod,
    extracted_by: extractedBy,
  });
}

/* ======================================================
   POST — START EXTRACTION
====================================================== */
export async function POST(request: Request) {
  const extractionId = uuidv4();

  try {
    const {
      userId,
      sender_filter = "",
      start_date,
      end_date,
      extracted_by,
    } = await request.json();

    if (!userId || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    await createExtractionProgress(
      userId,
      extractionId,
      `${start_date} → ${end_date}`,
      extracted_by || "Manager"
    );

    const { data: gmailSettings } = await supabase
      .from("gmail_settings")
      .select("gmail_email, gmail_password")
      .eq("user_id", userId)
      .single();

    const { data: employees } = await supabase
      .from("employees")
      .select("*");

    const { data: projects } = await supabase
      .from("projects")
      .select("*");

    processTimesheetExtraction(
      gmailSettings,
      employees || [],
      projects || [],
      sender_filter,
      extractionId,
      start_date,
      end_date,
      extracted_by || "Manager"
    );

    return NextResponse.json({
      success: true,
      extractionId,
    });
  } catch (error: any) {
    await updateExtractionProgress(extractionId, {
      error: error.message,
      is_processing: false,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/* ======================================================
   BACKGROUND EXTRACTION
====================================================== */
async function processTimesheetExtraction(
  gmailSettings: any,
  employees: any[],
  projects: any[],
  sender_filter: string,
  extractionId: string,
  start_date: string,
  end_date: string,
  extractedBy: string
) {
  const scriptPath = path.join(process.cwd(), "scripts", "process_timesheets.py");
  const resultsPath = path.join(
    process.cwd(),
    "scripts",
    `timesheet_${extractionId}.json`
  );

  try {
    /* ----------------------------------
       1️⃣ EMPLOYEE → PROJECT MAP
    ---------------------------------- */
    const employeeProjectMap: Record<string, any> = {};

    employees.forEach((e) => {
      employeeProjectMap[e.email_id.toLowerCase()] = {
        name: e.name,
        employee_id: e.employee_id,
        projects: {},
      };
    });

    projects.forEach((p) => {
      const key = p.employee_email.toLowerCase();
      const clientKey = p.client
        .toLowerCase()
        .replace(" technology consulting llc", "")
        .trim();

      if (!employeeProjectMap[key]) return;

      employeeProjectMap[key].projects[clientKey] = {
        project: p.project,
        required_hours: p.hours || 8,
      };
    });

    /* ----------------------------------
       2️⃣ LOAD HOLIDAYS
    ---------------------------------- */
    const { data: holidays } = await supabase
      .from("holidays")
      .select("holiday_date");

    const holidaySet = new Set(
      (holidays || []).map((h) => h.holiday_date)
    );

    /* ----------------------------------
       3️⃣ LOAD APPROVED PTO
    ---------------------------------- */
    const { data: pto } = await supabase
      .from("pto_records")
      .select("employee_id, date")
      .eq("status", "approved");

    const ptoMap = new Map<string, Set<string>>();
    pto?.forEach((r) => {
      if (!ptoMap.has(r.employee_id)) {
        ptoMap.set(r.employee_id, new Set());
      }
      ptoMap.get(r.employee_id)!.add(r.date);
    });

    /* ----------------------------------
       4️⃣ RUN PYTHON SCRIPT
    ---------------------------------- */
    const pythonInput = {
      gmail_email: gmailSettings.gmail_email,
      gmail_password: gmailSettings.gmail_password,
      sender_filter,
      employee_mapping: employeeProjectMap,
      start_date,
      end_date,
      results_id: extractionId,
    };

    await runPython(scriptPath, pythonInput, resultsPath);

    const raw = JSON.parse(await fs.readFile(resultsPath, "utf8"));
    const extracted = raw.extracted_data || [];

    /* ----------------------------------
       5️⃣ ACTIVITY OVERRIDE LOGIC 🔥
    ---------------------------------- */
    const processedData = extracted.map((entry: any) => {
      const empId = entry.employee_id;
      const date = entry.date;

      let activity = "WORK";
      let requiredHours = entry.required_hours || 8;

      if (holidaySet.has(date)) {
        activity = "HOLIDAY";
        requiredHours = 8;
      } else if (ptoMap.get(empId)?.has(date)) {
        activity = "PTO";
        requiredHours = 8;
      }

      return {
        ...entry,
        activity,
        client: activity === "WORK" ? entry.client : "",
        project: activity === "WORK" ? entry.project : "",
        required_hours: requiredHours,
      };
    });

    /* ----------------------------------
       6️⃣ UPSERT TO DB
    ---------------------------------- */
    await supabase.from("timesheets").upsert(processedData, {
      onConflict: "date,employee_id,client,project",
    });

    await createTimesheetExtractionNotification(employees, extractedBy);

    await updateExtractionProgress(extractionId, {
      progress: 100,
      is_processing: false,
      message: "Extraction completed",
      total_entries: processedData.length,
      total_entries_processed: processedData.length,
      total_entries_inserted_into_db: processedData.length,
      new_extracted_entries: processedData,
      completed_at: new Date().toISOString(),
    });

    await fs.unlink(resultsPath);
  } catch (error: any) {
    await updateExtractionProgress(extractionId, {
      error: error.message,
      is_processing: false,
      completed_at: new Date().toISOString(),
    });
  }
}

/* ======================================================
   PYTHON RUNNER
====================================================== */
function runPython(
  scriptPath: string,
  input: any,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("python", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    p.stdin.write(JSON.stringify(input));
    p.stdin.end();

    p.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error("Python failed"));
    });
  });
}

/* ======================================================
   GET — EXTRACTION STATUS
====================================================== */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const extractionId = searchParams.get("extractionId");

  if (!userId) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  let query = supabase
    .from("extraction_progress")
    .select("*")
    .eq("user_id", userId);

  if (extractionId) {
    query = query.eq("extraction_id", extractionId);
  } else {
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data } = await query.single();

  return NextResponse.json({
    success: true,
    ...data,
  });
}
