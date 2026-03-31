"use client"

import { Check, X } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TIER_CONFIG, USD_TO_AED, type BillingTier } from "@/lib/billing-api"

interface LoginTierSelectorProps {
  selectedTier: BillingTier
  onSelectTier: (tier: BillingTier) => void
}

const tierFeatures: Record<BillingTier, Array<{ en: string; ar: string; included: boolean }>> = {
  FREE: [
    { en: "5 domains", ar: "٥ مجالات", included: true },
    { en: "Basic chat", ar: "محادثة أساسية", included: true },
    { en: "Sovereignty dashboard", ar: "لوحة السيادة", included: true },
    { en: "Voice counsel", ar: "مستشار صوتي", included: false },
    { en: "RAG intelligence", ar: "ذكاء RAG", included: false },
    { en: "Priority routing", ar: "توجيه أولوية", included: false },
  ],
  PRO: [
    { en: "15 domains", ar: "١٥ مجال", included: true },
    { en: "Voice counsel", ar: "مستشار صوتي", included: true },
    { en: "RAG intelligence", ar: "ذكاء RAG", included: true },
    { en: "Priority routing", ar: "توجيه أولوية", included: true },
    { en: "Financial analysis", ar: "تحليل مالي", included: true },
    { en: "Dedicated support", ar: "دعم مخصص", included: false },
  ],
  ENTERPRISE: [
    { en: "All domains", ar: "جميع المجالات", included: true },
    { en: "Everything in Pro", ar: "كل ما في Pro", included: true },
    { en: "Dedicated support", ar: "دعم مخصص", included: true },
    { en: "Custom SLA", ar: "اتفاقية مخصصة", included: true },
    { en: "SSO integration", ar: "تكامل SSO", included: true },
    { en: "Audit compliance", ar: "امتثال التدقيق", included: true },
  ],
}

const tierLabels: Record<BillingTier, { en: string; ar: string }> = {
  FREE: { en: "Free", ar: "مجاني" },
  PRO: { en: "Pro", ar: "برو" },
  ENTERPRISE: { en: "Enterprise", ar: "المؤسسات" },
}

const ctaLabels: Record<BillingTier, { en: string; ar: string }> = {
  FREE: { en: "Start Free", ar: "ابدأ مجانًا" },
  PRO: { en: "Get Pro", ar: "احصل على برو" },
  ENTERPRISE: { en: "Contact Sales", ar: "تواصل مع المبيعات" },
}

export function LoginTierSelector({ selectedTier, onSelectTier }: LoginTierSelectorProps) {
  const { language } = useNexus()
  const isRTL = language === "ar"
  const locale = language === "ar" ? "ar-AE" : "en-US"

  const formatPrice = (usd: number) => {
    const aed = Math.round(usd * USD_TO_AED)
    return {
      usd: usd.toLocaleString(locale, { style: "currency", currency: "USD", minimumFractionDigits: 0 }),
      aed: aed.toLocaleString(locale, { style: "currency", currency: "AED", minimumFractionDigits: 0 }),
    }
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", isRTL && "direction-rtl")}>
      {(["FREE", "PRO", "ENTERPRISE"] as BillingTier[]).map((tier) => {
        const config = TIER_CONFIG[tier]
        const features = tierFeatures[tier]
        const label = tierLabels[tier]
        const cta = ctaLabels[tier]
        const isSelected = selectedTier === tier
        const isPro = tier === "PRO"
        const price = formatPrice(config.priceUsdMonthly)

        return (
          <button
            key={tier}
            type="button"
            onClick={() => onSelectTier(tier)}
            aria-label={`${language === "ar" ? "اختر خطة" : "Select"} ${label.en}`}
            className={cn(
              "relative flex flex-col p-5 rounded-2xl border-2 text-start transition-all",
              isSelected
                ? "border-nexus-jade bg-nexus-jade/5 ring-1 ring-nexus-jade/50"
                : "border-border hover:border-muted-foreground bg-card",
              isPro && "md:scale-[1.02] md:shadow-lg"
            )}
          >
            {/* Recommended badge for PRO */}
            {isPro && (
              <Badge className="absolute -top-3 start-4 bg-nexus-gold text-background text-xs">
                {language === "ar" ? "موصى به" : "Recommended"}
              </Badge>
            )}

            {/* Selected checkmark */}
            {isSelected && (
              <div className="absolute top-3 end-3">
                <div className="w-6 h-6 rounded-full bg-nexus-jade flex items-center justify-center">
                  <Check className="h-4 w-4 text-background" aria-hidden="true" />
                </div>
              </div>
            )}

            {/* Tier name */}
            <h3 className="text-lg font-bold text-foreground">
              {language === "ar" ? label.ar : label.en}
            </h3>

            {/* Price */}
            <div className="mt-2">
              <span className="text-2xl font-bold text-foreground">{price.usd}</span>
              <span className="text-sm text-muted-foreground">
                {language === "ar" ? "/شهر" : "/mo"}
              </span>
              {config.priceUsdMonthly > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{price.aed}</p>
              )}
            </div>

            {/* Features */}
            <ul className="mt-4 space-y-2 flex-1">
              {features.map((feature) => (
                <li
                  key={feature.en}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  {feature.included ? (
                    <Check className="h-4 w-4 text-[#10B981] flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className={feature.included ? "text-foreground" : "text-muted-foreground/50"}>
                    {language === "ar" ? feature.ar : feature.en}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA text */}
            <div
              className={cn(
                "mt-4 py-2 text-center text-sm font-medium rounded-lg",
                isSelected ? "bg-nexus-jade text-background" : "bg-secondary text-foreground"
              )}
            >
              {language === "ar" ? cta.ar : cta.en}
            </div>
          </button>
        )
      })}
    </div>
  )
}
