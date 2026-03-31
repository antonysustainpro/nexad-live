"use client"

import { useState } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { DomainUsage } from "@/lib/types"
import { ChevronUp, ChevronDown } from "lucide-react"
import { USD_TO_AED } from "@/lib/billing-api"

interface BillingUsageBreakdownProps {
  data: DomainUsage[]
}

type SortKey = "domain" | "calls" | "tokens" | "costUsd"
type SortDir = "asc" | "desc"

export function BillingUsageBreakdown({ data }: BillingUsageBreakdownProps) {
  const { language, isRTL } = useNexus()
  const [sortKey, setSortKey] = useState<SortKey>("calls")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
  })

  const formatNumber = (value: number) => {
    return value.toLocaleString(language === "ar" ? "ar-AE" : "en-US")
  }

  const formatCurrency = (usd: number) => {
    const aed = usd * USD_TO_AED
    return language === "ar" ? `${aed.toFixed(0)} د.إ` : `$${usd.toFixed(2)}`
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null
    return sortDir === "asc" ? (
      <ChevronUp className="h-4 w-4 inline ms-1" aria-hidden="true" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ms-1" aria-hidden="true" />
    )
  }

  const headers: Array<{ key: SortKey; labelEn: string; labelAr: string }> = [
    { key: "domain", labelEn: "Domain", labelAr: "المجال" },
    { key: "calls", labelEn: "Calls", labelAr: "الطلبات" },
    { key: "tokens", labelEn: "Tokens", labelAr: "التوكنات" },
    { key: "costUsd", labelEn: "Cost", labelAr: "التكلفة" },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className={cn(
                  "py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
                  "text-start"
                )}
                onClick={() => handleSort(header.key)}
              >
                {language === "ar" ? header.labelAr : header.labelEn}
                <SortIcon columnKey={header.key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={row.domain}
              className={cn(
                "border-b border-border/50 hover:bg-muted/50 transition-colors",
                index === sortedData.length - 1 && "border-b-0"
              )}
            >
              <td className={cn("py-3 px-4 font-medium", "text-start")}>{row.domain}</td>
              <td className={cn("py-3 px-4", "text-start")}>{formatNumber(row.calls)}</td>
              <td className={cn("py-3 px-4", "text-start")}>{formatNumber(row.tokens)}</td>
              <td className={cn("py-3 px-4", "text-start")}>{formatCurrency(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
