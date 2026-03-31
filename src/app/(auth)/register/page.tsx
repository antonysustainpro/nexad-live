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
import { Progress } from "@/components/ui/progress"
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function getPasswordStrength(password: string): { score: number; label: string; labelAr: string; color: string } {
  let score = 0
  if (password.length >= 8) score += 25
  if (password.length >= 12) score += 15
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 20
  if (/\d/.test(password)) score += 20
  if (/[^a-zA-Z0-9]/.test(password)) score += 20

  if (score < 40) return { score, label: "Weak", labelAr: "ضعيفة", color: "bg-destructive" }
  if (score < 70) return { score, label: "Medium", labelAr: "متوسطة", color: "bg-emotion-excited" }
  return { score, label: "Strong", labelAr: "قوية", color: "bg-emotion-joyful" }
}

export default function RegisterPage() {
  const { language, isRTL } = useNexus()
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const passwordStrength = getPasswordStrength(formData.password)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = language === "ar" ? "الاسم الكامل مطلوب" : "Full name is required"
    }
    
    if (!formData.email) {
      newErrors.email = language === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = language === "ar" ? "البريد الإلكتروني غير صالح" : "Invalid email address"
    }
    
    if (!formData.password) {
      newErrors.password = language === "ar" ? "كلمة المرور مطلوبة" : "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = language === "ar" ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters"
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match"
    }
    
    if (!acceptTerms) {
      newErrors.terms = language === "ar" ? "يجب الموافقة على الشروط" : "You must accept the terms"
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
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Only store minimal display info (no sensitive data)
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
          // localStorage unavailable (e.g. Safari private mode) — continue registration flow
        }

        // Check if email verification is required (backend returns false when auto-verified)
        if (data.email_verification_required === false) {
          toast.success(language === "ar" ? "تم إنشاء الحساب بنجاح!" : "Account created successfully!")
          // Use hard navigation to ensure session cookies are sent with the new request
          window.location.href = "/chat"
        } else {
          toast.success(language === "ar" ? "تم إنشاء الحساب بنجاح. تحقق من بريدك الإلكتروني" : "Account created! Check your email for a verification code")
          window.location.href = "/verify-email?email=" + encodeURIComponent(formData.email)
        }
      } else {
        // SEC-AUTH-004: Use generic error to prevent account enumeration.
        // Backend may return "Email already exists" which leaks registration status.
        const errorData = await response.json().catch(() => ({}))
        const status = response.status
        const safeError = status === 400 && errorData.error && !errorData.error.toLowerCase().includes("exist")
          ? errorData.error
          : (language === "ar" ? "فشل إنشاء الحساب. حاول مرة أخرى" : "Registration failed. Please try again")
        toast.error(safeError)
      }
    } catch {
      toast.error(language === "ar" ? "حدث خطأ. حاول مرة أخرى" : "An error occurred. Please try again")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for the changed field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
    // When either password field changes, clear the confirmPassword error
    // since the match status may have changed
    if ((field === "password" || field === "confirmPassword") && errors.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: "" }))
    }
  }

  return (
    <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-title-2">
          {language === "ar" ? "إنشاء حساب" : "Create Account"}
        </CardTitle>
        <CardDescription>
          {language === "ar" 
            ? "انضم إلى NexusAD وابدأ رحلتك" 
            : "Join NexusAD and start your journey"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">
              {language === "ar" ? "الاسم الكامل" : "Full Name"}
            </Label>
            <div className="relative">
              <User className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} aria-hidden="true" />
              <Input
                id="fullName"
                type="text"
                placeholder={language === "ar" ? "أدخل اسمك الكامل" : "Enter your full name"}
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                className={cn(
                  "bg-secondary/50 border-white/10 focus:border-nexus-jade focus:ring-nexus-jade/20",
                  isRTL ? "pr-10" : "pl-10",
                  errors.fullName && "border-destructive"
                )}
              />
            </div>
            {errors.fullName && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
                {errors.fullName}
              </motion.p>
            )}
          </div>

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
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className={cn(
                  "bg-secondary/50 border-white/10 focus:border-nexus-jade focus:ring-nexus-jade/20",
                  isRTL ? "pr-10" : "pl-10",
                  errors.email && "border-destructive"
                )}
                dir="ltr"
              />
            </div>
            {errors.email && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
                {errors.email}
              </motion.p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              {language === "ar" ? "كلمة المرور" : "Password"}
            </Label>
            <div className="relative">
              <Lock className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                autoComplete="new-password"
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
            {formData.password && (
              <div className="space-y-1">
                <Progress value={passwordStrength.score} className="h-1" />
                <p className={cn("text-xs", passwordStrength.color.replace("bg-", "text-"))}>
                  {language === "ar" ? passwordStrength.labelAr : passwordStrength.label}
                </p>
              </div>
            )}
            {errors.password && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
                {errors.password}
              </motion.p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
            </Label>
            <div className="relative">
              <Lock className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} aria-hidden="true" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                autoComplete="new-password"
                className={cn(
                  "bg-secondary/50 border-white/10 focus:border-nexus-jade focus:ring-nexus-jade/20",
                  isRTL ? "pr-10 pl-10" : "pl-10 pr-10",
                  errors.confirmPassword && "border-destructive"
                )}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors",
                  isRTL ? "left-3" : "right-3"
                )}
                aria-label={showConfirmPassword ? (language === "ar" ? "إخفاء كلمة المرور" : "Hide password") : (language === "ar" ? "إظهار كلمة المرور" : "Show password")}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
                {errors.confirmPassword}
              </motion.p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
              className="mt-0.5 border-white/20 data-[state=checked]:bg-nexus-jade data-[state=checked]:border-nexus-jade"
            />
            <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-tight">
              {language === "ar" ? (
                <>
                  أوافق على{" "}
                  <Link href="/terms" className="text-nexus-jade hover:text-nexus-jade-hover">الشروط والأحكام</Link>
                  {" "}و{" "}
                  <Link href="/privacy" className="text-nexus-jade hover:text-nexus-jade-hover">سياسة الخصوصية</Link>
                </>
              ) : (
                <>
                  I agree to the{" "}
                  <Link href="/terms" className="text-nexus-jade hover:text-nexus-jade-hover">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-nexus-jade hover:text-nexus-jade-hover">Privacy Policy</Link>
                </>
              )}
            </Label>
          </div>
          {errors.terms && (
            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">
              {errors.terms}
            </motion.p>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background font-medium btn-press"
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              language === "ar" ? "إنشاء حساب" : "Create Account"
            )}
          </Button>
        </form>

      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {language === "ar" ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
          <Link href="/login" className="text-nexus-jade hover:text-nexus-jade-hover transition-colors font-medium">
            {language === "ar" ? "تسجيل الدخول" : "Sign In"}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
