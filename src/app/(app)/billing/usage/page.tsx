"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { UsageMetric, DomainUsage, UsageSummary } from "@/lib/types"
import { BillingUsageBreakdown } from "@/components/billing-usage-breakdown"
import { BillingLimitBars } from "@/components/billing-limit-bars"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3, Zap, Database, Globe, Calendar, TrendingUp, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getUsage, getSubscription, type UsageData } from "@/lib/billing-api"

// Dynamic import for chart to avoid SSR issues
const BillingUsageChart = dynamic(
  () => import("@/components/billing-usage-chart").then((mod) => mod.BillingUsageChart),
  { ssr: false, loading: () => <div className="h-[300px] bg-muted motion-safe:animate-pulse rounded-lg" /> }
)

type TimeRange = "7d" | "30d" | "90d"

export default function BillingUsagePage() {
  const { language, isRTL } = useNexus()
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")
  const [selectedMetric, setSelectedMetric] = useState<"apiCalls" | "tokensUsed" | "storageUsedMb">("apiCalls")
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)

  // API data
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [usageMetrics] = useState<UsageMetric[]>([])
  const [domainUsage] = useState<DomainUsage[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const [usage, sub] = await Promise.all([
          getUsage(),
          getSubscription(),
        ])
        if (usage) {
          setUsageData(usage)
        }
        // subscription data could be used for billing period info
        if (sub) {
          // Could enhance summary with subscription period data
        }
        if (!usage && !sub) {
          setApiError(true)
        }
      } catch {
        setApiError(true)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Build summary from API data or show empty state
  const summary: UsageSummary | null = usageData ? {
    totalApiCalls: usageData.requests.used,
    totalTokens: 0,
    totalStorageMb: usageData.storage.usedMb,
    activeDomains: usageData.domains.active,
    billingPeriodStart: new Date().toISOString().split("T")[0] ?? new Date().toISOString(),
    billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? new Date().toISOString(),
    daysRemaining: 30,
  } : null

  const filteredData = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    return usageMetrics.slice(-days)
  }, [timeRange, usageMetrics])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === "ar" ? "ar-AE" : "en-US",
      { month: "short", day: "numeric" }
    )
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toLocaleString(language === "ar" ? "ar-AE" : "en-US")
  }

  const limitBars = usageData ? [
    { labelEn: "API Requests", labelAr: "طلبات API", used: usageData.requests.used, limit: usageData.requests.limit, unit: "requests", unitAr: "طلب" },
    { labelEn: "Active Domains", labelAr: "المجالات النشطة", used: usageData.domains.active, limit: usageData.domains.limit, unit: "", unitAr: "" },
    { labelEn: "Vault Storage", labelAr: "تخزين الخزنة", used: usageData.storage.usedMb, limit: usageData.storage.limitMb, unit: "MB", unitAr: "ميجابايت" },
  ] : [
    { labelEn: "API Requests", labelAr: "طلبات API", used: 0, limit: 10000, unit: "requests", unitAr: "طلب" },
    { labelEn: "Active Domains", labelAr: "المجالات النشطة", used: 0, limit: 5, unit: "", unitAr: "" },
    { labelEn: "Vault Storage", labelAr: "تخزين الخزنة", used: 0, limit: 100, unit: "MB", unitAr: "ميجابايت" },
  ]

  // Skeleton loading state
  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 pb-24 md:pb-8">
        <Breadcrumbs />
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-8 w-52" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mb-6">
          <CardContent className="pt-4">
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const statCards = summary ? [
    { icon: Zap, labelEn: "Total API Calls", labelAr: "إجمالي طلبات API", value: summary.totalApiCalls },
    { icon: TrendingUp, labelEn: "Tokens Used", labelAr: "التوكنات المستخدمة", value: summary.totalTokens },
    { icon: Database, labelEn: "Storage Used", labelAr: "التخزين المستخدم", value: `${summary.totalStorageMb} MB` },
    { icon: Globe, labelEn: "Active Domains", labelAr: "المجالات النشطة", value: summary.activeDomains },
  ] : [
    { icon: Zap, labelEn: "Total API Calls", labelAr: "إجمالي طلبات API", value: 0 },
    { icon: TrendingUp, labelEn: "Tokens Used", labelAr: "التوكنات المستخدمة", value: 0 },
    { icon: Database, labelEn: "Storage Used", labelAr: "التخزين المستخدم", value: "0 MB" },
    { icon: Globe, labelEn: "Active Domains", labelAr: "المجالات النشطة", value: 0 },
  ]

  return (
    <div className="container max-w-6xl mx-auto px-4 pb-24 md:pb-8">
      <Breadcrumbs />

      {/* Header */}
      <div className={cn("flex items-center justify-between mb-6", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <BarChart3 className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">
            {language === "ar" ? "لوحة الاستخدام" : "Usage Dashboard"}
          </h1>
        </div>
      </div>

      {apiError && (
        <Alert variant="default" className="mb-6 border-[#F59E0B]/50 bg-[#F59E0B]/10">
          <AlertDescription className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {language === "ar" ? "تعذر تحميل البيانات الحية - عرض القيم الافتراضية" : "Unable to load live data -- showing defaults"}
          </AlertDescription>
        </Alert>
      )}

      {/* No data state */}
      {!usageData && !apiError && (
        <div className="mb-6 p-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-medium text-muted-foreground">
            {language === "ar" ? "لا توجد بيانات استخدام بعد" : "No usage data yet"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ar"
              ? "ستظهر بيانات الاستخدام هنا بمجرد بدء استخدام الخدمة."
              : "Usage data will appear here once you start using the service."}
          </p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardContent className="pt-4">
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <div className="p-2 rounded-lg bg-nexus-jade/10">
                    <Icon className="h-5 w-5 text-nexus-jade" aria-hidden="true" />
                  </div>
                  <div className={isRTL ? "text-right" : undefined}>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? stat.labelAr : stat.labelEn}
                    </p>
                    <p className="text-lg font-bold">
                      {typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Billing Period Info */}
      {summary && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className={cn("flex items-center justify-between flex-wrap gap-4", isRTL && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "فترة الفوترة:" : "Billing period:"}
                </span>
                <span className="text-sm font-medium">
                  {formatDate(summary.billingPeriodStart)} - {formatDate(summary.billingPeriodEnd)}
                </span>
              </div>
              <span className="text-sm text-nexus-jade font-medium">
                {language === "ar"
                  ? `${summary.daysRemaining} أيام متبقية`
                  : `${summary.daysRemaining} days remaining`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className={cn("flex items-center justify-between flex-wrap gap-4", isRTL && "flex-row-reverse")}>
              <CardTitle>{language === "ar" ? "الاستخدام اليومي" : "Daily Usage"}</CardTitle>
              <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                {(["7d", "30d", "90d"] as TimeRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className={cn(timeRange === range && "bg-nexus-jade hover:bg-nexus-jade-hover text-background")}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
            <div className={cn("flex gap-2 mt-2", isRTL && "flex-row-reverse")}>
              {[
                { key: "apiCalls" as const, labelEn: "API Calls", labelAr: "طلبات API" },
                { key: "tokensUsed" as const, labelEn: "Tokens", labelAr: "التوكنات" },
                { key: "storageUsedMb" as const, labelEn: "Storage", labelAr: "التخزين" },
              ].map((metric) => (
                <Button
                  key={metric.key}
                  variant={selectedMetric === metric.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedMetric(metric.key)}
                >
                  {language === "ar" ? metric.labelAr : metric.labelEn}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredData.length > 0 ? (
              <BillingUsageChart data={filteredData} metric={selectedMetric} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p className="text-sm">
                    {language === "ar" ? "لا توجد بيانات للعرض" : "No chart data available"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Limit Bars */}
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "حدود الاستخدام" : "Usage Limits"}</CardTitle>
          </CardHeader>
          <CardContent>
            <BillingLimitBars limits={limitBars} />
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{language === "ar" ? "تفصيل حسب المجال" : "Breakdown by Domain"}</CardTitle>
        </CardHeader>
        <CardContent>
          {domainUsage.length > 0 ? (
            <BillingUsageBreakdown data={domainUsage} />
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
              <p className="text-sm">
                {language === "ar" ? "لا توجد بيانات نطاقات للعرض" : "No domain usage data available"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
