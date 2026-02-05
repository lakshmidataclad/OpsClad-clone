"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

/* ---------------- TYPES ---------------- */

type ExpenseStatus = "pending" | "approved" | "rejected"

interface Expense {
  id: string
  employee_name: string
  sender_email: string
  amount: number
  currency: string
  reimbursement_type: string
  transaction_id: string
  request_reason: string
  invoice_url: string
  status: ExpenseStatus
  created_at: string
}

/* ---------------- COMPONENT ---------------- */

export default function ManagerExpensesTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const { toast } = useToast()
  const { userProfile } = useAuth()

  const currentYear = new Date().getFullYear()
  const [search, setSearch] = useState("")
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const isManager = useMemo(
    () => userProfile?.role === "manager",
    [userProfile]
  )

  /* ---------------- LOAD EXPENSES ---------------- */

  const loadExpenses = async () => {
    setLoading(true)

    try {
      const res = await fetch("/api/google-drive/expenses/list")
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load expenses")
      }

      setExpenses(data.expenses)
    } catch (err: any) {
      toast({
        title: "Failed to load expenses",
        description: err.message,
        variant: "destructive",
      })
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userProfile || !isManager) {
      setLoading(false)
      return
    }
    loadExpenses()
  }, [userProfile, isManager])

  /* ---------------- FILTERING ---------------- */

  const availableYears = useMemo(() => {
    const years = expenses.map(e => new Date(e.created_at).getFullYear())
    return Array.from(new Set(years)).sort((a, b) => b - a)
  }, [expenses])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const yearMatches =
        new Date(e.created_at).getFullYear() === selectedYear

      const q = search.toLowerCase()
      const searchMatches =
        e.employee_name.toLowerCase().includes(q) ||
        e.sender_email.toLowerCase().includes(q) ||
        e.transaction_id.toLowerCase().includes(q) ||
        e.reimbursement_type.toLowerCase().includes(q) ||
        e.request_reason.toLowerCase().includes(q)

      return yearMatches && searchMatches
    })
  }, [expenses, search, selectedYear])

  /* ---------------- UPDATE STATUS (IMPORTANT PART) ---------------- */

  const updateStatus = async (
    expense: Expense,
    nextStatus: "approved" | "rejected"
  ) => {
    if (!userProfile?.email) return

    if (expense.sender_email === userProfile.email) {
      toast({
        title: "Not allowed",
        description: "You cannot approve or reject your own expense.",
        variant: "destructive",
      })
      return
    }

    const ok = window.confirm(
      `Are you sure you want to ${nextStatus.toUpperCase()} this expense?\n\nTxn: ${
        expense.transaction_id
      }\nEmployee: ${expense.employee_name}\nAmount: ${
        expense.currency
      } ${Number(expense.amount).toFixed(2)}`
    )
    if (!ok) return

    setProcessingId(expense.id)

    try {
      const res = await fetch("/api/google-drive/expenses/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: expense.id,
          status: nextStatus,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update expense")
      }

      toast({
        title: `Expense ${nextStatus}`,
        description: `Invoice moved to ${
          nextStatus === "approved" ? "Approved" : "Rejected"
        } folder`,
      })

      await loadExpenses()
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message || "Unexpected error",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  /* ---------------- UI ---------------- */

  if (!userProfile) return null

  if (!isManager) {
    return (
      <Card className="bg-gray-900 text-white">
        <CardHeader>
          <CardTitle>Expenses Approval</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-red-400 py-10">
          You are not authorized to view this page.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-900 text-white">
      <CardHeader>
        <CardTitle>Expenses Approval</CardTitle>
      </CardHeader>

      <CardContent>
        {/* SEARCH + YEAR FILTER */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search expenses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full md:w-2/3 rounded-md bg-gray-800 px-3 py-2 text-sm"
          />

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="w-full md:w-1/3 rounded-md bg-gray-800 px-3 py-2 text-sm"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 gap-2">
            <Loader2 className="animate-spin" /> Loading…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Trn ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredExpenses.map(e => {
                const disabled =
                  processingId === e.id ||
                  e.status !== "pending" ||
                  e.sender_email === userProfile.email

                return (
                  <>
                    {/* MAIN EXPENSE ROW */}
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.employee_name}
                      </TableCell>

                      <TableCell className="text-xs text-gray-300">
                        {e.transaction_id}
                      </TableCell>

                      <TableCell>
                        {e.currency} {Number(e.amount).toFixed(2)}
                      </TableCell>

                      <TableCell>{e.reimbursement_type}</TableCell>

                      <TableCell>
                        <Badge
                          className={
                            e.status === "approved"
                              ? "bg-green-600"
                              : e.status === "rejected"
                              ? "bg-red-600"
                              : "bg-yellow-600"
                          }
                        >
                          {e.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <a
                          href={e.invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 underline"
                        >
                          View
                        </a>
                      </TableCell>

                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          disabled={disabled}
                          onClick={() => updateStatus(e, "approved")}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={disabled}
                          onClick={() => updateStatus(e, "rejected")}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* DESCRIPTION ROW */}
                    <TableRow className="bg-gray-900/40">
                      <TableCell colSpan={7} className="px-6 pt-1 pb-4">
                        <div
                          className="
                            text-sm
                            text-gray-300
                            whitespace-normal
                            break-words
                            max-h-[7.5rem]
                            overflow-y-auto
                            pr-2
                          "
                        >
                          <span className="text-gray-400 font-semibold">
                            Description:
                          </span>{" "}
                          {e.request_reason || "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                )
              })}
            </TableBody>

          </Table>
        )}
      </CardContent>
    </Card>
  )
}
