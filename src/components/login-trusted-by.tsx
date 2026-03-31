"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"

const badges = [
  { labelEn: "Family Offices", labelAr: "مكاتب العائلات" },
  { labelEn: "CEOs", labelAr: "المدراء التنفيذيين" },
  { labelEn: "DIFC Members", labelAr: "أعضاء مركز دبي المالي" },
  { labelEn: "ADGM Firms", labelAr: "شركات سوق أبوظبي العالمي" },
]

function AnimatedCounter({ target, language }: { target: number; language: string }) {
  const [count, setCount] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) {
      setCount(target)
      return
    }
    const duration = 2000
    const steps = 60
    const increment = target / steps
    let current = 0
    const interval = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(interval)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(interval)
  }, [target, prefersReducedMotion])

  return (
    <span className="font-mono text-nexus-jade">
      {count.toLocaleString(language === "ar" ? "ar-AE" : "en-US")}+
    </span>
  )
}

export function LoginTrustedBy() {
  const { language } = useNexus()
  const isRTL = language === "ar"
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <div className={cn("space-y-4", isRTL && "text-right")}>
      <p className="text-sm text-muted-foreground">
        {language === "ar"
          ? "موثوق من قادة الأعمال حول العالم"
          : "Trusted by business leaders worldwide"}
      </p>

      <div className={cn("flex flex-wrap gap-2", isRTL && "justify-end")}>
        {badges.map((badge, index) => (
          <motion.span
            key={badge.labelEn}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-secondary text-muted-foreground border border-border"
          >
            {language === "ar" ? badge.labelAr : badge.labelEn}
          </motion.span>
        ))}
      </div>

      <p className="text-sm">
        <AnimatedCounter target={200} language={language} />{" "}
        <span className="text-muted-foreground">
          {language === "ar" ? "حساب سيادي" : "sovereign accounts"}
        </span>
      </p>
    </div>
  )
}
