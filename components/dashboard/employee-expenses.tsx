"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  transaction_id: string
  invoice_url: string
  status: "pending" | "approved" | "rejected"
  request_reason: string
  created_at: string
}

/* ---------------- COMPONENT ---------------- */

export default function EmployeeExpenses() {
  const { userProfile } = useAuth()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [type, setType] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  /* ---------------- CURRENCY LIST (Intl) ---------------- */

  const currencyOptions = useMemo(() => {
    return Intl.supportedValuesOf("currency").map(code => {
      const formatter = new Intl.NumberFormat("en", {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })

      const symbol =
        formatter.formatToParts(1).find(p => p.type === "currency")?.value || ""

      return {
        value: code,
        label: `${code} — ${symbol}`,
      }
    })
  }, [])

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

    if (!amount || !currency || !type || !file || !description) {
      toast({
        title: "Missing fields",
        description: "All fields including description are required.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0]

      const transactionId = `REM-${userProfile.employee_id}-${timestamp}`

      const fileExtension = file.name.split(".").pop()
      const path = `${userProfile.employee_id}/${transactionId}.${fileExtension}`

      // 1️⃣ get default drive
      const res = await fetch("/api/gdrive", { method: "GET" })
      const { email: driveEmail } = await res.json()

      let invoiceUrl = ""

      // 2️⃣ upload invoice
      if (driveEmail) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("employee_id", userProfile.employee_id)
        formData.append("transaction_id", transactionId)

        const uploadRes = await fetch("/api/upload-expense-to-drive", {
          method: "POST",
          body: formData,
        })

        const uploadData = await uploadRes.json()

        if (!uploadData.success) {
          throw new Error("Google Drive upload failed")
        }

        invoiceUrl = uploadData.driveUrl
      } else {
        throw new Error("No default Google Drive configured")
      }

      const { error } = await supabase.from("expenses").insert({
        employee_id: userProfile.employee_id,
        employee_name: userProfile.username,
        sender_email: userProfile.email,
        amount: Number(amount),
        currency: currency,
        reimbursement_type: type,
        transaction_id: transactionId,
        invoice_url: invoiceUrl,
        request_reason: description,
        status: "pending",
      })

      if (error) throw error

      toast({ title: "Expense submitted for approval" })

      setAmount("")
      setCurrency("")
      setType("")
      setDescription("")
      setFile(null)
      setPreviewUrl(null)

      loadExpenses(userProfile.email)

    } catch {
      toast({
        title: "Submission failed",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

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

        {/* INPUT ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                {currencyOptions.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

                    <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
                <SelectItem value="professional">
                  Professional Development
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* DESCRIPTION */}
        <div>
          <Label>Description</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the expense in detail"
            className="resize-y"
            maxLength={500}
          />
        </div>

        {/* INVOICE */}
        <div>
          <Input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null
              setFile(selectedFile)

              if (selectedFile) {
                const url = URL.createObjectURL(selectedFile)
                setPreviewUrl(url)
              } else {
                setPreviewUrl(null)
              }
            }}
          />

            {previewUrl && (
              <div className="mt-4 border border-gray-700 rounded-lg p-3 bg-gray-800">
                <p className="text-sm text-gray-400 mb-2">Preview</p>

                {/* IMAGE PREVIEW */}
                {file?.type.startsWith("image/") && (
                  <img
                    src={previewUrl}
                    alt="Invoice preview"
                    className="rounded-md mx-auto w-auto max-w-full h-auto"
                    style={{ maxHeight: "80vh" }}
                  />
                )}

                {/* PDF PREVIEW */}
                {file?.type === "application/pdf" && (
                  <div className="w-full overflow-auto">
                    <iframe
                      src={previewUrl}
                      title="PDF Preview"
                      className="w-full rounded-md border border-gray-700"
                      style={{ height: "80vh" }}
                    />
                  </div>
                )}
              </div>
            )}
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
              <TableHead>Txn ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {expenses.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">
                  {e.transaction_id}
                </TableCell>
                <TableCell>{e.amount}</TableCell>
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
                <TableCell
                  colSpan={5}
                  className="text-center text-gray-400 py-6"
                >
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
