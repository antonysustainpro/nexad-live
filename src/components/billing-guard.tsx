"use client"

import { type ReactNode, useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Lock, Sparkles } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { BillingTier } from "@/lib/billing-api"

interface BillingGuardProps {
  tier: BillingTier
  children: ReactNode
  feature?: string
  featureAr?: string
}

// SEC WARNING: This is a client-side guard ONLY. It reads the tier from localStorage
// which is trivially editable by the user (DevTools > Application > Storage).
// ALL premium feature access MUST be enforced server-side via the API proxy.
// This guard is for UX only — it hides UI, it does NOT enforce authorization.
// TODO: Replace with server-side session/JWT tier claim when auth is production-ready.
function useCurrentTier(): BillingTier {
  const [tier, setTier] = useState<BillingTier>("FREE")

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nexusad-billing-tier")
      if (saved && ["FREE", "PRO", "ENTERPRISE"].includes(saved)) {
        setTier(saved as BillingTier)
      }
    } catch {
      // Fallback to FREE
    }
  }, [])

  return tier
}

const TIER_LEVELS: Record<BillingTier, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
}

export function BillingGuard({ tier, children, feature, featureAr }: BillingGuardProps) {
  const { language, isRTL } = useNexus()
  const currentTier = useCurrentTier()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const hasAccess = TIER_LEVELS[currentTier] >= TIER_LEVELS[tier]

  if (hasAccess) {
    return <>{children}</>
  }

  const featureName = language === "ar" ? (featureAr || feature || "هذه الميزة") : (feature || "This feature")
  const tierName = tier === "PRO" ? (language === "ar" ? "برو" : "Pro") : (language === "ar" ? "المؤسسات" : "Enterprise")

  return (
    <div className="relative">
      {/* Blurred children */}
      <div className="blur-sm pointer-events-none select-none opacity-50" aria-hidden="true">
        {children}
      </div>

      {/* Lock overlay */}
      <AnimatePresence>
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center",
            "bg-background/80 backdrop-blur-sm rounded-xl",
            isRTL && "text-right"
          )}
        >
          <motion.div
            initial={prefersReducedMotion ? {} : { scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-4 p-6 text-center"
          >
            <div className="p-3 rounded-full bg-nexus-gold/10">
              <Lock className="h-8 w-8 text-nexus-gold" aria-hidden="true" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {language === "ar" ? `${featureName} مقفلة` : `${featureName} Locked`}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {language === "ar"
                  ? `قم بالترقية إلى ${tierName} للوصول إلى هذه الميزة`
                  : `Upgrade to ${tierName} to access this feature`}
              </p>
            </div>

            <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-white">
              <Link href="/billing/pricing">
                <Sparkles className="h-4 w-4 me-2" aria-hidden="true" />
                {language === "ar" ? "ترقية الآن" : "Upgrade Now"}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
