"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [hasValidToken, setHasValidToken] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    checkRecoveryToken()
  }, [])

  const checkRecoveryToken = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error
      
      if (session) {
        setHasValidToken(true)
      } else {
        toast({
          title: "Invalid or expired link",
          description: "Please request a new password reset.",
          variant: "destructive",
        })
        setTimeout(() => router.push("/dashboard"), 3000)
      }
    } catch (error) {
      console.error("Error checking recovery token:", error)
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
      setTimeout(() => router.push("/dashboard"), 3000)
    } finally {
      setIsVerifying(false)
    }
  }

  const checkPasswordStrength = (pwd: string) => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[a-z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++
    return strength
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setPassword(newPassword)
    setPasswordStrength(checkPasswordStrength(newPassword))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      })
      return
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast({
        title: "Password reset successful",
        description: "Redirecting to login...",
      })

      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)

    } catch (error: any) {
      console.error("Error resetting password:", error)
      toast({
        title: "Password reset failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500"
    if (passwordStrength === 3) return "bg-yellow-500"
    return "bg-green-500"
  }

  const getStrengthText = () => {
    if (passwordStrength <= 2) return "Weak"
    if (passwordStrength === 3) return "Medium"
    return "Strong"
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="text-center mb-8">
          <Image
            src="/opsclad-logo.png"
            alt="OpsClad by DataClad"
            width={400}
            height={300}
            className="mx-auto"
            priority
          />
        </div>
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Verifying your reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasValidToken) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="text-center mb-8">
        <Image
          src="/opsclad-logo.png"
          alt="OpsClad by DataClad"
          width={400}
          height={300}
          className="mx-auto"
          priority
        />
      </div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-center text-black">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                required
                minLength={8}
                placeholder="Enter new password"
              />
              {password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength <= 2 ? 'text-red-500' : 
                      passwordStrength === 3 ? 'text-yellow-500' : 
                      'text-green-500'
                    }`}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p className={password.length >= 8 ? 'text-green-600' : ''}>
                      ✓ At least 8 characters
                    </p>
                    <p className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                      ✓ One uppercase letter
                    </p>
                    <p className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                      ✓ One lowercase letter
                    </p>
                    <p className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                      ✓ One number
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-black">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-red-500 hover:bg-red-600" 
              disabled={isLoading || password !== confirmPassword || password.length < 8}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}



