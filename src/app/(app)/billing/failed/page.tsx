"use client"

import { Suspense } from "react"
import { motion } from "motion/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { XCircle, RefreshCw, CreditCard, HelpCircle, AlertTriangle, MessageCircle } from "lucide-react"

const errorMessages: Record<string, { en: string; ar: string }> = {
  card_declined: { en: "Your card was declined", ar: "تم رفض بطاقتك" },
  insufficient_funds: { en: "Insufficient funds", ar: "رصيد غير كافٍ" },
  expired_card: { en: "Your card has expired", ar: "انتهت صلاحية بطاقتك" },
  invalid_card: { en: "Invalid card details", ar: "تفاصيل البطاقة غير صالحة" },
  processing_error: { en: "Payment processing error", ar: "خطأ في معالجة الدفع" },
  default: { en: "Payment could not be completed", ar: "تعذر إكمال الدفع" },
}

const troubleshootingTips = [
  { 
    icon: CreditCard, 
    en: "Double-check your card details are correct",
    ar: "تحقق من صحة تفاصيل بطاقتك"
  },
  { 
    icon: RefreshCw, 
    en: "Try a different payment method",
    ar: "جرب طريقة دفع مختلفة"
  },
  { 
    icon: HelpCircle, 
    en: "Contact your bank if the issue persists",
    ar: "تواصل مع البنك إذا استمرت المشكلة"
  },
]

function PaymentFailedContent() {
  const { language, isRTL } = useNexus()
  const searchParams = useSearchParams()

  // SEC-INPUT-007: Validate URL parameters to prevent reflected content injection
  const rawErrorType = searchParams.get("error") || "default"
  const errorType = Object.keys(errorMessages).includes(rawErrorType) ? rawErrorType : "default"
  // Only allow alphanumeric error codes (max 32 chars) to prevent injection
  const rawErrorCode = searchParams.get("code")
  const errorCode = rawErrorCode && /^[A-Za-z0-9_-]{1,32}$/.test(rawErrorCode) ? rawErrorCode : null
  const fallbackMessage = { en: "Payment could not be completed", ar: "تعذر إكمال الدفع" }
  const errorMessage = errorMessages[errorType] ?? fallbackMessage

  return (
    <div 
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-destructive/10 to-transparent rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* Error icon with shake animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-6"
        >
          <motion.div
            animate={{ x: [-5, 5, -5, 5, 0] }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-24 h-24 mx-auto rounded-full bg-destructive/20 flex items-center justify-center"
          >
            <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-title-1 mb-2">
            {language === "ar" ? "فشل الدفع" : "Payment Failed"}
          </h1>
          <p className="text-muted-foreground mb-2">
            {language === "ar" ? errorMessage.ar : errorMessage.en}
          </p>
          {errorCode && (
            <p className="text-xs text-muted-foreground/60 font-mono mb-6">
              {language === "ar" ? "رمز الخطأ:" : "Error Code:"} {errorCode}
            </p>
          )}
        </motion.div>

        {/* Troubleshooting tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-white/10 bg-card/80 backdrop-blur-xl mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-emotion-excited" aria-hidden="true" />
                <h3 className="text-sm font-medium">
                  {language === "ar" ? "نصائح لحل المشكلة" : "Troubleshooting Tips"}
                </h3>
              </div>
              <ul className="space-y-3">
                {troubleshootingTips.map((tip, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <tip.icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-nexus-jade" aria-hidden="true" />
                    <span>{language === "ar" ? tip.ar : tip.en}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press">
            <Link href="/billing/pricing">
              <RefreshCw className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "حاول مرة أخرى" : "Try Again"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 hover:bg-secondary/50 btn-press">
            <Link href="/support">
              <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "تواصل مع الدعم" : "Contact Support"}
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <PaymentFailedContent />
    </Suspense>
  )
}
