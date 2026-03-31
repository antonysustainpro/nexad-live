"use client"

import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface LimitBar {
  labelEn: string
  labelAr: string
  used: number
  limit: number
  unit: string
  unitAr: string
}

interface BillingLimitBarsProps {
  limits: LimitBar[]
}

export function BillingLimitBars({ limits }: BillingLimitBarsProps) {
  const { language, isRTL } = useNexus()

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  return (
    <div className="space-y-4">
      {limits.map((limit, index) => {
        const percentage = limit.limit > 0 ? (limit.used / limit.limit) * 100 : 0
        const isWarning = percentage >= 80 && percentage < 100
        const isAtLimit = percentage >= 100

        return (
          <div key={index} className="space-y-2">
            <div className={cn("flex items-center justify-between text-sm", isRTL && "flex-row-reverse")}>
              <span className="font-medium text-foreground">
                {language === "ar" ? limit.labelAr : limit.labelEn}
              </span>
              <span className={cn(
                "text-muted-foreground",
                isWarning && "text-[#F59E0B]",
                isAtLimit && "text-destructive"
              )}>
                {formatNumber(limit.used)} / {limit.limit === -1 ? (language === "ar" ? "غير محدود" : "Unlimited") : formatNumber(limit.limit)}{" "}
                {language === "ar" ? limit.unitAr : limit.unit}
              </span>
            </div>
            
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 rounded-full transition-all",
                  isRTL ? "right-0" : "left-0",
                  isAtLimit ? "bg-destructive" : isWarning ? "bg-[#F59E0B]" : "bg-nexus-jade"
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>

            {(isWarning || isAtLimit) && (
              <div className={cn(
                "flex items-center gap-2 text-xs",
                isRTL && "flex-row-reverse",
                isAtLimit ? "text-destructive" : "text-[#F59E0B]"
              )}>
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                <span>
                  {isAtLimit
                    ? language === "ar"
                      ? "وصلت للحد الأقصى"
                      : "Limit reached"
                    : language === "ar"
                    ? "اقتربت من الحد الأقصى"
                    : "Approaching limit"}
                </span>
                <Link href="/billing/pricing" className="ms-auto">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                    {language === "ar" ? "ترقية" : "Upgrade"}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
