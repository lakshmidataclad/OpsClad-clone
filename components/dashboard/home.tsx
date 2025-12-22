'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  User,
  PartyPopper,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

/* ================= TYPES ================= */

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

interface HolidayRecord {
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

/* ================= DATE UTILS ================= */

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)
const addMonths = (date: Date, amount: number) => {
  const d = new Date(date)
  d.setMonth(d.getMonth() + amount)
  return d
}
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const isSameDayMonth = (a: Date, b: Date) =>
  a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const isToday = (date: Date) => isSameDay(date, new Date())

const parseISODate = (d: string) => new Date(d + "T00:00:00")

const formatDateForDB = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" })

/* ================= WELCOME ================= */

const TypingWelcome = ({ onComplete }: { onComplete: () => void }) => {
  const [text, setText] = useState("")
  const full = "Welcome to OpsClad!"

  useEffect(() => {
    if (text.length < full.length) {
      const t = setTimeout(() => setText(full.slice(0, text.length + 1)), 50)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(onComplete, 1500)
      return () => clearTimeout(t)
    }
  }, [text, full, onComplete])

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <h1 className="text-5xl font-bold text-white">{text}|</h1>
    </div>
  )
}

/* ================= MODAL ================= */

const DateDetailsModal = ({
  selectedDate,
  onClose,
}: {
  selectedDate: SelectedDateInfo | null
  onClose: () => void
}) => {
  if (!selectedDate) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full bg-gray-900 border-gray-700">
        <CardHeader className="flex flex-row justify-between">
          <CardTitle className="text-white">
            {selectedDate.date.toDateString()}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {selectedDate.birthdays.map(b => (
            <div key={b.id} className="text-yellow-400 flex items-center gap-2">
              <PartyPopper className="w-4 h-4" /> {b.name}'s Birthday
            </div>
          ))}

          {selectedDate.holidays.map(h => (
            <div key={h.id} className="text-orange-400">
              🎉 {h.holiday}
            </div>
          ))}

          {selectedDate.ptoRecords.map(p => (
            <div key={p.id} className="text-green-400">
              🏖 {p.employee_name} on leave
            </div>
          ))}

          {selectedDate.birthdays.length === 0 &&
            selectedDate.holidays.length === 0 &&
            selectedDate.ptoRecords.length === 0 && (
              <p className="text-gray-400 text-center">No activity</p>
            )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ================= MAIN ================= */

export default function HomePage() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [ptoRecords, setPtoRecords] = useState<PTORecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [holidays, setHolidays] = useState<HolidayRecord[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<SelectedDateInfo | null>(null)

  useEffect(() => {
    const load = async () => {
      const start = new Date()
      const end = endOfMonth(addMonths(new Date(), 3))

      const { data: pto } = await supabase
        .from("pto_records")
        .select("*")
        .gte("date", formatDateForDB(start))
        .lte("date", formatDateForDB(end))
        .eq("status", "approved")

      const { data: emp } = await supabase
        .from("employees")
        .select("id, name, birthday")

      const { data: hol } = await supabase
        .from("holidays")
        .select("*")

      setPtoRecords(pto || [])
      setEmployees(emp || [])
      setHolidays(hol || [])
    }

    load()
  }, [])

  if (showWelcome) {
    return <TypingWelcome onComplete={() => setShowWelcome(false)} />
  }

  const calendarDays: CalendarDay[] = (() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    const gridStart = new Date(start)
    gridStart.setDate(gridStart.getDate() - start.getDay())

    const days: CalendarDay[] = []
    const d = new Date(gridStart)

    while (d <= end || d.getDay() !== 0) {
      days.push({
        date: new Date(d),
        isCurrentMonth: d.getMonth() === currentDate.getMonth(),
        ptoRecords: ptoRecords.filter(p => isSameDay(parseISODate(p.date), d)),
        birthdays: employees.filter(e =>
          e.birthday && isSameDayMonth(parseISODate(e.birthday), d)
        ),
        holidays: holidays.filter(h =>
          h.holiday_date && isSameDayMonth(parseISODate(h.holiday_date), d)
        ),
      })
      d.setDate(d.getDate() + 1)
    }
    return days
  })()

  return (
    <div className="p-6 bg-gray-800 min-h-screen">
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 bg-gray-900">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Home Overview</CardTitle>
              <CardDescription className="text-gray-400">
                Summary widgets can live here
              </CardDescription>
            </CardHeader>
            <CardContent className="text-gray-300">
              You can add stats, announcements, or shortcuts here.
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row justify-between">
              <CardTitle className="text-white flex gap-2">
                <Calendar className="w-5 h-5" />
                {formatMonthTitle(currentDate)}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setCurrentDate(addMonths(currentDate, -1))}>
                  <ChevronLeft />
                </Button>
                <Button size="sm" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, i) => (
                <div
                  key={i}
                  onClick={() =>
                    (day.ptoRecords.length ||
                      day.birthdays.length ||
                      day.holidays.length) &&
                    setSelectedDate(day)
                  }
                  className={`p-2 rounded border text-sm cursor-pointer
                    ${day.isCurrentMonth ? "bg-white" : "bg-gray-100 text-gray-400"}
                  `}
                >
                  {day.date.getDate()}
                  {day.ptoRecords.length > 0 && (
                    <Badge className="mt-1 block bg-green-500">Leave</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <DateDetailsModal
            selectedDate={selectedDate}
            onClose={() => setSelectedDate(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
