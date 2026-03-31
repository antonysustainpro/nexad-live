"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { forgotPassword } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
  const { language, isRTL } = useNexus()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError(language === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required")
      return
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(language === "ar" ? "البريد الإلكتروني غير صالح" : "Invalid email address")
      return
    }
    
    setError("")
    setIsLoading(true)
    try {
      // SEC-AUTH-003: Always show success screen regardless of whether email exists.
      // This prevents account enumeration -- attacker cannot determine if an email
      // is registered by observing different responses for valid vs invalid emails.
      await forgotPassword(email)
      setIsSuccess(true)
    } catch {
      // SEC-AUTH-003: Even on network errors, show success to prevent enumeration.
      // The user can retry via "Send Another Link" if the email truly wasn't sent.
      setIsSuccess(true)
    } finally {
      setIsLoading(false)
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
          >
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="mx-auto mb-4 w-16 h-16 rounded-full bg-emotion-joyful/20 flex items-center justify-center"
              >
                <CheckCircle2 className="h-8 w-8 text-emotion-joyful" aria-hidden="true" />
              </motion.div>
              <CardTitle className="text-title-2">
                {language === "ar" ? "تم إرسال الرابط!" : "Check Your Email"}
              </CardTitle>
              <CardDescription className="mt-2">
                {language === "ar" 
                  ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${email}` 
                  : `We've sent a password reset link to ${email}`}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {language === "ar" 
                  ? "إذا لم تجد البريد الإلكتروني، تحقق من مجلد الرسائل غير المرغوب فيها." 
                  : "If you don't see the email, check your spam folder."}
              </p>
              
              <Button
                onClick={() => { setIsSuccess(false); setEmail("") }}
                variant="outline"
                className="w-full border-white/10 hover:bg-secondary/50"
              >
                {language === "ar" ? "إرسال رابط جديد" : "Send Another Link"}
              </Button>
            </CardContent>
            
            <CardFooter className="justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-nexus-jade hover:text-nexus-jade-hover transition-colors"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {language === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
              </Link>
            </CardFooter>
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
                {language === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
              </CardTitle>
              <CardDescription>
                {language === "ar" 
                  ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور" 
                  : "Enter your email and we'll send you a reset link"}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError("") }}
                      className={cn(
                        "bg-secondary/50 border-white/10 focus:border-nexus-jade focus:ring-nexus-jade/20",
                        isRTL ? "pr-10" : "pl-10",
                        error && "border-destructive"
                      )}
                      dir="ltr"
                    />
                  </div>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background font-medium btn-press"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    language === "ar" ? "إرسال رابط إعادة التعيين" : "Send Reset Link"
                  )}
                </Button>
              </form>
            </CardContent>
            
            <CardFooter className="justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {language === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
              </Link>
            </CardFooter>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
