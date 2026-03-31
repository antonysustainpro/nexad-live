"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Check, X, Crown, Zap, Building2, ChevronLeft } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  getSubscription,
  type BillingTier,
  TIER_CONFIG,
  USD_TO_AED,
  formatCurrency,
  upgradePlan,
  downgradePlan,
} from "@/lib/billing-api"

const TIER_LEVELS: Record<BillingTier, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
}

interface Feature {
  key: string
  labelEn: string
  labelAr: string
  free: boolean | string
  pro: boolean | string
  enterprise: boolean | string
}

const FEATURES: Feature[] = [
  { key: "requests", labelEn: "Requests per minute", labelAr: "طلبات في الدقيقة", free: "10", pro: "100", enterprise: "1,000" },
  { key: "domains", labelEn: "Active domains", labelAr: "النطاقات النشطة", free: "5", pro: "15", enterprise: "Unlimited" },
  { key: "storage", labelEn: "Vault storage", labelAr: "تخزين الخزنة", free: "100 MB", pro: "5 GB", enterprise: "50 GB" },
  { key: "voice", labelEn: "Voice mode", labelAr: "الوضع الصوتي", free: false, pro: true, enterprise: true },
  { key: "rag", labelEn: "Document intelligence (RAG)", labelAr: "ذكاء المستندات", free: false, pro: true, enterprise: true },
  { key: "priority", labelEn: "Priority processing", labelAr: "معالجة أولوية", free: false, pro: true, enterprise: true },
  { key: "support", labelEn: "Dedicated support", labelAr: "دعم مخصص", free: false, pro: false, enterprise: true },
  { key: "sla", labelEn: "Custom SLA", labelAr: "اتفاقية مستوى خدمة مخصصة", free: false, pro: false, enterprise: true },
]

export default function PricingPage() {
  const { language, isRTL } = useNexus()
  const locale = language === "ar" ? "ar-AE" : "en-US"

  const [currentTier, setCurrentTier] = useState<BillingTier>("FREE")
  const [tierLoading, setTierLoading] = useState(true)
  const [isAnnual, setIsAnnual] = useState(false)
  const [loading, setLoading] = useState<BillingTier | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Load current tier from API
  useEffect(() => {
    async function loadCurrentTier() {
      try {
        const sub = await getSubscription()
        if (sub) {
          setCurrentTier(sub.tier)
        }
        // If null, stays as FREE (no subscription = free tier)
      } catch {
        // Default to FREE on error
      } finally {
        setTierLoading(false)
      }
    }
    loadCurrentTier()
  }, [])

  const handleSelectTier = async (tier: BillingTier) => {
    if (tier === currentTier) return

    setLoading(tier)
    try {
      const isUpgrade = TIER_LEVELS[tier] > TIER_LEVELS[currentTier]
      if (isUpgrade) {
        await upgradePlan({ new_tier: tier })
      } else {
        await downgradePlan({ new_tier: tier })
      }
      setCurrentTier(tier)
    } catch {
      // Handle error
    } finally {
      setLoading(null)
    }
  }

  const getPrice = (tier: BillingTier) => {
    const config = TIER_CONFIG[tier]
    const price = isAnnual ? config.priceUsdAnnual / 12 : config.priceUsdMonthly
    return price
  }

  const getAnnualPrice = (tier: BillingTier) => {
    return TIER_CONFIG[tier].priceUsdAnnual
  }

  const tiers: Array<{
    tier: BillingTier
    icon: typeof Crown
    nameEn: string
    nameAr: string
    descEn: string
    descAr: string
    highlight?: boolean
  }> = [
    {
      tier: "FREE",
      icon: Zap,
      nameEn: "Free",
      nameAr: "مجاني",
      descEn: "Get started with basic features",
      descAr: "ابدأ مع الميزات الأساسية",
    },
    {
      tier: "PRO",
      icon: Crown,
      nameEn: "Pro",
      nameAr: "برو",
      descEn: "For power users and professionals",
      descAr: "للمستخدمين المحترفين",
      highlight: true,
    },
    {
      tier: "ENTERPRISE",
      icon: Building2,
      nameEn: "Enterprise",
      nameAr: "المؤسسات",
      descEn: "Custom solutions for organizations",
      descAr: "حلول مخصصة للمؤسسات",
    },
  ]

  const MotionCard = prefersReducedMotion ? Card : motion.create(Card)

  // Skeleton loading state while fetching current tier
  if (tierLoading) {
    return (
      <div className={cn("p-6 space-y-6 max-w-6xl mx-auto pb-20", isRTL && "text-right")}>
        <Skeleton className="h-4 w-32" />
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-52 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <div className="flex items-center justify-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-40 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-full" />
                <div className="space-y-3 pt-4 border-t">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("p-6 space-y-6 max-w-6xl mx-auto pb-20", isRTL && "text-right")}>
      {/* Back Link */}
      <Link
        href="/billing"
        className={cn(
          "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
          isRTL && "flex-row-reverse"
        )}
      >
        <ChevronLeft className={cn("h-4 w-4", isRTL && "rotate-180")} aria-hidden="true" />
        {language === "ar" ? "العودة للفواتير" : "Back to Billing"}
      </Link>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-title-1">
          {language === "ar" ? "اختر خطتك" : "Choose Your Plan"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar"
            ? "ابدأ مجانًا، قم بالترقية في أي وقت"
            : "Start free, upgrade anytime"}
        </p>
      </div>

      {/* Annual Toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label htmlFor="billing-toggle" className={cn(isAnnual && "text-muted-foreground")}>
          {language === "ar" ? "شهري" : "Monthly"}
        </Label>
        <Switch
          id="billing-toggle"
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
        />
        <Label htmlFor="billing-toggle" className={cn(!isAnnual && "text-muted-foreground")}>
          {language === "ar" ? "سنوي" : "Annual"}
          <Badge variant="secondary" className="ms-2 text-nexus-jade">
            {language === "ar" ? "وفر 20%" : "Save 20%"}
          </Badge>
        </Label>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((t, index) => {
          const isCurrent = t.tier === currentTier
          const isUpgrade = TIER_LEVELS[t.tier] > TIER_LEVELS[currentTier]
          const isDowngrade = TIER_LEVELS[t.tier] < TIER_LEVELS[currentTier]
          const isEnterprise = t.tier === "ENTERPRISE"
          const Icon = t.icon
          const price = getPrice(t.tier)

          return (
            <MotionCard
              key={t.tier}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={cn(
                "relative overflow-hidden",
                t.highlight && "border-nexus-jade shadow-lg"
              )}
            >
              {/* Current Plan Badge */}
              {isCurrent && (
                <div className="absolute top-4 end-4">
                  <Badge className="bg-nexus-jade text-white">
                    {language === "ar" ? "الخطة الحالية" : "Current"}
                  </Badge>
                </div>
              )}

              {/* Recommended Badge */}
              {t.highlight && !isCurrent && (
                <div className="absolute top-0 inset-x-0 bg-nexus-jade text-white text-center text-sm py-1">
                  {language === "ar" ? "موصى به" : "Recommended"}
                </div>
              )}

              <CardHeader className={cn(t.highlight && !isCurrent && "pt-10")}>
                <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse justify-end")}>
                  <Icon className="h-6 w-6 text-nexus-gold" aria-hidden="true" />
                  <CardTitle className="text-headline">
                    {language === "ar" ? t.nameAr : t.nameEn}
                  </CardTitle>
                </div>
                <CardDescription>
                  {language === "ar" ? t.descAr : t.descEn}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div>
                  <div className={cn("flex items-baseline gap-1", isRTL && "flex-row-reverse justify-end")}>
                    <span className="text-4xl font-bold">
                      {formatCurrency(price, "USD", locale)}
                    </span>
                    <span className="text-muted-foreground">
                      / {language === "ar" ? "شهر" : "mo"}
                    </span>
                  </div>
                  {price > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCurrency(price * USD_TO_AED, "AED", locale)}{" "}
                      {isAnnual && `(${formatCurrency(getAnnualPrice(t.tier), "USD", locale)}/${language === "ar" ? "سنة" : "yr"})`}
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                {isEnterprise ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open("mailto:enterprise@nexusad.com", "_blank", "noopener,noreferrer")}
                  >
                    {language === "ar" ? "تواصل مع المبيعات" : "Contact Sales"}
                  </Button>
                ) : isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    {language === "ar" ? "خطتك الحالية" : "Your Current Plan"}
                  </Button>
                ) : (
                  <Button
                    className={cn(
                      "w-full",
                      isUpgrade
                        ? "bg-nexus-jade hover:bg-nexus-jade-hover text-white"
                        : "bg-secondary hover:bg-secondary/80"
                    )}
                    onClick={() => handleSelectTier(t.tier)}
                    disabled={loading !== null}
                  >
                    {loading === t.tier
                      ? (language === "ar" ? "جارٍ التحديث..." : "Updating...")
                      : isUpgrade
                        ? (language === "ar" ? "ترقية" : "Upgrade")
                        : (language === "ar" ? "تخفيض" : "Downgrade")}
                  </Button>
                )}

                {/* Features */}
                <ul className="space-y-3 pt-4 border-t">
                  {FEATURES.map((feature) => {
                    const value = feature[t.tier.toLowerCase() as "free" | "pro" | "enterprise"]
                    const hasFeature = value !== false

                    return (
                      <li
                        key={feature.key}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          !hasFeature && "text-muted-foreground",
                          isRTL && "flex-row-reverse"
                        )}
                      >
                        {hasFeature ? (
                          <Check className="h-4 w-4 text-nexus-jade shrink-0" aria-hidden="true" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {language === "ar" ? feature.labelAr : feature.labelEn}
                          {typeof value === "string" && `: ${value}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </MotionCard>
          )
        })}
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        {language === "ar"
          ? "جميع الأسعار بالدولار الأمريكي. يمكنك الإلغاء في أي وقت."
          : "All prices in USD. Cancel anytime."}
      </p>
    </div>
  )
}
