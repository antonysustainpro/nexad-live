"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { XCircle, ArrowLeft, CreditCard, HelpCircle } from "lucide-react"

export default function PaymentCancelledPage() {
  const { language, isRTL } = useNexus()

  return (
    <div 
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-muted/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* Neutral icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-6"
        >
          <div className="w-24 h-24 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
            <XCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-title-1 mb-2">
            {language === "ar" ? "تم إلغاء الدفع" : "Payment Cancelled"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {language === "ar" 
              ? "لم يتم خصم أي مبلغ من بطاقتك." 
              : "Your card was not charged."}
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3"
        >
          <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press">
            <Link href="/billing/pricing">
              <CreditCard className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "العودة للأسعار" : "Return to Pricing"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 hover:bg-secondary/50 btn-press">
            <Link href="/chat">
              <ArrowLeft className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "العودة للتطبيق" : "Back to App"}
            </Link>
          </Button>
        </motion.div>

        {/* Help link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Link 
            href="/support" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "تحتاج مساعدة؟" : "Need Help?"}
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
