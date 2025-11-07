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
import { format, parseISO, startOfYear, endOfYear, addYears, isFuture, isToday } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
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
  status: string
  request_reason?: string
}

interface PTORequest {
  date: string
  hours: number
  reason: string
}

interface CarryForwardRequest {
  days_to_carry: number
}

interface CarryForwardBalance {
  id: string
  employee_id: string
  employee_name: string
  sender_email: string
  year: number
  days_carried_forward: number
  days_used: number
  expires_at: string
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

interface Employee {
  employee_id: string
  name: string
  email_id: string
}

export default function EmployeePTOTrackingTab() {
  const [ptoRecords, setPtoRecords] = useState<PTORecord[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [carryForwardBalance, setCarryForwardBalance] = useState<CarryForwardBalance | null>(null)

  // PTO Request Modal States
  const [isPTORequestOpen, setIsPTORequestOpen] = useState(false)
  const [ptoRequest, setPtoRequest] = useState<PTORequest>({ date: "", hours: 8, reason: "" })
  const [submittingPTORequest, setSubmittingPTORequest] = useState(false)

  // Carry Forward Modal States
  const [isCarryForwardOpen, setIsCarryForwardOpen] = useState(false)
  const [carryForwardRequest, setCarryForwardRequest] = useState<CarryForwardRequest>({ days_to_carry: 0 })
  const [submittingCarryForward, setSubmittingCarryForward] = useState(false)

  const { toast } = useToast()

  const BASE_PTO_LIMIT_DAYS = 12
  const currentYear = selectedYear
  const nextYear = currentYear + 1
  const yearStart = startOfYear(new Date(currentYear, 0, 1))
  const yearEnd = endOfYear(new Date(currentYear, 11, 31))

  const loadEmployeeInfo = async (userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_id, name, email_id')
        .eq('email_id', userEmail)
        .single()

      if (error) {
        console.error('Error loading employee info:', error)
        // If employee not found, create a placeholder
        setCurrentEmployee({
          employee_id: 'TEMP_' + Date.now(),
          name: 'Unknown Employee',
          email_id: userEmail
        })
        return
      }

      setCurrentEmployee(data)
    } catch (error) {
      console.error('Error loading employee info:', error)
      setCurrentEmployee({
        employee_id: 'TEMP_' + Date.now(),
        name: 'Unknown Employee',
        email_id: userEmail
      })
    }
  }

  const loadCarryForwardBalance = async (employeeId: string, year: number) => {
    try {
      const { data, error } = await supabase
        .from('carry_forward_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading carry forward balance:', error)
        return 0
      }

      setCarryForwardBalance(data)
      return data ? (data.days_carried_forward - data.days_used) : 0
    } catch (error) {
      console.error('Error loading carry forward balance:', error)
      return 0
    }
  }

  const getCurrentUserSummary = (): EmployeePTOSummary | null => {
    if (!currentUser || !currentEmployee) return null

    const userRecords = ptoRecords.filter(record =>
      record.sender_email === currentUser.email &&
      new Date(record.date) >= yearStart &&
      new Date(record.date) <= yearEnd &&
      record.status === 'approved'
    )

    // Get carry forward for current year
    const carryForwardDays = carryForwardBalance ? (carryForwardBalance.days_carried_forward - carryForwardBalance.days_used) : 0
    const effectivePtoLimit = BASE_PTO_LIMIT_DAYS + carryForwardDays

    let totalPtoHours = 0
    let nonPtoHours = 0

    // Count PTO and non-PTO hours based on is_pto flag
    userRecords.forEach(record => {
      if (record.is_pto) {
        totalPtoHours += record.hours
      } else {
        nonPtoHours += record.hours
      }
    })

    const totalPtoDays = totalPtoHours / 8
    const remainingPtoDays = effectivePtoLimit - totalPtoDays
    const nonPtoDays = nonPtoHours / 8

    return {
      employee_id: currentEmployee.employee_id,
      employee_name: currentEmployee.name,
      sender_email: currentEmployee.email_id,
      total_pto_hours: totalPtoHours,
      total_pto_days: totalPtoDays,
      remaining_pto_days: Math.max(0, remainingPtoDays),
      non_pto_hours: nonPtoHours,
      non_pto_days: nonPtoDays,
      carry_forward_days: carryForwardDays,
      effective_pto_limit: effectivePtoLimit
    }
  }

  const getFilteredRecords = () => {
    if (!currentUser) return []

    return ptoRecords.filter(record => {
      const recordDate = new Date(record.date)
      const isCurrentUser = record.sender_email === currentUser.email
      const isInDateRange = recordDate >= yearStart && recordDate <= yearEnd
      const matchesCustomDateRange = (!dateRange.start || record.date >= dateRange.start) &&
        (!dateRange.end || record.date <= dateRange.end)

      return isCurrentUser && isInDateRange && matchesCustomDateRange
    })
  }

  const loadPTORecords = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (!user) return

      // Load employee information first
      await loadEmployeeInfo(user.email!)

      const { data, error } = await supabase
        .from('pto_records')
        .select('*')
        .eq('sender_email', user.email)
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading PTO records:', error)
        toast({
          title: "Error Loading Data",
          description: "Failed to fetch your leave records. Please try again.",
          variant: "destructive",
        })
        return
      }

      setPtoRecords(data || [])

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

  const submitPTORequest = async () => {
    if (!currentUser || !currentEmployee || !ptoRequest.date || ptoRequest.hours <= 0) {
      toast({
        title: "Invalid Request",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const requestDate = new Date(ptoRequest.date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    requestDate.setHours(0, 0, 0, 0);

    // Validate that the request date is not in the past
    if (!isFuture(requestDate) && !isToday(requestDate)) {
        toast({
            title: "Invalid Date",
            description: "You can only request PTO for future dates.",
            variant: "destructive",
        });
        return;
    }

    setSubmittingPTORequest(true)

    try {
      const dayName = requestDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      
      // Directly attempt to insert the record. The database's unique constraint will handle duplicates.
      const { error } = await supabase
        .from('pto_records')
        .insert({
          date: ptoRequest.date,
          day: dayName,
          hours: ptoRequest.hours,
          employee_name: currentEmployee.name,
          employee_id: currentEmployee.employee_id,
          sender_email: currentUser.email,
          activity: 'PTO Request',
          status: 'pending',
          request_reason: ptoRequest.reason,
          is_pto: false
        });

      if (error) {
        // Check for the unique constraint violation error code
        if (error.code === '23505') {
          toast({
            title: "Duplicate Request",
            description: `A PTO request for ${format(requestDate, 'yyyy-MM-dd')} already exists.`,
            variant: "destructive",
          });
        } else {
          // Handle all other types of Supabase errors
          console.error('Error submitting PTO request:', error);
          toast({
            title: "Submission Failed",
            description: "Failed to submit your PTO request. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Request Submitted",
        description: "Your leave request has been submitted for manager approval.",
      });

      setPtoRequest({ date: "", hours: 8, reason: "" });
      setIsPTORequestOpen(false);
      await loadPTORecords();

    } catch (error) {
      console.error('An unexpected error occurred:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while submitting your request.",
        variant: "destructive",
      });
    } finally {
      setSubmittingPTORequest(false);
    }
  }

  const submitCarryForwardRequest = async () => {
    if (!currentUser || !currentEmployee || carryForwardRequest.days_to_carry <= 0) {
      toast({
        title: "Invalid Request",
        description: "Please specify the number of days to carry forward.",
        variant: "destructive",
      })
      return
    }

    const summary = getCurrentUserSummary()
    if (!summary || carryForwardRequest.days_to_carry > summary.remaining_pto_days) {
      toast({
        title: "Invalid Request",
        description: "Cannot carry forward more days than you have remaining.",
        variant: "destructive",
      })
      return
    }

    setSubmittingCarryForward(true)

    try {
      // Check if a carry forward request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('carry_forward_requests')
        .select('id, status')
        .eq('employee_id', currentEmployee.employee_id)
        .eq('from_year', currentYear)
        .eq('to_year', nextYear)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing request:', checkError)
        toast({
          title: "Error",
          description: "Failed to check existing requests.",
          variant: "destructive",
        })
        return
      }

      if (existingRequest) {
        toast({
          title: "Request Already Exists",
          description: `You already have a ${existingRequest.status} carry forward request for ${currentYear} to ${nextYear}.`,
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from('carry_forward_requests')
        .insert({
          employee_id: currentEmployee.employee_id,
          employee_name: currentEmployee.name,
          sender_email: currentUser.email,
          from_year: currentYear,
          to_year: nextYear,
          days_requested: carryForwardRequest.days_to_carry,
          status: 'pending'
        })

      if (error) {
        console.error('Error submitting carry forward request:', error)
        toast({
          title: "Submission Failed",
          description: "Failed to submit your carry forward request. Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Request Submitted",
        description: `Your request to carry forward ${carryForwardRequest.days_to_carry} days to ${nextYear} has been submitted for approval.`,
      })

      setCarryForwardRequest({ days_to_carry: 0 })
      setIsCarryForwardOpen(false)

    } catch (error) {
      console.error('Error submitting carry forward request:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while submitting your request.",
        variant: "destructive",
      })
    } finally {
      setSubmittingCarryForward(false)
    }
  }

  const getChartData = () => {
    const summary = getCurrentUserSummary()
    if (!summary) return []

    return [{
      name: 'My PTO Usage',
      ptoUsed: summary.total_pto_days,
      remaining: summary.remaining_pto_days,
      nonPto: summary.non_pto_days,
      carryForward: summary.carry_forward_days
    }]
  }

  const chartData = getChartData()

  useEffect(() => {
    loadPTORecords()
  }, [selectedYear])

  useEffect(() => {
    if (currentEmployee) {
      loadCarryForwardBalance(currentEmployee.employee_id, selectedYear)
    }
  }, [currentEmployee, selectedYear])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-white p-2 shadow-sm text-black">
          <p className="font-bold">Your PTO Usage</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(1)} days`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const filteredRecords = getFilteredRecords()
  const summary = getCurrentUserSummary()

  if (!currentEmployee) {
    return (
      <div className="p-6">
        <Card className="bg-white border-gray-700">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-600" />
            <p className="text-gray-600">Loading employee information...</p>
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
            <div>
              <Label htmlFor="pto-date" className="text-white">Date</Label>
              <Input
                id="pto-date"
                type="date"
                value={ptoRequest.date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setPtoRequest(prev => ({ ...prev, date: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white"
              />
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