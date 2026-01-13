"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

export default function ManagerExpensesTracker() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false })

    setExpenses(data || [])
  }

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    setProcessing(id)

    await supabase.from("expenses").update({
      status,
      approved_at: new Date().toISOString(),
    }).eq("id", id)

    toast({ title: `Expense ${status}` })
    loadExpenses()
    setProcessing(null)
  }

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
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {expenses.map(e => (
              <TableRow key={e.id}>
                <TableCell>{e.employee_name}</TableCell>
                <TableCell>${e.amount}</TableCell>
                <TableCell>{e.reimbursement_type}</TableCell>
                <TableCell>
                  <Badge>{e.status}</Badge>
                </TableCell>
                <TableCell>
                  <a href={e.invoice_url} target="_blank" className="text-blue-400">View</a>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" onClick={() => updateStatus(e.id, "approved")} disabled={processing === e.id}>
                    {processing === e.id ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus(e.id, "rejected")} disabled={processing === e.id}>
                    <XCircle />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
