"use client"

import { useState } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { getCsrfToken } from "@/lib/csrf"
import { Button } from "@/components/ui/button"
import { GoogleSignIn } from "@/components/auth/google-sign-in"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Eye, EyeOff, Mail, Lock, Chrome } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function LoginPage() {
  const { language, isRTL } = useNexus()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}
    
    if (!email) {
      newErrors.email = language === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = language === "ar" ? "البريد الإلكتروني غير صالح" : "Invalid email address"
    }
    
    if (!password) {
      newErrors.password = language === "ar" ? "كلمة المرور مطلوبة" : "Password is required"
    } else if (password.length < 8) {
      newErrors.password = language === "ar" ? "كلمة المرور قصيرة جداً" : "Password is too short"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    try {
      // Use server-side auth endpoint that sets httpOnly cookie
      const csrfToken = getCsrfToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        // Only store minimal display info (no sensitive data like tokens, emails with PII)
        // Wrapped in try-catch: localStorage can throw in private browsing / quota exceeded
        try {
          if (data.user) {
            const safeUserInfo = {
              id: data.user.id,
              displayName: data.user.fullName?.split(" ")[0] || data.user.name?.split(" ")[0] || "User",
            }
            localStorage.setItem("nexus-user-display", JSON.stringify(safeUserInfo))
          }
        } catch {
          // localStorage unavailable (e.g. Safari private mode) — continue login flow
        }
        toast.success(language === "ar" ? "تم تسجيل الدخول بنجاح" : "Login successful")
        // Use hard navigation to ensure cookies are sent with the new page request.
        // router.push() does a client-side SPA navigation which may not pick up
        // cookies set by the fetch response in all browsers.
        window.location.href = "/"
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || (language === "ar" ? "بيانات تسجيل الدخول غير صحيحة" : "Invalid credentials"))
      }
    } catch {
      toast.error(language === "ar" ? "حدث خطأ. حاول مرة أخرى" : "An error occurred. Please try again")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-title-2">
          {language === "ar" ? "تسجيل الدخول" : "Sign In"}
        </CardTitle>
        <CardDescription>
          {language === "ar" 
            ? "أدخل بيانات حسابك للمتابعة" 
            : "Enter your credentials to continue"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              {language === "ar" ? "البريد الإلكتروني" : "Email"}
            </Label>
            <div className="relative">
              <Mail className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} aria-hidden="true" />
              <Input
                id="email"
                type="email"
                placeholder={language === "ar" ? "name@example.com" : "name@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "bg-secondary/50 border-white/10 focus:border-nexus-jade focus:ring-nexus-jade/20",
                  isRTL ? "pr-10" : "pl-10",
                  errors.email && "border-destructive"
                )}
                dir="ltr"
              />
            </div>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive"
              >
                {errors.email}
              </motion.p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                {language === "ar" ? "كلمة المرور" : "Password"}
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm text-nexus-jade hover:text-nexus-jade-hover transition-colors"
              >
                {language === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
              </Link>
            </div>
            <div className="relative">
              <Lock className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={cn(
                  "bg-secondary/50 border-white/10 focus:border-nexus-jade focus:ring-nexus-jade/20",
                  isRTL ? "pr-10 pl-10" : "pl-10 pr-10",
                  errors.password && "border-destructive"
                )}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors",
                  isRTL ? "left-3" : "right-3"
                )}
                aria-label={showPassword ? (language === "ar" ? "إخفاء كلمة المرور" : "Hide password") : (language === "ar" ? "إظهار كلمة المرور" : "Show password")}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive"
              >
                {errors.password}
              </motion.p>
            )}
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              className="border-white/20 data-[state=checked]:bg-nexus-jade data-[state=checked]:border-nexus-jade"
            />
            <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
              {language === "ar" ? "تذكرني" : "Remember me"}
            </Label>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background font-medium btn-press"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>{language === "ar" ? "جارٍ تسجيل الدخول..." : "Signing in..."}</span>
              </>
            ) : (
              language === "ar" ? "تسجيل الدخول" : "Sign In"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {language === "ar" ? "أو" : "or"}
            </span>
          </div>
        </div>

        {/* Google OAuth */}
        <GoogleSignIn language={language} />

      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {language === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
          <Link
            href="/register"
            className="text-nexus-jade hover:text-nexus-jade-hover transition-colors font-medium"
          >
            {language === "ar" ? "إنشاء حساب" : "Sign Up"}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
