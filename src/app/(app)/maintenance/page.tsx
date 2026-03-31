"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { Progress } from "@/components/ui/progress"
import { Twitter, Linkedin, Wrench, Sparkles } from "lucide-react"

export default function MaintenancePage() {
  const { language, isRTL } = useNexus()
  const [progress, setProgress] = useState(65)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Simulate progress updates
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 2, 95))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const estimatedTime = "30 minutes"
  const estimatedTimeAr = "30 دقيقة"

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {prefersReducedMotion ? (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
            <div className="absolute inset-0 bg-gradient-conic from-nexus-jade/10 via-transparent to-nexus-gold/10 rounded-full blur-3xl" />
          </div>
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]"
          >
            <div className="absolute inset-0 bg-gradient-conic from-nexus-jade/10 via-transparent to-nexus-gold/10 rounded-full blur-3xl" />
          </motion.div>
        )}
      </div>

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Animated illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="mb-8 relative"
        >
          {/* Pulsing ring */}
          {prefersReducedMotion ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <div className="w-32 h-32 rounded-full border-2 border-nexus-jade/30 opacity-35" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <div className="w-40 h-40 rounded-full border border-nexus-jade/20 opacity-20" />
              </div>
            </>
          ) : (
            <>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="w-32 h-32 rounded-full border-2 border-nexus-jade/30" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="w-40 h-40 rounded-full border border-nexus-jade/20" />
              </motion.div>
            </>
          )}

          {/* Center icon */}
          <div className="w-24 h-24 mx-auto rounded-full bg-nexus-bg-card border border-white/10 flex items-center justify-center relative" aria-hidden="true">
            {prefersReducedMotion ? (
              <Wrench className="h-10 w-10 text-nexus-jade" />
            ) : (
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Wrench className="h-10 w-10 text-nexus-jade" />
              </motion.div>
            )}
            {!prefersReducedMotion && (
              <motion.div
                animate={{ opacity: [0, 1, 0], y: [-5, -15, -5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="h-5 w-5 text-nexus-gold" />
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-title-1 mb-2">
            {language === "ar" ? "نقوم بتحديث NexusAD" : "We're Upgrading NexusAD"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {language === "ar"
              ? "نعمل على تحسينات مهمة لتجربة أفضل. سنعود قريباً!"
              : "We're working on important improvements for a better experience. We'll be back soon!"}
          </p>
        </motion.div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "التقدم" : "Progress"}
            </span>
            <span className="text-sm font-medium text-nexus-jade">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {language === "ar"
              ? `الوقت المتبقي المتوقع: ${estimatedTimeAr}`
              : `Estimated time remaining: ${estimatedTime}`}
          </p>
        </motion.div>

        {/* Notification message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "سنُعلمك عند اكتمال الصيانة. تحقق مرة أخرى قريباً."
              : "We'll notify you when maintenance is complete. Check back soon."}
          </p>
        </motion.div>

        {/* Social links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-4"
        >
          <p className="text-sm text-muted-foreground">
            {language === "ar" ? "تابعنا:" : "Follow us:"}
          </p>
          <a
            href="https://twitter.com/nexusad"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            aria-label="Twitter"
          >
            <Twitter className="h-5 w-5 text-muted-foreground hover:text-foreground" aria-hidden="true" />
          </a>
          <a
            href="https://linkedin.com/company/nexusad"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            aria-label="LinkedIn"
          >
            <Linkedin className="h-5 w-5 text-muted-foreground hover:text-foreground" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </div>
  )
}
