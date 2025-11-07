"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("Login error:", error)
        toast({
          title: "Login failed",
          description: error.message || "Please check your credentials and try again.",
          variant: "destructive",
        })
        return
      }

      if (data.user) {
        const userObject = {
          user_id: data.user.id,
          email: data.user.email,
        };
        sessionStorage.setItem("currentUser", JSON.stringify(userObject));
        
        toast({
          title: "Login successful",
          description: "Welcome back to OpsClad!",
        })
        
        await new Promise(resolve => setTimeout(resolve, 3000));
    
        console.log("Login successful, redirecting to dashboard...")
        router.refresh()
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Unexpected login error:", error)
      toast({
        title: "Login error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const username = formData.get("username") as string
    const employee_id = formData.get("employee_id") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    try {
      if (password !== confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure your passwords match.",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            employee_id: employee_id,
          }
        }
      })

      if (error) {
        console.error("Signup error:", error)
        toast({
          title: "Signup failed",
          description: error.message || "Please check your information and try again.",
          variant: "destructive",
        })
        return
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            username: username,
            email: email,
            employee_id: employee_id,
          })

        if (profileError) {
          console.error("Profile creation error:", profileError)
        }

        toast({
          title: "Account created successfully",
          description: data.user.email_confirmed_at 
            ? "You can now login with your credentials." 
            : "Please check your email to confirm your account, then login.",
        })
        setIsLogin(true)
      }
    } catch (error) {
      console.error("Unexpected signup error:", error)
      toast({
        title: "Signup error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        console.error("Password reset error:", error)
        toast({
          title: "Password reset failed",
          description: error.message || "Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      })

      // Return to login after showing success message
      setTimeout(() => {
        setIsForgotPassword(false)
        setIsLogin(true)
      }, 2000)

    } catch (error) {
      console.error("Unexpected password reset error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
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
          <CardTitle className="text-center text-black">
            {isForgotPassword ? "Reset Password" : isLogin ? "Login" : "Sign Up"}
          </CardTitle>
          <CardDescription className="text-center">
            {isForgotPassword 
              ? "Enter your email to receive a password reset link"
              : isLogin 
              ? "Enter your credentials to access your account" 
              : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-black">Email</Label>
                <Input id="forgot-email" name="email" type="email" required />
              </div>
              <Button type="submit" className="w-full bg-red-500 hover:bg-red-600" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <div className="text-center text-sm mt-4 text-black">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false)
                    setIsLogin(true)
                  }}
                  className="text-red-500 hover:underline font-medium"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-black">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-black">Password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="text-right text-sm">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-red-500 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full bg-red-500 hover:bg-red-600" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <div className="text-center text-sm mt-4 text-black">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-red-500 hover:underline font-medium"
                >
                  Sign up here
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username" className="text-black">Employee Name</Label>
                <Input id="signup-username" name="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-empid" className="text-black">Employee ID</Label>
                <Input id="signup-empid" name="employee_id" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-black">Email</Label>
                <Input id="signup-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-black">Password</Label>
                <Input id="signup-password" name="password" type="password" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-black">Confirm Password</Label>
                <Input id="signup-confirm-password" name="confirmPassword" type="password" required />
              </div>
              <Button type="submit" className="w-full bg-red-500 hover:bg-red-600" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
              <div className="text-center text-sm mt-4 text-black">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-red-500 hover:underline font-medium"
                >
                  Login here
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
