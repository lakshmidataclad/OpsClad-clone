'use client'

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, ChevronLeft, ChevronRight, User, PartyPopper, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

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
  status: 'pending' | 'approved' | 'rejected'
}

interface Employee {
  id: string
  name: string
  birthday: string
}

interface HolidayRecord{
  id: string
  holiday: string
  holiday_date: string
  holiday_description: string
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  ptoRecords: PTORecord[]
  birthdays: Employee[]
  holidays: HolidayRecord[]
}

interface SelectedDateInfo {
  date: Date
  ptoRecords: PTORecord[]
  birthdays: Employee[]
  holidays: HolidayRecord[]

}


// Utility functions for date handling
const formatDate = (date: Date, format: string): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const weekday = date.getDay()

  return format
    .replace('yyyy', year.toString())
    .replace('MMMM', months[month])
    .replace('MMM', monthsShort[month])
    .replace('EEEE', weekdays[weekday])
    .replace('dd', day.toString().padStart(2, '0'))
    .replace('d', day.toString())
}

const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const endOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

const addMonths = (date: Date, amount: number): Date => {
  const result = new Date(date)
  result.setMonth(result.getMonth() + amount)
  return result
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

const isSameDayMonth = (date1: Date, date2: Date): boolean => {
  return date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date())
}


const parseISODate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00')
}


const rangeIntersectsMonth = (
  start: string,
  end: string,
  monthKey: string
) => {
  return expandRange(start, end).some(d => d.startsWith(monthKey))
}


// Typing animation component
const TypingWelcome = ({ employeeName, onComplete }: { employeeName: string, onComplete: () => void }) => {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const fullText = `Welcome to OpsClad!`
  
  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + fullText[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, 50) // Typing speed - adjust as needed
      
      return () => clearTimeout(timeout)
    } else {
      // Wait 2 seconds after typing is complete, then fade out
      const fadeTimeout = setTimeout(() => {
        onComplete()
      }, 2000)
      
      return () => clearTimeout(fadeTimeout)
    }
  }, [currentIndex, fullText, onComplete])

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          {displayedText}
          <span className="animate-pulse">|</span>
        </h1>
      </div>
    </div>
  )
}

// Date Details Modal Component
const DateDetailsModal = ({ selectedDate, onClose }: { selectedDate: SelectedDateInfo | null, onClose: () => void }) => {
  if (!selectedDate) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">
              {formatDate(selectedDate.date, 'MMMM dd, yyyy')}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Birthdays Section */}
          {selectedDate.birthdays.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-yellow-400" />
                Birthdays ({selectedDate.birthdays.length})
              </h3>
              <div className="space-y-2">
                {selectedDate.birthdays.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <PartyPopper className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="text-white font-medium">{employee.name}</p>
                      <p className="text-yellow-300 text-sm">Happy Birthday! 🎉</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PTO Section */}
          {selectedDate.ptoRecords.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400" />
                Employees on Leave ({selectedDate.ptoRecords.length})
              </h3>
              <div className="space-y-2">
                {selectedDate.ptoRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-white font-medium">{record.employee_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Holidays Section */}
          {selectedDate.holidays.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-400" />
                Public Holidays ({selectedDate.holidays.length})
              </h3>
              <div className="space-y-2">
                {selectedDate.holidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-orange-400" />
                      <div>
                        <p className="text-white font-medium">{holiday.holiday}</p>
                        <p className="text-orange-300 text-sm">Public Holiday! 🎉</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Activity */}
          {selectedDate.ptoRecords.length === 0 && selectedDate.birthdays.length === 0 && selectedDate.holidays.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No activity scheduled for this date</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



const normalizeDate = (date: string | null): string | null => {
  if (!date) return null

  // ISO with time → YYYY-MM-DD
  if (date.includes("T")) {
    return date.split("T")[0]
  }

  // DD/MM/YYYY → YYYY-MM-DD
  if (date.includes("/")) {
    const [d, m, y] = date.split("/")
    if (y && m && d) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    }
  }

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  // Fallback (invalid / unexpected)
  return null
}

const formatISOToDDMMYYYY = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${d}-${m}-${y}`
}


const expandRange = (start: string, end: string): string[] => {
  const s = new Date(start)
  const e = new Date(end)
  const out: string[] = []
  const cur = new Date(s)

  while (cur <= e) {
    out.push(cur.toISOString().split("T")[0])
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

const buildContinuousRanges = (dates: string[]) => {
  if (!dates.length) return []
  const result: { start: string; end: string }[] = []
  let start = dates[0]
  let prev = dates[0]

  for (let i = 1; i < dates.length; i++) {
    const diff =
      (new Date(dates[i]).getTime() - new Date(prev).getTime()) / 86400000

    if (diff === 1) {
      prev = dates[i]
    } else {
      result.push({ start, end: prev })
      start = dates[i]
      prev = dates[i]
    }
  }

  result.push({ start, end: prev })
  return result
}





export default function HomePage() {
  const [ptoRecords, setPtoRecords] = useState<PTORecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [holidays, setHolidays] = useState<HolidayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showWelcome, setShowWelcome] = useState(true)
  const [showContent, setShowContent] = useState(false)
  const [selectedDate, setSelectedDate] = useState<SelectedDateInfo | null>(null)

  const [selectedMonth, setSelectedMonth] = useState(() => {
  const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const changeMonth = (direction: "prev" | "next") => {
    setSelectedMonth(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + (direction === "prev" ? -1 : 1))
      return d
    })
  }

  const selectedMonthKey = formatDate(selectedMonth, "yyyy-MM")
  
  const loadData = async () => {
    try {
      setLoading(true)

      // Load PTO records
      const { data: ptoData, error: ptoError } = await supabase
        .from('pto_records')
        .select('*')
        .order('date', { ascending: true })

      if (ptoError) {
        console.error('Error loading PTO records:', ptoError)
      } else {
        setPtoRecords(ptoData || [])
      }

      // Load employees with birthdays
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, name, birthday')
        .not('birthday', 'is', null)

      if (employeeError) {
        console.error('Error loading employees:', employeeError)
      } else {
        setEmployees(employeeData || [])
      }

      // Load Holidays
      const { data: holidays, error: holidayError } = await supabase
        .from('holidays')
        .select('id, holiday, holiday_date, holiday_description')
        .not('holiday_date', 'is', null)

      if (holidayError) {
        console.error('Error loading holidays:', holidayError)
      } else {
        setHolidays(holidays || [])
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Refresh data every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])


const paidPtoTable = useMemo(() => {
  const byEmp: Record<string, string[]> = {}

  ptoRecords.forEach(p => {
    if (!p.is_pto) return
    if (p.status === "rejected") return

    const start = normalizeDate(p.date)
    if (!start) return

    // 🔑 Month gate (single-day PTO works too)
    if (!rangeIntersectsMonth(start, start, selectedMonthKey)) return

    byEmp[p.employee_name] ||= []
    byEmp[p.employee_name].push(start)
  })

  return Object.entries(byEmp).map(([name, dates]) => ({
    name,
    ranges: buildContinuousRanges(dates.sort())
  }))
}, [ptoRecords, selectedMonthKey])

const unpaidPtoTable = useMemo(() => {
  const byEmp: Record<string, string[]> = {}

  ptoRecords.forEach(p => {
    if (p.is_pto) return
    if (p.status === "rejected") return

    const start = normalizeDate(p.date)
    if (!start) return

    // 🔑 Month gate
    if (!rangeIntersectsMonth(start, start, selectedMonthKey)) return

    byEmp[p.employee_name] ||= []
    byEmp[p.employee_name].push(start)
  })

  return Object.entries(byEmp).map(([name, dates]) => ({
    name,
    ranges: buildContinuousRanges(dates.sort())
  }))
}, [ptoRecords, selectedMonthKey])




  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    // Small delay before showing content for smooth transition
    setTimeout(() => {
      setShowContent(true)
    }, 300)
  }

  const getBirthdaysForDate = (date: Date): Employee[] => {
    return employees.filter(employee => {
      if (!employee.birthday) return false
      const birthdayDate = parseISODate(employee.birthday)
      return isSameDayMonth(birthdayDate, date)
    })
  }

    const getHolidaysForDate = (holiday_date: Date): HolidayRecord[] => {
    return holidays.filter(holiday => {
      if (!holiday.holiday_date) return false
    const normalized = normalizeDate(holiday.holiday_date)
      if (!normalized) return false
    const fn_holiday_date = parseISODate(normalized)      
    return isSameDayMonth(fn_holiday_date, holiday_date)
    })
  }


  const handleDateClick = (calendarDay: CalendarDay) => {
    setSelectedDate({
      date: calendarDay.date,
      ptoRecords: calendarDay.ptoRecords,
      birthdays: calendarDay.birthdays,
      holidays: calendarDay.holidays
    })
  }

  const generateCalendarDays = (): CalendarDay[] => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    
    // Get the first day of the week containing the first day of the month
    const calendarStart = new Date(monthStart)
    calendarStart.setDate(calendarStart.getDate() - monthStart.getDay())
    
    // Get the last day of the week containing the last day of the month
    const calendarEnd = new Date(monthEnd)
    calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()))
    
    const days = []
    const current = new Date(calendarStart)
    
    while (current <= calendarEnd) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days.map(day => ({
      date: day,
      isCurrentMonth: day.getMonth() === currentDate.getMonth(),
      ptoRecords: ptoRecords.filter(record => isSameDay(parseISODate(record.date), day)),
      birthdays: getBirthdaysForDate(day),
      holidays: getHolidaysForDate(day)
    }))
  }



  const upcomingEvents = useMemo(() => {
    const events: {
      id: string
      title: string
      date: string
      type: "Birthday" | "Holiday"
    }[] = []

    const selectedYear = selectedMonth.getFullYear()
    const selectedMonthStr = String(selectedMonth.getMonth() + 1).padStart(2, "0")

    // 🎂 Birthdays (month-based)
    employees.forEach(emp => {
      const normalized = normalizeDate(emp.birthday)
      if (!normalized) return

      const [, birthMonth, birthDay] = normalized.split("-")
      if (birthMonth !== selectedMonthStr) return

      events.push({
        id: `bday-${emp.id}`,
        title: `🎂 ${emp.name}`,
        date: `${selectedYear}-${birthMonth}-${birthDay}`,
        type: "Birthday",
      })
    })

    // 🎉 Holidays (FULL DATE-based)
    holidays.forEach(h => {
      const normalized = normalizeDate(h.holiday_date)
      if (!normalized) return

      // normalized is now YYYY-MM-DD
      if (!normalized.startsWith(`${selectedYear}-${selectedMonthStr}`)) return

      events.push({
        id: `hol-${h.id}`,
        title: `🎉 ${h.holiday}`,
        date: normalized,
        type: "Holiday",
      })
    })

    return events.sort((a, b) => a.date.localeCompare(b.date))
  }, [employees, holidays, selectedMonth])




  const todayEvents = ptoRecords.filter(record => isToday(parseISODate(record.date)))


  const calendarDays = generateCalendarDays()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => addMonths(prev, direction === 'prev' ? -1 : 1))
  }

  const getTotalEmployeesOnLeave = (date: Date) => {
    const recordsForDate = ptoRecords.filter(record => isSameDay(parseISODate(record.date), date))
    return new Set(recordsForDate.map(record => record.employee_id)).size
  }

  const getEmployeesOnLeaveToday = () => {
    return new Set(todayEvents.map(record => record.employee_name)).size
  }

  // Show welcome screen first
  if (showWelcome) {
    return <TypingWelcome employeeName='' onComplete={handleWelcomeComplete} />
  }

  // Show calendar content after welcome
  if (!showContent) {
    return <div className="bg-gray-800 min-h-screen" />
  }

  return (
    

 <div className="p-6 bg-gray-800 min-h-screen">
    <Tabs defaultValue="overview">

      {/* TAB HEADER */}
      <TabsList className="mb-6 bg-gray-900">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      {/* OVERVIEW TAB */}
    <TabsContent value="overview" className="space-y-6">


      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="flex items-center justify-between py-4">
          <Button
            variant="ghost"
            onClick={() => changeMonth("prev")}
            className="text-gray-400 hover:text-white"
          >
            ◀
          </Button>

          <div className="text-white font-semibold text-lg">
            {formatDate(selectedMonth, "MMMM yyyy")}
          </div>

          <Button
            variant="ghost"
            onClick={() => changeMonth("next")}
            className="text-gray-400 hover:text-white"
          >
            ▶
          </Button>
        </CardContent>
      </Card>


      {/* UPCOMING EVENTS */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-gray-300">
          {upcomingEvents.length === 0 ? (
            <p>No upcoming events this month</p>
          ) : (
            upcomingEvents.map(ev => (
              <div key={ev.id} className="flex justify-between">
                <span>{ev.title}</span>
                <span>{formatDate(parseISODate(ev.date), "MMM dd")}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>


      {/* PTO SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* PAID PTO */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Paid Time Off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[720px] overflow-y-auto pr-2">
            {paidPtoTable.length === 0 ? (
              <p className="text-gray-400">No paid PTO</p>
            ) : (
              paidPtoTable.map(emp => (
                <div key={emp.name}>
                  <p className="font-semibold text-white">{emp.name}</p>
                  {emp.ranges.map((r: any, i: number) => (
                    <p key={i} className="text-sm text-gray-300">
                      • {formatISOToDDMMYYYY(r.start)} → {formatISOToDDMMYYYY(r.end)}
                    </p>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* UNPAID PTO */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Unpaid Time Off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[720px] overflow-y-auto pr-2">
            {unpaidPtoTable.length === 0 ? (
              <p className="text-gray-400">No unpaid leave</p>
            ) : (
              unpaidPtoTable.map(emp => (
                <div key={emp.name}>
                  <p className="font-semibold text-white">{emp.name}</p>
                  {emp.ranges.map((r: any, i: number) => (
                    <p key={i} className="text-sm text-gray-300">
                      • {formatISOToDDMMYYYY(r.start)} → {formatISOToDDMMYYYY(r.end)}
                    </p>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>


    </TabsContent>

      {/* 🔥 CALENDAR TAB — YOUR EXISTING CODE STARTS HERE 🔥 */}
      <TabsContent value="calendar">
    <div className="p-6 space-y-6 bg-gray-800 min-h-screen animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendar Overview</h1>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-4">
          <Card className="border-gray-700 bg-gray-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {formatDate(currentDate, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="border-gray-500 text-gray-500 hover:bg-gray-950"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                    className="border-gray-500 text-gray-500 hover:bg-gray-950"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="border-gray-500 text-gray-500 hover:bg-gray-950"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-gray-400">
                Click on any date to view detailed activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {weekdays.map(day => (
                  <div key={day} className="p-2 text-center font-medium text-gray-500 text-sm">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((calendarDay, index) => {
                  const totalEmployees = getTotalEmployeesOnLeave(calendarDay.date)
                  const hasLeave = calendarDay.ptoRecords.length > 0
                  const hasBirthdays = calendarDay.birthdays.length > 0
                  const hasHolidays = calendarDay.holidays.length > 0
                  const hasActivity = hasLeave || hasBirthdays || hasHolidays
                  const isCurrentDay = isToday(calendarDay.date)
                  
                  return (
                    <div
                      key={index}
                      onClick={() => hasActivity && handleDateClick(calendarDay)}
                      className={`
                        relative min-h-[80px] p-2 border border-gray-200 rounded-lg transition-all duration-200
                        ${!calendarDay.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white text-black'}
                        ${isCurrentDay ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                        ${hasLeave ? 'bg-green-50 border-green-200' : ''}
                        ${hasBirthdays ? 'bg-yellow-50 border-yellow-200' : ''}
                        ${hasHolidays ? 'bg-orange-50 border-orange-200' : ''}
                        ${hasActivity ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''}
                      `}
                    >
                      <div className="text-sm font-medium">
                        {calendarDay.date.getDate()}
                      </div>
                      
                      <div className="mt-1 space-y-1">
                        {/* Birthday indicator */}
                        {hasBirthdays && (
                          <div className="flex items-center gap-1">
                            <PartyPopper className="w-3 h-3 text-yellow-600" />
                            <Badge 
                              variant="outline" 
                              className="text-xs border-yellow-500 text-yellow-600 bg-yellow-100 px-1 py-0"
                            >
                              {calendarDay.birthdays.length} Birthday
                            </Badge>
                          </div>
                        )}

                        {hasHolidays && (
                          <div className="flex items-center gap-1">
                            <PartyPopper className="w-3 h-3 text-orange-600" />
                            <Badge 
                              variant="outline" 
                              className="text-xs border-orange-500 text-orange-600 bg-orange-100 px-1 py-0"
                            >
                              {calendarDay.holidays.length} Holiday
                            </Badge>
                          </div>
                        )}
                        
                        {/* Leave indicator */}
                        {hasLeave && (
                          <Badge 
                            variant="outline" 
                            className="text-xs border-green-500 text-green-600 bg-green-100"
                          >
                            {totalEmployees} on leave
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Date Details Modal */}
      <DateDetailsModal 
        selectedDate={selectedDate} 
        onClose={() => setSelectedDate(null)} 
      />
        </div>
      </TabsContent>
    </Tabs>
  </div>
)
}