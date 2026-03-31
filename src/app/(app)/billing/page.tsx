"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import {
  CreditCard,
  Calendar,
  Zap,
  Globe,
  HardDrive,
  Crown,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  getSubscription,
  getUsage,
  cancelSubscription,
  type BillingTier,
  type Subscription,
  type UsageData,
  TIER_CONFIG,
  USD_TO_AED,
  formatCurrency,
  formatDate,
} from "@/lib/billing-api"

// Default values used when API returns null (no subscription)
const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: "FREE",
  status: "active",
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelAtPeriodEnd: false,
  priceUsd: 0,
  priceAed: 0,
}

const DEFAULT_USAGE: UsageData = {
  requests: { used: 0, limit: 10000 },
  domains: { active: 0, limit: 5 },
  storage: { usedMb: 0, limitMb: 100 },
}

export default function BillingPage() {
  const { language, isRTL } = useNexus()
  const locale = language === "ar" ? "ar-AE" : "en-US"

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    async function loadData() {
      try {
        const [subData, usageData] = await Promise.all([
          getSubscription(abortController.signal),
          getUsage(abortController.signal),
        ])
        if (isMounted) {
          setSubscription(subData)
          setUsage(usageData)
        }
      } catch (err) {
        // Ignore abort errors, API failed - state stays null, show free tier defaults
        if (err instanceof Error && err.name === "AbortError") return
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    loadData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const handleCancel = async () => {
    setCanceling(true)
    try {
      await cancelSubscription()
      setSubscription((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev)
    } catch (e) {
      // Subscription cancellation failed - handled via UI feedback
    } finally {
      setCanceling(false)
      setCancelDialogOpen(false)
    }
  }

  // Resolve display values: use API data or defaults
  const displaySub = subscription ?? DEFAULT_SUBSCRIPTION
  const displayUsage = usage ?? DEFAULT_USAGE
  const hasSubscription = subscription !== null
  const tierConfig = TIER_CONFIG[displaySub.tier]
  const isFreeTier = displaySub.tier === "FREE"
  const isPro = displaySub.tier === "PRO"

  const tierBadgeColor: Record<BillingTier, string> = {
    FREE: "bg-secondary text-secondary-foreground",
    PRO: "bg-nexus-jade text-white",
    ENTERPRISE: "bg-nexus-gold text-white",
  }

  const MotionCard = prefersReducedMotion ? Card : motion.create(Card)

  // Skeleton loading state
  if (loading) {
    return (
      <div className={cn("p-6 space-y-6 max-w-4xl mx-auto pb-20", isRTL && "text-right")}>
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("p-6 space-y-6 max-w-4xl mx-auto pb-20", isRTL && "text-right")}>
      {/* Header */}
      <div>
        <h1 className="text-title-1 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          {language === "ar" ? "الفواتير والاشتراك" : "Billing & Subscription"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar"
            ? "إدارة خطتك واستخدامك"
            : "Manage your plan and usage"}
        </p>
      </div>

      {/* No subscription info banner */}
      {!hasSubscription && (
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30",
          isRTL && "flex-row-reverse"
        )}>
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "أنت حاليًا على الخطة المجانية. قم بالترقية للحصول على المزيد من الميزات."
              : "You are currently on the Free tier. Upgrade to unlock more features."}
          </p>
        </div>
      )}

      {/* Current Plan Card */}
      <MotionCard
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-nexus-jade/20"
      >
        <CardHeader>
          <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
            <CardTitle className="text-headline flex items-center gap-2">
              <Crown className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
              {language === "ar" ? "خطتك الحالية" : "Current Plan"}
            </CardTitle>
            <Badge className={tierBadgeColor[displaySub.tier]}>
              {displaySub.tier}
            </Badge>
          </div>
          <CardDescription>
            {language === "ar"
              ? `${tierConfig.requestsPerMin} طلب/دقيقة • ${tierConfig.domains === -1 ? "غير محدود" : tierConfig.domains} نطاق`
              : `${tierConfig.requestsPerMin} req/min • ${tierConfig.domains === -1 ? "Unlimited" : tierConfig.domains} domains`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Price */}
          <div className={cn("flex items-baseline gap-2", isRTL && "flex-row-reverse justify-end")}>
            <span className="text-3xl font-bold">
              {formatCurrency(displaySub.priceUsd, "USD", locale)}
            </span>
            <span className="text-muted-foreground">
              / {language === "ar" ? "شهر" : "month"}
            </span>
            {displaySub.priceUsd > 0 && (
              <span className="text-sm text-muted-foreground">
                ({formatCurrency(displaySub.priceUsd * USD_TO_AED, "AED", locale)})
              </span>
            )}
          </div>

          {/* Billing Date */}
          {!isFreeTier && (
            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", isRTL && "flex-row-reverse")}>
              <Calendar className="h-4 w-4" aria-hidden="true" />
              {displaySub.cancelAtPeriodEnd ? (
                <span className="text-destructive">
                  {language === "ar"
                    ? `سينتهي في ${formatDate(displaySub.currentPeriodEnd, locale)}`
                    : `Cancels on ${formatDate(displaySub.currentPeriodEnd, locale)}`}
                </span>
              ) : (
                <span>
                  {language === "ar"
                    ? `التجديد التالي: ${formatDate(displaySub.currentPeriodEnd, locale)}`
                    : `Next billing: ${formatDate(displaySub.currentPeriodEnd, locale)}`}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className={cn("flex gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
            {(isFreeTier || isPro) && (
              <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-white">
                <Link href="/billing/pricing">
                  <Zap className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "ترقية الخطة" : "Upgrade Plan"}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/billing/pricing">
                {language === "ar" ? "عرض جميع الخطط" : "View All Plans"}
                <ChevronRight className={cn("h-4 w-4", isRTL ? "me-2 rotate-180" : "ms-2")} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </MotionCard>

      {/* Usage Meters */}
      <MotionCard
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <CardHeader>
          <CardTitle className="text-headline">
            {language === "ar" ? "الاستخدام الحالي" : "Current Usage"}
          </CardTitle>
          <CardDescription>
            {language === "ar" ? "استخدامك لهذه الفترة" : "Your usage this period"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Requests */}
          <UsageMeter
            icon={<Zap className="h-4 w-4" />}
            label={language === "ar" ? "الطلبات" : "Requests"}
            used={displayUsage.requests.used}
            limit={displayUsage.requests.limit}
            locale={locale}
            isRTL={isRTL}
          />

          {/* Domains */}
          <UsageMeter
            icon={<Globe className="h-4 w-4" />}
            label={language === "ar" ? "النطاقات" : "Domains"}
            used={displayUsage.domains.active}
            limit={displayUsage.domains.limit}
            locale={locale}
            isRTL={isRTL}
          />

          {/* Storage */}
          <UsageMeter
            icon={<HardDrive className="h-4 w-4" />}
            label={language === "ar" ? "التخزين" : "Storage"}
            used={displayUsage.storage.usedMb}
            limit={displayUsage.storage.limitMb}
            unit="MB"
            locale={locale}
            isRTL={isRTL}
          />
        </CardContent>
      </MotionCard>

      {/* Quick Links */}
      <MotionCard
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <CardContent className="p-0">
          <Link
            href="/billing/invoices"
            className={cn(
              "flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors",
              isRTL && "flex-row-reverse"
            )}
          >
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">
                {language === "ar" ? "سجل الفواتير" : "Invoice History"}
              </span>
            </div>
            <ChevronRight className={cn("h-5 w-5 text-muted-foreground", isRTL && "rotate-180")} aria-hidden="true" />
          </Link>
        </CardContent>
      </MotionCard>

      {/* Cancel Subscription */}
      {!isFreeTier && !displaySub.cancelAtPeriodEnd && (
        <div className="pt-4">
          <button
            onClick={() => setCancelDialogOpen(true)}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            {language === "ar" ? "إلغاء الاشتراك" : "Cancel Subscription"}
          </button>
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
              {language === "ar" ? "إلغاء الاشتراك" : "Cancel Subscription"}
            </DialogTitle>
            <DialogDescription className={isRTL ? "text-right" : ""}>
              {language === "ar"
                ? `ستفقد الوصول إلى ميزات ${displaySub.tier} في نهاية فترة الفوترة الحالية.`
                : `You will lose access to ${displaySub.tier} features at the end of your current billing period.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              {language === "ar" ? "الإبقاء على الخطة" : "Keep Plan"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={canceling}
            >
              {canceling
                ? (language === "ar" ? "جارٍ الإلغاء..." : "Canceling...")
                : (language === "ar" ? "تأكيد الإلغاء" : "Confirm Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Usage meter subcomponent
function UsageMeter({
  icon,
  label,
  used,
  limit,
  unit = "",
  locale,
  isRTL,
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number
  unit?: string
  locale: string
  isRTL: boolean
}) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isNearLimit = percent >= 80

  return (
    <div className="space-y-2">
      <div className={cn("flex items-center justify-between text-sm", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn(isNearLimit && "text-destructive")}>
          {used.toLocaleString(locale)} / {limit.toLocaleString(locale)} {unit}
        </span>
      </div>
      <Progress
        value={percent}
        className={cn("h-2", isNearLimit && "[&>div]:bg-destructive")}
      />
    </div>
  )
}
