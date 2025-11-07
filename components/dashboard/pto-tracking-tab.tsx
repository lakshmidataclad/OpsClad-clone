'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar, Search, Download, Trash2, AlertTriangle, Mail, PieChart, BarChart3, Loader2, CheckCircle, XCircle, Clock, ArrowRight, Eye } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format, parseISO, startOfYear, endOfYear, addYears } from "date-fns"
import { PieChart as RechartsPieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"

interface PTORecord {
  id: string
  date: string
  day: string
  hours: number
  employee_name: string
  employee_id: string
  sender_email: string
  updated_at: string
  is_pto: boolean
  status?: 'pending' | 'approved' | 'rejected'
  request_reason?: string
}

interface CarryForwardRequest {
  id: string
  employee_id: string
  employee_name: string
  sender_email: string
  from_year: number
  to_year: number
  days_requested: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
}

interface EmployeePTOSummary {
  employee_id: string
  employee_name: string
  sender_email: string
  total_pto_hours: number
  total_pto_days: number
  remaining_pto_days: number
  non_pto_hours: number
  non_pto_days: number
  needs_notification: boolean
  carry_forward_days: number
  effective_pto_limit: number
}

// Database view interface
interface EmployeePTOSummaryView {
  employee_id: string
  employee_name: string
  sender_email: string
  year: number
  pto_hours_used: number
  non_pto_hours: number
  total_approved_days: number
  pending_requests: number
  carried_forward: number
  carried_out: number
  effective_pto_limit_days: number
  effective_pto_limit_hours: number
  pto_days_used: number
  pto_days_remaining: number
  non_pto_days: number
}

export default function PTOTrackingTab() {
  const [ptoRecords, setPtoRecords] = useState<PTORecord[]>([])
  const [carryForwardRequests, setCarryForwardRequests] = useState<CarryForwardRequest[]>([])
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeePTOSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEmployee, setFilterEmployee] = useState("all")
  const [reportsFilterEmployee, setReportsFilterEmployee] = useState("all")
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [activeTab, setActiveTab] = useState("overview")
  const [sendingNotifications, setSendingNotifications] = useState(false)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [emailPreview, setEmailPreview] = useState({
    recipients: [] as { name: string; email: string; }[],
    subject: "",
    body: "",
  })
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Processing states for buttons
  const [processingApprovals, setProcessingApprovals] = useState(new Set<string>())
  const [processingCarryForward, setProcessingCarryForward] = useState(new Set<string>())

  const { toast } = useToast()

  const PTO_LIMIT_DAYS = 12
  const NOTIFICATION_THRESHOLD_DAYS = 1

  const currentYear = selectedYear
  const yearStart = startOfYear(new Date(currentYear, 0, 1))
  const yearEnd = endOfYear(new Date(currentYear, 11, 31))

  const uniqueEmployees = [...new Set(ptoRecords.map(record => record.employee_name))].sort()

  const getFilteredRecords = () => {
    return ptoRecords.filter(record => {
      const matchesSearch =
        record.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.sender_email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesEmployee = filterEmployee === "all" || record.employee_name === filterEmployee

      const matchesDateRange = (!dateRange.start || record.date >= dateRange.start) &&
        (!dateRange.end || record.date <= dateRange.end)

      return matchesSearch && matchesEmployee && matchesDateRange
    })
  }

  const filteredRecords = getFilteredRecords()

  // Load employee summaries directly from database view
  const loadEmployeeSummariesFromView = async (year: number): Promise<EmployeePTOSummary[]> => {
    try {
      const { data, error } = await supabase
        .from('employee_pto_summary')
        .select('*')
        .eq('year', year)

      if (error) {
        console.error('Error loading employee summaries:', error)
        return []
      }

      // Transform the database view data to match your interface
      const summaries: EmployeePTOSummary[] = (data || []).map((row: EmployeePTOSummaryView) => ({
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        sender_email: row.sender_email,
        total_pto_hours: row.pto_hours_used || 0,
        total_pto_days: row.pto_days_used || 0,
        remaining_pto_days: row.pto_days_remaining || 0,
        non_pto_hours: row.non_pto_hours || 0,
        non_pto_days: row.non_pto_days || 0,
        needs_notification: (row.pto_days_used || 0) >= ((row.effective_pto_limit_days || PTO_LIMIT_DAYS) - NOTIFICATION_THRESHOLD_DAYS) && (row.pto_days_remaining || 0) > 0,
        carry_forward_days: row.carried_forward || 0,
        effective_pto_limit: row.effective_pto_limit_days || PTO_LIMIT_DAYS
      }))

      return summaries
    } catch (error) {
      console.error('Error loading employee summaries:', error)
      return []
    }
  }

  const loadPTORecords = async (year: number) => {
    try {
      setLoading(true)
      const yearStart = startOfYear(new Date(year, 0, 1))
      const yearEnd = endOfYear(new Date(year, 11, 31))

      const { data, error } = await supabase
        .from('pto_records')
        .select('*')
        .gte('date', format(yearStart, 'yyyy-MM-dd'))
        .lte('date', format(yearEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading PTO records:', error)
        toast({
          title: "Error Loading Data",
          description: "Failed to fetch leave records. Please try again.",
          variant: "destructive",
        })
        return
      }

      // Use records as-is since database handles PTO status calculation
      setPtoRecords(data || [])

      // Load summaries from the database view
      const summaries = await loadEmployeeSummariesFromView(year)
      setEmployeeSummaries(summaries)

    } catch (error) {
      console.error('Error loading PTO records:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCarryForwardRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('carry_forward_requests')
        .select('*')

      if (error) {
        console.error('Error loading carry forward requests:', error)
        return
      }

      setCarryForwardRequests(data || [])
    } catch (error) {
      console.error('Error loading carry forward requests:', error)
    }
  }

  const handlePTOApproval = async (recordId: string, action: 'approve' | 'reject') => {
    setProcessingApprovals(prev => new Set(prev).add(recordId))

    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected'

      // Step 1: Update the record's status in the database.
      const { error: updateError } = await supabase
        .from('pto_records')
        .update({
          status: newStatus,
          approved_at: newStatus === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', recordId)

      if (updateError) {
        console.error('Error processing PTO approval:', updateError)
        toast({
          title: "Approval Failed",
          description: "Failed to process the leave request. Please try again.",
          variant: "destructive",
        })
        return
      }

      // NOTE: Removed the call to 'recalculateEmployeePTOStatus' here.
      // The backend function was likely causing all other non-PTO entries to be overwritten.
      // The UI will now rely on the single-record update and a full data reload to stay in sync.

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The leave request has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
      })

      // Step 2: Reload all data to ensure the UI is fully synchronized with the database.
      await loadPTORecords(selectedYear)

    } catch (error) {
      console.error('Error processing PTO approval:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred during approval.",
        variant: "destructive",
      })
    } finally {
      setProcessingApprovals(prev => {
        const newSet = new Set(prev)
        newSet.delete(recordId)
        return newSet
      })
    }
  }

  const handleCarryForwardApproval = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingCarryForward(prev => new Set(prev).add(requestId))

    try {
      const { error } = await supabase
        .from('carry_forward_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: action === 'approve' ? new Date().toISOString() : null
        })
        .eq('id', requestId)

      if (error) {
        console.error('Error processing carry forward approval:', error)
        toast({
          title: "Approval Failed",
          description: "Failed to process the carry forward request. Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The carry forward request has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
      })

      await Promise.all([loadPTORecords(selectedYear), loadCarryForwardRequests()])

    } catch (error) {
      console.error('Error processing carry forward approval:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred during approval.",
        variant: "destructive",
      })
    } finally {
      setProcessingCarryForward(prev => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
    }
  }

  const prepareAndShowNotificationPopup = async () => {
    const employeesNeedingNotification = employeeSummaries.filter(emp => emp.needs_notification)
    if (employeesNeedingNotification.length === 0) {
      toast({
        title: "No Alerts Needed",
        description: "No employees are currently approaching their PTO limit.",
      })
      return
    }

    const recipients = employeesNeedingNotification.map(emp => ({
      name: emp.employee_name,
      email: emp.sender_email,
    }))

    const subject = `Urgent: Your PTO is Approaching the Limit for ${selectedYear}`

    const body = `Dear {name},
This is an automated notification to inform you that your paid time off (PTO) balance is approaching the annual limit of ${PTO_LIMIT_DAYS} days.

Please be mindful of your remaining balance for the current calendar year.

Best regards,
Your HR Team
`
    setEmailPreview({ recipients, subject, body })
    setIsPopupOpen(true)
  }

  const sendConfirmedNotifications = async () => {
    if (emailPreview.recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Cannot send emails without recipients.",
        variant: "destructive",
      })
      return
    }

    setSendingNotifications(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: "Authentication Error",
          description: "Please log in to send notifications.",
          variant: "destructive",
        })
        setSendingNotifications(false)
        return
      }

      const response = await fetch('/api/send-pto-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          subject: emailPreview.subject,
          body: emailPreview.body,
          recipients: emailPreview.recipients,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message || "Emails sent successfully!",
        })
      } else {
        toast({
          title: "Failed to Send Notifications",
          description: data.message || "An unexpected error occurred.",
          variant: "destructive",
        })
      }

    } catch (error) {
      console.error('Error sending notifications:', error)
      toast({
        title: "Failed to Send Notifications",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setSendingNotifications(false)
      setIsPopupOpen(false)
    }
  }

  const deletePTORecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pto_records')
        .delete()
        .eq('id', id)
      if (error) {
        console.error('Error deleting PTO record:', error)
        toast({
          title: "Deletion Failed",
          description: "Failed to delete the PTO record.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Record Deleted",
        description: "The leave record has been successfully deleted.",
      })
      await loadPTORecords(selectedYear)
    } catch (error) {
      console.error('Error deleting PTO record:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred during deletion.",
        variant: "destructive",
      })
    }
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Day', 'Hours', 'Employee Name', 'Employee ID', 'Email', 'Type', 'Status']
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(record => [
        record.date,
        record.day,
        record.hours,
        `"${record.employee_name}"`,
        record.employee_id,
        record.sender_email,
        record.is_pto ? 'PTO' : 'Non-PTO',
        record.status || 'approved'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Leave_Records_${selectedYear}_as_of_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getChartData = () => {
    const filteredSummaries = reportsFilterEmployee === "all"
      ? employeeSummaries
      : employeeSummaries.filter(emp => emp.employee_name === reportsFilterEmployee)

    const totalPtoHours = filteredSummaries.reduce((sum, emp) => sum + emp.total_pto_hours, 0)
    const totalNonPtoHours = filteredSummaries.reduce((sum, emp) => sum + emp.non_pto_hours, 0)

    const pieData = [
      { name: 'PTO Leave', value: totalPtoHours, color: '#10b981' },
      { name: 'Non-PTO Leave', value: totalNonPtoHours, color: '#f59e0b' }
    ]

    const barData = filteredSummaries.map(emp => ({
      name: emp.employee_name,
      ptoUsed: emp.total_pto_days,
      remaining: emp.remaining_pto_days,
      nonPto: emp.non_pto_days
    }))

    return { pieData, barData }
  }

  const { pieData, barData } = getChartData()

  useEffect(() => {
    Promise.all([loadPTORecords(selectedYear), loadCarryForwardRequests()])
    const interval = setInterval(() => {
      Promise.all([loadPTORecords(selectedYear), loadCarryForwardRequests()])
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [selectedYear])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const employeeName = payload[0].payload.name
      const ptoUsed = payload.find((p: any) => p.name === "PTO Used")?.value || 0
      const remaining = payload.find((p: any) => p.name === "PTO Remaining")?.value || 0
      const nonPto = payload.find((p: any) => p.name === "Non-PTO Leave")?.value || 0
      const totalPto = ptoUsed + remaining

      return (
        <div className="rounded-lg border bg-white p-2 shadow-sm text-black">
          <p className="font-bold">{employeeName}</p>
          <p className="text-green-500">{`PTO Used: ${ptoUsed.toFixed(1)} days`}</p>
          <p className="text-gray-400">{`PTO Remaining: ${remaining.toFixed(1)} days`}</p>
          <p className="text-gray-600">{`Total PTO Available: ${totalPto.toFixed(1)} days`}</p>
          <p className="text-orange-500">{`Non-PTO Leave: ${nonPto.toFixed(1)} days`}</p>
        </div>
      )
    }
    return null
  }

  const pendingPTORequests = ptoRecords.filter(r => r.status === 'pending').length
  const pendingCarryForwardRequests = carryForwardRequests.filter(req => req.status === 'pending').length

  const yearOptions = [
    new Date().getFullYear(),
    new Date().getFullYear() + 1
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-800 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        <div>
          <CardTitle className="text-white">Employee Leave Tracking</CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            PTO limit: {PTO_LIMIT_DAYS} days per employee
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger id="year-select" className="w-[120px] bg-gray-950 text-white">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent className="bg-gray-950 text-white">
                {yearOptions.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year} {year === new Date().getFullYear()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={exportToCSV}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Pending Requests Alerts */}
      {(pendingPTORequests > 0 || pendingCarryForwardRequests > 0) && (
        <Alert className="bg-blue-900/20 border-blue-700">
          <Clock className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-blue-200">Pending Approvals</AlertTitle>
          <AlertDescription className="text-blue-300">
            {pendingPTORequests > 0 && (
              <span><strong>{pendingPTORequests} Leave requests</strong> pending approval. </span>
            )}
            {pendingCarryForwardRequests > 0 && (
              <span><strong>{pendingCarryForwardRequests} carry forward requests</strong> pending approval.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* PTO Alert Summary */}
      {employeeSummaries.filter(emp => emp.needs_notification).length > 0 && (
        <Alert className="bg-orange-900 border-orange-700">
          <AlertTriangle className="h-4 w-4 text-orange-400" />
          <AlertDescription className="text-orange-200">
            <strong>{employeeSummaries.filter(emp => emp.needs_notification).length} employees</strong> are approaching their PTO limit and may need notifications.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for Leave Overview vs Reports vs Approvals */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="overview" className="text-gray-200 data-[state=active]:bg-gray-950">Leave Overview</TabsTrigger>
          <TabsTrigger value="approvals" className="relative text-gray-200 data-[state=active]:bg-gray-950">
            Approvals
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-gray-200 data-[state=active]:bg-gray-950">Reports & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="employee" className="text-white">Filter by Employee</Label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="bg-gray-950 text-white">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent className="bg-gray-950">
                  <SelectItem value="all">All employees</SelectItem>
                  {uniqueEmployees.map(employee => (
                    <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start-date" className="text-white">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-gray-950 text-white"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-white">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-gray-950 text-white"
              />
            </div>
          </div>

          {/* Records Table */}
          <Card className="bg-white border-gray-700">
            <CardHeader>
              <CardTitle className="text-black">Leave Records</CardTitle>
              <CardDescription className="text-gray-400">
                Showing {filteredRecords.length} of {ptoRecords.length} records for {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                </div>
              ) : (
                <div className="overflow-auto max-h-96 border border-gray-300 rounded-lg">
                  <Table className="min-w-full">
                    <TableHeader className="bg-gray-200 z-10">
                      <TableRow className="border-gray-700 bg-gray-200">
                        <TableHead className="text-black sticky top-0">Employee ID</TableHead>
                        <TableHead className="text-black sticky top-0">Employee</TableHead>
                        <TableHead className="text-black sticky top-0">Date</TableHead>
                        <TableHead className="text-black sticky top-0">Day</TableHead>
                        <TableHead className="text-black sticky top-0">Hours</TableHead>
                        <TableHead className="text-black sticky top-0">Leave Type</TableHead>
                        <TableHead className="text-black sticky top-0">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => {
                        return (
                          <TableRow key={record.id} className="border-gray-700">
                            <TableCell className="text-black" >{record.employee_id}</TableCell>
                            <TableCell className="text-black" >{record.employee_name}</TableCell>
                            <TableCell className="text-black">
                              {format(parseISO(record.date), "yyyy-MM-dd")}
                            </TableCell>
                            <TableCell className="text-black">{record.day}</TableCell>
                            <TableCell className="text-black">
                              <Badge variant="outline" className="border-blue-500 text-blue-400">
                                {record.hours}h
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {/* Add a new condition that checks for 'rejected' status first */}
                              {record.status === 'rejected' ? (
                                <Badge
                                  variant="outline"
                                  className="border-red-500 text-red-400"
                                >
                                  Rejected Leave
                                </Badge>
                              ) : (
                                // Only apply the PTO/Non-PTO logic for non-rejected requests
                                <Badge
                                  variant="outline"
                                  className={record.is_pto ? "border-green-500 text-green-400" : "border-orange-500 text-orange-400"}
                                >
                                  {record.is_pto ? "PTO" : "Non-PTO"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  record.status === 'approved' ? "bg-green-100 text-green-700" :
                                    record.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                                      "bg-red-100 text-red-700"
                                }
                              >
                                {record.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                                {record.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                {record.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                                {record.status === 'approved' ? 'Approved' :
                                  record.status === 'pending' ? 'Pending' : 'Rejected'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-6">
          <Card className="bg-white border-gray-700">
            <CardHeader>
              <CardTitle className="text-black">Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {ptoRecords.filter(r => r.status === "pending").length === 0 ? (
                <p className="text-gray-400">No pending leave requests for {selectedYear}.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 bg-gray-200">
                      <TableHead className="text-black">Employee</TableHead>
                      <TableHead className="text-black">Date</TableHead>
                      <TableHead className="text-black">Hours</TableHead>
                      <TableHead className="text-black">Reason</TableHead>
                      <TableHead className="text-right text-black">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ptoRecords.filter(r => r.status === "pending").map(r => (
                      <TableRow key={r.id} className="border-gray-700">
                        <TableCell className="text-black">{r.employee_name}</TableCell>
                        <TableCell className="text-black">{format(parseISO(r.date), "yyyy-MM-dd")}</TableCell>
                        <TableCell className="text-black">
                          <Badge variant="outline" className="border-blue-500 text-blue-400">
                            {r.hours}h
                          </Badge>
                        </TableCell>
                        <TableCell className="text-black">{r.request_reason || "-"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            className="bg-white text-black hover:bg-gray-800 hover:text-white"
                            onClick={() => handlePTOApproval(r.id, "approve")}
                            disabled={processingApprovals.has(r.id)}
                          >
                            {processingApprovals.has(r.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-white text-black hover:bg-gray-800 hover:text-white"
                            onClick={() => handlePTOApproval(r.id, "reject")}
                            disabled={processingApprovals.has(r.id)}
                          >
                            {processingApprovals.has(r.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-700">
            <CardHeader>
              <CardTitle className="text-black">Carry Forward Requests</CardTitle>
              <CardDescription className="text-gray-400">
                Requests to carry unused PTO days to the following year
              </CardDescription>
            </CardHeader>
            <CardContent>
              {carryForwardRequests.filter(r => r.status === "pending").length === 0 ? (
                <p className="text-gray-400">No pending carry forward requests.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 bg-gray-200">
                      <TableHead className="text-black">Employee</TableHead>
                      <TableHead className="text-black">From Year</TableHead>
                      <TableHead className="text-black">To Year</TableHead>
                      <TableHead className="text-black">Days Requested</TableHead>
                      <TableHead className="text-right text-black">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carryForwardRequests.filter(r => r.status === "pending").map(r => (
                      <TableRow key={r.id} className="border-gray-700">
                        <TableCell className="text-black">{r.employee_name}</TableCell>
                        <TableCell className="text-black">
                          <Badge variant="outline" className="border-gray-500 text-gray-600">
                            {r.from_year}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-black">
                          <Badge variant="outline" className="border-blue-500 text-blue-600">
                            {r.to_year}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-black">
                          <Badge variant="outline" className="border-purple-500 text-purple-600">
                            {r.days_requested} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            className="bg-white text-black hover:bg-gray-800 hover:text-white"
                            onClick={() => handleCarryForwardApproval(r.id, "approve")}
                            disabled={processingCarryForward.has(r.id)}
                          >
                            {processingCarryForward.has(r.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-white text-black hover:bg-gray-800 hover:text-white"
                            onClick={() => handleCarryForwardApproval(r.id, "reject")}
                            disabled={processingCarryForward.has(r.id)}
                          >
                            {processingCarryForward.has(r.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          {/* Employee Filter for Reports */}
          <div className="w-full max-w-sm">
            <Label htmlFor="reports-filter" className="text-white">Filter by Employee</Label>
            <Select value={reportsFilterEmployee} onValueChange={setReportsFilterEmployee}>
              <SelectTrigger className="bg-gray-950 text-white">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent className="bg-gray-950">
                <SelectItem value="all">All employees</SelectItem>
                {uniqueEmployees.map(employee => (
                  <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            {/* Bar Chart */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-black flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Employee PTO Usage
                </CardTitle>
                <CardDescription className="text-gray-400">PTO vs Non-PTO days used</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#4a5568" tick={false} />
                      <YAxis stroke="#4a5568" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="ptoUsed" name="PTO Used" stackId="a" fill="#10b981" />
                      <Bar dataKey="remaining" name="PTO Remaining" stackId="a" fill="#6b7280" />
                      <Bar dataKey="nonPto" name="Non-PTO Leave" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Summary Table */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-black">Employee Leave Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 bg-gray-200">
                      <TableHead className="text-black">Employee</TableHead>
                      <TableHead className="text-black">PTO Used</TableHead>
                      <TableHead className="text-black">PTO Remaining</TableHead>
                      <TableHead className="text-black">Non-PTO</TableHead>
                      <TableHead className="text-black">Effective Limit</TableHead>
                      <TableHead className="text-black">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reportsFilterEmployee === "all" ? employeeSummaries : employeeSummaries.filter(emp => emp.employee_name === reportsFilterEmployee)).map((emp) => (
                      <TableRow key={emp.employee_id} className="border-gray-700">
                        <TableCell className="text-black">{emp.employee_name}</TableCell>
                        <TableCell className="text-gray-300">
                          <Badge variant="outline" className="border-blue-500 text-blue-400">
                            {emp.total_pto_days.toFixed(1)} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <Badge
                            variant="outline"
                            className={emp.remaining_pto_days <= 1
                              ? "border-red-500 text-red-400"
                              : "border-green-500 text-green-400"
                            }
                          >
                            {emp.remaining_pto_days.toFixed(1)} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {emp.non_pto_days > 0 ? (
                            <Badge variant="outline" className="border-orange-500 text-orange-400">
                              {emp.non_pto_days.toFixed(1)} days
                            </Badge>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <Badge variant="outline" className="border-purple-500 text-purple-400">
                            {emp.effective_pto_limit} days
                          </Badge>
                          {emp.carry_forward_days > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              (+{emp.carry_forward_days} carry)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {emp.needs_notification ? (
                            <Badge className="bg-orange-600 text-white">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Alert Needed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Good
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Notification Preview Modal */}
      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Email Preview</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review the notification email before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <strong className="text-white">Recipients:</strong>
              <ul className="list-disc list-inside text-gray-300 mt-2">
                {emailPreview.recipients.map((r, i) => (
                  <li key={i}>{r.name} ({r.email})</li>
                ))}
              </ul>
            </div>
            <div>
              <strong className="text-white">Subject:</strong>
              <p className="text-gray-300">{emailPreview.subject}</p>
            </div>
            <div>
              <strong className="text-white">Body:</strong>
              <pre className="whitespace-pre-wrap text-gray-300 bg-gray-800 p-3 rounded text-sm">{emailPreview.body}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPopupOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendConfirmedNotifications} 
              disabled={sendingNotifications}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {sendingNotifications ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}