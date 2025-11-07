import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save, X, Download, Clock } from "lucide-react"
import { Task, TaskStatus, TASK_STATUS_OPTIONS } from "@/lib/types"
import { CardTitle } from "../ui/card"
import { supabase } from "@/lib/supabase"

// Department options
const DEPARTMENT_OPTIONS = [
  { value: "hr", label: "HR" },
  { value: "finance", label: "Finance" },
  { value: "it", label: "IT" },
  { value: "sales", label: "Sales" },
  { value: "talent", label: "Talent" },
]

type Department = "hr" | "finance" | "it" | "sales" | "talent"

interface EmployeeTaskViewProps {
  currentUser: string // The logged-in employee's name
}

export default function EmployeeTaskView({ currentUser }: EmployeeTaskViewProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Partial<Task>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- CSV Export Function ---
  const exportToCSV = () => {
    if (tasks.length === 0) {
      alert("No tasks to export")
      return
    }

    const headers = [
      "Task ID",
      "Description",
      "Owner",
      "Department",
      "Start Date",
      "Estimated Completion Date",
      "Actual Completion Date",
      "Status",
      "Pending Changes",
      "Created At",
      "Updated At",
    ]

    const csvRows = tasks.map((task) => [
      task.task_id,
      `"${task.description.replace(/"/g, '""')}"`,
      task.owner,
      getDepartmentLabel(task.department),
      task.start_date ? new Date(task.start_date).toLocaleDateString() : "",
      task.estimated_completion_date || "",
      task.actual_completion_date || "",
      getStatusLabel(task.status),
      task.pending_changes ? "Yes" : "No",
      task.created_at ? new Date(task.created_at).toLocaleDateString() : "",
      task.updated_at ? new Date(task.updated_at).toLocaleDateString() : "",
    ])

    const csvContent = [headers, ...csvRows].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    const currentDate = new Date().toISOString().split("T")[0]
    const filename = `My_Tasks_as_of_${currentDate}.csv`

    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // --- Supabase Data Operations ---
  const fetchTasks = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from("task_overviews")
      .select("*")
      .eq("owner", currentUser) // Only fetch tasks for current user
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching tasks:", error.message)
      setError("Failed to load tasks. Please try again.")
    } else {
      const formattedTasks = data.map((task) => ({
        ...task,
        start_date: task.start_date ? new Date(task.start_date).toISOString().split("T")[0] : "",
        estimated_completion_date: task.estimated_completion_date
          ? new Date(task.estimated_completion_date).toISOString().split("T")[0]
          : "",
        actual_completion_date: task.actual_completion_date
          ? new Date(task.actual_completion_date).toISOString().split("T")[0]
          : "",
      }))
      setTasks(formattedTasks as Task[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
  }, [currentUser])

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingValues({
      ...task,
      estimated_completion_date: task.estimated_completion_date || '',
      actual_completion_date: task.actual_completion_date || ''
    })
  }

  const cancelEditing = () => {
    setEditingTaskId(null)
    setEditingValues({})
  }

  const saveEdit = async () => {
    if (!editingTaskId) return

    setError(null)
    
    // Store pending changes in a separate field for manager approval
    const { data, error } = await supabase
      .from('task_overviews')
      .update({
        pending_changes: JSON.stringify({
          task_id: editingValues.task_id,
          description: editingValues.description,
          estimated_completion_date: editingValues.estimated_completion_date || null,
          actual_completion_date: editingValues.actual_completion_date || null,
          status: editingValues.status,
          changed_by: currentUser,
          change_requested_at: new Date().toISOString()
        }),
        // updated_at is handled by Supabase trigger or default
      })
      .eq('id', editingTaskId)
      .select()

    if (error) {
      console.error("Error submitting changes:", error.message)
      setError("Failed to submit changes. Please try again.")
      return
    }

    if (data && data.length > 0) {
      // Update local state to show pending changes
      setTasks(tasks.map(task =>
        task.id === editingTaskId
          ? { ...task, pending_changes: data[0].pending_changes }
          : task
      ))
    }

    setEditingTaskId(null)
    setEditingValues({})
    
    // Show success message
    alert("Changes submitted for manager approval!")
  }

  // --- Helper Functions for UI ---

  const getStatusBadgeColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return 'bg-[#7ba48bff] text-green-100'
      case 'in_progress': return 'bg-[#95bdffff] text-blue-50'
      case 'on_hold': return 'bg-yellow-600 text-yellow-100'
      case 'blocked': return 'bg-red-600 text-red-100'
      default: return 'bg-gray-600 text-gray-100'
    }
  }

  const getStatusLabel = (status: TaskStatus) => {
    return TASK_STATUS_OPTIONS.find(option => option.value === status)?.label || status
  }

  const getDepartmentLabel = (department: Department) => {
    return DEPARTMENT_OPTIONS.find(option => option.value === department)?.label || department
  }

  const getDepartmentBadgeColor = (department: Department) => {
    switch (department) {
      case 'hr': return 'bg-gray-200 text-gray-900'
      case 'finance': return 'bg-gray-200 text-gray-900'
      case 'it': return 'bg-gray-200 text-gray-900'
      case 'sales': return 'bg-gray-200 text-gray-900'
      case 'talent': return 'bg-gray-200 text-gray-900'
      default: return 'bg-gray-200 text-gray-900'
    }
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <CardTitle className="text-black">My Tasks</CardTitle>
          <div className="flex space-x-2">
            <Button 
              onClick={exportToCSV}
              variant="outline"
              className="bg-white border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Loading your tasks...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[100px]">Task ID</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[250px]">Description</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[120px]">Department</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[160px]">Start Date</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[160px]">Estimated Completion</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[160px]">Actual Completion</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[140px]">Status</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {editingTaskId === task.id ? (
                            <Input
                              value={editingValues.task_id || ''}
                              onChange={(e) => setEditingValues({ ...editingValues, task_id: e.target.value })}
                              className="bg-gray-100 border-gray-300 text-gray-800 text-sm"
                              disabled // Task ID shouldn't be editable by employees
                            />
                          ) : (
                            <>
                              <span className="text-gray-700 font-mono">{task.task_id}</span>
                              {task.pending_changes && (
                                <Clock className="w-4 h-4 text-orange-500" title="Changes pending manager approval" />
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingTaskId === task.id ? (
                          <Textarea
                            value={editingValues.description || ''}
                            onChange={(e) => setEditingValues({ ...editingValues, description: e.target.value })}
                            className="bg-gray-100 border-gray-300 text-gray-800 text-sm"
                          />
                        ) : (
                          <span className="text-gray-700">{task.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDepartmentBadgeColor(task.department)} whitespace-nowrap`}>
                          {getDepartmentLabel(task.department)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{task.start_date}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editingTaskId === task.id ? (
                          <Input
                            type="date"
                            value={editingValues.estimated_completion_date || ''}
                            onChange={(e) => setEditingValues({ ...editingValues, estimated_completion_date: e.target.value })}
                            className="bg-gray-100 border-gray-300 text-gray-800 text-sm"
                          />
                        ) : (
                          <span className="text-gray-700">{task.estimated_completion_date}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingTaskId === task.id ? (
                          <Input
                            type="date"
                            value={editingValues.actual_completion_date || ''}
                            onChange={(e) => setEditingValues({ ...editingValues, actual_completion_date: e.target.value })}
                            className="bg-gray-100 border-gray-300 text-gray-800 text-sm"
                          />
                        ) : (
                          <span className="text-gray-700">{task.actual_completion_date || 'N/A'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingTaskId === task.id ? (
                          <Select
                            value={editingValues.status || task.status}
                            onValueChange={(value: TaskStatus) => setEditingValues({ ...editingValues, status: value })}
                          >
                            <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-800 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              {TASK_STATUS_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value} className="text-gray-800 hover:bg-gray-100">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(task.status)} whitespace-nowrap`}>
                              {getStatusLabel(task.status)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          {editingTaskId === task.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                className="bg-green-600 hover:bg-green-700 text-white p-1"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={cancelEditing}
                                variant="outline"
                                className="border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => startEditing(task)}
                              variant="outline"
                              className="border-red-600 bg-white text-red-600 hover:bg-red-50"
                              disabled={!!task.pending_changes} // Disable editing if changes are pending
                            >
                              {task.pending_changes ? 'Pending' : 'Edit'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No tasks assigned to you yet.</p>
          </div>
        )}

        {/* Information banner about the approval process */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> Any changes you make to your tasks will be submitted for manager approval. 
            You'll see a "Pending Approval" indicator next to tasks with submitted changes.
          </p>
        </div>
      </div>
    </div>
  )
}