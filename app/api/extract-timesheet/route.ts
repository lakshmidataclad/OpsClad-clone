import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";

// Helper function to create a notification for each individual employee
async function createTimesheetExtractionNotification(employees: any[], extractedBy: string) {
  try {
    const notificationsToInsert = employees.map(employee => ({
      user_email: employee.email_id,
      type: 'timesheet_extraction',
      title: 'Timesheet Extraction Completed',
      message: `${extractedBy} has performed a timesheet extraction. Please check your reports for updates.`,
      timestamp: new Date().toISOString(),
      read: false,
      recipient_role: 'employee',
      action_url: '/dashboard?tab=employee-reports'
    }));
    
    // Insert all notifications in a single batch operation
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notificationsToInsert);

    if (insertError) {
      console.error("Error creating notifications:", insertError);
    } else {
      console.log(`Created ${notificationsToInsert.length} notifications for timesheet extraction`);
    }
  } catch (error) {
    console.error("Failed to create timesheet extraction notifications:", error);
  }
}

// Helper function to update extraction progress in database
async function updateExtractionProgress(
  extractionId: string,
  updates: {
    is_processing?: boolean;
    progress?: number;
    message?: string;
    error?: string | null;
    total_entries?: number;
    total_entries_processed?: number;
    total_entries_inserted_into_db?: number;
    search_method?: string;
    new_extracted_entries?: any[];
    completed_at?: string | null;
    extracted_by?: string;
  }
) {
  try {
    const { error } = await supabase
      .from("extraction_progress")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("extraction_id", extractionId);

    if (error) {
      console.error("Error updating extraction progress:", error);
    }
  } catch (error) {
    console.error("Failed to update extraction progress:", error);
  }
}

// Helper function to create initial extraction progress record
async function createExtractionProgress(userId: string, extractionId: string, searchMethod: string, extractedBy: string) {
  try {
    const { error } = await supabase
      .from("extraction_progress")
      .insert({
        user_id: userId,
        extraction_id: extractionId,
        is_processing: true,
        progress: 5,
        message: "Starting extraction...",
        search_method: searchMethod,
        error: null,
        extracted_by: extractedBy
      });

    if (error) {
      console.error("Error creating extraction progress:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to create extraction progress:", error);
    return false;
  }
}

// POST handler
export async function POST(request: Request) {
  const extractionId = uuidv4();

  try {
    const {
      userId,
      sender_filter = "",
      start_date, // start_date is now mandatory
      end_date, // end_date is now mandatory
      extracted_by // Add this to know who performed the extraction
    } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user already has an active extraction
    const { data: activeExtractions, error: checkError } = await supabase
      .from("extraction_progress")
      .select("extraction_id")
      .eq("user_id", userId)
      .eq("is_processing", true)
      .limit(1);

    if (checkError) {
      console.error("Error checking active extractions:", checkError);
    } else if (activeExtractions && activeExtractions.length > 0) {
      return NextResponse.json(
        { success: false, message: "An extraction is already in progress. Please wait." },
        { status: 400 }
      );
    }

    // Validate date range (now always required)
    if (!start_date || !end_date) {
      return NextResponse.json(
        { success: false, message: "Start date and end date are required." },
        { status: 400 }
      );
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const now = new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid date format provided" },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, message: "Start date must be before or equal to end date" },
        { status: 400 }
      );
    }

    if (startDate > now) {
      return NextResponse.json(
        { success: false, message: "Start date cannot be in the future" },
        { status: 400 }
      );
    }

    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return NextResponse.json(
        { success: false, message: "Date range cannot exceed 90 days" },
        { status: 400 }
      );
    }

    // Get Gmail credentials
    const { data: gmailSettings, error: gmailError } = await supabase
      .from("gmail_settings")
      .select("gmail_email, gmail_password")
      .eq("user_id", userId)
      .single();

    if (gmailError || !gmailSettings) {
      return NextResponse.json(
        { success: false, message: "Gmail credentials not found. Please connect Gmail first." },
        { status: 400 }
      );
    }

    // Get employee data from employees table
    const { data: employees, error: employeeError } = await supabase
      .from("employees")
      .select("*");

    if (employeeError || !employees || employees.length === 0) {
      return NextResponse.json(
        { success: false, message: "Employee data not found. Please upload employee CSV first." },
        { status: 400 }
      );
    }

    // Get project data from projects table - including hours column
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("*");

    if (projectError || !projects || projects.length === 0) {
      return NextResponse.json(
        { success: false, message: "Project data not found. Please upload project CSV first." },
        { status: 400 }
      );
    }

    // Search method is now always date range
    const searchMethod = `Date range: ${start_date} to ${end_date}`;

    // Create initial progress record
    const progressCreated = await createExtractionProgress(userId, extractionId, searchMethod, extracted_by || 'Manager');
    if (!progressCreated) {
      return NextResponse.json(
        { success: false, message: "Failed to initialize extraction tracking" },
        { status: 500 }
      );
    }

    // Trigger background process (don't await - run in background)
    processTimesheetExtraction(
      gmailSettings,
      employees,
      projects,
      sender_filter,
      extractionId,
      start_date,
      end_date,
      extracted_by || 'Manager'
    ).catch((error) => {
      console.error("Background process error (unhandled promise rejection):", error);
      // Update database with error
      updateExtractionProgress(extractionId, {
        error: `Background process failed: ${error.message || "Unknown error"}`,
        is_processing: false,
        progress: 0,
        completed_at: new Date().toISOString()
      });
    });

    return NextResponse.json({
      success: true,
      message: "Extraction started successfully",
      extractionId // Return the extraction ID for tracking
    });

  } catch (error) {
    console.error("POST extraction error:", error);
    // If we have an extractionId, update the database with the error
    if (extractionId) {
      await updateExtractionProgress(extractionId, {
        error: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        is_processing: false,
        progress: 0,
        completed_at: new Date().toISOString()
      });
    }
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

// Background timesheet processing
async function processTimesheetExtraction(
  gmailSettings: any,
  employees: any[],
  projects: any[],
  sender_filter: string,
  extractionId: string,
  start_date: string, // Now mandatory
  end_date: string, // Now mandatory
  extractedBy: string
) {
  const scriptDir = path.join(process.cwd(), "scripts");
  const resultsFileName = `timesheet_results_${extractionId}.json`;
  const resultsFilePath = path.join(scriptDir, resultsFileName);
  let cleanupAttempted = false;

  try {
    await updateExtractionProgress(extractionId, {
      progress: 15,
      message: "Preparing employee mapping..."
    });
    await new Promise((res) => setTimeout(res, 500));

    const employeeProjectMap: Record<string, any> = {};

    employees.forEach((emp) => {
      const emailKey = emp.email_id.toLowerCase();
      if (!employeeProjectMap[emailKey]) {
        employeeProjectMap[emailKey] = {
          name: emp.name,
          employee_id: emp.employee_id,
          projects: {}
        };
      }
    });

    // Build project mapping with required hours
    projects.forEach((proj) => {
      const emailKey = proj.employee_email.toLowerCase();
      const normalizedClient = proj.client.toLowerCase().replace(" technology consulting llc", "").trim();

      if (employeeProjectMap[emailKey]) {
        const projectInfo = employeeProjectMap[emailKey].projects[normalizedClient];
        if (projectInfo) {
          // Project already exists, use existing project name from the projects table
          employeeProjectMap[emailKey].projects[normalizedClient] = {
            project: projectInfo.project,
            required_hours: proj.hours || 0
          };
        } else {
          // Add new project
          employeeProjectMap[emailKey].projects[normalizedClient] = {
            project: proj.project,
            required_hours: proj.hours || 0
          };
        }
      } else {
        console.warn(`Employee ${proj.employee_email} found in projects but not in employees table`);
        employeeProjectMap[emailKey] = {
          name: proj.employee_name,
          employee_id: proj.employee_id,
          projects: {
            [normalizedClient]: {
              project: proj.project,
              required_hours: proj.hours || 0
            }
          }
        };
      }
    });

    await updateExtractionProgress(extractionId, { progress: 25 });

    await updateExtractionProgress(extractionId, {
      message: `Connecting to Gmail (${start_date} to ${end_date})...`
    });
    await new Promise((res) => setTimeout(res, 500));

    const pythonInput = {
      gmail_email: gmailSettings.gmail_email,
      gmail_password: gmailSettings.gmail_password,
      sender_filter: sender_filter || undefined,
      employee_mapping: employeeProjectMap,
      results_id: extractionId,
      start_date: start_date, // Always use start_date
      end_date: end_date, // Always use end_date
    };

    await updateExtractionProgress(extractionId, {
      progress: 30,
      message: "Processing emails and attachments..."
    });

    const pythonResults = await executePythonScript(extractionId, pythonInput, resultsFilePath);

    if (!pythonResults.success) {
      await updateExtractionProgress(extractionId, {
        error: pythonResults.message || "Python extraction failed",
        is_processing: false,
        progress: 0,
        completed_at: new Date().toISOString()
      });
      return;
    }

    await updateExtractionProgress(extractionId, {
      progress: 80,
      message: "Analyzing extracted data..."
    });
    await new Promise((res) => setTimeout(res, 500));

    const extractedData = pythonResults.extracted_data || [];
    console.log(`Python extraction completed with ${extractedData.length} entries`);

    if (extractedData.length === 0) {
      await updateExtractionProgress(extractionId, {
        progress: 100,
        message: "Extraction completed - no timesheet entries found",
        total_entries: 0,
        total_entries_processed: 0,
        total_entries_inserted_into_db: 0,
        new_extracted_entries: [],
        is_processing: false,
        completed_at: new Date().toISOString()
      });
      return;
    }


    // Fetch holidays
    const { data: holidays } = await supabase
      .from("holidays")
      .select("holiday_date");

    // Fetch approved PTO requests
    const { data: ptoRequests } = await supabase
      .from("pto_requests")
      .select("employee_id, start_date, end_date, status")
      .eq("status", "approved");




    // Process extracted data to ensure proper structure
    const processedData = extractedData.map((entry: any) => {
      const emailKey = entry.sender_email?.toLowerCase();
      const normalizedClient = entry.client?.toLowerCase().replace(" technology consulting llc", "").trim();

      // Get project info from mapping
      let projectName = entry.project || "";
      let requiredHours = 0;

      if (employeeProjectMap[emailKey] && employeeProjectMap[emailKey].projects[normalizedClient]) {
        const projectInfo = employeeProjectMap[emailKey].projects[normalizedClient];
        projectName = projectInfo.project;
        requiredHours = projectInfo.required_hours || 0;
      }
      const entryDate = new Date(entry.date);

      // 🔹 HOLIDAY check
      const isHoliday = holidays?.some(
        h => new Date(h.holiday_date).toDateString() === entryDate.toDateString()
      );

      // 🔹 PTO check
      const isPTO = ptoRequests?.some(p =>
        p.employee_id === entry.employee_id &&
        entryDate >= new Date(p.start_date) &&
        entryDate <= new Date(p.end_date)
      );

      return {
        ...entry,
        project: projectName,
        required_hours: requiredHours,
        activity: isHoliday ? "HOLIDAY" : isPTO ? "PTO" : entry.activity
      };
    });

    await updateExtractionProgress(extractionId, {
      progress: 95,
      message: `Saving ${processedData.length} entries to database...`
    });
    await new Promise((res) => setTimeout(res, 300));

    // Insert data using upsert - PostgreSQL will handle duplicates automatically
    const { error: insertError, data: insertedData } = await supabase
      .from("timesheets")
      .upsert(processedData, {
        onConflict: 'date,sender_email,project,client',
        ignoreDuplicates: false
      })
      .select();

    if (insertError) {
      console.error("Database insert error:", insertError);
      await updateExtractionProgress(extractionId, {
        error: `Database error: ${insertError.message}`,
        is_processing: false,
        completed_at: new Date().toISOString()
      });
      return;
    }

    const insertedCount = insertedData?.length || 0;
    console.log(`Successfully processed ${insertedCount} timesheet entries (includes updates to existing entries)`);

    // Create notifications for employees AFTER successful extraction
    await createTimesheetExtractionNotification(employees, extractedBy);

    // Final completion update
    await updateExtractionProgress(extractionId, {
      progress: 100,
      message: `Extraction completed successfully`,
      total_entries: processedData.length,
      total_entries_processed: processedData.length,
      total_entries_inserted_into_db: insertedCount,
      new_extracted_entries: processedData, // Return all processed data
      is_processing: false,
      completed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("Background processing error:", error);
    await updateExtractionProgress(extractionId, {
      error: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      is_processing: false,
      progress: 0,
      completed_at: new Date().toISOString()
    });
  } finally {
    if (!cleanupAttempted) {
      cleanupAttempted = true;
      try {
        await fs.unlink(resultsFilePath);
        console.log(`Cleaned up results file: ${resultsFilePath}`);
      } catch (cleanupError: any) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Cleanup failed:", cleanupError);
        }
      }
    }
  }
}

// Run the Python script with progress updates
function executePythonScript(extractionId: string, inputData: any, expectedResultsFilePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const progressInterval = setInterval(async () => {
      // Get current progress from database to avoid conflicts
      const { data: currentProgress } = await supabase
        .from("extraction_progress")
        .select("progress, is_processing")
        .eq("extraction_id", extractionId)
        .single();

      if (currentProgress?.is_processing && (currentProgress.progress || 0) < 75) {
        const newProgress = Math.min((currentProgress.progress || 30) + 3, 75);
        let message = "Processing email attachments...";

        if (newProgress < 50) {
          message = "Processing email attachments...";
        } else if (newProgress < 70) {
          message = "Extracting timesheet data...";
        } else {
          message = "Finalizing extraction...";
        }

        await updateExtractionProgress(extractionId, {
          progress: newProgress,
          message
        });
      }
    }, 2000);

    try {
      const scriptPath = path.join(process.cwd(), "scripts", "process_timesheets.py");
      const pythonPath = "python";

      const pythonProcess = spawn(pythonPath, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 300000 // 5 minute timeout
      });

      let stderrBuffer = "";
      let stdoutBuffer = "";

      pythonProcess.stdin.write(JSON.stringify(inputData));
      pythonProcess.stdin.end();

      pythonProcess.stdout.on("data", (data) => {
        stdoutBuffer += data.toString();
        console.log("Python stdout:", data.toString().trim());
      });

      pythonProcess.stderr.on("data", (data) => {
        stderrBuffer += data.toString();
        console.error("Python stderr:", data.toString().trim());
      });

      pythonProcess.on("close", async (code) => {
        clearInterval(progressInterval);
        console.log(`Python script exited with code: ${code}`);

        try {
          const fileContent = await fs.readFile(expectedResultsFilePath, "utf-8");
          const results = JSON.parse(fileContent);

          if (results.success || results.extracted_data) {
            resolve(results);
          } else {
            resolve({
              success: false,
              message: results.message || `Python process failed with code ${code}`,
              errors: [stderrBuffer],
            });
          }
        } catch (fileError: any) {
          console.error("Error reading results file:", fileError);
          resolve({
            success: false,
            message: `Python process completed but results file couldn't be read. Exit code: ${code}`,
            errors: [stderrBuffer, fileError.message],
          });
        }
      });

      pythonProcess.on("error", (error) => {
        clearInterval(progressInterval);
        console.error("Python process error:", error);
        resolve({
          success: false,
          message: `Failed to execute Python script: ${error.message}`,
          errors: [error.message, stderrBuffer],
        });
      });

      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill();
          clearInterval(progressInterval);
          resolve({
            success: false,
            message: "Python script execution timed out after 5 minutes",
            errors: ["Timeout", stderrBuffer],
          });
        }
      }, 300000);

    } catch (error) {
      clearInterval(progressInterval);
      reject(error);
    }
  });
}

// GET handler - Returns current extraction progress for the user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const extractionId = searchParams.get('extractionId');

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // If extractionId is provided, get specific extraction
    // Otherwise, get the most recent extraction for the user
    let query = supabase
      .from("extraction_progress")
      .select("*")
      .eq("user_id", userId);

    if (extractionId) {
      query = query.eq("extraction_id", extractionId);
    } else {
      query = query.order("created_at", { ascending: false }).limit(1);
    }

    const { data: progressData, error } = await query.single();

    if (error || !progressData) {
      return NextResponse.json({
        success: false,
        is_processing: false,
        progress: 0,
        message: "No extraction found",
        error: null,
        data: []
      });
    }

    const response = {
      success: !progressData.error && (progressData.is_processing || progressData.new_extracted_entries?.length > 0),
      is_processing: progressData.is_processing,
      progress: progressData.progress,
      message: progressData.message,
      error: progressData.error,
      data: progressData.new_extracted_entries || [],
      status: {
        result: {
          total_entries: progressData.total_entries || 0,
          total_entries_processed: progressData.total_entries_processed || 0,
          total_entries_inserted_into_db: progressData.total_entries_inserted_into_db || 0,
          search_method: progressData.search_method || "",
          new_extracted_entries: progressData.new_extracted_entries || []
        }
      },
      extractionId: progressData.extraction_id
    };

    console.log('GET /api/extract-timesheet response:', {
      is_processing: response.is_processing,
      progress: response.progress,
      message: response.message,
      success: response.success,
      dataLength: response.data.length,
      error: response.error,
      extractionId: response.extractionId
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error("GET extraction status error:", error);
    return NextResponse.json(
      {
        success: false,
        is_processing: false,
        progress: 0,
        message: "Failed to fetch extraction status",
        error: "Internal server error",
        data: []
      },
      { status: 500 }
    );
  }
}