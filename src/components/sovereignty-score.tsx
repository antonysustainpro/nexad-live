"use client"

import { useState, useEffect } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { getSovereigntyScore } from "@/lib/api"
import type { SovereigntyScoreResponse } from "@/lib/types"

interface SovereigntyScoreProps {
  score?: number
  grade?: string
  factors?: {
    encryption: number
    shards: number
    localProcessing: number
    keyHealth: number
    access: number
  }
  compact?: boolean
}

// Default values - actual scores loaded from API
const defaultFactors = {
  encryption: 0,
  shards: 0,
  localProcessing: 0,
  keyHealth: 0,
  access: 0,
}

export function SovereigntyScore({
  score = 0,
  grade = "--",
  factors = defaultFactors,
  compact = false,
}: SovereigntyScoreProps) {
  const { language } = useNexus()
  const [scoreData, setScoreData] = useState<SovereigntyScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSovereigntyScore().then((data) => {
      if (cancelled) return
      if (data) setScoreData(data)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // Use scoreData values if available, else fall back to prop defaults
  const displayScore = scoreData?.score ?? score
  const displayGrade = scoreData?.grade ?? grade

  // Map factors from API response
  const displayFactors = scoreData ? {
    encryption: scoreData.factors.find(f => f.name === "encryption_strength")?.score ?? factors.encryption,
    shards: scoreData.factors.find(f => f.name === "shard_distribution")?.score ?? factors.shards,
    localProcessing: scoreData.factors.find(f => f.name === "pii_protection")?.score ?? factors.localProcessing,
    keyHealth: scoreData.factors.find(f => f.name === "key_health")?.score ?? factors.keyHealth,
    access: scoreData.factors.find(f => f.name === "access_hygiene")?.score ?? factors.access,
  } : factors

  const factorLabels = {
    encryption: { en: "Encryption", ar: "التشفير" },
    shards: { en: "Shards", ar: "توزيع البيانات" },
    localProcessing: { en: "Local Processing", ar: "المعالجة المحلية" },
    keyHealth: { en: "Key Health", ar: "صحة المفتاح" },
    access: { en: "Access", ar: "الوصول" },
  }

  return (
    <div 
      className="relative p-6 bg-card rounded-2xl border-t-2 border-nexus-gold"
      role="region"
      aria-label={language === "ar" ? "نقاط السيادة" : "Sovereignty Score"}
    >
      <div className="flex items-start gap-6">
        {/* Score Display */}
        <div className="flex flex-col items-center">
          <span className="text-5xl font-bold text-nexus-gold">{displayScore}</span>
          <span className="text-xl font-semibold text-nexus-gold mt-1">{displayGrade}</span>
          
          {/* Vault Heartbeat */}
          <div className="mt-4 relative">
            <div className="w-6 h-6 rounded-full bg-nexus-gold/20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-nexus-gold motion-safe:animate-pulse-sovereignty" />
            </div>
          </div>
        </div>

        {/* Factors */}
        {!compact && (
          <div className="flex-1 space-y-3">
            {Object.entries(displayFactors).map(([key, value]) => {
              const factorKey = key as keyof typeof factorLabels
              const label = language === "ar" ? factorLabels[factorKey].ar : factorLabels[factorKey].en
              const needsWarning = value < 75

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      {label}
                      {needsWarning && (
                        <AlertCircle className="w-3.5 h-3.5 text-emotion-excited" aria-hidden="true" />
                      )}
                    </span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nexus-gold rounded-full transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Action Link */}
      {!compact && (
        <Link
          href="/sovereignty"
          className="mt-4 inline-flex text-sm text-nexus-jade hover:text-nexus-jade-hover transition-colors"
        >
          {language === "ar"
            ? "تفعيل نسخ المفتاح الاحتياطي للوصول إلى 92 ←"
            : "Enable hardware key backup to reach 92 →"}
        </Link>
      )}
    </div>
  )
}
