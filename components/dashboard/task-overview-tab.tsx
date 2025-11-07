import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit3, Save, X, Download, AlertTriangle } from "lucide-react"
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

export default function TaskOverviewTab() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Partial<Task>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [selectedTaskForApproval, setSelectedTaskForApproval] = useState<Task | null>(null)
  const [pendingChanges, setPendingChanges] = useState<any>(null)

  // State for new task input
  const [newTask, setNewTask] = useState({
    task_id: "",
    description: "",
    owner: "",
    department: "hr" as Department,
    start_date: "",
    estimated_completion_date: "",
    status: "in_progress" as TaskStatus,
  })

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
      task.created_at ? new Date(task.created_at).toLocaleDateString() : "",
      task.updated_at ? new Date(task.updated_at).toLocaleDateString() : "",
    ])

    const csvContent = [headers, ...csvRows].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    const currentDate = new Date().toISOString().split("T")[0]
    const filename = `Task_Overview_as_of_${currentDate}.csv`

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

  const fetchEmployees = async () => {
    const { data, error } = await supabase.from('employees').select('id, name')
    if (error) {
      console.error("Error fetching employees:", error.message)
    } else {
      setEmployees(data || [])
    }
  }

  useEffect(() => {
    fetchEmployees()
    fetchTasks()
  }, [])

  // New function to create a personalized notification for a task owner
  const createTaskNotification = async (ownerName: string, taskId: string, taskDescription: string) => {
    try {
      // Find the email of the employee based on their name
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('email_id')
        .eq('name', ownerName)
        .single();

      if (employeeError || !employeeData) {
        console.error("Error fetching owner's email:", employeeError);
        return;
      }

      const ownerEmail = employeeData.email_id;

      // Create a personalized notification
      const { error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_email: ownerEmail,
          type: 'task_assignment',
          title: `New Task Assigned: ${taskId}`,
          message: `You have been assigned a new task: "${taskDescription}".`,
          timestamp: new Date().toISOString(),
          read: false,
          recipient_role: 'employee',
          action_url: '/dashboard?tab=employee-reports'
        });

      if (insertError) {
        console.error("Error creating task notification:", insertError);
      } else {
        console.log(`Notification created for ${ownerName} (${ownerEmail})`);
      }
    } catch (error) {
      console.error("Failed to create task notification:", error);
    }
  };

  const handleAddTask = async () => {
    setError(null)
    const { data, error } = await supabase
      .from('task_overviews')
      .insert([
        {
          task_id: newTask.task_id,
          description: newTask.description,
          owner: newTask.owner,
          department: newTask.department,
          start_date: newTask.start_date,
          estimated_completion_date: newTask.estimated_completion_date || null,
          status: newTask.status,
          // created_at and updated_at are handled by Supabase defaults
        }
      ])
      .select(); // Use .select() to get the newly inserted row

    if (error) {
      console.error("Error adding task:", error.message)
      setError("Failed to add task. Please ensure Task ID is unique.")
      return
    }

    if (data && data.length > 0) {
      // Add the newly created task to the state, ensuring proper date format
      const addedTask = {
        ...data[0],
        estimated_completion_date: data[0].estimated_completion_date ? new Date(data[0].estimated_completion_date).toISOString().split('T')[0] : '',
        actual_completion_date: data[0].actual_completion_date ? new Date(data[0].actual_completion_date).toISOString().split('T')[0] : '',
      };
      setTasks([addedTask as Task, ...tasks]);
      
      // Trigger notification for the new task owner
      createTaskNotification(addedTask.owner, addedTask.task_id, addedTask.description);
    }

    setNewTask({
      task_id: "",
      description: "",
      owner: "",
      department: "hr",
      start_date: "",
      estimated_completion_date: "",
      status: "in_progress"
    })
    setIsAddDialogOpen(false)
  }

  const handleDeleteTask = async (taskId: string) => {
    setError(null)
    const { error } = await supabase
      .from('task_overviews')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error("Error deleting task:", error.message)
      setError("Failed to delete task. Please try again.")
      return
    }

    setTasks(tasks.filter(task => task.id !== taskId))
  }

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
    const originalTask = tasks.find(t => t.id === editingTaskId);
    const oldOwner = originalTask?.owner;
    const newOwner = editingValues.owner;

    const { data, error } = await supabase
      .from('task_overviews')
      .update({
        task_id: editingValues.task_id,
        description: editingValues.description,
        owner: newOwner,
        department: editingValues.department,
        estimated_completion_date: editingValues.estimated_completion_date || null,
        actual_completion_date: editingValues.actual_completion_date || null,
        status: editingValues.status,
        // updated_at is handled by Supabase trigger or default
      })
      .eq('id', editingTaskId)
      .select(); // Use .select() to get the updated row

    if (error) {
      console.error("Error updating task:", error.message)
      setError("Failed to update task. Please try again.")
      return
    }

    if (data && data.length > 0) {
      // Update the state with the newly updated task, ensuring proper date format
      const updatedTask = {
        ...data[0],
        estimated_completion_date: data[0].estimated_completion_date ? new Date(data[0].estimated_completion_date).toISOString().split('T')[0] : '',
        actual_completion_date: data[0].actual_completion_date ? new Date(data[0].actual_completion_date).toISOString().split('T')[0] : '',
      };
      setTasks(tasks.map(task =>
        task.id === editingTaskId
          ? (updatedTask as Task)
          : task
      ))

      // Trigger notification if the owner was updated
      if (newOwner && newOwner !== oldOwner) {
        createTaskNotification(newOwner, updatedTask.task_id, updatedTask.description);
      }
    }

    setEditingTaskId(null)
    setEditingValues({})
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

  const openApprovalDialog = (task: Task) => {
    setSelectedTaskForApproval(task)
    if (task.pending_changes) {
      setPendingChanges(JSON.parse(task.pending_changes))
    }
    setApprovalDialogOpen(true)
  }

  const closeApprovalDialog = () => {
    setApprovalDialogOpen(false)
    setSelectedTaskForApproval(null)
    setPendingChanges(null)
  }

  const approveChanges = async () => {
    if (!selectedTaskForApproval || !pendingChanges) return

    setError(null)
    const { data, error } = await supabase
      .from('task_overviews')
      .update({
        task_id: pendingChanges.task_id,
        description: pendingChanges.description,
        estimated_completion_date: pendingChanges.estimated_completion_date,
        actual_completion_date: pendingChanges.actual_completion_date,
        status: pendingChanges.status,
        pending_changes: null, // Clear pending changes
      })
      .eq('id', selectedTaskForApproval.id)
      .select()

    if (error) {
      console.error("Error approving changes:", error.message)
      setError("Failed to approve changes. Please try again.")
      return
    }

    if (data && data.length > 0) {
      const updatedTask = {
        ...data[0],
        estimated_completion_date: data[0].estimated_completion_date ? new Date(data[0].estimated_completion_date).toISOString().split('T')[0] : '',
        actual_completion_date: data[0].actual_completion_date ? new Date(data[0].actual_completion_date).toISOString().split('T')[0] : '',
      }
      setTasks(tasks.map(task =>
        task.id === selectedTaskForApproval.id ? (updatedTask as Task) : task
      ))
    }

    closeApprovalDialog()
    alert("Changes approved successfully!")
  }

  const rejectChanges = async () => {
    if (!selectedTaskForApproval) return

    setError(null)
    const { error } = await supabase
      .from('task_overviews')
      .update({
        pending_changes: null, // Clear pending changes without applying them
      })
      .eq('id', selectedTaskForApproval.id)

    if (error) {
      console.error("Error rejecting changes:", error.message)
      setError("Failed to reject changes. Please try again.")
      return
    }

    setTasks(tasks.map(task =>
      task.id === selectedTaskForApproval.id ? { ...task, pending_changes: null } : task
    ))

    closeApprovalDialog()
    alert("Changes rejected successfully!")
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <CardTitle className="text-black">Task Overview</CardTitle>
          <div className="flex space-x-2">
            <Button 
              onClick={exportToCSV}
              variant="outline"
              className="bg-white border-red-600 text-red-600 hover:bg-red-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white text-gray-800 border-gray-200">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="task_id" className="text-gray-700">Task ID</Label>
                    <Input
                      id="task_id"
                      value={newTask.task_id}
                      onChange={(e) => setNewTask({ ...newTask, task_id: e.target.value })}
                      className="bg-gray-100 border-gray-300 text-gray-800"
                      placeholder="TSK-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-gray-700">Description</Label>
                    <Textarea
                      id="description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="bg-gray-100 border-gray-300 text-gray-800"
                      placeholder="Task description..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="owner" className="text-gray-700">Owner</Label>
                    <Select
                      value={newTask.owner}
                      onValueChange={(value) => setNewTask({ ...newTask, owner: value })}
                    >
                      <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-800">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.name} className="text-gray-800 hover:bg-gray-100">
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="department" className="text-gray-700">Department</Label>
                    <Select value={newTask.department} onValueChange={(value: Department) => setNewTask({ ...newTask, department: value })}>
                      <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {DEPARTMENT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-gray-800 hover:bg-gray-100">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="start_date" className="text-gray-700">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newTask.start_date}
                      onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                      className="bg-gray-100 border-gray-300 text-gray-800"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estimated_date" className="text-gray-700">Estimated Completion Date</Label>
                    <Input
                      id="estimated_date"
                      type="date"
                      value={newTask.estimated_completion_date}
                      onChange={(e) => setNewTask({ ...newTask, estimated_completion_date: e.target.value })}
                      className="bg-gray-100 border-gray-300 text-gray-800"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-gray-700">Status</Label>
                    <Select value={newTask.status} onValueChange={(value: TaskStatus) => setNewTask({ ...newTask, status: value })}>
                      <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-800">
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
                  </div>
                  <Button onClick={handleAddTask} className="w-full bg-red-600 hover:bg-red-700">
                    Add Task
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Loading tasks...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[100px]">Task ID</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[250px]">Description</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold w-[150px]">Owner</th>
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
                            />
                          ) : (
                            <>
                              <span className="text-gray-700 font-mono">{task.task_id}</span>
                              {task.pending_changes && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openApprovalDialog(task)}
                                  className="p-1 h-6 w-6 text-orange-600 hover:text-orange-800 hover:bg-orange-100"
                                  title="Employee changes pending approval"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </Button>
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
                        {editingTaskId === task.id ? (
                          <Input
                            value={editingValues.owner || ''}
                            onChange={(e) => setEditingValues({ ...editingValues, owner: e.target.value })}
                            className="bg-gray-100 border-gray-300 text-gray-800 text-sm"
                          />
                        ) : (
                          <span className="text-gray-700">{task.owner}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingTaskId === task.id ? (
                          <Select
                            value={editingValues.department || task.department}
                            onValueChange={(value: Department) => setEditingValues({ ...editingValues, department: value })}
                          >
                            <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-800 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              {DEPARTMENT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value} className="text-gray-800 hover:bg-gray-100">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDepartmentBadgeColor(task.department)} whitespace-nowrap`}>
                            {getDepartmentLabel(task.department)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {editingTaskId === task.id ? (
                          <Input
                            type="date"
                            value={editingValues.start_date || ''}
                            onChange={(e) => setEditingValues({ ...editingValues, start_date: e.target.value })}
                            className="bg-gray-100 border-gray-300 text-gray-800 text-sm"
                          />
                        ) : (
                          <span className="text-gray-700">{task.start_date}</span>
                        )}
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
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(task.status)} whitespace-nowrap`}>
                            {getStatusLabel(task.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          {editingTaskId === task.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                className="bg-white text-green-600 hover:bg-green-200 p-1"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={cancelEditing}
                                variant="outline"
                                className="border-white bg-white text-gray-600 hover:bg-gray-100"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => startEditing(task)}
                                variant="outline"
                                className="border-white bg-white text-gray-600 hover:bg-gray-100 p-1"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleDeleteTask(task.id)}
                                variant="outline"
                                className="border-white bg-white text-red-500 hover:bg-red-50 hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
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
            <p className="text-gray-500 text-lg">No tasks found. Add your first task to get started!</p>
          </div>
        )}

        {/* Approval Dialog */}
        <Dialog open={approvalDialogOpen} onOpenChange={closeApprovalDialog}>
          <DialogContent className="bg-white text-gray-800 border-gray-200 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span>Employee Changes Pending Approval</span>
              </DialogTitle>
            </DialogHeader>
            {pendingChanges && selectedTaskForApproval && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Employee:</strong> {pendingChanges.changed_by} requested changes on{' '}
                    {new Date(pendingChanges.change_requested_at).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Current Values</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                      <div><strong>Task ID:</strong> {selectedTaskForApproval.task_id}</div>
                      <div><strong>Description:</strong> {selectedTaskForApproval.description}</div>
                      <div><strong>Est. Completion:</strong> {selectedTaskForApproval.estimated_completion_date || 'N/A'}</div>
                      <div><strong>Actual Completion:</strong> {selectedTaskForApproval.actual_completion_date || 'N/A'}</div>
                      <div><strong>Status:</strong> {getStatusLabel(selectedTaskForApproval.status)}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Proposed Changes</h4>
                    <div className="bg-orange-50 p-3 rounded-md space-y-2 text-sm">
                      <div><strong>Task ID:</strong> {pendingChanges.task_id}</div>
                      <div><strong>Description:</strong> {pendingChanges.description}</div>
                      <div><strong>Est. Completion:</strong> {pendingChanges.estimated_completion_date || 'N/A'}</div>
                      <div><strong>Actual Completion:</strong> {pendingChanges.actual_completion_date || 'N/A'}</div>
                      <div><strong>Status:</strong> {getStatusLabel(pendingChanges.status)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    onClick={rejectChanges}
                    className="bg-white text-red-800 hover:bg-red-50 text-red-800"
                  >
                    Reject Changes
                  </Button>
                  <Button
                    onClick={approveChanges}
                    className="bg-white text-green-800 hover:bg-green-50 text-green-800"
                  >
                    Approve Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}