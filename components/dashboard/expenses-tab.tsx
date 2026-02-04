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
import { supabase } from "@/lib/supabase"
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
  google_drive_file_id: string | null
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
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  const isManager = useMemo(() => {
    // adjust this if your userProfile uses a different key
    return userProfile?.role === "manager"
  }, [userProfile])

  useEffect(() => {
    if (!userProfile) return
    if (!isManager) {
      setLoading(false)
      return
    }
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, isManager])

  /* ---------------- LOAD ALL EXPENSES ---------------- */

  const loadExpenses = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, employee_name, sender_email, amount, currency, reimbursement_type, transaction_id, request_reason, invoice_url, google_drive_file_id, status, created_at"
      )
      .order("created_at", { ascending: false })

    if (error) {
      toast({
        title: "Failed to load expenses",
        description: error.message,
        variant: "destructive",
      })
      setExpenses([])
      setLoading(false)
      return
    }

    setExpenses((data as Expense[]) || [])
    setLoading(false)
  }

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

  /* ---------------- UPDATE STATUS ---------------- */

  const updateStatus = async (expense: Expense, nextStatus: "approved" | "rejected") => {
    if (!userProfile?.email) return

    // basic safety: prevent approving own expense (optional but recommended)
    if (expense.sender_email === userProfile.email) {
      toast({
        title: "Not allowed",
        description: "You cannot approve/reject your own expense.",
        variant: "destructive",
      })
      return
    }

    const ok = window.confirm(
      `Are you sure you want to ${nextStatus.toUpperCase()} this expense?\n\nTxn: ${expense.transaction_id}\nEmployee: ${expense.employee_name}\nAmount: ${expense.currency} ${Number(expense.amount).toFixed(2)}\n\nThis cannot be undone.`
    )
    if (!ok) return

    setProcessingId(expense.id)

    // 1) Update DB first
    const { data, error } = await supabase
      .from("expenses")
      .update({
        status: nextStatus,
        approved_at: new Date().toISOString(),
        approved_by: userProfile.email,
        // IMPORTANT: don't write invoice_folder unless you are sure the column exists.
        // If you DO have it and want it, uncomment:
        // invoice_folder: nextStatus === "approved" ? "Approved" : "Rejected",
      })
      .eq("id", expense.id)
      .select("google_drive_file_id")
      .single()

    if (error) {
      toast({
        title: "Failed to update expense",
        description: error.message,
        variant: "destructive",
      })
      setProcessingId(null)
      return
    }

    // 2) Move invoice in Google Drive (if we have a file id)
    const fileId = data?.google_drive_file_id as string | null

    if (fileId) {
      try {
        const moveRes = await fetch("/api/google-drive/expenses/move-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fileId,
            targetFolder: nextStatus === "approved" ? "Approved" : "Rejected",
          }),
        })

        const moveData = await moveRes.json().catch(() => ({}))

        if (!moveRes.ok || moveData?.success === false) {
          throw new Error(moveData?.error || "Failed to move invoice in Drive")
        }
      } catch (e: any) {
        toast({
          title: "Drive move failed",
          description:
            "Expense status updated, but the invoice could not be moved in Drive. You may need to move it manually.",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "No Drive file found",
        description: "Expense was updated, but no Drive fileId exists for this invoice.",
        variant: "destructive",
      })
    }

    toast({ title: `Expense ${nextStatus}` })
    await loadExpenses()
    setProcessingId(null)
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
            placeholder="Search by employee, email, txn ID, type, description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="
              w-full md:w-2/3
              rounded-md
              border border-gray-700
              bg-gray-800
              px-3 py-2
              text-sm
              text-white
              placeholder-gray-400
              focus:outline-none
              focus:ring-2
              focus:ring-orange-500
            "
          />

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="
              w-full md:w-1/3
              rounded-md
              border border-gray-700
              bg-gray-800
              px-3 py-2
              text-sm
              text-white
              focus:outline-none
              focus:ring-2
              focus:ring-orange-500
            "
          >
            {availableYears.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading expenses...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Txn ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredExpenses.map((e) => {
                const isPending = e.status === "pending"
                const isOwn = e.sender_email === userProfile.email
                const disabled = processingId === e.id || !isPending || isOwn

                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.employee_name}</TableCell>

                    <TableCell className="text-xs">{e.transaction_id}</TableCell>

                    <TableCell>
                      {e.currency} {Number(e.amount).toFixed(2)}
                    </TableCell>

                    <TableCell>{e.reimbursement_type}</TableCell>

                    <TableCell className="max-w-xs truncate">{e.request_reason}</TableCell>

                    <TableCell>
                      {e.status === "approved" && (
                        <Badge className="bg-green-600">Approved</Badge>
                      )}
                      {e.status === "pending" && (
                        <Badge className="bg-yellow-600">Pending</Badge>
                      )}
                      {e.status === "rejected" && (
                        <Badge className="bg-red-600">Rejected</Badge>
                      )}
                      {isOwn && (
                        <span className="ml-2 text-xs text-gray-400">(your expense)</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {e.invoice_url ? (
                        <a
                          href={e.invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>

                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        disabled={disabled}
                        onClick={() => updateStatus(e, "approved")}
                        title={isOwn ? "You cannot approve your own expense" : "Approve"}
                      >
                        {processingId === e.id ? (
                          <Loader2 className="animate-spin w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={disabled}
                        onClick={() => updateStatus(e, "rejected")}
                        title={isOwn ? "You cannot reject your own expense" : "Reject"}
                      >
                        {processingId === e.id ? (
                          <Loader2 className="animate-spin w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}

              {filteredExpenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-6">
                    No expenses found for {selectedYear}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
