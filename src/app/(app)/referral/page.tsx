"use client"

import { useState, useEffect, useCallback } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { Referral, ReferralStats } from "@/lib/types"
import {
  getReferralCode,
  getReferralStats,
  getReferrals,
} from "@/lib/api"
import { ReferralShareCard } from "@/components/referral-share-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Gift, Users, DollarSign, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

// Fallback: Generate a stable referral code from a browser-fingerprint seed
function generateLocalReferralCode(): string {
  try {
    const stored = localStorage.getItem("nexus-referral-code")
    if (stored) return stored
  } catch {
    // Ignore storage errors
  }

  let seed = 0
  const raw = (typeof navigator !== "undefined" ? navigator.userAgent : "") +
    (typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "") +
    String(Date.now())
  for (let i = 0; i < raw.length; i++) {
    seed = ((seed << 5) - seed) + raw.charCodeAt(i)
    seed = seed & seed
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "NX-"
  let s = Math.abs(seed)
  for (let i = 0; i < 6; i++) {
    s = (s * 16807 + 0) % 2147483647
    code += chars[s % chars.length]
  }

  try {
    localStorage.setItem("nexus-referral-code", code)
  } catch {
    // Ignore storage errors
  }
  return code
}

export default function ReferralPage() {
  const { language, isRTL } = useNexus()

  const [referralCode, setReferralCode] = useState("NX-......")
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    creditsEarned: 0,
    referralCode: "NX-......",
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReferralData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
      let userId: string | null = null
      try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
        userId = storedUser ? JSON.parse(storedUser).id : null
      } catch {
        // Corrupted localStorage
      }

      const [codeData, statsData, referralsData] = await Promise.all([
        userId ? getReferralCode(userId, signal) : Promise.resolve(null),
        userId ? getReferralStats(userId, signal) : Promise.resolve(null),
        userId ? getReferrals(userId, signal) : Promise.resolve(null),
      ])

      // Use backend code if available, otherwise fall back to local generation
      const code = codeData?.code || generateLocalReferralCode()
      setReferralCode(code)

      if (statsData) {
        setStats({ ...statsData, referralCode: code })
      } else {
        setStats({
          totalReferrals: 0,
          activeReferrals: 0,
          creditsEarned: 0,
          referralCode: code,
        })
      }

      setReferrals(referralsData || [])
    } catch (err) {
      // Fall back to local code on error
      const fallbackCode = generateLocalReferralCode()
      setReferralCode(fallbackCode)
      setStats({
        totalReferrals: 0,
        activeReferrals: 0,
        creditsEarned: 0,
        referralCode: fallbackCode,
      })
      setError(err instanceof Error ? err.message : "Failed to load referral data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    loadReferralData(abortController.signal)
    return () => abortController.abort()
  }, [loadReferralData])

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-[#F59E0B]",
      bgColor: "bg-[#F59E0B]/10",
      labelEn: "Pending",
      labelAr: "معلق",
    },
    active: {
      icon: CheckCircle2,
      color: "text-[#10B981]",
      bgColor: "bg-[#10B981]/10",
      labelEn: "Active",
      labelAr: "نشط",
    },
    expired: {
      icon: XCircle,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      labelEn: "Expired",
      labelAr: "منتهي",
    },
  }

  const statCards = [
    { icon: Users, labelEn: "Total Referrals", labelAr: "إجمالي الإحالات", value: stats.totalReferrals },
    { icon: CheckCircle2, labelEn: "Active", labelAr: "نشط", value: stats.activeReferrals },
    { icon: DollarSign, labelEn: "Credits Earned", labelAr: "الأرصدة المكتسبة", value: `$${stats.creditsEarned}` },
  ]

  const howItWorks = [
    { stepEn: "Share your code", stepAr: "شارك كودك", descEn: "Send your referral code to friends", descAr: "أرسل كود الإحالة لأصدقائك" },
    { stepEn: "Friend signs up", stepAr: "صديقك يسجل", descEn: "They create an account using your code", descAr: "يقومون بإنشاء حساب باستخدام كودك" },
    { stepEn: "Both get rewarded", stepAr: "كلاكما يحصل على مكافأة", descEn: "You both get $50 credit", descAr: "كلاكما يحصل على رصيد 50$" },
  ]

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === "ar" ? "ar-AE" : "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    )
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 pb-24 md:pb-8 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 pb-24 md:pb-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Gift className="h-12 w-12 text-destructive/30 mb-4" aria-hidden="true" />
          <h3 className="font-medium text-destructive mb-1">
            {language === "ar" ? "خطأ في تحميل الإحالات" : "Error Loading Referrals"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => loadReferralData()}>
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
        <Gift className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">
          {language === "ar" ? "برنامج الإحالة" : "Referral Program"}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardContent className="pt-4">
                <div className={cn("flex flex-col items-center text-center gap-2")}>
                  <div className="p-2 rounded-lg bg-nexus-jade/10">
                    <Icon className="h-5 w-5 text-nexus-jade" aria-hidden="true" />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? stat.labelAr : stat.labelEn}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Share Card */}
      <ReferralShareCard referralCode={stats.referralCode} />

      {/* How It Works */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className={isRTL ? "text-right" : undefined}>
            {language === "ar" ? "كيف يعمل" : "How It Works"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("grid md:grid-cols-3 gap-6", isRTL && "md:grid-flow-col-dense")}>
            {howItWorks.map((step, index) => (
              <div key={index} className={cn("flex flex-col items-center text-center gap-3")}>
                <div className="w-10 h-10 rounded-full bg-nexus-jade/20 text-nexus-jade flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <h4 className="font-semibold">{language === "ar" ? step.stepAr : step.stepEn}</h4>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? step.descAr : step.descEn}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referral List */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className={isRTL ? "text-right" : undefined}>
            {language === "ar" ? "إحالاتك" : "Your Referrals"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className={cn("text-muted-foreground text-center py-8", isRTL && "text-right")}>
              {language === "ar" ? "لا توجد إحالات بعد" : "No referrals yet"}
            </p>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => {
                const status = statusConfig[referral.status]
                const StatusIcon = status.icon
                return (
                  <div
                    key={referral.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border border-border",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                      <div className={cn("p-2 rounded-full", status.bgColor)}>
                        <StatusIcon className={cn("h-4 w-4", status.color)} aria-hidden="true" />
                      </div>
                      <div className={isRTL ? "text-right" : undefined}>
                        <p className="font-medium">{referral.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(referral.date)}</p>
                      </div>
                    </div>
                    <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                      <span className={cn("text-xs px-2 py-1 rounded-full", status.bgColor, status.color)}>
                        {language === "ar" ? status.labelAr : status.labelEn}
                      </span>
                      {referral.creditEarned > 0 && (
                        <span className="text-sm font-medium text-nexus-jade">+${referral.creditEarned}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms Link */}
      <p className={cn("text-xs text-muted-foreground mt-6 text-center")}>
        {language === "ar" ? (
          <>
            بالمشاركة، أنت توافق على{" "}
            <Link href="/terms" className="text-nexus-jade hover:underline">
              شروط برنامج الإحالة
            </Link>
          </>
        ) : (
          <>
            By participating, you agree to our{" "}
            <Link href="/terms" className="text-nexus-jade hover:underline">
              Referral Program Terms
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
