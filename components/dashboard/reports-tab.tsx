"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { TimesheetEntry, FilterOptions, SummaryStats } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, BarChart2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ReportsTab() {
  const [combinedData, setCombinedData] = useState<TimesheetEntry[]>([])
  const [filteredData, setFilteredData] = useState<TimesheetEntry[]>([])
  const [showFilteredResults, setShowFilteredResults] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null)
  const [showMonthlyReport, setShowMonthlyReport] = useState(false)
  const [employeeReports, setEmployeeReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()



  
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [comparisonResults, setComparisonResults] = useState<any[]>([])
  const [isComparing, setIsComparing] = useState(false)



  const runPdfComparison = async () => {
  if (!filters.dateFrom || !filters.dateTo || pdfFiles.length === 0) {
    toast({
      title: "Missing input",
      description: "Select date range and upload PDFs",
      variant: "destructive",
    })
    return
  }

  setIsComparing(true)

  const form = new FormData()
  form.append("dateFrom", filters.dateFrom)
  form.append("dateTo", filters.dateTo)
  pdfFiles.forEach(f => form.append("files", f))

  const res = await fetch("/api/reports/compare", {
    method: "POST",
    body: form,
  })

  const data = await res.json()

  const { compareTimesheets } = await import("@/lib/compare-timesheets")
  const results = compareTimesheets(data.pdfEntries, data.dbEntries)

  setComparisonResults(results)
  setIsComparing(false)
}




  const [filters, setFilters] = useState<FilterOptions>({
    employee: "",
    client: "",
    project: "",
    dateFrom: "",
    dateTo: "",
  })

  const normalizeToISO = (dateStr: string) => {
    if (!dateStr) return ""
    if (dateStr.includes("/")) {
      const [m, d, y] = dateStr.split("/")
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    }
    if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
      return dateStr // already YYYY-MM-DD
    }
    // DD-MM-YYYY → YYYY-MM-DD
    const [d, m, y] = dateStr.split("-")
    return `${y}-${m}-${d}`
  }

  const formatForDisplay = (isoDate: string) => {
    if (!isoDate) return ""
    const [y, m, d] = isoDate.split("-")
    return `${d}-${m}-${y}`
  }

  // Load combined timesheet and PTO data on component mount
  useEffect(() => {
    loadCombinedData()
  }, [])

  const loadCombinedData = async () => {
    setIsLoading(true)
    try {
      // 1️⃣ Fetch ALL timesheets (PTO included)
      const { data: timesheetData, error: timesheetError } = await supabase
        .from("timesheets")
        .select("*")

      if (timesheetError) {
        console.error("Timesheet data error:", timesheetError)
      }

      // 2️⃣ Fetch PTO records (fallback only)
      const { data: ptoData, error: ptoError } = await supabase
        .from("pto_records")
        .select("*")
        .eq("is_pto", true)

      if (ptoError) {
        console.error("PTO data error:", ptoError)
      }

      // 3️⃣ Transform PTO records into timesheet-like rows
      const transformedPtoData = (ptoData || []).map(pto => ({
        id: pto.id,
        employee_id: pto.employee_id,
        employee_name: pto.employee_name,
        sender_email: pto.sender_email,
        date: pto.date,
        day: pto.day,
        hours: pto.hours,
        activity: "PTO",
        client: "",
        project: "",
        required_hours: "",
        created_at: pto.created_at,
        updated_at: pto.updated_at,
      }))

      // 4️⃣ Build lookup for existing timesheets (employee + date)
      const timesheetKeySet = new Set(
        (timesheetData || []).map(
          t => `${t.employee_id}_${normalizeToISO(t.date)}`
        )
      )

      // 5️⃣ Only include PTO records if NO timesheet exists for same employee + date
      const filteredPtoData = transformedPtoData.filter(
        pto =>
          !timesheetKeySet.has(
            `${pto.employee_id}_${normalizeToISO(pto.date)}`
          )
      )

      // 6️⃣ Combine (timesheets always win)
      const combined = [
        ...(timesheetData || []).map(t => ({
          ...t,
          date: formatForDisplay(normalizeToISO(t.date)),
          _isoDate: normalizeToISO(t.date), // internal use
        })),
        ...filteredPtoData.map(p => ({
          ...p,
          date: formatForDisplay(normalizeToISO(p.date)),
          _isoDate: normalizeToISO(p.date),
        })),
      ]

      // 7️⃣ Sort by date (latest first)
      combined.sort(
        (a, b) =>
          new Date(normalizeToISO(b.date)).getTime() -
          new Date(normalizeToISO(a.date)).getTime()
      )

      setCombinedData(combined)

      if (combined.length === 0) {
        toast({
          title: "No Data Found",
          description: "No timesheet or PTO entries found in the system.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Data loading error",
        description: "An error occurred while loading timesheet data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Get unique values for filters (exclude empty values from PTO records)
  const employees = [...new Set(combinedData.map((item) => item.employee_name).filter(Boolean))]
  const clients = [...new Set(combinedData
    .map((item) => item.client)
    .filter(Boolean))] // This will exclude empty strings and null values
  const projects = [...new Set(combinedData
    .map((item) => item.project)
    .filter(Boolean))] // This will exclude empty strings and null values

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    if (combinedData.length === 0) {
      toast({
        title: "No data available",
        description: "There is no timesheet or PTO data to filter.",
        variant: "destructive",
      })
      return
    }

    const filtered = combinedData.filter((item) => {
      // Employee filter
      if (filters.employee && filters.employee !== "all" && item.employee_name !== filters.employee) {
        return false
      }

      // Client filter - for PTO records, client is empty, so only filter non-PTO entries
      if (filters.client && filters.client !== "all") {
        if (item.activity === "PTO") {
          // Include PTO records when filtering by client (they should show up in all client filters)
          return true
        } else if (item.client !== filters.client) {
          return false
        }
      }

      // Project filter - for PTO records, project is empty, so only filter non-PTO entries
      if (filters.project && filters.project !== "all") {
        if (item.activity === "PTO") {
          // Include PTO records when filtering by project (they should show up in all project filters)
          return true
        } else if (item.project !== filters.project) {
          return false
        }
      }

      // Date filters
      if (filters.dateFrom || filters.dateTo) {
      const itemDate = new Date(normalizeToISO(item.date))
        if (filters.dateFrom && itemDate < new Date(filters.dateFrom)) {
          return false
        }
        if (filters.dateTo && itemDate > new Date(filters.dateTo)) {
          return false
        }
      }

      return true
    })

    setFilteredData(filtered)
    setShowFilteredResults(true)

    if (filtered.length > 0) {
      updateSummaryStats(filtered)
      setShowSummary(true)

      toast({
        title: "Filters applied",
        description: `Found ${filtered.length} entries matching your filters.`,
      })
    } else {
      setShowSummary(false)
      toast({
        title: "No matching data",
        description: "No entries match your filter criteria.",
        variant: "destructive",
      })
    }
  }

  const clearFilters = () => {
    setFilters({
      employee: "",
      client: "",
      project: "",
      dateFrom: "",
      dateTo: "",
    })

    setShowFilteredResults(false)
    setShowSummary(false)
    setFilteredData([])

    toast({
      title: "Filters cleared",
      description: "All filters have been reset.",
    })
  }

  const generateReport = () => {
    applyFilters()
  }

  const updateSummaryStats = (data: TimesheetEntry[]) => {
    // Calculate summary statistics
    const totalHours = data.reduce((sum, item) => sum + item.hours, 0)

    const totalPTOandHolidayHours = data
      .filter(item =>
        item.activity === "PTO" ||
        item.activity === "Holiday"
      )
      .reduce((sum, item) => sum + item.hours, 0)

    const uniqueEmployees = new Set(data.map((item) => item.employee_name).filter(Boolean))
    
    // For clients and projects, only count non-empty values (excludes PTO records)
    const uniqueClients = new Set(data.map((item) => item.client).filter(Boolean))
    const uniqueProjects = new Set(data.map((item) => item.project).filter(Boolean))

    const dates = data
      .map((item) => item._isoDate)
      .filter(Boolean)
      .map((d) => new Date(d))   

    const uniqueDates = new Set(dates.map((date) => date.toDateString()))
    const avgHoursPerDay = uniqueDates.size > 0 ? totalHours / uniqueDates.size : 0

    const minDate =
      dates.length > 0
        ? new Date(Math.min(...dates.map(d => d.getTime())))
            .toLocaleDateString("en-GB")
        : "-"

    const maxDate =
      dates.length > 0
        ? new Date(Math.max(...dates.map(d => d.getTime())))
            .toLocaleDateString("en-GB")
        : "-"

    const dateRange =
      minDate !== "-" && maxDate !== "-" ? `${minDate} - ${maxDate}` : "-"

    setSummaryStats({
      totalHours,
      totalPTOandHolidayHours: totalPTOandHolidayHours,
      totalEmployees: uniqueEmployees.size,
      totalClients: uniqueClients.size,
      totalProjects: uniqueProjects.size,
      avgHoursPerDay,
      dateRange,
    })
  }

  const generateMonthlyReport = () => {
    const monthInput = document.getElementById("report-month") as HTMLInputElement
    const selectedMonth = monthInput.value

    if (!selectedMonth) {
      toast({
        title: "Month required",
        description: "Please select a month for the report.",
        variant: "destructive",
      })
      return
    }

    if (combinedData.length === 0) {
      toast({
        title: "No data available",
        description: "There is no timesheet or PTO data available for monthly report.",
        variant: "destructive",
      })
      return
    }

    const [year, month] = selectedMonth.split("-")
    const monthlyData = combinedData.filter((item) => {
      const itemDate = new Date(item.date)
      return itemDate.getFullYear() == Number(year) && itemDate.getMonth() + 1 == Number(month)
    })

    if (monthlyData.length === 0) {
      toast({
        title: "No data found",
        description: "No data found for the selected month.",
        variant: "destructive",
      })
      return
    }

    // Group data by employee
    const employeeData: Record<string, any> = {}
    monthlyData.forEach((item) => {
      const employeeKey = item.employee_name || item.sender_email
      if (!employeeKey) return

      if (!employeeData[employeeKey]) {
        employeeData[employeeKey] = {
          name: employeeKey,
          email: item.sender_email,
          entries: [],
          totalHours: 0,
          clients: new Set(),
          projects: new Set(),
        }
      }

      employeeData[employeeKey].entries.push(item)
      employeeData[employeeKey].totalHours += item.hours
      if (item.client) employeeData[employeeKey].clients.add(item.client)
      if (item.project) employeeData[employeeKey].projects.add(item.project)
    })

    setEmployeeReports(Object.values(employeeData))
    setShowMonthlyReport(true)

    toast({
      title: "Monthly report generated",
      description: `Report generated for ${Object.keys(employeeData).length} employees.`,
    })
  }

  const downloadFilteredCSV = () => {
    if (filteredData.length === 0) return

    const headers = ["Employee ID", "Employee Name", "Client", "Project", "Date", "Day", "Activity", "Hours", "Required Hours"]
    let csvContent = headers.join(",") + "\n"

    filteredData.forEach((entry) => {
      const row = [
        entry.employee_id || "",
        entry.employee_name || "",
        entry.client || "",
        entry.project || "",
        entry.date || "",
        entry.day || "",
        entry.activity || "",
        entry.hours !== undefined ? entry.hours : "",
        entry.required_hours !== undefined ? entry.required_hours : "",
      ]
      csvContent += row.map((field) => `"${field}"`).join(",") + "\n"
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    // Construct the dynamic filename based on applied filters
    const filenameParts = ["Timesheet_Report"];
    if (filters.employee && filters.employee !== "all") {
        filenameParts.push(`${filters.employee}`);
    }
    if (filters.client && filters.client !== "all") {
        filenameParts.push(`${filters.client}`);
    }
    if (filters.project && filters.project !== "all") {
        filenameParts.push(`${filters.project}`);
    }
    if (filters.dateFrom && filters.dateTo) {
        filenameParts.push(`${filters.dateFrom}_to_${filters.dateTo}`);
    } else if (filters.dateFrom) {
        filenameParts.push(`From_${filters.dateFrom}`);
    } else if (filters.dateTo) {
        filenameParts.push(`To_${filters.dateTo}`);
    }

    const filename = `${filenameParts.join('_')}.csv`;

    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-white">Loading timesheet and PTO data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle className="text-white">Timesheet Reports & Analytics</CardTitle>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="employee-filter" className="text-white">Filter by Employee</Label>
          <Select value={filters.employee} onValueChange={(value) => handleFilterChange("employee", value)}>
            <SelectTrigger id="employee-filter" className="bg-black text-white">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee} value={employee}>
                  {employee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-filter" className="text-white">Filter by Client</Label>
          <Select value={filters.client} onValueChange={(value) => handleFilterChange("client", value)}>
            <SelectTrigger id="client-filter" className="bg-black text-white">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-filter" className="text-white">Filter by Project</Label>
          <Select value={filters.project} onValueChange={(value) => handleFilterChange("project", value)}>
            <SelectTrigger id="project-filter" className="bg-black text-white">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project} value={project}>
                  {project}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-from" className="text-white">From Date</Label>
          <Input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            className="bg-black text-white"
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-to" className="text-white">To Date</Label>
          <Input
            id="date-to"
            type="date"
            value={filters.dateTo}
            className="bg-black text-white"
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
          />
        </div>

        {/* Buttons aligned with date filters */}
        <div className="space-y-2 flex flex-col justify-end">
          <div className="flex gap-2">
            <Button
              onClick={generateReport}
              variant="outline"
              className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white bg-transparent flex-1"
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button 
              onClick={clearFilters} 
              variant="outline" 
              className="bg-gray-600 border-gray-600 text-white hover:bg-gray-700 flex-1"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {showSummary && summaryStats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-medium mb-4 text-white">Summary Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
              <h4 className="text-xl font-medium text-orange-600">{summaryStats.totalHours.toFixed(1)}</h4>
              <p className="text-sm text-gray-400">Total Hours</p>
            </div>

            <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
              <h4 className="text-xl font-medium text-orange-600">
                {summaryStats.totalPTOandHolidayHours.toFixed(1)}
              </h4>
              <p className="text-sm text-gray-400">Total PTO & Holiday Hours</p>
            </div>

            <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
              <h4 className="text-xl font-medium text-orange-600">{summaryStats.totalEmployees}</h4>
              <p className="text-sm text-gray-400">Employees</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
              <h4 className="text-xl font-medium text-orange-600">{summaryStats.totalClients}</h4>
              <p className="text-sm text-gray-400">Clients</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
              <h4 className="text-xl font-medium text-orange-600">{summaryStats.totalProjects}</h4>
              <p className="text-sm text-gray-400">Projects</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
              <h4 className="text-xl font-medium text-orange-600">{summaryStats.avgHoursPerDay.toFixed(1)}</h4>
              <p className="text-sm text-gray-400">Avg Hours/Day</p>
            </div>
              <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
                <h4 className="text-xl font-medium text-orange-600">
                  {summaryStats.dateRange
                    .replace(/(\d{4})/g, "\n$1")
                    .replace(" - ", "\n–\n")}
                </h4>
                <p className="text-sm text-gray-400">Date Range</p>
              </div>
          </div>
        </div>
      )}

      {/* Filtered Results */}
      {showFilteredResults && (
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-black">Filtered Results</CardTitle>
            <Button 
              onClick={downloadFilteredCSV} 
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={filteredData.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {filteredData.length > 0 ? (
              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto overflow-x-auto">
                <table className="w-full border-collapse min-w-full">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="border-b px-4 py-2 text-left text-black">ID</th>
                      <th className="border-b px-4 py-2 text-left text-black">Employee</th>
                      <th className="border-b px-4 py-2 text-left text-black">Client</th>
                      <th className="border-b px-4 py-2 text-left text-black">Project</th>
                      <th className="border-b px-4 py-2 text-left text-black">Date</th>
                      <th className="border-b px-4 py-2 text-left text-black">Day</th>
                      <th className="border-b px-4 py-2 text-left text-black">Activity</th>
                      <th className="border-b px-4 py-2 text-left text-black">Hours</th>
                      <th className="border-b px-4 py-2 text-left text-black">Required Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((entry, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border-b px-4 py-2 text-black">{entry.employee_id || "N/A"}</td>
                        <td className="border-b px-4 py-2 text-black">{entry.employee_name || "N/A"}</td>
                        <td className="border-b px-4 py-2 text-black">
                          {entry.client || "-"}
                        </td>
                        <td className="border-b px-4 py-2 text-black">
                          {entry.project || "-"}
                        </td>
                        <td className="border-b px-4 py-2 text-black whitespace-nowrap">
                          {entry.date}
                        </td>                   
                        <td className="border-b px-4 py-2 text-black">{entry.day || "N/A"}</td>
                        <td className="border-b px-4 py-2 text-black">{entry.activity || "N/A"}</td>
                        <td
                          className={`border-b px-4 py-2 text-black ${
                            entry.activity !== "PTO" && entry.hours < entry.required_hours
                              ? "bg-red-100"
                              : entry.activity !== "PTO" && entry.hours > entry.required_hours
                              ? "bg-green-100"
                              : ""
                          }`}
                        >
                          {entry.hours !== undefined ? entry.hours : "N/A"}
                        </td>
                        <td className="border-b px-4 py-2 text-black">
                          {entry.required_hours !== undefined ? entry.required_hours : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
                No data matches the selected filters.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Report Section */}
      <Card className="bg-white border-gray-700">
        <CardHeader>
          <CardTitle className="text-black">Monthly Employee Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
            <div className="w-full md:w-1/2 space-y-2">
              <Label htmlFor="report-month" className="text-black">Select Month</Label>
              <Input
                id="report-month"
                type="month"
                className="bg-black text-white border-gray-600"
                defaultValue={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              />
            </div>
            <Button
              onClick={generateMonthlyReport}
              className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white bg-transparent"
              variant="outline"
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              Generate Monthly Report
            </Button>
          </div>

          {showMonthlyReport && (
            <div className="space-y-4 mt-6">
              {employeeReports.length > 0 ? (
                <>
                  <div className="bg-green-300/20 border border-green-600/30 text-green-700 rounded-md p-4">
                    Monthly Report for{" "}
                    {(() => {
                      const val = document.getElementById("report-month")?.value || "";
                      const [year, month] = val.split("-");
                      if (year && month) {
                        return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
                          "en-US",
                          { month: "long", year: "numeric" }
                        );
                      }
                      return "";
                    })()}
                  </div>

                  {employeeReports.map((employee, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4 border-l-4 border-orange-600">
                      <h5 className="font-medium mb-3 text-white">{employee.name}</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-950 p-3 rounded text-center shadow-sm">
                          <div className="text-lg font-medium text-orange-600">{employee.totalHours.toFixed(1)}</div>
                          <div className="text-xs text-gray-400">Total Hours</div>
                        </div>
                        <div className="bg-gray-950 p-3 rounded text-center shadow-sm">
                          <div className="text-lg font-medium text-orange-600">{employee.entries.length}</div>
                          <div className="text-xs text-gray-400">Entries</div>
                        </div>
                        <div className="bg-gray-950 p-3 rounded text-center shadow-sm">
                          <div className="text-lg font-medium text-orange-600">{employee.clients.size}</div>
                          <div className="text-xs text-gray-400">Clients</div>
                        </div>
                        <div className="bg-gray-950 p-3 rounded text-center shadow-sm">
                          <div className="text-lg font-medium text-orange-600">{employee.projects.size}</div>
                          <div className="text-xs text-gray-400">Projects</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="bg-red-900/20 border border-red-600/30 text-red-300 rounded-md p-4">
                  No data found for the selected month.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-black">
            Accountant PDF vs Timesheet Comparison
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="application/pdf"
            multiple
            onChange={e => setPdfFiles(Array.from(e.target.files || []))}
          />

          <Button
            onClick={runPdfComparison}
            disabled={isComparing}
            className="bg-orange-600 text-white"
          >
            {isComparing ? "Comparing..." : "Compare PDFs"}
          </Button>

          {comparisonResults.length > 0 && (
            <div className="border rounded max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>PDF Hours</th>
                    <th>DB Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonResults.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td>{r.date}</td>
                      <td>{r.activity}</td>
                      <td>{r.pdf_hours}</td>
                      <td>{r.db_hours ?? "-"}</td>
                      <td
                        className={
                          r.status === "MATCH"
                            ? "text-green-600"
                            : r.status === "HOURS_MISMATCH"
                            ? "text-orange-600"
                            : "text-red-600"
                        }
                      >
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}