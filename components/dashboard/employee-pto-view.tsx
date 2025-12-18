"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Plus, BarChart3, Loader2, Clock, CheckCircle, XCircle, ArrowRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format, parseISO, startOfYear, endOfYear, isFuture, isToday } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"

/* ---------------- TYPES ---------------- */
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
  status: string
  request_reason?: string
}

interface PTORequest {
  start_date: string
  end_date: string
  hours: number
  reason: string
}

interface CarryForwardRequest {
  days_to_carry: number
}

interface Employee {
  employee_id: string
  name: string
  email_id: string
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
  carry_forward_days: number
  effective_pto_limit: number
}

/* ---------------- MAIN ---------------- */
export default function EmployeePTOTrackingTab() {
  const [ptoRecords, setPtoRecords] = useState<PTORecord[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [activeTab, setActiveTab] = useState("overview")

  const [isPTORequestOpen, setIsPTORequestOpen] = useState(false)
  const [ptoRequest, setPtoRequest] = useState<PTORequest>({
    start_date: "",
    end_date: "",
    hours: 8,
    reason: "",
  })

  const [isCarryForwardOpen, setIsCarryForwardOpen] = useState(false)
  const [carryForwardRequest, setCarryForwardRequest] = useState<CarryForwardRequest>({
    days_to_carry: 0,
  })
  const [submittingCarryForward, setSubmittingCarryForward] = useState(false)

  const [submittingPTORequest, setSubmittingPTORequest] = useState(false)

  const { toast } = useToast()

  const BASE_PTO_LIMIT_DAYS = 12
  const currentYear = selectedYear
  const nextYear = currentYear + 1

  const yearStart = startOfYear(new Date(selectedYear, 0, 1))
  const yearEnd = endOfYear(new Date(selectedYear, 11, 31))

  /* ---------------- LOADERS ---------------- */

  const loadEmployeeInfo = async (email: string) => {
    const { data } = await supabase
      .from("employees")
      .select("employee_id, name, email_id")
      .eq("email_id", email)
      .single()

    setCurrentEmployee(
      data ?? {
        employee_id: "TEMP_" + Date.now(),
        name: "Unknown Employee",
        email_id: email,
      }
    )
  }

  const loadPTORecords = async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    setCurrentUser(user)

    if (!user) {
      setLoading(false)
      return
    }

    await loadEmployeeInfo(user.email!)

    const { data } = await supabase
      .from("pto_records")
      .select("*")
      .eq("sender_email", user.email)
      .order("date", { ascending: false })

    setPtoRecords(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadPTORecords()
  }, [selectedYear])

  /* ---------------- HELPERS ---------------- */

  const getDatesBetween = (start: string, end: string) => {
    const dates: string[] = []
    let current = new Date(start)
    const last = new Date(end)

    while (current <= last) {
      dates.push(current.toISOString().split("T")[0])
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  const getFilteredRecords = () =>
    ptoRecords.filter((r) => {
      const d = new Date(r.date)
      return (
        r.sender_email === currentEmployee?.email_id &&
        d >= yearStart &&
        d <= yearEnd &&
        (!dateRange.start || r.date >= dateRange.start) &&
        (!dateRange.end || r.date <= dateRange.end)
      )
    })

  const getCurrentUserSummary = (): EmployeePTOSummary | null => {
    if (!currentEmployee) return null

    const approved = ptoRecords.filter((r) => {
      const d = new Date(r.date)
      return (
        r.sender_email === currentEmployee.email_id &&
        r.status === "approved" &&
        d >= yearStart &&
        d <= yearEnd
      )
    })

    let ptoHours = 0
    let nonPtoHours = 0

    approved.forEach((r) => (r.is_pto ? (ptoHours += r.hours) : (nonPtoHours += r.hours)))

    const ptoDays = ptoHours / 8
    const nonPtoDays = nonPtoHours / 8
    const remaining = Math.max(0, BASE_PTO_LIMIT_DAYS - ptoDays)

    return {
      employee_id: currentEmployee.employee_id,
      employee_name: currentEmployee.name,
      sender_email: currentEmployee.email_id,
      total_pto_hours: ptoHours,
      total_pto_days: ptoDays,
      remaining_pto_days: remaining,
      non_pto_hours: nonPtoHours,
      non_pto_days: nonPtoDays,
      carry_forward_days: 0,
      effective_pto_limit: BASE_PTO_LIMIT_DAYS,
    }
  }

  const summary = getCurrentUserSummary()
  const filteredRecords = getFilteredRecords()

  const chartData = summary
    ? [
        {
          name: "My PTO Usage",
          ptoUsed: summary.total_pto_days,
          remaining: summary.remaining_pto_days,
          nonPto: summary.non_pto_days,
        },
      ]
    : []

  const CustomTooltip = ({ active, payload }: any) =>
    active && payload ? (
      <div className="bg-white p-2 border rounded text-black">
        {payload.map((p: any) => (
          <p key={p.name}>{`${p.name}: ${p.value.toFixed(1)} days`}</p>
        ))}
      </div>
    ) : null

    /* SQL TO ADD UNIQUE CONSTRAINT TO PTO RECORDS TABLE
    
    ALTER TABLE pto_records
    ADD CONSTRAINT unique_employee_date
    UNIQUE (employee_id, date);
    */

  /* ---------------- PTO SUBMISSION (MOBILE LOGIC) ---------------- */
const submitPTORequest = async () => {
  if (!currentUser || !currentEmployee || !ptoRequest.start_date || !ptoRequest.end_date) {
    toast({ title: "Invalid Request", variant: "destructive" })
    return
  }

  setSubmittingPTORequest(true)

  try {
    const requestedDates = getDatesBetween(
      ptoRequest.start_date,
      ptoRequest.end_date
    )

    // 🔴 STEP 1: Check for existing PTO on any requested date
    const { data: existingRecords, error } = await supabase
      .from("pto_records")
      .select("date")
      .eq("sender_email", currentEmployee.email_id)
      .in("date", requestedDates)

    if (error) {
      throw error
    }

    if (existingRecords && existingRecords.length > 0) {
      const conflictDates = existingRecords.map(r => r.date).join(", ")

      toast({
        title: "Date Conflict",
        description: `You already have leave booked on: ${conflictDates}`,
        variant: "destructive",
      })

      setSubmittingPTORequest(false)
      return
    }

    // 🟢 STEP 2: Continue with existing PTO logic
    const yearPtoRecords = ptoRecords.filter(r => {
      const d = new Date(r.date)
      return (
        r.sender_email === currentEmployee.email_id &&
        r.is_pto &&
        d >= yearStart &&
        d <= yearEnd
      )
    })

    const approvedDays = yearPtoRecords.filter(r => r.status === "approved").length
    const pendingDays = yearPtoRecords.filter(r => r.status === "pending").length
    const remainingPTO = BASE_PTO_LIMIT_DAYS - approvedDays - pendingDays

    const rows = requestedDates.map((date, index) => ({
      date,
      day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      hours: 8,
      employee_name: currentEmployee.name,
      employee_id: currentEmployee.employee_id,
      sender_email: currentEmployee.email_id,
      activity: index < remainingPTO ? "PTO Request" : "Non-PTO Leave Request",
      status: "pending",
      request_reason: ptoRequest.reason,
      is_pto: index < remainingPTO,
    }))

    await supabase.from("pto_records").insert(rows)

    toast({
      title: "Leave Request Submitted",
      description: `${rows.length} day(s) submitted for approval`,
    })

    setIsPTORequestOpen(false)
    setPtoRequest({ start_date: "", end_date: "", hours: 8, reason: "" })
    loadPTORecords()

  } catch (err) {
    console.error(err)
    toast({
      title: "Error",
      description: "Failed to submit leave request.",
      variant: "destructive",
    })
  } finally {
    setSubmittingPTORequest(false)
  }
}



  const submitCarryForwardRequest = async () => {
    setSubmittingCarryForward(true)
    setTimeout(() => {
      toast({ title: "Carry Forward Submitted" })
      setSubmittingCarryForward(false)
      setIsCarryForwardOpen(false)
    }, 800)
  }

  /* ---------------- RENDER ---------------- */

  if (!currentEmployee) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>My Leave Tracking</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Calendar Year {currentYear} • Your PTO limit: {summary?.effective_pto_limit || BASE_PTO_LIMIT_DAYS} days
            {summary && summary.carry_forward_days > 0 && (
              <span className="ml-2 text-green-600">
                (includes {summary.carry_forward_days} carried forward days)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32 bg-black text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {[new Date().getFullYear(), new Date().getFullYear() + 1].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                        {year}
                    </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setIsPTORequestOpen(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Request Leave
          </Button>
          {selectedYear === new Date().getFullYear() && summary && summary.remaining_pto_days > 0 && (
            <Button
              onClick={() => setIsCarryForwardOpen(true)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Carry Forward
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Leave Overview</TabsTrigger>
          <TabsTrigger value="reports">My Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date" className="text-white">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-black text-white"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-white">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-black text-white"
              />
            </div>
          </div>

          {/* Records Table */}
          <Card className="bg-white border-gray-700">
            <CardHeader>
              <CardTitle className="text-black">My Leave Records</CardTitle>
              <CardDescription className="text-gray-400">
                Showing {filteredRecords.length} records for {currentYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                </div>
              ) : (
                <div className="overflow-auto max-h-96 border border-gray-300 rounded-lg">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow className="bg-gray-200">
                        <TableHead className="text-black">Date</TableHead>
                        <TableHead className="text-black">Day</TableHead>
                        <TableHead className="text-black">Hours</TableHead>
                        <TableHead className="text-black">Leave Type</TableHead>
                        <TableHead className="text-black">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id} className="border-gray-700">
                          <TableCell className="text-black">
                            {format(parseISO(record.date), 'yyyy-MM-dd')}
                          </TableCell>
                          <TableCell className="text-black">{record.day}</TableCell>
                          <TableCell className="text-black">
                            <Badge variant="outline" className="border-blue-500 text-blue-400">
                              {record.hours}h
                            </Badge>
                          </TableCell>
                          <TableCell className="text-black">
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
                          <TableCell className="text-black">
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
                                record.status === 'pending' ? 'Pending Approval' : 'Rejected'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                            No leave records found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Summary Table */}
            <Card className="bg-white border-gray-700">
              <CardHeader>
                <CardTitle className="text-black">Leave Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {summary && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700">
                          <TableHead className="text-black">PTO Used</TableHead>
                          <TableHead className="text-black">PTO Remaining</TableHead>
                          <TableHead className="text-black">Non-PTO</TableHead>
                          {summary.carry_forward_days > 0 && (
                            <TableHead className="text-black">Carried Forward</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-gray-700">
                          <TableCell className="text-black">
                            <Badge variant="outline" className="border-blue-500 text-blue-600">
                              {summary.total_pto_days.toFixed(1)} days
                            </Badge>
                          </TableCell>
                          <TableCell className="text-black">
                            <Badge
                              variant="outline"
                              className={summary.remaining_pto_days <= 1
                                ? "border-red-500 text-red-600"
                                : "border-green-500 text-green-600"
                              }
                            >
                              {summary.remaining_pto_days.toFixed(1)} days
                            </Badge>
                          </TableCell>
                          <TableCell className="text-black">
                              <Badge variant="outline" className="border-orange-500 text-orange-600">
                                  {(summary.non_pto_days || 0).toFixed(1)} days
                              </Badge>
                          </TableCell>
                          {summary.carry_forward_days > 0 && (
                            <TableCell className="text-black">
                              <Badge variant="outline" className="border-purple-500 text-purple-600">
                                {summary.carry_forward_days.toFixed(1)} days
                              </Badge>
                            </TableCell>
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card className="bg-white border-gray-700">
              <CardHeader>
                <CardTitle className="text-black flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  PTO Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="ptoUsed" stackId="a" fill="#10b981" name="PTO Used" />
                      <Bar dataKey="remaining" stackId="a" fill="#6b7280" name="PTO Remaining" />
                      <Bar dataKey="nonPto" fill="#f59e0b" name="Non-PTO" />
                      {summary && summary.carry_forward_days > 0 && (
                        <Bar dataKey="carryForward" fill="#8b5cf6" name="Carried Forward" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* PTO Request Dialog */}
      <Dialog open={isPTORequestOpen} onOpenChange={setIsPTORequestOpen}>
        <DialogContent className="bg-gray-950 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Request Leave</DialogTitle>
            <DialogDescription className="text-gray-400">
              Submit a new leave request for manager approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Start Date</Label>
                <Input
                  type="date"
                  min={format(new Date(), "yyyy-MM-dd")}
                  value={ptoRequest.start_date}
                  onChange={(e) =>
                    setPtoRequest(prev => ({ ...prev, start_date: e.target.value }))
                  }
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label className="text-white">End Date</Label>
                <Input
                  type="date"
                  min={ptoRequest.start_date || format(new Date(), "yyyy-MM-dd")}
                  value={ptoRequest.end_date}
                  onChange={(e) =>
                    setPtoRequest(prev => ({ ...prev, end_date: e.target.value }))
                  }
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>



            <div>
              <Label htmlFor="pto-hours" className="text-white">Hours</Label>
              <Input
                id="pto-hours"
                type="number"
                min="1"
                max="8"
                value={ptoRequest.hours}
                onChange={(e) => setPtoRequest(prev => ({ ...prev, hours: parseInt(e.target.value) || 0 }))}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="pto-reason" className="text-white">Reason (Optional)</Label>
              <Textarea
                id="pto-reason"
                value={ptoRequest.reason}
                onChange={(e) => setPtoRequest(prev => ({ ...prev, reason: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white"
                placeholder="Brief reason for PTO request..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPTORequestOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitPTORequest}
              disabled={submittingPTORequest}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submittingPTORequest ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {submittingPTORequest ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Carry Forward Dialog */}
      <Dialog open={isCarryForwardOpen} onOpenChange={setIsCarryForwardOpen}>
        <DialogContent className="bg-gray-950 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Request PTO Carry Forward</DialogTitle>
            <DialogDescription className="text-gray-400">
              Request to carry forward unused PTO days to {nextYear}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {summary && (
              <Alert className="bg-blue-50 border-blue-200">
                <Calendar className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  You have <strong>{summary.remaining_pto_days.toFixed(1)} days</strong> remaining that can be carried forward.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="carry-days" className="text-white">Days to Carry Forward</Label>
              <Input
                id="carry-days"
                type="number"
                min="1"
                max={summary?.remaining_pto_days || 0}
                step="0.5"
                value={carryForwardRequest.days_to_carry}
                onChange={(e) => setCarryForwardRequest(prev => ({
                  ...prev,
                  days_to_carry: parseFloat(e.target.value) || 0
                }))}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maximum: {summary?.remaining_pto_days.toFixed(1)} days available to carry forward
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCarryForwardOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCarryForwardRequest}
              disabled={submittingCarryForward || !carryForwardRequest.days_to_carry}
              className="bg-green-600 hover:bg-green-700"
            >
              {submittingCarryForward ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              {submittingCarryForward ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}