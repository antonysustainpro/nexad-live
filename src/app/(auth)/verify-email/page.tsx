"use client"

import { useState, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useNexus } from "@/contexts/nexus-context"
import { verifyEmail, forgotPassword } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function VerifyEmailContent() {
  const { language } = useNexus()
  const router = useRouter()
  const searchParams = useSearchParams()
  // SEC-AUTH-006: Validate email from URL parameter to prevent injection via crafted URLs.
  // Only accept well-formed email addresses; reject anything else.
  const rawEmail = searchParams.get("email") || ""
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : ""
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)

  // If no valid email in URL, redirect back to register
  useEffect(() => {
    if (!email) {
      router.replace("/register")
    }
  }, [email, router])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  useEffect(() => {
    if (otp.length === 6) {
      handleVerify()
    }
  }, [otp])

  const handleVerify = async () => {
    if (!email) {
      setError(language === "ar" ? "البريد الإلكتروني مفقود" : "Email address is missing")
      return
    }
    // SEC-AUTH-010: Validate OTP is exactly 6 digits (numeric only).
    // Prevents injection of non-numeric characters via crafted requests.
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError(language === "ar" ? "أدخل الرمز الكامل" : "Enter the complete 6-digit code")
      return
    }

    setError("")
    setIsLoading(true)

    try {
      const result = await verifyEmail(email, otp)
      if (result?.verified) {
        setIsSuccess(true)
        setTimeout(() => {
          router.push("/chat")
        }, 2000)
      } else {
        setError(language === "ar" ? "الرمز غير صحيح" : "Invalid verification code")
        setOtp("")
      }
    } catch {
      setError(language === "ar" ? "حدث خطأ. حاول مرة أخرى" : "An error occurred. Please try again")
      setOtp("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return

    setResendCooldown(60)
    try {
      const result = await forgotPassword(email)
      if (result?.sent) {
        toast.success(language === "ar" ? "تم إرسال الرمز" : "Code sent successfully")
      } else {
        toast.error(language === "ar" ? "تعذّر إرسال الرمز. يرجى المحاولة مرة أخرى." : "We couldn't send the code. Please try again.")
        setResendCooldown(0)
      }
    } catch {
      toast.error(language === "ar" ? "حدث خطأ" : "An error occurred")
      setResendCooldown(0)
    }
  }

  return (
    <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto mb-4 w-20 h-20 rounded-full bg-emotion-joyful/20 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <CheckCircle2 className="h-10 w-10 text-emotion-joyful" aria-hidden="true" />
                </motion.div>
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-title-2 mb-2"
              >
                {language === "ar" ? "تم التحقق بنجاح!" : "Email Verified!"}
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground"
              >
                {language === "ar" ? "جاري تحويلك..." : "Redirecting you..."}
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4"
              >
                <Spinner className="h-5 w-5 mx-auto text-nexus-jade" />
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <CardHeader className="text-center">
              <CardTitle className="text-title-2">
                {language === "ar" ? "تحقق من بريدك الإلكتروني" : "Verify Your Email"}
              </CardTitle>
              <CardDescription>
                {language === "ar" 
                  ? "أدخل الرمز المكون من 6 أرقام الذي أرسلناه إلى بريدك الإلكتروني" 
                  : "Enter the 6-digit code we sent to your email"}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => { setOtp(value); setError("") }}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="border-white/10 bg-secondary/50" />
                    <InputOTPSlot index={1} className="border-white/10 bg-secondary/50" />
                    <InputOTPSlot index={2} className="border-white/10 bg-secondary/50" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="border-white/10 bg-secondary/50" />
                    <InputOTPSlot index={4} className="border-white/10 bg-secondary/50" />
                    <InputOTPSlot index={5} className="border-white/10 bg-secondary/50" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive text-center"
                >
                  {error}
                </motion.p>
              )}

              {isLoading && (
                <div className="flex justify-center">
                  <Spinner className="h-5 w-5 text-nexus-jade" />
                </div>
              )}

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === "ar" ? "لم تستلم الرمز؟" : "Didn't receive the code?"}
                </p>
                <Button
                  variant="ghost"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className={cn(
                    "text-nexus-jade hover:text-nexus-jade-hover",
                    resendCooldown > 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4 me-2", resendCooldown > 0 && "motion-safe:animate-spin")} aria-hidden="true" />
                  {resendCooldown > 0 
                    ? `${language === "ar" ? "إعادة الإرسال في" : "Resend in"} ${resendCooldown}s`
                    : language === "ar" ? "إعادة إرسال الرمز" : "Resend Code"
                  }
                </Button>
              </div>

              {email && (
                <p className="text-xs text-muted-foreground text-center">
                  {language === "ar"
                    ? `الرمز المرسل إلى ${email}`
                    : `Code sent to ${email}`}
                </p>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
