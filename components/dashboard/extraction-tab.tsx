'use client'

import type React from "react"
import type { TimesheetEntry, ExtractionStatus } from "@/lib/types"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Download, CheckCircle, AlertCircle, Calendar, Play } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ExtractionTab() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>({
    is_processing: false,
    progress: 0,
    message: "",
    error: null,
    result: null,
  })
  const [extractedData, setExtractedData] = useState<TimesheetEntry[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState("")
  const [csvUploaded, setCsvUploaded] = useState(false)
  const [currentExtractionId, setCurrentExtractionId] = useState<string | null>(null)
  const { toast } = useToast()

  const getDefaultDates = () => {
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)

    return {
      startDate: sevenDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }
  }

  const defaultDates = getDefaultDates()

  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const isExtractingRef = useRef(false)
  const statusCheckCountRef = useRef(0)
  const extractionStartTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const userStr = sessionStorage.getItem("currentUser")
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      checkPrerequisites(user.user_id)
      checkExtractionStatus(user.user_id)
    }
  }, [])

  useEffect(() => {
    isExtractingRef.current = isExtracting

    if (isExtracting) {
      statusCheckCountRef.current = 0
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [isExtracting])

  const startPolling = () => {
    console.log("Starting polling...")

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    if (currentUser) {
      checkExtractionStatus(currentUser.id)
    }

    pollingRef.current = setInterval(() => {
      console.log("Polling interval triggered, isExtracting:", isExtractingRef.current)
      if (isExtractingRef.current && currentUser) {
        checkExtractionStatus(currentUser.user_id)
      } else {
        console.log("Stopping polling - extraction no longer active")
        stopPolling()
      }
    }, 2000)
  }

  const stopPolling = () => {
    console.log("Stopping polling...")
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const checkPrerequisites = async (userId: string) => {
    try {
      const gmailResponse = await fetch(`/api/gmail-settings?userId=${userId}`)
      const gmailData = await gmailResponse.json()
      if(gmailData.success && gmailData.connected){
        setGmailConnected(true)
        setGmailEmail(gmailData.email)
      }

      const csvResponse = await fetch("/api/csv-status")
      const csvData = await csvResponse.json()
      setCsvUploaded(csvData.uploaded)
    } catch (error) {
      console.error("Error checking prerequisites:", error)
    }
  }

  const checkExtractionStatus = async (userId: string) => {
    try {
      statusCheckCountRef.current++
      console.log(`=== Status check #${statusCheckCountRef.current} ===`)

      const queryParams = new URLSearchParams({ userId })
      if (currentExtractionId) {
        queryParams.append('extractionId', currentExtractionId)
      }

      const response = await fetch(`/api/extract-timesheet?${queryParams}`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const jsonResponse = await response.json()
      console.log("Raw API response:", jsonResponse)

      const timeSinceStart = extractionStartTimeRef.current ? Date.now() - extractionStartTimeRef.current : 0
      const isWithinGracePeriod = timeSinceStart < 10000

      if (!jsonResponse.is_processing && !isWithinGracePeriod) {
        console.log("Component not extracting and no ongoing extraction found. Stopping polling.")
        setIsExtracting(false)
        return
      }

      if (jsonResponse.error) {
        console.log("❌ Error detected:", jsonResponse.error)
        setIsExtracting(false)
        setCurrentExtractionId(null)
        setExtractedData([])
        extractionStartTimeRef.current = null
        setExtractionStatus(prev => ({
          ...prev,
          is_processing: false,
          progress: 0,
          error: jsonResponse.error
        }))

        toast({
          title: "Extraction failed",
          description: jsonResponse.error,
          variant: "destructive",
        })
        return
      }

      if (!isExtractingRef.current && jsonResponse.is_processing) {
        console.log("Found ongoing extraction, starting to track it")
        setCurrentExtractionId(jsonResponse.extractionId)
        setIsExtracting(true)
        extractionStartTimeRef.current = Date.now()
      }

      if (jsonResponse.is_processing === true) {
        console.log("🔄 Still processing...")

        const currentProgress = Math.max(
          jsonResponse.progress || 10,
          extractionStatus.progress || 10,
          10
        )

        console.log(`Progress: ${currentProgress}%, Message: ${jsonResponse.message}`)

        setExtractionStatus(prev => ({
          ...prev,
          is_processing: true,
          progress: currentProgress,
          message: jsonResponse.message || (isWithinGracePeriod ? "Starting extraction..." : "Processing..."),
          error: null,
          status: jsonResponse.status,
          result: jsonResponse.status?.result || prev.result
        }))

        return
      }

      console.log("✅ Processing complete, checking results...")

      if (jsonResponse.data && Array.isArray(jsonResponse.data) && jsonResponse.data.length > 0) {
        console.log(`🎉 Success! Found ${jsonResponse.data.length} entries`)

        setExtractionStatus(prev => ({
          ...prev,
          progress: 100,
          message: "Extraction completed successfully!",
          is_processing: false,
          error: null,
          status: jsonResponse.status,
          result: jsonResponse.status?.result || null
        }))

        setExtractedData(jsonResponse.data as TimesheetEntry[])
        setIsExtracting(false)
        setCurrentExtractionId(null)
        extractionStartTimeRef.current = null

        const totalEntries = jsonResponse.status?.result?.total_entries || jsonResponse.data.length
        const duplicatesSkipped = jsonResponse.status?.result?.duplicate_entries_skipped || 0

        toast({
          title: "Extraction complete",
          description: `Successfully extracted ${totalEntries} timesheet entries.`,
        })
        return
      }

      if (!isWithinGracePeriod) {
        console.log("ℹ️ Processing complete but no new data found")

        setExtractionStatus(prev => ({
          ...prev,
          progress: 100,
          message: "Extraction completed - no new data found",
          is_processing: false,
          error: null,
          status: jsonResponse.status,
          result: jsonResponse.status?.result || null
        }))

        setIsExtracting(false)
        setCurrentExtractionId(null)
        extractionStartTimeRef.current = null

        const duplicatesSkipped = jsonResponse.status?.result?.duplicate_entries_skipped || 0
        const totalFound = jsonResponse.status?.result?.total_entries || 0

        toast({
          title: "Extraction complete",
          description: totalFound > 0
            ? `Found ${totalFound} entries, but all ${duplicatesSkipped} entries are already stored in database and can be accessed through reports.`
            : "No timesheet entries found in the specified date range.",
        })
      }

    } catch (error) {
      console.error(`❌ Status check #${statusCheckCountRef.current} error:`, error)

      if (statusCheckCountRef.current > 30) {
        console.log("Too many consecutive errors, stopping extraction")
        setIsExtracting(false)
        setCurrentExtractionId(null)
      }
    }
  }

  const handleExtractTimesheets = async () => {
    if (!currentUser) {
      toast({ title: "Authentication required", description: "Please log in to start an extraction.", variant: "destructive" })
      return
    }

    if (!gmailConnected) {
      toast({ title: "Gmail Not Connected", description: "Please connect your Gmail account in the Settings tab.", variant: "destructive" })
      return
    }

    if (!csvUploaded) {
      toast({ title: "CSV Data Missing", description: "Please upload your Employee and Project CSV files first.", variant: "destructive" })
      return
    }

    setIsExtracting(true)
    setExtractionStatus({
      is_processing: true,
      progress: 5,
      message: "Initiating extraction...",
      error: null,
      result: null,
    })
    setExtractedData([])
    extractionStartTimeRef.current = Date.now()

    try {
      const response = await fetch("/api/extract-timesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.user_id,
          start_date: startDate,
          end_date: endDate,
          extracted_by: currentUser.username || currentUser.email || 'Manager'
        }),
      })

      const data = await response.json()

      if (data.success) {
        setCurrentExtractionId(data.extractionId)
        toast({
          title: "Extraction started",
          description: "Timesheet extraction is now running in the background.",
        })
      } else {
        setIsExtracting(false)
        setCurrentExtractionId(null)
        extractionStartTimeRef.current = null
        toast({
          title: "Failed to start extraction",
          description: data.message || "An unknown error occurred.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error starting extraction:", error)
      setIsExtracting(false)
      setCurrentExtractionId(null)
      extractionStartTimeRef.current = null
      toast({
        title: "Extraction Error",
        description: "An error occurred while trying to start the extraction.",
        variant: "destructive",
      })
    }
  }

  const handleDownloadCSV = () => {
    if (extractedData.length === 0) {
      toast({
        title: "No data to download",
        description: "Please run an extraction first.",
        variant: "destructive",
      })
      return
    }
    
    const headers = ["Employee ID", "Employee Name", "Client", "Project", "Date", "Day", "Activity", "Hours", "Required Hours"]
    let csvContent = headers.join(",") + "\n"

    extractedData.forEach((entry) => {
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
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `extracted_timesheets_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const requirementsMet = gmailConnected && csvUploaded

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-white mb-2">Timesheet Extraction</h2>
      
      {/* Prerequisites Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${gmailConnected ? "bg-green-200" : "bg-red-500"}`}></div>
              <div className="flex-1">
                <h3 className="font-medium text-white">Gmail Connection</h3>
                {gmailConnected ? (
                  <p className="text-sm text-green-200 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Connected to {gmailEmail}
                  </p>
                ) : (
                  <p className="text-sm text-red-400 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Not connected
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-950 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${csvUploaded ? "bg-green-200" : "bg-red-500"}`}></div>
              <div className="flex-1">
                <h3 className="font-medium text-white">Employee Database</h3>
                {csvUploaded ? (
                  <p className="text-sm text-green-200 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Data uploaded
                  </p>
                ) : (
                  <p className="text-sm text-red-400 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    CSV files required
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements Alert */}
      {!requirementsMet && (
        <Alert className="border-yellow-600 bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            <strong>Setup Required:</strong> Please complete the following:
            <ul className="mt-2 ml-4 list-disc space-y-1">
              {!gmailConnected && <li>Connect your Gmail account in the Settings tab</li>}
              {!csvUploaded && <li>Upload your Employee and Project CSV files</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Extraction Panel */}
      <Card className="bg-white border-gray-700">
        <CardHeader>
          <CardTitle className="text-black flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-black" />
            Extraction Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range with Button on Same Line */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="startDate" className="text-black">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 bg-gray-950 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-black">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2 bg-gray-950 border-gray-600 text-white"
              />
            </div>
            {/* Action Button aligned with date inputs */}
            <Button
              onClick={handleExtractTimesheets}
              disabled={!requirementsMet || isExtracting}
              variant= "outline"
              className="bg-white border-red-600 text-red-600 hover:bg-red-500 px-8 py-3 text-base font-semibold"
              size="lg"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Extraction
                </>
              )}
            </Button>
          </div>
          {/* Progress Indicator */}
          {isExtracting && (
            <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-red-500 font-bold">{extractionStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 border-gray-200 rounded-full h-3">
                    <div 
                      className="bg-red-500 h-3 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${extractionStatus.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-black">{extractionStatus.message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      {extractedData.length > 0 && (
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-black">
                Extracted Timesheets
              </CardTitle>
              <p className="text-gray-600 mt-1">{extractedData.length} entries found</p>
            </div>
            <Button 
              onClick={handleDownloadCSV} 
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
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
                  {extractedData.map((entry, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border-b px-4 py-2 text-black">{entry.employee_id || "N/A"}</td>
                      <td className="border-b px-4 py-2 text-black">{entry.employee_name || "N/A"}</td>
                      <td className="border-b px-4 py-2 text-black">{entry.client || "N/A"}</td>
                      <td className="border-b px-4 py-2 text-black">{entry.project || "N/A"}</td>
                      <td className="border-b px-4 py-2 text-black">{entry.date || "N/A"}</td>
                      <td className="border-b px-4 py-2 text-black">{entry.day || "N/A"}</td>
                      <td className="border-b px-4 py-2 text-black">{entry.activity || "N/A"}</td>
                      <td
                        className={`border-b px-4 py-2 text-black ${
                          entry.hours < entry.required_hours
                            ? "bg-red-100"
                            : entry.hours > entry.required_hours
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
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {extractionStatus.error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-800">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-300">Extraction Failed</AlertTitle>
          <AlertDescription className="text-red-200">{extractionStatus.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}