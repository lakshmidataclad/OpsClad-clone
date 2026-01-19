"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
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
import {
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

/* ---------------- TYPES ---------------- */

interface Expense {
  id: string
  employee_name: string
  amount: number
  currency: string
  reimbursement_type: string
  transaction_id: string
  request_reason: string
  invoice_url: string
  google_drive_file_id: string
  status: "pending" | "approved" | "rejected"
}

/* ---------------- COMPONENT ---------------- */

export default function ManagerExpensesTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const { toast } = useToast()
  const { userProfile } = useAuth()

  useEffect(() => {
    loadExpenses()
  }, [])

  /* ---------------- LOAD ALL EXPENSES ---------------- */

  const loadExpenses = async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      toast({
        title: "Failed to load expenses",
        variant: "destructive",
      })
      return
    }

    setExpenses((data as Expense[]) || [])
  }

  /* ---------------- UPDATE STATUS ---------------- */

  const updateStatus = async (
    id: string,
    status: "approved" | "rejected"
  ) => {
    if (!userProfile?.email) return

    setProcessing(id)

    /* 1️⃣ Update database first */
    const { data, error } = await supabase
      .from("expenses")
      .update({
        status,
        invoice_folder: status, // keeps DB in sync
        approved_at: new Date().toISOString(),
        approved_by: userProfile.email,
      })
      .eq("id", id)
      .select("google_drive_file_id")
      .single()

    if (error || !data?.google_drive_file_id) {
      toast({
        title: "Failed to update expense",
        variant: "destructive",
      })
      setProcessing(null)
      return
    }

    /* 2️⃣ Move invoice in Google Drive */
    try {
      await fetch("/api/move-expense-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileId: data.google_drive_file_id,
          targetFolder: status === "approved" ? "Approved" : "Rejected",
        }),
      })
    } catch {
      toast({
        title: "Drive update failed",
        description: "Expense status updated, but file could not be moved.",
        variant: "destructive",
      })
    }

    toast({ title: `Expense ${status}` })
    loadExpenses()
    setProcessing(null)
  }

  /* ---------------- UI ---------------- */

  return (
    <Card className="bg-gray-900 text-white">
      <CardHeader>
        <CardTitle>Expenses Approval</CardTitle>
      </CardHeader>

      <CardContent>
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
            {expenses.map(e => (
              <TableRow key={e.id}>
                <TableCell>{e.employee_name}</TableCell>

                <TableCell className="text-xs">
                  {e.transaction_id}
                </TableCell>

                <TableCell>
                  {e.currency} {e.amount.toFixed(2)}
                </TableCell>

                <TableCell>{e.reimbursement_type}</TableCell>

                <TableCell className="max-w-xs truncate">
                  {e.request_reason}
                </TableCell>

                <TableCell>
                  {e.status === "approved" && (
                    <Badge className="bg-green-600">
                      Approved (Filed)
                    </Badge>
                  )}
                  {e.status === "pending" && (
                    <Badge className="bg-yellow-600">
                      Pending
                    </Badge>
                  )}
                  {e.status === "rejected" && (
                    <Badge className="bg-red-600">
                      Rejected (Filed)
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  <a
                    href={e.invoice_url}
                    target="_blank"
                    className="text-blue-400 underline"
                  >
                    View
                  </a>
                </TableCell>

                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    disabled={
                      processing === e.id || e.status !== "pending"
                    }
                    onClick={() => updateStatus(e.id, "approved")}
                  >
                    {processing === e.id ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={
                      processing === e.id || e.status !== "pending"
                    }
                    onClick={() => updateStatus(e.id, "rejected")}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-gray-400 py-6"
                >
                  No expenses found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
