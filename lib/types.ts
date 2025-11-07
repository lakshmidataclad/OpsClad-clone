export interface User {
  id: string
  username: string
  email: string
  created_at?: string
}

export interface TimesheetEntry {
  id?: number
  date: string
  day: string
  hours: number
  required_hours: number
  activity?: string
  client?: string
  project?: string
  employee_name?: string
  employee_id?: string
  sender_email: string
  created_at?: string
}

export interface EmployeeData {
  id?: number
  email_id: string
  name: string
  client: string
  project: string
  created_at?: string
}

export interface FilterOptions {
  employee: string
  client: string
  project: string
  dateFrom: string
  dateTo: string
}

export interface SummaryStats {
  totalHours: number
  totalEmployees: number
  totalClients: number
  totalProjects: number
  avgHoursPerDay: number
  dateRange: string
}

export interface ExtractionStatus {
  is_processing: boolean
  progress: number
  message: string
  error: string | null
  result: {
    total_entries?: number
    total_entries_processed?: number
    total_entries_inserted_into_db?: number
    duplicate_entries_skipped?: number // Added this property
    search_method?: string // Added this property
    new_extracted_entries?: TimesheetEntry[] // Added this property
  } | null
}

export interface Task {
  id: string
  task_id: string
  description: string
  owner: string
  start_date: string
  estimated_completion_date: string
  actual_completion_date: string | null
  status: TaskStatus
  pending_changes: string 
  created_at: string
  updated_at: string
}

export type TaskStatus = 'in_progress' | 'on_hold' | 'completed' | 'blocked'

export const TASK_STATUS_OPTIONS = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
] as const