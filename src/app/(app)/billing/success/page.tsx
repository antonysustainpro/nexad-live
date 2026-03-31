"use client"

import { useState, useEffect, Suspense } from "react"
import { motion } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Download, LayoutDashboard, Sparkles } from "lucide-react"
import Confetti from "react-confetti"

function PaymentSuccessContent() {
  const { language, isRTL } = useNexus()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [countdown, setCountdown] = useState(10)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [showConfetti, setShowConfetti] = useState(true)

  // SEC-INPUT-006: Validate URL parameters to prevent injection
  const VALID_PLANS = ["Free", "Pro", "Enterprise"] as const
  const rawPlan = searchParams.get("plan") || "Pro"
  const plan = VALID_PLANS.includes(rawPlan as typeof VALID_PLANS[number]) ? rawPlan : "Pro"

  // Validate amount is a numeric string
  const rawAmount = searchParams.get("amount") || "99"
  const amount = /^\d{1,6}(\.\d{1,2})?$/.test(rawAmount) ? rawAmount : "99"
  const [transactionId, setTransactionId] = useState("")

  // Generate transaction ID client-side to avoid impure render
  // SEC-INPUT-008: Validate transaction_id from URL to prevent reflected content injection.
  // Only allow alphanumeric, hyphens, and underscores (max 64 chars).
  useEffect(() => {
    const urlTxnId = searchParams.get("transaction_id")
    const isValidTxnId = urlTxnId && /^[A-Za-z0-9_-]{1,64}$/.test(urlTxnId)
    setTransactionId(isValidTxnId ? urlTxnId : "TXN-" + Date.now())
  }, [searchParams])

  // Get window size for confetti
  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Stop confetti after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  // Countdown and redirect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      router.push("/chat")
    }
  }, [countdown, router])

  const nextBillingDate = new Date()
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
  const formattedDate = nextBillingDate.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div 
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Confetti */}
      {showConfetti && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          colors={["#C6AD90", "#9B7A58", "#F5F5F7", "#4CAF50"]}
        />
      )}

      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-emotion-joyful/10 to-transparent rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-6"
        >
          <div className="w-24 h-24 mx-auto rounded-full bg-emotion-joyful/20 flex items-center justify-center relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <CheckCircle2 className="h-12 w-12 text-emotion-joyful" aria-hidden="true" />
            </motion.div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
              aria-hidden="true"
            >
              <Sparkles className="absolute top-0 right-2 h-4 w-4 text-nexus-gold" />
              <Sparkles className="absolute bottom-2 left-0 h-3 w-3 text-nexus-jade" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-title-1 mb-2">
            {language === "ar" ? "تم الدفع بنجاح!" : "Payment Successful!"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {language === "ar" 
              ? `شكراً لاشتراكك في خطة ${plan}` 
              : `Thank you for subscribing to the ${plan} plan`}
          </p>
        </motion.div>

        {/* Order summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-white/10 bg-card/80 backdrop-blur-xl mb-6">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                {language === "ar" ? "ملخص الطلب" : "Order Summary"}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "الخطة" : "Plan"}
                  </span>
                  <span className="font-medium">{plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "المبلغ المدفوع" : "Amount Paid"}
                  </span>
                  <span className="font-medium text-nexus-jade">${amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "تاريخ الفوترة التالي" : "Next Billing Date"}
                  </span>
                  <span className="font-medium">{formattedDate}</span>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {language === "ar" ? "رقم المعاملة" : "Transaction ID"}
                    </span>
                    <span className="font-mono text-xs">{transactionId}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-6"
        >
          <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press">
            <Link href="/chat">
              <LayoutDashboard className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "إلى لوحة التحكم" : "Go to Dashboard"}
            </Link>
          </Button>
          <Button variant="outline" className="border-white/10 hover:bg-secondary/50 btn-press">
            <Download className="h-4 w-4 me-2" aria-hidden="true" />
            {language === "ar" ? "تحميل الإيصال" : "Download Receipt"}
          </Button>
        </motion.div>

        {/* Auto-redirect countdown */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-muted-foreground"
        >
          {language === "ar" 
            ? `سيتم تحويلك تلقائياً في ${countdown} ثانية...` 
            : `Redirecting automatically in ${countdown} seconds...`}
        </motion.p>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
