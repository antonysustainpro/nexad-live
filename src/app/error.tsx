"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Home, RefreshCw, AlertTriangle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { language, isRTL } = useNexus()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    // Error is displayed in the UI
  }, [error])

  return (
    <main
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Animated background - respects reduced motion */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {prefersReducedMotion ? (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-destructive/10 to-transparent rounded-full blur-3xl" />
        ) : (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-destructive/10 to-transparent rounded-full blur-3xl"
          />
        )}
      </div>

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Broken robot illustration - decorative, respects reduced motion */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.5, type: "spring" }}
          className="mb-8"
          aria-hidden="true"
        >
          <div>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mx-auto" aria-hidden="true">
              {/* Robot head - cracked */}
              <circle cx="60" cy="40" r="30" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" fill="none" />
              <path d="M45 25 L75 55" stroke="currentColor" strokeWidth="1" className="text-destructive/50" />

              {/* Eyes - one X, one normal */}
              <circle cx="50" cy="35" r="4" className="text-muted-foreground" fill="currentColor" />
              <g className="text-destructive">
                <path d="M66 31 L74 39" stroke="currentColor" strokeWidth="2" />
                <path d="M74 31 L66 39" stroke="currentColor" strokeWidth="2" />
              </g>

              {/* Sad mouth */}
              <path d="M48 50 Q60 44 72 50" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" fill="none" />

              {/* Body */}
              <rect x="45" y="75" width="30" height="30" rx="4" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" fill="none" />

              {/* Sparks - static when reduced motion */}
              {!prefersReducedMotion ? (
                <motion.g
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 1 }}
                >
                  <path d="M80 45 L90 40 L85 50 L95 45" stroke="#FFD700" strokeWidth="2" fill="none" />
                </motion.g>
              ) : (
                <g>
                  <path d="M80 45 L90 40 L85 50 L95 45" stroke="#FFD700" strokeWidth="2" fill="none" />
                </g>
              )}

              {/* Warning triangle */}
              <g transform="translate(75, 80)">
                <path d="M15 0 L30 26 L0 26 Z" fill="none" stroke="currentColor" strokeWidth="2" className="text-emotion-excited" />
                <text x="15" y="20" textAnchor="middle" className="text-emotion-excited" fontSize="14" fontWeight="bold">!</text>
              </g>
            </svg>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            <h1 className="text-title-1">
              {language === "ar" ? "حدث خطأ" : "Something Went Wrong"}
            </h1>
          </div>
          <p className="text-muted-foreground mb-4">
            {language === "ar" 
              ? "نعتذر عن هذا الخطأ. فريقنا يعمل على إصلاحه." 
              : "We apologize for the inconvenience. Our team has been notified."}
          </p>
          
          {/* SEC-SM-R3-007: Validate error digest before rendering to prevent injection.
              While digest is server-generated, a compromised or misconfigured server could
              inject HTML/script via this field. Truncate and strip non-alphanumeric chars. */}
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 mb-8 font-mono">
              {language === "ar" ? "رمز الخطأ:" : "Error Code:"} {error.digest.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}
            </p>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button
            onClick={reset}
            className="bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press"
          >
            <RefreshCw className="h-4 w-4 me-2" aria-hidden="true" />
            {language === "ar" ? "حاول مرة أخرى" : "Try Again"}
          </Button>
          <Button asChild variant="outline" className="border-white/10 hover:bg-secondary/50 btn-press">
            <Link href="/">
              <Home className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "العودة للرئيسية" : "Go Home"}
            </Link>
          </Button>
        </motion.div>

        {/* Help text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-sm text-muted-foreground"
        >
          {language === "ar" 
            ? "إذا استمرت المشكلة، يرجى التواصل مع الدعم" 
            : "If the problem persists, please contact support"}
        </motion.p>
      </div>
    </main>
  )
}
