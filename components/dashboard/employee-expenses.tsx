"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Wallet,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

/* ---------------- TYPES ---------------- */

interface Expense {
  id: string
  amount: string
  reimbursement_type: string
  transaction_id: string | null
  invoice_url: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}

/* ---------------- COMPONENT ---------------- */

export default function EmployeeExpenses() {
  const { userProfile } = useAuth()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [amount, setAmount] = useState("")
  const [type, setType] = useState("")
  const [txn, setTxn] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  /* ---------------- LOAD EXPENSES ---------------- */

  const loadExpenses = async (email: string) => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("sender_email", email)
      .order("created_at", { ascending: false })

    if (error) {
      toast({ title: "Failed to load expenses", variant: "destructive" })
      return
    }

    setExpenses((data as Expense[]) || [])
  }

  useEffect(() => {
    if (!userProfile?.email) return
    loadExpenses(userProfile.email)
  }, [userProfile])

  /* ---------------- SUBMIT EXPENSE ---------------- */

  const submitExpense = async () => {
    if (!userProfile?.email || !userProfile.employee_id) return

    if (!amount || !type || !file) {
      toast({
        title: "Missing fields",
        description: "Amount, type, and invoice are required.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      /* Upload invoice */
      const path = `${userProfile.employee_id}/${Date.now()}-${file.name}`

      const { data: upload, error: uploadError } = await supabase.storage
        .from("expense-invoices")
        .upload(path, file)

      if (uploadError) throw uploadError

      const invoiceUrl = supabase.storage
        .from("expense-invoices")
        .getPublicUrl(upload.path).data.publicUrl

      /* Insert expense record */
      const { error: insertError } = await supabase.from("expenses").insert({
        employee_id: userProfile.employee_id,
        employee_name: userProfile.username,
        sender_email: userProfile.email,
        amount,
        reimbursement_type: type,
        transaction_id: txn || null,
        invoice_url: invoiceUrl,
        status: "pending",
      })

      if (insertError) throw insertError

      toast({ title: "Expense submitted for approval" })

      /* Reset form */
      setAmount("")
      setType("")
      setTxn("")
      setFile(null)

      loadExpenses(userProfile.email)

    } catch (err) {
      toast({
        title: "Submission failed",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  /* ---------------- RENDER GUARD ---------------- */

  if (!userProfile) return null

  /* ---------------- UI ---------------- */

  return (
    <Card className="bg-gray-900 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="text-orange-500" />
          My Expenses
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* FORM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <Label>Transaction ID (optional)</Label>
            <Input
              value={txn}
              onChange={(e) => setTxn(e.target.value)}
            />
          </div>

          <div>
            <Label>Expense Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="meals">Meals</SelectItem>
                <SelectItem value="office">Office Supplies</SelectItem>
                <SelectItem value="client">Client Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Invoice / Receipt</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <Button
          onClick={submitExpense}
          disabled={loading}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Submit Expense"}
        </Button>

        {/* HISTORY */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>${e.amount}</TableCell>
                <TableCell>{e.reimbursement_type}</TableCell>
                <TableCell>
                  {e.status === "approved" && (
                    <Badge className="bg-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approved
                    </Badge>
                  )}
                  {e.status === "pending" && (
                    <Badge className="bg-yellow-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </Badge>
                  )}
                  {e.status === "rejected" && (
                    <Badge className="bg-red-600 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Rejected
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
              </TableRow>
            ))}

            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                  No expenses submitted yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

      </CardContent>
    </Card>
  )
}
