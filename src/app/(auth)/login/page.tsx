"use client"

import { useState } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { getCsrfToken } from "@/lib/csrf"
import { Button } from "@/components/ui/button"
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
        <Button
          type="button"
          variant="outline"
          className="w-full border-white/10 bg-secondary/50 hover:bg-secondary/80"
          onClick={() => {
            window.location.href = "/api/v1/auth/google"
          }}
        >
          <svg className="h-5 w-5 me-2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {language === "ar" ? "المتابعة مع Google" : "Continue with Google"}
        </Button>

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
