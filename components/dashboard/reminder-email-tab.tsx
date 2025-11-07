'use client'

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Users, Send, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  email_id: string;
}

export default function ReminderEmailTab() {
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoaded, setEmployeesLoaded] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [emailSubject, setEmailSubject] = useState("Timesheet Reminder")
  const [emailBody, setEmailBody] = useState(`Dear {name},

This is a friendly reminder to please submit your timesheet for this period. Please log in to the system and complete your timesheet submission by the deadline. Thank you for your attention to this matter.

Best regards,
HR Team`)
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { toast } = useToast()

  // Load data on component mount
  useEffect(() => {
    const userStr = sessionStorage.getItem("currentUser") 
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      checkGmailStatus(user.user_id)
    }
    loadEmployeesFromDatabase()
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

  const loadEmployeesFromDatabase = async () => {
    setLoadingEmployees(true)
    try {
      const response = await fetch("/api/send-reminder-emails")
      const data = await response.json()

      if (data.success && data.employees) {
        setEmployees(data.employees)
        setEmployeesLoaded(true)
        toast({
          title: "Employee data loaded",
          description: `Loaded ${data.employees.length} employees from database.`,
        })
      } else {
        toast({
          title: "Failed to load employees",
          description: data.message || "Could not fetch employee data from database.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading employees:", error)
      toast({
        title: "Database connection error",
        description: "Failed to connect to employee database.",
        variant: "destructive",
      })
    } finally {
      setLoadingEmployees(false)
    }
  }

  const refreshEmployeeData = () => {
    loadEmployeesFromDatabase()
  }

  const handleRemoveRecipient = (idToRemove: string) => {
    setEmployees(currentEmployees =>
      currentEmployees.filter(employee => employee.id !== idToRemove)
    );
  };

  const sendReminders = async () => {
    if (!gmailConnected) {
      toast({
        title: "Gmail not connected",
        description: "Please configure Gmail settings in the Settings tab first.",
        variant: "destructive",
      })
      return
    }

    if (!employeesLoaded || employees.length === 0) {
      toast({
        title: "No employee data",
        description: "Please ensure employee data is loaded from the database and at least one recipient is selected.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/send-reminder-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          userId: currentUser?.user_id,
          employees: employees
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Emails sent successfully",
          description: `Reminder emails sent to ${data.emailsSent || employees.length} employees.`,
        })
      } else {
        toast({
          title: "Failed to send emails",
          description: data.message || "An error occurred while sending emails.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error sending emails",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
    setIsLoading(false)
  }

  return (
    <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-white mb-2">Email Reminders</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-950">
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
                    Not connected - configure in Settings tab
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-950">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${employeesLoaded && employees.length > 0 ? "bg-green-200" : "bg-red-500"}`}></div>
              <div className="flex-1">
                <h3 className="font-medium text-white flex items-center">
                  Employee Database
                </h3>
                {loadingEmployees ? (
                  <p className="text-sm text-yellow-400 flex items-center">
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Loading employees...
                  </p>
                ) : employeesLoaded && employees.length > 0 ? (
                  <p className="text-sm text-green-200 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {employees.length} employees loaded
                  </p>
                ) : (
                  <p className="text-sm text-red-400 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    No employees found in database
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshEmployeeData}
                disabled={loadingEmployees}
                className="text-gray-300 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loadingEmployees ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements Alert */}
      {(!gmailConnected || !employeesLoaded || employees.length === 0) && (
        <Alert className="border-yellow-600 bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            <strong>Setup Required:</strong> Please complete the following:
            <ul className="mt-2 ml-4 list-disc space-y-1">
              {!gmailConnected && <li>Connect your Gmail account in the Settings tab</li>}
              {(!employeesLoaded || employees.length === 0) && (
                <li>Ensure your Supabase employees table has data and database connection is working</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Email Template Configuration */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-black flex items-center">
            <Mail className="w-5 h-5 mr-2 text-black" />
            Email Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="emailSubject" className="text-gray-800">
              Subject Line
            </Label>
            <Input
              id="emailSubject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="bg-gray-200 border-gray-200 text-gray-800"
              placeholder="Email subject"
            />
          </div>
          <div>
            <Label htmlFor="emailBody" className="text-gray-800">
              Email Body
            </Label>
            <Textarea
              id="emailBody"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={8}
              className="bg-gray-200 border-gray-200 text-gray-800"
              placeholder="Email body template. Use {name} to personalize with employee names."
            />
            <p className="text-sm text-gray-400 mt-2">
              Use <code className="bg-gray-200 px-1 rounded">{`{name}`}</code> to automatically insert employee names
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recipients and Send Section */}
      {employeesLoaded && (
        <>
          <Card className="bg-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Users className="w-5 h-5 mr-2 text-white" />
                Recipients ({employees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[50px]">
                {employees.length > 0 ? (
                  employees.map(employee => (
                    <div
                      key={employee.id}
                      className="inline-flex items-center bg-gray-600 text-white text-sm font-medium px-2.5 py-0.5 rounded-full"
                    >
                      {employee.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipient(employee.id)}
                        className="ml-1 text-white hover:text-red-400 focus:outline-none"
                        aria-label={`Remove ${employee.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic">No recipients selected.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Email Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-gray-400">Subject: </span>
                <span className="text-white">{emailSubject}</span>
              </div>
              <div className="border-t border-gray-600 pt-3">
                <div className="bg-gray-900 p-4 rounded text-white whitespace-pre-wrap text-sm">
                  {/* Corrected logic: use the {name} placeholder for the preview */}
                  {emailBody.replace('{name}', '[Employee Name]')}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              onClick={sendReminders}
              disabled={isLoading || employees.length === 0}
              variant={"outline"}
              className="bg-gray-800 border-red-500 hover:bg-red-700 text-red-500 px-8 py-3"
            >
              <Send className="w-5 h-6 text-white" />
              {isLoading ? "Sending..." : `Send Reminder Emails`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}