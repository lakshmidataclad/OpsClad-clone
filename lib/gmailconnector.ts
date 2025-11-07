// TypeScript implementation of the Gmail Timesheet Detector
// This is a mock implementation that simulates the Python functionality

export interface TimesheetEmail {
  email_id: string
  sender: string
  subject: string
  date: Date
  attachment_names: string[]
  matched_keywords: string[]
}

export class GmailTimesheetDetector {
  private email_address: string
  private password: string
  private isConnected = false

  private timesheet_keywords = [
    "timesheet",
    "time-sheet",
    "time sheet",
    "timecard",
    "time card",
    "hours",
    "weekly hours",
    "work hours",
    "time log",
    "time entry",
    "hours worked",
    "weekly report",
    "time report",
    "payroll",
    "schedule",
    "work schedule",
    "attendance",
  ]

  constructor(email_address: string, password: string) {
    this.email_address = email_address
    this.password = password
  }

  async connect(): Promise<boolean> {
    console.log("🔗 Connecting to Gmail...")
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simple validation for demo purposes
    if (this.email_address && this.password && this.password.length >= 8) {
      this.isConnected = true
      console.log("✅ Connected to Gmail successfully!")
      return true
    }

    console.log("❌ Connection failed: Invalid credentials")
    return false
  }

  async disconnect(): Promise<void> {
    console.log("📡 Disconnecting from Gmail...")
    await new Promise((resolve) => setTimeout(resolve, 500))
    this.isConnected = false
    console.log("📡 Disconnected from Gmail")
  }

  private is_timesheet_email(subject: string): { isTimesheet: boolean; matches: string[] } {
    const subject_lower = subject.toLowerCase()
    const matches: string[] = []

    for (const keyword of this.timesheet_keywords) {
      if (subject_lower.includes(keyword)) {
        matches.push(keyword)
      }
    }

    return { isTimesheet: matches.length > 0, matches }
  }

  async find_timesheet_emails(options: {
    days_back: number
    sender_filter?: string
  }): Promise<TimesheetEmail[]> {
    if (!this.isConnected) {
      if (!(await this.connect())) {
        return []
      }
    }

    console.log(`🔍 Searching for timesheet emails from ${options.days_back} days back...`)

    // Simulate email search delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Generate mock timesheet emails
    const mockEmails: TimesheetEmail[] = []
    const today = new Date()

    for (let i = 0; i < 5; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)

      const subjects = [
        "Weekly Timesheet - Week Ending",
        "Time Sheet Submission",
        "Hours Worked Report",
        "Weekly Time Log",
        "Timecard for Review",
      ]

      const subject = `${subjects[i % subjects.length]} ${date.toLocaleDateString()}`
      const { isTimesheet, matches } = this.is_timesheet_email(subject)

      if (isTimesheet) {
        mockEmails.push({
          email_id: `email_${i}`,
          sender: `employee${i + 1}@example.com`,
          subject,
          date,
          attachment_names: [`timesheet_${i + 1}.pdf`, `hours_${i + 1}.png`],
          matched_keywords: matches,
        })
      }
    }

    console.log(`📧 Found ${mockEmails.length} timesheet emails`)
    return mockEmails
  }

  async download_attachments(
    timesheet_email: TimesheetEmail,
    download_dir = "timesheet_attachments",
  ): Promise<string[]> {
    if (!timesheet_email.attachment_names.length) {
      console.log(`📎 No attachments found in email: ${timesheet_email.subject}`)
      return []
    }

    console.log(`📎 Downloading ${timesheet_email.attachment_names.length} attachments...`)

    // Simulate download delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Return mock file paths
    return timesheet_email.attachment_names.map((name) => `${download_dir}/${name}`)
  }
}
