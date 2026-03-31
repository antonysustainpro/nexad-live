"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Sparkles, Zap, Shield, Globe } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface UpgradeBannerProps {
  feature: "voice" | "rag" | "domains" | "priority"
  className?: string
}

const FEATURE_CONFIG = {
  voice: {
    icon: Zap,
    titleEn: "Unlock Voice Mode",
    titleAr: "افتح الوضع الصوتي",
    descEn: "Get natural voice conversations with Pro",
    descAr: "احصل على محادثات صوتية طبيعية مع برو",
  },
  rag: {
    icon: Shield,
    titleEn: "Unlock Document Intelligence",
    titleAr: "افتح ذكاء المستندات",
    descEn: "Query your vault documents with Pro",
    descAr: "استعلم من مستنداتك مع برو",
  },
  domains: {
    icon: Globe,
    titleEn: "Need More Domains?",
    titleAr: "تحتاج المزيد من النطاقات؟",
    descEn: "Upgrade to Pro for 15 domains",
    descAr: "قم بالترقية إلى برو للحصول على 15 نطاق",
  },
  priority: {
    icon: Sparkles,
    titleEn: "Get Priority Processing",
    titleAr: "احصل على معالجة أولوية",
    descEn: "Skip the queue with Pro",
    descAr: "تخطى الطابور مع برو",
  },
}

export function UpgradeBanner({ feature, className }: UpgradeBannerProps) {
  const { language, isRTL } = useNexus()
  const [dismissed, setDismissed] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    // Check if this banner was dismissed this session
    const key = `nexusad-upgrade-banner-${feature}`
    const wasDismissed = sessionStorage.getItem(key) === "dismissed"
    setDismissed(wasDismissed)
  }, [feature])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(`nexusad-upgrade-banner-${feature}`, "dismissed")
    } catch {
      // Session storage not available
    }
  }

  const config = FEATURE_CONFIG[feature]
  const Icon = config.icon

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "relative flex items-center gap-4 p-4 rounded-xl",
            "bg-nexus-gold/10 border border-nexus-gold/20",
            isRTL && "flex-row-reverse text-right",
            className
          )}
        >
          {/* Icon */}
          <div className="shrink-0 p-2 rounded-lg bg-nexus-gold/20">
            <Icon className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {language === "ar" ? config.titleAr : config.titleEn}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {language === "ar" ? config.descAr : config.descEn}
            </p>
          </div>

          {/* CTA */}
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-nexus-jade hover:bg-nexus-jade-hover text-white"
          >
            <Link href="/billing/pricing">
              {language === "ar" ? "ترقية" : "Upgrade"}
            </Link>
          </Button>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className={cn(
              "absolute top-2 p-1 rounded-full",
              "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
              "transition-colors",
              isRTL ? "left-2" : "right-2"
            )}
            aria-label={language === "ar" ? "إغلاق" : "Dismiss"}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
