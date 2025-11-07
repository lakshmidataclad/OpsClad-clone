"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts"
import { CalendarDays, Clock, TrendingUp, AlertTriangle, CheckCircle, Users, Download, BarChart2 } from "lucide-react"
import { Task, TaskStatus, TASK_STATUS_OPTIONS } from "@/lib/types"
import { supabase } from "@/lib/supabase"

interface TaskMetrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  onHoldTasks: number
  blockedTasks: number
  averageCompletionTime: number
  onTimeCompletionRate: number
  overdueTasksCount: number
}

interface EfficiencyData {
  taskId: string
  estimatedDays: number
  actualDays: number
  efficiency: number
  status: TaskStatus
}

interface StatusDistribution {
  status: string
  count: number
  percentage: number
  color: string
}

interface OwnerMetrics {
  owner: string
  totalTasks: number
  completedTasks: number
  averageEfficiency: number
  onTimeRate: number
}

export default function TaskReportsTab() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("30")
  const [showDetailedResults, setShowDetailedResults] = useState(false)

  // Fetch tasks from Supabase
  const fetchTasks = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('task_overviews')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error fetching tasks:", error.message)
      setError("Failed to load tasks. Please try again.")
    } else {
      setTasks(data as Task[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  // Filter tasks based on selected owner and date range
  const filteredTasks = useMemo(() => {
    let filtered = tasks

    // Filter by owner
    if (selectedOwner !== "all") {
      filtered = filtered.filter(task => task.owner === selectedOwner)
    }

    // Filter by date range
    const daysAgo = parseInt(dateRange)
    if (daysAgo > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
      filtered = filtered.filter(task => new Date(task.created_at) >= cutoffDate)
    }

    return filtered
  }, [tasks, selectedOwner, dateRange])

  // Calculate task metrics
  const taskMetrics = useMemo((): TaskMetrics => {
    const total = filteredTasks.length
    const completed = filteredTasks.filter(t => t.status === 'completed').length
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length
    const onHold = filteredTasks.filter(t => t.status === 'on_hold').length
    const blocked = filteredTasks.filter(t => t.status === 'blocked').length

    // Calculate average completion time for completed tasks
    const completedTasksWithDates = filteredTasks.filter(t => 
      t.status === 'completed' && 
      t.estimated_completion_date && 
      t.actual_completion_date
    )

    const totalCompletionTime = completedTasksWithDates.reduce((acc, task) => {
      const estimated = new Date(task.estimated_completion_date!)
      const actual = new Date(task.actual_completion_date!)
      return acc + Math.abs(actual.getTime() - estimated.getTime()) / (1000 * 60 * 60 * 24)
    }, 0)

    const averageCompletionTime = completedTasksWithDates.length > 0 
      ? totalCompletionTime / completedTasksWithDates.length 
      : 0

    // Calculate on-time completion rate
    const onTimeCompletions = completedTasksWithDates.filter(task => {
      const estimated = new Date(task.estimated_completion_date!)
      const actual = new Date(task.actual_completion_date!)
      return actual <= estimated
    }).length

    const onTimeCompletionRate = completedTasksWithDates.length > 0 
      ? (onTimeCompletions / completedTasksWithDates.length) * 100 
      : 0

    // Calculate overdue tasks
    const today = new Date()
    const overdueTasksCount = filteredTasks.filter(task => 
      task.status !== 'completed' && 
      task.estimated_completion_date &&
      new Date(task.estimated_completion_date) < today
    ).length

    return {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgress,
      onHoldTasks: onHold,
      blockedTasks: blocked,
      averageCompletionTime,
      onTimeCompletionRate,
      overdueTasksCount
    }
  }, [filteredTasks])

  // Calculate efficiency data
  const efficiencyData = useMemo((): EfficiencyData[] => {
    return filteredTasks
      .filter(task => task.estimated_completion_date && task.actual_completion_date)
      .map(task => {
        const estimated = new Date(task.estimated_completion_date!)
        const actual = new Date(task.actual_completion_date!)
        const estimatedDays = Math.ceil((estimated.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))
        const actualDays = Math.ceil((actual.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))
        
        const efficiency = estimatedDays > 0 ? (estimatedDays / actualDays) * 100 : 0

        return {
          taskId: task.task_id,
          estimatedDays,
          actualDays,
          efficiency,
          status: task.status
        }
      })
  }, [filteredTasks])

  // Calculate status distribution
  const statusDistribution = useMemo((): StatusDistribution[] => {
    const statusColors = {
      'completed': '#7ba48bff',
      'in_progress': '#95bdffff',
      'on_hold': '#f59e0b',
      'blocked': '#ef4444'
    }

    return TASK_STATUS_OPTIONS.map(option => {
      const count = filteredTasks.filter(t => t.status === option.value).length
      const percentage = taskMetrics.totalTasks > 0 ? (count / taskMetrics.totalTasks) * 100 : 0
      
      return {
        status: option.label,
        count,
        percentage,
        color: statusColors[option.value as keyof typeof statusColors] || '#6b7280'
      }
    }).filter(item => item.count > 0)
  }, [filteredTasks, taskMetrics.totalTasks])

  // Calculate owner metrics
  const ownerMetrics = useMemo((): OwnerMetrics[] => {
    const ownerMap = new Map<string, OwnerMetrics>()

    filteredTasks.forEach(task => {
      if (!ownerMap.has(task.owner)) {
        ownerMap.set(task.owner, {
          owner: task.owner,
          totalTasks: 0,
          completedTasks: 0,
          averageEfficiency: 0,
          onTimeRate: 0
        })
      }

      const metrics = ownerMap.get(task.owner)!
      metrics.totalTasks++
      
      if (task.status === 'completed') {
        metrics.completedTasks++
      }
    })

    // Calculate efficiency and on-time rates
    ownerMap.forEach((metrics, owner) => {
      const ownerTasks = filteredTasks.filter(t => t.owner === owner)
      const completedWithDates = ownerTasks.filter(t => 
        t.status === 'completed' && 
        t.estimated_completion_date && 
        t.actual_completion_date
      )

      if (completedWithDates.length > 0) {
        const totalEfficiency = completedWithDates.reduce((acc, task) => {
          const estimated = new Date(task.estimated_completion_date!)
          const actual = new Date(task.actual_completion_date!)
          const estimatedDays = Math.ceil((estimated.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))
          const actualDays = Math.ceil((actual.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))
          return acc + (estimatedDays > 0 ? (estimatedDays / actualDays) * 100 : 0)
        }, 0)

        metrics.averageEfficiency = totalEfficiency / completedWithDates.length

        const onTimeCount = completedWithDates.filter(task => {
          const estimated = new Date(task.estimated_completion_date!)
          const actual = new Date(task.actual_completion_date!)
          return actual <= estimated
        }).length

        metrics.onTimeRate = (onTimeCount / completedWithDates.length) * 100
      }
    })

    return Array.from(ownerMap.values()).sort((a, b) => b.totalTasks - a.totalTasks)
  }, [filteredTasks])

  // Get unique owners for filter
  const uniqueOwners = useMemo(() => {
    return Array.from(new Set(tasks.map(task => task.owner))).sort()
  }, [tasks])

  const downloadCSV = () => {
    if (filteredTasks.length === 0) return

    const headers = ["Task ID", "Owner", "Status", "Created Date", "Estimated Completion", "Actual Completion"]
    let csvContent = headers.join(",") + "\n"

    filteredTasks.forEach((task) => {
      const row = [
        task.task_id,
        task.owner,
        task.status,
        task.created_at,
        task.estimated_completion_date || "",
        task.actual_completion_date || "",
      ]
      csvContent += row.map((field) => `"${field}"`).join(",") + "\n"
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "task_report.csv")
    link.click()
    URL.revokeObjectURL(url)
  }

  // Custom tooltip for efficiency chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const taskData = payload[0].payload;
      return (
        <div className="rounded-lg border bg-white p-2 shadow-sm text-black">
          <p className="font-bold text-black">{taskData.taskId}</p>
          <p style={{ color: payload[0].color }}>
            Efficiency: {Math.round(taskData.efficiency)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Loading task reports...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Task Reports & Analytics</CardTitle>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Filter by Owner:</label>
          <Select value={selectedOwner} onValueChange={setSelectedOwner}>
            <SelectTrigger className="bg-black text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {uniqueOwners.map(owner => (
                <SelectItem key={owner} value={owner}>{owner}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Date Range:</label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="bg-black text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="bg-gray-800 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
            <h4 className="text-xl font-medium text-orange-600">{taskMetrics.totalTasks}</h4>
            <p className="text-sm text-gray-500">Total Tasks</p>
          </div>
          <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
            <h4 className="text-xl font-medium text-orange-600">
              {taskMetrics.totalTasks > 0 ? Math.round((taskMetrics.completedTasks / taskMetrics.totalTasks) * 100) : 0}%
            </h4>
            <p className="text-sm text-gray-500">Completion Rate</p>
          </div>
          <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
            <h4 className="text-xl font-medium text-orange-600">
              {Math.round(taskMetrics.onTimeCompletionRate)}%
            </h4>
            <p className="text-sm text-gray-500">On-Time Rate</p>
          </div>
          <div className="bg-gray-950 p-4 rounded-lg text-center shadow-sm">
            <h4 className="text-xl font-medium text-orange-600">{taskMetrics.overdueTasksCount}</h4>
            <p className="text-sm text-gray-500">Overdue Tasks</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card className="bg-white">
          <CardHeader>
            <h1 className="text-xl font-semibold text-black">Task Status Distribution</h1>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value} tasks (${props.payload.percentage.toFixed(1)}%)`,
                      props.payload.status
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {statusDistribution.map((item, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1 text-black">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  {item.status}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Efficiency Chart */}
        <Card className="bg-white">
          <CardHeader>
            <h1 className="text-xl font-semibold text-black">Task Efficiency Analysis</h1>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efficiencyData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="taskId" 
                    tickFormatter={() => ''} 
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="efficiency" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Efficiency = (Estimated Days / Actual Days) × 100%.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Owner Performance Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-black">
            <Users className="h-5 w-5 text-black" />
            Owner Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-full bg-gray-100">
                <TableHeader className="bg-gray-100">
                    <TableRow className="border-gray-600">
                    <TableHead className="px-4 py-3 text-left text-gray-800">Owner</TableHead>
                    <TableHead className="px-4 py-3 text-left text-gray-800">Total Tasks</TableHead>
                    <TableHead className="px-4 py-3 text-left text-gray-800">Completed</TableHead>
                    <TableHead className="px-4 py-3 text-left text-gray-800">Completion Rate</TableHead>
                    <TableHead className="px-4 py-3 text-left text-gray-800">Avg Efficiency</TableHead>
                    <TableHead className="px-4 py-3 text-left text-gray-800">On-Time Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ownerMetrics.map((owner, index) => (
                    <TableRow key={index} className={index % 2 === 0 ? "bg-white border-gray-700" : "bg-white border-gray-700"}>
                        <TableCell className="px-4 py-3 font-medium text-black">{owner.owner}</TableCell>
                        <TableCell className="px-4 py-3 text-black">{owner.totalTasks}</TableCell>
                        <TableCell className="px-4 py-3 text-black">{owner.completedTasks}</TableCell>
                        <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Progress
                            value={owner.totalTasks > 0 ? (owner.completedTasks / owner.totalTasks) * 100 : 0}
                            className="w-24 h-2 bg-gray-600 [&>*]:bg-blue-500" // Customizing progress bar colors
                            />
                            <span className="text-sm text-black">
                            {owner.totalTasks > 0 ? Math.round((owner.completedTasks / owner.totalTasks) * 100) : 0}%
                            </span>
                        </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                        <Badge variant={owner.averageEfficiency >= 100 ? "default" : "secondary"} className="rounded-full px-3 py-1 text-xs">
                            {Math.round(owner.averageEfficiency)}%
                        </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                        <Badge variant={owner.onTimeRate >= 80 ? "default" : "destructive"} className="rounded-full px-3 py-1 text-xs">
                            {Math.round(owner.onTimeRate)}%
                        </Badge>
                        </TableCell>
                    </TableRow>
                    ))}
                    {ownerMetrics.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        No owner metrics found
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}