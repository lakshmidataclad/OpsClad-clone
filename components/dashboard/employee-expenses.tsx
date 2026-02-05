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
  amount: number
  currency: string  
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
  const [amount, setAmount] = useState<number | "">("")
  const [currency, setCurrency] = useState("")
  const [type, setType] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)


  // Google Drive readiness (shared / global)
  const [driveReady, setDriveReady] = useState<boolean | null>(null)

  /* ---------------- CHECK DRIVE CONFIG ---------------- */

  useEffect(() => {
    const checkDrive = async () => {
      try {
        const res = await fetch("/api/google-drive/status")
        const data = await res.json()
        setDriveReady(Boolean(data?.connected))
      } catch {
        setDriveReady(false)
      }
    }

    checkDrive()

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  /* ---------------- CURRENCY LIST ---------------- */

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
const validateExpense = () => {
  if (!amount || amount <= 0) return "Enter a valid amount"
  if (!currency) return "Select a currency"
  if (!type) return "Select an expense type"
  if (!description.trim()) return "Description is required"
  if (!file) return "Invoice file is required"

  // File validations
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
  if (!allowedTypes.includes(file.type)) {
    return "Only JPG, PNG, or PDF files are allowed"
  }

  if (file.size > 5 * 1024 * 1024) {
    return "Invoice must be smaller than 5MB"
  }

  return null
}

const generateFileHash = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

const submitExpense = async () => {
  if (!userProfile?.email || !userProfile.employee_id) return

  if (!driveReady) {
    toast({
      title: "Google Drive not configured",
      description:
        "Expense uploads are unavailable until a company Drive is configured.",
      variant: "destructive",
    })
    return
  }

  const validationError = validateExpense()
  if (validationError) {
    toast({
      title: "Invalid submission",
      description: validationError,
      variant: "destructive",
    })
    return
  }

  setLoading(true)

  try {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, "")
    const time = now.toTimeString().slice(0, 8).replace(/:/g, "")
    const transactionId = `REM${date}${time}${userProfile.employee_id}`

    // ✅ NEW: generate hash
    const invoiceHash = await generateFileHash(file!)

    const formData = new FormData()
    formData.append("invoice", file!)
    formData.append("invoice_hash", invoiceHash)

    formData.append("employee_id", String(userProfile.employee_id))
    formData.append("employee_name", String(userProfile.username))
    formData.append("sender_email", String(userProfile.email))
    formData.append("amount", String(amount))
    formData.append("currency", String(currency))
    formData.append("reimbursement_type", String(type))
    formData.append("transaction_id", transactionId)
    formData.append("request_reason", String(description))

    const res = await fetch("/api/google-drive/expenses/submit", {
      method: "POST",
      body: formData,
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Expense submission failed")
    }

    toast({ title: "Expense submitted for approval" })

    // reset form
    setAmount("")
    setCurrency("")
    setType("")
    setDescription("")
    setFile(null)

    loadExpenses(userProfile.email)
  } catch (err) {
    console.error(err)
    toast({
      title: "Submission failed",
      description:
        err instanceof Error ? err.message : "Unexpected error occurred.",
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
        {driveReady === false && (
          <p className="text-sm text-red-400">
            Google Drive is not configured. Expense submissions are currently
            unavailable.
          </p>
        )}

        {/* INPUTS */}
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
              onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
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

        <div>
          <Label>Description</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>

        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={e => {
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
        {file && previewUrl && (
          <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800 p-3">
            <p className="text-sm text-gray-400 mb-2">
              Invoice Preview ({file.type})
            </p>

            {/* IMAGE PREVIEW */}
            {file.type.startsWith("image/") && (
              <img
                src={previewUrl}
                alt="Invoice preview"
                className="max-h-96 mx-auto rounded-md"
              />
            )}

            {/* PDF PREVIEW */}
            {file.type === "application/pdf" && (
              <iframe
                src={previewUrl}
                className="w-full h-96 rounded-md"
                title="PDF Preview"
              />
            )}
          </div>
        )}



        <Button
          onClick={submitExpense}
          disabled={loading || driveReady === false}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Submit Expense"}
        </Button>

        {/* HISTORY */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trn ID</TableHead>
              <TableHead>Currency</TableHead>
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
                <TableCell>{e.currency}</TableCell>
                <TableCell>{e.amount}</TableCell>
                <TableCell>{e.reimbursement_type}</TableCell>
                <TableCell>
                  {e.status === "approved" && (
                    <Badge className="bg-green-600">
                      <CheckCircle className="w-3 h-3" /> Approved
                    </Badge>
                  )}
                  {e.status === "pending" && (
                    <Badge className="bg-yellow-600">
                      <Clock className="w-3 h-3" /> Pending
                    </Badge>
                  )}
                  {e.status === "rejected" && (
                    <Badge className="bg-red-600">
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
