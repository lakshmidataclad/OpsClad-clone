"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Wallet } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { InvoiceFileSelector } from "@/app/api/invoiceFileSelector/invoiceFileSelector"

export default function EmployeeExpensesPage() {
  const router = useRouter()
  const { authState, userProfile } = useAuth()

  // Form state (UI only)
  const [amount, setAmount] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [reimbursementType, setReimbursementType] = useState("")
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)

  // Route protection
  useEffect(() => {
    if (authState === "unauthenticated") {
      router.replace("/")
      return
    }

    if (
      authState === "authenticated" &&
      userProfile?.role !== "employee"
    ) {
      router.replace("/dashboard")
    }
  }, [authState, userProfile, router])

  if (authState !== "authenticated" || !userProfile) {
    return null
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <Card className="bg-gray-900 border-gray-700 shadow-xl max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Wallet className="w-6 h-6 text-orange-500" />
            Expenses Tracker
          </CardTitle>
          <CardDescription className="text-gray-400">
            Submit and track your work-related reimbursement claims
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Employee Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Employee Name</Label>
              <Input
                value={userProfile.username}
                disabled
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-400">Employee ID</Label>
              <Input
                value={userProfile.employee_id}
                disabled
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Expense Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Reimbursement Amount</Label>
              <Input
                type="number"
                placeholder="e.g. 125.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-gray-900 border-gray-700 text-white focus:ring-orange-500"
              />
            </div>

            <div>
              <Label className="text-gray-400">Transaction ID</Label>
              <Input
                placeholder="e.g. TXN-2026-00123"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="bg-gray-900 border-gray-700 text-white focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Reimbursement Type */}
          <div>
            <Label className="text-gray-400">Reimbursement Type</Label>
            <Select
              value={reimbursementType}
              onValueChange={setReimbursementType}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select reimbursement type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="meals">Meals</SelectItem>
                <SelectItem value="office_supplies">Office Supplies</SelectItem>
                <SelectItem value="client_expense">Client Expense</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Upload */}
          <div>
            <Label className="text-gray-400">Invoice / Receipt</Label>
            <InvoiceFileSelector
              file={invoiceFile}
              setFile={setInvoiceFile}
            />
          </div>

          {/* Submit (UI only) */}
          <div className="pt-4 flex justify-end">
            <Button
              disabled
              className="bg-orange-600 hover:bg-orange-700 text-white opacity-60 cursor-not-allowed"
            >
              Submit Expense (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
