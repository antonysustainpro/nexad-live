"use client"

import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { UsageMetric } from "@/lib/types"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface BillingUsageChartProps {
  data: UsageMetric[]
  metric: "apiCalls" | "tokensUsed" | "storageUsedMb"
}

export function BillingUsageChart({ data, metric }: BillingUsageChartProps) {
  const { language, isRTL } = useNexus()

  const metricLabels = {
    apiCalls: { en: "API Calls", ar: "طلبات API" },
    tokensUsed: { en: "Tokens", ar: "الكلمات المعالجة" },
    storageUsedMb: { en: "Storage (MB)", ar: "التخزين (ميجابايت)" },
  }

  const formatDate = (label: string | number) => {
    if (typeof label !== "string") return String(label)
    return new Date(label).toLocaleDateString(
      language === "ar" ? "ar-AE" : "en-US",
      { month: "short", day: "numeric" }
    )
  }

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  return (
    <div className="w-full h-[300px]" role="img" aria-label={language === "ar" ? metricLabels[metric].ar : metricLabels[metric].en}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--nexus-jade)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--nexus-jade)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            reversed={isRTL}
          />
          <YAxis
            tickFormatter={formatValue}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            orientation={isRTL ? "right" : "left"}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) => [
              formatValue(Number(value)),
              language === "ar" ? metricLabels[metric].ar : metricLabels[metric].en,
            ]}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="var(--nexus-jade)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorMetric)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
