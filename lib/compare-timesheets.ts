export type ComparisonResult = {
  employee_id: string
  date: string
  activity: string
  pdf_hours: number
  db_hours?: number
  status: "MATCH" | "MISSING_IN_DB" | "HOURS_MISMATCH"
}

const normalizeDate = (d: string) => {
  if (!d) return ""
  if (d.includes("/")) {
    const [day, month, year] = d.split("/")
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  return d
}

const normalizeActivity = (a: string) =>
  a?.trim().toUpperCase() || ""

const key = (e: any) =>
  `${e.employee_id || e.employee_name || "UNKNOWN"}_${
    normalizeDate(e.date)
  }_${normalizeActivity(e.activity)}`

export function compareTimesheets(
  pdfEntries: any[],
  dbEntries: any[]
): ComparisonResult[] {
  const dbMap = new Map(dbEntries.map(e => [key(e), e]))

  return pdfEntries.map(pdf => {
    const db = dbMap.get(key(pdf))

    if (!db) {
      return {
        employee_id: pdf.employee_id || pdf.employee_name || "UNKNOWN",
        date: normalizeDate(pdf.date),
        activity: pdf.activity,
        pdf_hours: pdf.hours,
        status: "MISSING_IN_DB"
      }
    }

    if (Math.abs(pdf.hours - db.hours) > 0.01) {
      return {
        employee_id: pdf.employee_id || pdf.employee_name || "UNKNOWN",
        date: normalizeDate(pdf.date),
        activity: pdf.activity,
        pdf_hours: pdf.hours,
        db_hours: db.hours,
        status: "HOURS_MISMATCH"
      }
    }

    return {
      employee_id: pdf.employee_id || pdf.employee_name || "UNKNOWN",
      date: normalizeDate(pdf.date),
      activity: pdf.activity,
      pdf_hours: pdf.hours,
      db_hours: db.hours,
      status: "MATCH"
    }
  })
}
