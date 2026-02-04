export type ComparisonResult = {
  employee_id: string
  date: string
  activity: string
  pdf_hours: number
  db_hours?: number
  status: "MATCH" | "MISSING_IN_DB" | "HOURS_MISMATCH"
}

const key = (e: any) =>
  `${e.employee_id}_${e.date}_${e.activity}`

export function compareTimesheets(
  pdfEntries: any[],
  dbEntries: any[]
): ComparisonResult[] {
  const dbMap = new Map(dbEntries.map(e => [key(e), e]))

  return pdfEntries.map(pdf => {
    const db = dbMap.get(key(pdf))

    if (!db) {
      return {
        employee_id: pdf.employee_id,
        date: pdf.date,
        activity: pdf.activity,
        pdf_hours: pdf.hours,
        status: "MISSING_IN_DB"
      }
    }

    if (Math.abs(pdf.hours - db.hours) > 0.01) {
      return {
        employee_id: pdf.employee_id,
        date: pdf.date,
        activity: pdf.activity,
        pdf_hours: pdf.hours,
        db_hours: db.hours,
        status: "HOURS_MISMATCH"
      }
    }

    return {
      employee_id: pdf.employee_id,
      date: pdf.date,
      activity: pdf.activity,
      pdf_hours: pdf.hours,
      db_hours: db.hours,
      status: "MATCH"
    }
  })
}


