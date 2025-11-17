"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, UploadIcon, CheckCircle, FileTextIcon, DownloadIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function SettingsTab() {
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState("")
  const [csvUploaded, setCsvUploaded] = useState(false)
  const [csvRecordCount, setCsvRecordCount] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [csvData, setCsvData] = useState<any[] | null>(null)
  const [isLoadingCsvData, setIsLoadingCsvData] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load data on component mount - same as ReminderEmailTab
  useEffect(() => {
    const userStr = sessionStorage.getItem("currentUser") 
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      checkGmailStatus(user.user_id)
      checkCsvStatus(user.user_id)
    }
    setIsLoading(false)
  }, [])

  const checkGmailStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/gmail-settings?userId=${userId}`)
      const data = await response.json()

      if (data.success && data.connected) {
        setGmailConnected(true)
        setGmailEmail(data.email)
      }
    } catch (error) {
      console.error("Error checking Gmail status:", error)
    }
  }

  const checkCsvStatus = async (userId: string) => {
    try {
      const csvResponse = await fetch("/api/csv-status")
      const csvData = await csvResponse.json()
      setCsvUploaded(csvData.uploaded)
    } catch (error) {
      console.error("Error checking CSV status:", error)
    }
  }

  const fetchCsvData = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to view the file content.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingCsvData(true)
    try {
      const response = await fetch(`/api/get-csv-content`)
      const data = await response.json()

      if (response.ok && data.success) {
        setCsvData(data.data)
      } else {
        toast({
          title: "Failed to load CSV",
          description: data.message || "An error occurred while fetching the CSV content.",
          variant: "destructive",
        })
        setCsvData(null)
      }
    } catch (error) {
      console.error("Error fetching CSV content:", error)
      toast({
        title: "Network Error",
        description: "Could not connect to the server to fetch the file content.",
        variant: "destructive",
      })
      setCsvData(null)
    } finally {
      setIsLoadingCsvData(false)
    }
  }

  const handleGmailConnection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to connect your Gmail account.",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const testResponse = await fetch("/api/test-gmail-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, userId: currentUser.user_id }),
      })

      const testData = await testResponse.json()

      if (!testData.success) {
        toast({
          title: "Connection failed",
          description: testData.message || "Failed to connect to Gmail.",
          variant: "destructive",
        })
        setIsConnecting(false)
        return
      }

      const saveResponse = await fetch("/api/gmail-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          userId: currentUser.user_id,
        }),
      })

      const saveData = await saveResponse.json()

      if (saveData.success) {
        setGmailConnected(true)
        setGmailEmail(email)
        toast({
          title: "Gmail connected",
          description: "Your Gmail account has been successfully connected and saved.",
        })
      } else {
        toast({
          title: "Save failed",
          description: saveData.message || "Failed to save Gmail settings.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Connection error",
        description: "Failed to connect to Gmail. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload a file.",
        variant: "destructive",
      })
      return
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file.",
        variant: "destructive",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 5MB.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setCsvFile(file)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("userId", currentUser.user_id)

      const response = await fetch("/api/upload-csv", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setCsvUploaded(true)
        setCsvRecordCount(data.record_count || data.project_count || 0)
        toast({
          title: "CSV uploaded",
          description: data.message || "Employee data has been successfully uploaded and saved.",
        })
      } else {
        toast({
          title: "Upload failed",
          description: data.message || "Failed to upload CSV file.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload error",
        description: "An error occurred while uploading the file.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadCsv = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to download the file.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/get-csv-content`)
      const data = await response.json()

      if (response.ok && data.success && data.data) {
        // Convert the data back to CSV format
        const csvRows = []
        
        // Add header
        csvRows.push("Emp ID,Name,Email ID,Birthday,Project,Client,Hours")
        
        // Helper function to escape CSV fields
        const escapeCSV = (field: string) => {
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`
          }
          return field
        }
        
        // Add data rows
        data.data.forEach((employee: any) => {
          employee.projects.forEach((project: any) => {
            const birthday = employee.birthday || ""
            
            // Escape fields that contain commas
            const empId = escapeCSV(employee.employee_id)
            const name = escapeCSV(employee.name)
            const email = escapeCSV(employee.email_id)
            const birthdayEscaped = escapeCSV(birthday)
            const projectName = escapeCSV(project.project)
            const client = escapeCSV(project.client)
            const hours = project.hours
            
            csvRows.push(
              `${empId},${name},${email},${birthdayEscaped},${projectName},${client},${hours}`
            )
          })
        })
        
        // Create blob and download
        const csvContent = csvRows.join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        
        link.setAttribute("href", url)
        link.setAttribute("download", `employee_data_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        toast({
          title: "Download started",
          description: "Your CSV file is being downloaded.",
        })
      } else {
        toast({
          title: "Download failed",
          description: data.message || "Failed to download CSV file.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Download error",
        description: "An error occurred while downloading the file.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 flex flex-col items-center justify-center h-full">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="bg-white text-gray-800">
        <CardHeader>
          <CardTitle>Gmail Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${gmailConnected ? "bg-green-500" : "bg-red-500"}`}></div>
            <span>
              {gmailConnected ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Connected to {gmailEmail}
                </span>
              ) : (
                "Not connected"
              )}
            </span>
          </div>

          {gmailConnected && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Gmail Connected</AlertTitle>
              <AlertDescription className="text-green-600">
                Your Gmail credentials are saved and will be used automatically for the timesheet tracker.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-500">How to get your Gmail App Password:</AlertTitle>
            <AlertDescription className="text-gray-700">
              <ol className="list-decimal ml-5 space-y-1">
                <li>
                  Go to your{" "}
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline font-medium"
                  >
                    Google Account Security
                  </a>
                </li>
                <li>Enable 2-Factor Authentication if not already enabled</li>
                <li>
                  Go to{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline font-medium"
                  >
                    App Passwords
                  </a>
                </li>
                <li>Generate a new app password for "Mail"</li>
                <li>Use this 16-character password below (not your regular Gmail password)</li>
              </ol>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleGmailConnection} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gmail-email">Gmail Address</Label>
              <Input
                id="gmail-email"
                name="email"
                type="email"
                placeholder="your.email@gmail.com"
                className="text-gray-200"
                defaultValue={gmailEmail}
                disabled={isConnecting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gmail-password">Gmail App Password (16 characters)</Label>
              <Input
                id="gmail-password"
                name="password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                disabled={isConnecting}
              />
            </div>
            <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white" disabled={isConnecting}>
              {isConnecting ? "Connecting..." : gmailConnected ? "Update Gmail Connection" : "Connect to Gmail"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-white text-gray-800">
        <CardHeader>
          <CardTitle>Employee Data Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${csvUploaded ? "bg-green-500" : "bg-red-500"}`}></div>
              <span>
                {csvUploaded ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    CSV uploaded
                  </span>
                ) : (
                  "No CSV uploaded"
                )}
              </span>
            </div>
            {csvUploaded && (
              <div className="flex gap-2">
                <Dialog onOpenChange={(open) => open && fetchCsvData()}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1 border-gray-300 text-gray-800 bg-white">
                      <FileTextIcon className="w-4 h-4" /> View File
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white text-gray-800">
                    <DialogHeader>
                      <DialogTitle>Current Employee Data</DialogTitle>
                      <DialogDescription>
                        Displaying the first 50 rows of the currently stored CSV file.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                      {isLoadingCsvData ? (
                        <div className="flex justify-center items-center h-32">
                          <p>Loading file content...</p>
                        </div>
                      ) : csvData && csvData.length > 0 ? (
                        <Table>
                          <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                              <TableHead>Employee ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Project</TableHead>
                              <TableHead>Client</TableHead>
                              <TableHead>Hours</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvData.map((employee, employeeIndex) =>
                              employee.projects.map((project: any, projectIndex: number) => (
                                <TableRow key={`${employee.employee_id}-${projectIndex}`}>
                                  <TableCell className="text-gray-600">
                                    {projectIndex === 0 ? employee.employee_id : ""}
                                  </TableCell>
                                  <TableCell className="text-gray-600">
                                    {projectIndex === 0 ? employee.name : ""}
                                  </TableCell>
                                  <TableCell className="text-gray-600">
                                    {projectIndex === 0 ? employee.email_id : ""}
                                  </TableCell>
                                  <TableCell className="text-gray-600">{project.project}</TableCell>
                                  <TableCell className="text-gray-600">{project.client}</TableCell>
                                  <TableCell className="text-gray-600">{project.hours}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-center text-gray-500 py-8">
                          No data to display. The file may be empty or corrupted.
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1 border-gray-300 text-gray-800 bg-white"
                  onClick={handleDownloadCsv}
                >
                  <DownloadIcon className="w-4 h-4" /> Download CSV
                </Button>
              </div>
            )}
          </div>

          {csvUploaded && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Employee Data Saved</AlertTitle>
              <AlertDescription className="text-green-600">
                Your employee data is saved and will be fetched automatically.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-500">CSV Requirements:</AlertTitle>
            <AlertDescription className="text-gray-700">
              <ul className="list-disc ml-5 space-y-1">
                <li>
                  Required columns: <strong>name</strong>, <strong>emp id</strong>, <strong>email id</strong>, <strong>birthday</strong>, <strong>project</strong>, <strong>client</strong>,{" "}
                  <strong>hours</strong>
                </li>
                <li>Column names are case-insensitive</li>
                <li>File must be in CSV format</li>
                <li>Each row should contain one employee's project assignment. If there are multiple projects for the same client, list both projects in the same row as Project1,Project2</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all ${
              isDragging ? "border-red-500 bg-gray-100" : "border-gray-300"
            } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
            onClick={() => document.getElementById("csv-file-input")?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white mb-4">
                <UploadIcon className="h-6 w-6" />
              </div>
              <p className="text-lg font-medium mb-2">Drag and drop your CSV file here</p>
              <p className="text-sm text-gray-500">or click to browse files</p>
              {csvUploaded && <p className="text-sm text-green-600 mt-2">Upload a new file to replace existing data</p>}
            </div>
          </div>

          <input
            type="file"
            id="csv-file-input"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />

          {csvFile && (
            <div className="bg-gray-100 p-4 rounded-lg">
              <h4 className="font-medium">{csvFile.name}</h4>
              <p className="text-sm text-gray-600">
                {csvUploaded ? `Successfully uploaded (${csvRecordCount} records) • ` : ""}
                {(csvFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}