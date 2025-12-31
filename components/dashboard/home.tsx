'use client'

import { useState, useEffect, useMemo, useRef, useLayoutEffect,  } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  PartyPopper,
  X,
  Plus,
  Loader2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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


interface Announcement {
  id: string
  title: string
  content: string
  start_date: string
  end_date: string
}


interface SocialMessage {
  id: string
  user_id: string
  user_name: string
  user_role: "manager" | "employee"
  message: string
  created_at: string
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

const isFuture = (date: Date): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date > today
}

const parseISODate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00')
}

const formatDateForDB = (date: Date): string => {
  return date.getFullYear() + '-' + 
         (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
         date.getDate().toString().padStart(2, '0')
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
  const [userRole, setUserRole] = useState<"manager" | "employee" | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
  const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false)
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null)

  const [socialMessages, setSocialMessages] = useState<SocialMessage[]>([])
  const [socialInput, setSocialInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: socialMessages.length > 1 ? "smooth" : "auto",
    })
  }, [socialMessages])


  const { toast } = useToast()


  const [announcement, setAnnouncement] = useState({
    title: "",
    content: "",
    start_date: "",
    end_date: "",
  })

  const getAnnouncementStatus = (
  start: string,
  end: string
  ): "active" | "inactive" | "upcoming" => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startDate = new Date(start)
    const endDate = new Date(end)

    if (today < startDate) return "upcoming"
    if (today > endDate) return "inactive"
    return "active"
  }

  const announcementStyles = {
  active:
    "from-blue-900/40 to-gray-800 border-blue-700 hover:border-blue-500",
  upcoming:
    "from-orange-900/30 to-gray-800 border-orange-700 hover:border-orange-500",
  inactive:
    "from-gray-800/40 to-gray-900 border-gray-700 opacity-70",
  }

const openEditAnnouncement = (a: Announcement) => {
  setEditingAnnouncementId(a.id)
  setAnnouncement({
    title: a.title,
    content: a.content,
    start_date: a.start_date,
    end_date: a.end_date,
  })
  setIsAnnouncementOpen(true)
}

const deleteAnnouncement = async (id: string) => {
  const confirmed = window.confirm("Delete this announcement?")
  if (!confirmed) return

  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)

  if (!error) {
    toast({ title: "Announcement deleted" })
    loadData()
  } else {
    toast({
      title: "Error",
      description: "Failed to delete announcement",
      variant: "destructive",
    })
  }
}
  

const getMessageBg = (index: number, messages: SocialMessage[]) => {
  if (index === 0) return "bg-gray-800 border-gray-700"

  const prev = messages[index - 1]
  const curr = messages[index]

  // Same sender → keep previous colour
if (prev.user_id === curr.user_id) {
  return index > 1 ? getMessageBg(index - 1, messages) : "bg-gray-800 border-gray-700"
}

  // New sender → alternate
  return index % 2 === 0
    ? "bg-red-900/30 border-red-800"
    : "bg-gray-800 border-gray-700"
}

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
      
      // Get records for the next 3 months to show upcoming events
      const startDate = new Date(2000, 0, 1)
      const endDate = new Date(2100, 11, 31)

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
      
      // Load Announcements
      const { data: announcementData, error } = await supabase
        .from("announcements")
        .select("id, title, content, start_date, end_date, created_at")
        .order("created_at", { ascending: false })

      // Load Social Messages
      const { data: socialData } = await supabase
        .from("social_messages")
        .select("*")
        .order("created_at", { ascending: true })

      setSocialMessages(socialData || [])
            

    if (!error) setAnnouncements(announcementData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
  let interval: number

  const init = async () => {
    try {
      /* 🔹 Load dashboard data */
      await loadData()

      /* 🔹 Load user role */
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()

      if (error) {
        console.error("ROLE LOAD FAILED:", error)
        // null = role could not be determined (safe default)
        setUserRole("employee")
        return
      }

      const role = data?.role?.toLowerCase()

      if (role === "manager") {
        setUserRole("manager")
      } else {
        setUserRole("employee")
      }}

    } catch (err) {
      console.error("Init error:", err)
    }

    /* 🔁 Refresh dashboard data every 5 minutes */
    interval = window.setInterval(loadData, 5 * 60 * 1000)
  }

  init()

  return () => {
    if (interval) {
      clearInterval(interval)
    }
  }
}, [])



// Announcement submission handler
const submitAnnouncement = async () => {
  if (
    !announcement.title ||
    !announcement.content ||
    !announcement.start_date ||
    !announcement.end_date
  ) {
    toast({
      title: "Missing fields",
      description: "All fields including date range are required",
      variant: "destructive",
    })
    return
  }

  setSubmittingAnnouncement(true)

  try {
    const query = editingAnnouncementId
      ? supabase
          .from("announcements")
          .update({
            title: announcement.title,
            content: announcement.content,
            start_date: announcement.start_date,
            end_date: announcement.end_date,
          })
          .eq("id", editingAnnouncementId)
      : supabase
          .from("announcements")
          .insert({
            title: announcement.title,
            content: announcement.content,
            start_date: announcement.start_date,
            end_date: announcement.end_date,
          })

    const { error } = await query
    if (error) throw error

    toast({
      title: editingAnnouncementId
        ? "Announcement updated"
        : "Announcement posted",
    })

    setIsAnnouncementOpen(false)
    setEditingAnnouncementId(null)
    setAnnouncement({
      title: "",
      content: "",
      start_date: "",
      end_date: "",
    })

    loadData()
  } catch (err) {
    toast({
      title: "Error",
      description: "Failed to save announcement",
      variant: "destructive",
    })
  } finally {
    setSubmittingAnnouncement(false)
  }
}


// Social message submission
const sendSocialMessage = async () => {
  if (!socialInput.trim()) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id")
    .eq("id", user.id)
    .single()

  const { data: employee } = await supabase
    .from("employees")
    .select("name")
    .eq("employee_id", profile?.employee_id)
    .single()

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  await supabase.from("social_messages").insert({
    user_id: user.id,
    user_name: employee?.name || "OPSCLAD",
    user_role: roleRow?.role || "employee",
    message: socialInput.trim(),
  })

  setSocialInput("")
  loadData()
}



// Format month-year for display for socials
const formatMonthYear = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}




// Filter announcements for the selected month
const doesAnnouncementOverlapMonth = (
  start: string,
  end: string,
  monthStart: Date,
  monthEnd: Date
) => {
  return (
    new Date(start) <= monthEnd &&
    new Date(end) >= monthStart
  )
}

const monthStart = new Date(
  selectedMonth.getFullYear(),
  selectedMonth.getMonth(),
  1
)

const monthEnd = new Date(
  selectedMonth.getFullYear(),
  selectedMonth.getMonth() + 1,
  0
)

const visibleAnnouncements = announcements.filter(a =>
  doesAnnouncementOverlapMonth(
    a.start_date,
    a.end_date,
    monthStart,
    monthEnd
  )
)




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
      ptoRecords: calendarDay.ptoRecords ?? [],
      birthdays: calendarDay.birthdays ?? [],
      holidays: calendarDay.holidays ?? []
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
      ptoRecords: ptoRecords.filter(record => {
        if (!record.date) return false
        const normalized = normalizeDate(record.date)
        if (!normalized) return false
        return isSameDay(parseISODate(normalized), day)
      }),      
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




  const todayEvents = ptoRecords.filter(record => {
    const normalized = normalizeDate(record.date)
    if (!normalized) return false
    return isToday(parseISODate(normalized))
  })
  const todayBirthdays = getBirthdaysForDate(new Date())
  const todayHolidays = getHolidaysForDate(new Date())


  const calendarDays = generateCalendarDays()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => addMonths(prev, direction === 'prev' ? -1 : 1))
  }

  const getTotalEmployeesOnLeave = (date: Date) => {
    const recordsForDate = ptoRecords.filter(record => {
      const normalized = normalizeDate(record.date)
      if (!normalized) return false
      return isSameDay(parseISODate(normalized), date)
    })
    return new Set(recordsForDate.map(r => r.employee_id)).size
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

      {/* TAB HEADER WITH ACTION BUTTON */}
      <div className="mb-6 flex items-center justify-between">
        <TabsList className="bg-gray-900">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
      </div>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-6">

        {/* Month Selector */}
        <Card
          className="
            bg-gradient-to-r
            from-[#ff6b4a]
            via-[#ff8f6b]
            to-[#0f172a]
            border-none
            shadow-[0_12px_35px_rgba(15,23,42,0.55)]
          "
        >      
          <CardContent className="flex items-center justify-between py-3 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeMonth("prev")}
            className="text-white hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-white/80 font-semibold">
                Overview
              </p>
              <p className="text-xl font-extrabold tracking-wide text-white drop-shadow">
                {formatDate(selectedMonth, "MMMM yyyy")}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeMonth("next")}
              className="text-white hover:bg-white/20"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

          {/* Anouncements */}
        <Card className="bg-gray-900 border-l-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Announcements</CardTitle>

            {userRole === "manager" && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingAnnouncementId(null)
                  setAnnouncement({
                    title: "",
                    content: "",
                    start_date: "",
                    end_date: "",
                  })
                  setIsAnnouncementOpen(true)
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-gray-300">
            {visibleAnnouncements.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No announcements for this month
              </p>
            ) : (
              visibleAnnouncements.map(a => {
                const status = getAnnouncementStatus(a.start_date, a.end_date)

                return (
                  <div
                    key={a.id}
                    className={`relative group rounded-lg p-4 bg-gradient-to-r border transition
                      ${announcementStyles[status]}
                    `}
                  >
                  {/* Manager Actions */}
                  {userRole === "manager" && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditAnnouncement(a)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        ✏️
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteAnnouncement(a.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        🗑
                      </Button>
                    </div>
                  )}

                  <p className="text-white font-semibold text-base">
                    {a.title}
                  </p>

                  <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                    {a.content}
                  </p>

                  <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        status === "active"
                          ? "border-blue-500 text-blue-400"
                          : status === "upcoming"
                          ? "border-orange-500 text-orange-400"
                          : "border-gray-500 text-gray-400"
                      }
                    >
                      {status === "active"
                        ? "Active"
                        : status === "upcoming"
                        ? "OTW"
                        : "Inactive"}
                    </Badge>

                    <span>
                      {a.start_date} → {a.end_date}
                    </span>
                  </div>
                </div>

              )})
            )}
          </CardContent>
        </Card>



        {/* Empty Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-700 min-h-[120px]">
            <CardHeader>
            <CardTitle className="text-white">News</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-400 text-sm">
              {/* future content */}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700 h-[420px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-white">Socials</CardTitle>
            </CardHeader>

            {/* Social Messages */}
            <CardContent className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
              {socialMessages.length === 0 ? (
                <p className="text-gray-400 text-sm text-center">
                  No messages yet 👋
                </p>
              ) : (
                socialMessages.map((msg, index) => {
                  const prev = index > 0 ? socialMessages[index - 1] : null

                  const isSameSender =
                    prev &&
                    prev.user_id === msg.user_id &&
                    new Date(prev.created_at).toDateString() ===
                      new Date(msg.created_at).toDateString()

                  const currentMonth = formatMonthYear(msg.created_at)
                  const prevMonth =
                    index > 0
                      ? formatMonthYear(socialMessages[index - 1].created_at)
                      : null

                  const showMonthHeader = index === 0 || currentMonth !== prevMonth

                  return (
                    <div key={msg.id}>
                      {/* 📅 Month Separator */}
                      {showMonthHeader && (
                        <div className="flex justify-center my-4">
                          <span className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                            {currentMonth}
                          </span>
                        </div>
                      )}

                      {/* 💬 Message */}
                      <div className={`${isSameSender ? "ml-6 mt-1" : "mt-3"}`}>
                        {/* 👤 Sender Header (only once per group) */}
                        {!isSameSender && (
                          <div className="flex items-center gap-2 mb-0.5 text-xs">
                            <span className="font-semibold text-white">
                              {msg.user_name}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px]
                                ${
                                  msg.user_role === "manager"
                                    ? "bg-orange-600/20 text-orange-400 border border-orange-500"
                                    : "bg-blue-600/20 text-blue-400 border border-blue-500"
                                }
                              `}
                            >
                              {msg.user_role}
                            </span>
                          </div>
                        )}

                        {/* 🧱 Message Bubble */}
                        <div
                          className={`p-3 ${isSameSender ? "rounded-lg rounded-tl-sm" : "rounded-lg"} 
                          border max-w-[70%] sm:max-w-[75%] w-fit flex flex-col gap-1
                          ${getMessageBg(index, socialMessages)}
                          `}
                        >
                          <p className="text-gray-200 text-sm whitespace-pre-wrap break-all">
                            {msg.message}
                          </p>

                          <span className="text-[10px] text-gray-500 self-end whitespace-nowrap">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {/* 🔽 AUTO-SCROLL ANCHOR */}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t border-gray-700 p-3 flex gap-2 shrink-0">
              <Textarea
                value={socialInput}
                onChange={(e) => setSocialInput(e.target.value)}
                placeholder="Type a message…"
                className="bg-gray-800 border-gray-600 text-white resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendSocialMessage()
                  }
                }}
              />
              <Button onClick={sendSocialMessage}>
                Send
              </Button>
            </div>
          </Card>

        </div>

        {/* Upcoming Events */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-gray-400">No upcoming events</p>
            ) : (
              upcomingEvents.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-orange-500/5 transition border border-gray-700"
                >
                  <span className="text-white">{ev.title}</span>
                <Badge
                  variant="outline"
                  className="border-orange-500 text-orange-400"
                >
                  {formatDate(parseISODate(ev.date), "MMM dd")}
                </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* CALENDAR TAB — YOUR EXISTING CODE STARTS HERE */}
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

 {/* 🔔 ANNOUNCEMENT DIALOG — PLACE HERE */}
    <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
      <DialogContent className="bg-gray-950 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editingAnnouncementId ? "Edit Announcement" : "Add Announcement"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This will be visible to all employees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-white">Title</Label>
            <Input
              value={announcement.title}
              onChange={(e) =>
                setAnnouncement(prev => ({ ...prev, title: e.target.value }))
              }
              className="bg-gray-800 border-gray-600 text-white"
              placeholder="Short headline"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Start Date</Label>
              <Input
                type="date"
                value={announcement.start_date}
                onChange={(e) =>
                  setAnnouncement(prev => ({ ...prev, start_date: e.target.value }))
                }
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            <div>
              <Label className="text-white">End Date</Label>
              <Input
                type="date"
                min={announcement.start_date}
                value={announcement.end_date}
                onChange={(e) =>
                  setAnnouncement(prev => ({ ...prev, end_date: e.target.value }))
                }
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </div>


          <div>
            <Label className="text-white">Message</Label>
            <Textarea
              value={announcement.content}
              onChange={(e) =>
                setAnnouncement(prev => ({ ...prev, content: e.target.value }))
              }
              className="bg-gray-800 border-gray-600 text-white"
              placeholder="Write the announcement details here..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsAnnouncementOpen(false)}
          >
            Cancel
          </Button>

          <Button
            onClick={submitAnnouncement}
            disabled={submittingAnnouncement}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {submittingAnnouncement ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {submittingAnnouncement
              ? "Posting..."
              : editingAnnouncementId
                ? "Update Announcement"
                : "Post Announcement"}          
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
)
}