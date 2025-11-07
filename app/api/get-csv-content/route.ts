// pages/api/get-csv-content/route.ts
// This API route fetches all employee and project data from Supabase
// and combines it into a single response.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    // 1. Fetch all employee records
    // We select all columns from the employees table.
    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("*");

    if (employeesError) {
      console.error("Error fetching employees:", employeesError);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch employee data." 
      }, { status: 500 });
    }

    // 2. Fetch all project records
    // We select all columns from the projects table.
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("*");

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch project data." 
      }, { status: 500 });
    }

    // 3. Combine the data
    // We create a map to efficiently group projects by employee_id.
    const combinedData = employees.map(employee => {
      // Find all projects associated with the current employee's ID.
      const employeeProjects = projects.filter(
        project => project.employee_id === employee.employee_id
      );

      // Return a new object that includes all employee details
      // and a nested 'projects' array.
      return {
        ...employee,
        projects: employeeProjects,
      };
    });

    // 4. Return the final structured data
    return NextResponse.json({
      success: true,
      data: combinedData,
    });
  } catch (error) {
    console.error("Unexpected error in get-csv-content API:", error);
    return NextResponse.json({ 
      success: false, 
      message: "An unexpected error occurred." 
    }, { status: 500 });
  }
}