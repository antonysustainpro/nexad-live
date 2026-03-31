"use client"

import { useState, useEffect } from "react"
import { Lock, Shield, Server, Key, MapPin, Cpu } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getSovereigntyStatus } from "@/lib/api"
import type { SovereigntyStatusResponse } from "@/lib/types"

// SEC-UI-117: Sanitize text from API responses before rendering to prevent XSS.
// Strips HTML tags, control characters, and limits length.
function sanitizeApiText(text: string | undefined | null, maxLen = 100): string {
  if (!text || typeof text !== "string") return ""
  return text
    .replace(/[<>'"&]/g, "") // Strip HTML-significant chars
    .replace(/[\x00-\x1f\x7f]/g, "") // Control characters
    .slice(0, maxLen)
    .trim()
}

export function SovereigntyRibbon() {
  const { language, isRTL } = useNexus()
  const [sovereigntyData, setSovereigntyData] = useState<SovereigntyStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSovereigntyStatus().then((data) => {
      if (cancelled) return
      if (data) setSovereigntyData(data)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // Build ribbon items only from verified API data — no hardcoded fallbacks
  // SEC-UI-117: All API-sourced strings are sanitized before rendering to prevent XSS
  const safeEncAlgo = sanitizeApiText(sovereigntyData?.encryption_algo, 30)
  const safeJurisdiction = sanitizeApiText(sovereigntyData?.jurisdiction, 50)
  const safeJurisdictionFlag = sanitizeApiText(sovereigntyData?.jurisdiction_flag, 4)
  // SEC-UI-117: Validate shard_count is a safe integer to prevent NaN/Infinity injection
  const safeShardCount = sovereigntyData && Number.isFinite(sovereigntyData.shard_count) && sovereigntyData.shard_count >= 0
    ? Math.floor(sovereigntyData.shard_count)
    : 0

  const dynamicRibbonItems = sovereigntyData ? [
    {
      id: "sovereign",
      icon: Lock,
      labelEn: "Sovereign",
      labelAr: "سيادي",
      tooltipEn: "Your data is encrypted and sharded across secure nodes",
      tooltipAr: "بياناتك مشفرة وموزعة عبر عقد آمنة",
      isGold: true,
    },
    {
      id: "encryption",
      icon: Shield,
      labelEn: safeEncAlgo,
      labelAr: safeEncAlgo,
      tooltipEn: `Military-grade ${safeEncAlgo} encryption`,
      tooltipAr: `تشفير عسكري ${safeEncAlgo}`,
    },
    {
      id: "shards",
      icon: Server,
      labelEn: `${safeShardCount} active`,
      labelAr: `${safeShardCount} نشط`,
      tooltipEn: `Your data is distributed across ${safeShardCount} encrypted shards`,
      tooltipAr: `بياناتك موزعة على ${safeShardCount} جزء مشفر`,
    },
    {
      id: "processing",
      icon: Cpu,
      labelEn: sovereigntyData.processing_mode === "local" ? "Local" : "Hybrid",
      labelAr: sovereigntyData.processing_mode === "local" ? "محلي" : "هجين",
      tooltipEn: "Processing mode for your data",
      tooltipAr: "وضع معالجة بياناتك",
    },
    {
      id: "key",
      icon: Key,
      labelEn: sovereigntyData.key_valid ? "Valid" : "Missing",
      labelAr: sovereigntyData.key_valid ? "صالح" : "مفقود",
      tooltipEn: sovereigntyData.key_valid ? "Your encryption key is valid and secure" : "Encryption key needs attention",
      tooltipAr: sovereigntyData.key_valid ? "مفتاح التشفير صالح وآمن" : "مفتاح التشفير يحتاج انتباه",
    },
    {
      id: "location",
      icon: MapPin,
      labelEn: `${safeJurisdictionFlag} ${safeJurisdiction}`,
      labelAr: `${safeJurisdictionFlag} ${safeJurisdiction}`,
      tooltipEn: `Data residency: ${safeJurisdiction}`,
      tooltipAr: `إقامة البيانات: ${safeJurisdiction}`,
      showFlag: false, // Flag is in the label
    },
  ] : []

  // On mobile, only show first 3 items
  const mobileItems = dynamicRibbonItems.slice(0, 3)
  
  // Hide ribbon completely when loading or no data - no empty bar
  if (loading || !sovereigntyData) {
    return null
  }

  return (
    <TooltipProvider>
      <div
        className="flex h-8 w-full bg-secondary border-b border-border items-center overflow-x-auto scrollbar-hide"
        role="status"
        aria-label={language === "ar" ? "شريط حالة السيادة" : "Sovereignty status ribbon"}
      >
        <div className={`flex items-center gap-0 px-4 ${isRTL ? "flex-row-reverse" : ""}`}>

          {/* Mobile: show first 3 items + count indicator */}
          <div className="flex md:hidden items-center gap-0">
            {mobileItems.map((item, index) => {
              const showDivider = index < mobileItems.length - 1
              const Icon = item.icon
              const label = language === "ar" ? item.labelAr : item.labelEn
              const tooltip = language === "ar" ? item.tooltipAr : item.tooltipEn

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-3 py-2 min-w-[44px] min-h-[44px] rounded-md text-subhead text-muted-foreground hover:bg-accent/50 transition-colors ${
                        isRTL ? "flex-row-reverse" : ""
                      }`}
                      aria-label={label}
                    >
                      {item.isGold ? (
                        <Icon
                          className="w-3.5 h-3.5 text-nexus-gold motion-safe:animate-pulse-sovereignty"
                          style={{ filter: "drop-shadow(0 0 4px rgba(155,122,88,0.4))" }}
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span className="whitespace-nowrap">
                        {item.showFlag && "🇦🇪 "}
                        {label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  {showDivider && (
                    <div className="w-px h-4 bg-border/40 mx-1" />
                  )}
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
            {dynamicRibbonItems.length > 3 && (
              <span className="px-2 text-xs text-muted-foreground">+{dynamicRibbonItems.length - 3}</span>
            )}
              </div>

              {/* Desktop: show all items */}
              <div className="hidden md:flex items-center gap-0">
            {dynamicRibbonItems.map((item, index) => {
              const showDivider = index < dynamicRibbonItems.length - 1
              const Icon = item.icon
              const label = language === "ar" ? item.labelAr : item.labelEn
              const tooltip = language === "ar" ? item.tooltipAr : item.tooltipEn

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-2 py-1 min-w-[44px] min-h-[44px] rounded-md text-subhead text-muted-foreground hover:bg-accent/50 transition-colors ${
                        isRTL ? "flex-row-reverse" : ""
                      }`}
                      aria-label={label}
                    >
                      {item.isGold ? (
                        <Icon
                          className="w-3.5 h-3.5 text-nexus-gold motion-safe:animate-pulse-sovereignty"
                          style={{ filter: "drop-shadow(0 0 4px rgba(155,122,88,0.4))" }}
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span className="whitespace-nowrap">
                        {item.showFlag && "🇦🇪 "}
                        {label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  {showDivider && (
                    <div className="w-px h-4 bg-border/40 mx-1" />
                  )}
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              )
              })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
