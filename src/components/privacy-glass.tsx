"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Shield, ChevronDown, Check, Lock, Globe, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { usePrivacyMetrics, type FetchLogEntry } from "@/contexts/privacy-metrics-context"

interface PrivacyGlassProps {
  // Optional server-side stats to merge with session metrics
  serverStats?: {
    trackersBlocked?: number
    anonymousRequests?: number
  } | null
  language: "en" | "ar" | "bilingual"
  isRTL: boolean
}

/**
 * Privacy Glass - REAL metrics display
 *
 * Shows actual privacy actions taken during the session:
 * - PII items scrubbed: Real count from chat API metadata events
 * - Anonymous requests: Real count of API calls made through privacy proxy
 * - Auto-delete countdown: Real timer from session start
 *
 * No more fake animated counters or hardcoded values.
 */
export function PrivacyGlass({ serverStats, language, isRTL }: PrivacyGlassProps) {
  const [expanded, setExpanded] = useState(false)
  const [countdown, setCountdown] = useState("24:00")
  const { metrics, getAutoDeleteCountdown } = usePrivacyMetrics()

  // Update countdown every minute
  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(getAutoDeleteCountdown())
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [getAutoDeleteCountdown])

  // Combine session metrics with any server-provided stats
  const totalPiiScrubbed = metrics.piiItemsScrubbed
  const totalAnonymousRequests = metrics.anonymousRequests + (serverStats?.anonymousRequests || 0)
  const totalTrackersBlocked = metrics.trackersBlocked + (serverStats?.trackersBlocked || 0)

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(language === "ar" ? "ar-AE" : "en-US", {
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  // Show different state based on whether we have any privacy activity
  const hasActivity = totalPiiScrubbed > 0 || totalAnonymousRequests > 0 || totalTrackersBlocked > 0

  return (
    <motion.div
      className="bg-[rgba(15,29,50,0.95)] border border-[rgba(255,255,255,0.08)] backdrop-blur-[12px] rounded-xl overflow-hidden"
      layout
    >
      {/* Collapsed Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className={cn(
          "w-full p-4 flex items-center gap-3 transition-colors hover:bg-[rgba(198,173,144,0.05)]",
          isRTL && "flex-row-reverse"
        )}
      >
        {/* Shield with pulse animation when active */}
        <div className="relative">
          <Shield className="h-6 w-6 text-[#C6AD90]" aria-hidden="true" />
          {hasActivity && (
            <motion.div
              className="absolute inset-0 rounded-full bg-[#C6AD90]/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>

        {/* Stats summary */}
        <div className={cn("flex-1", "text-start")}>
          <div className="flex items-center gap-2 flex-wrap">
            {totalPiiScrubbed > 0 ? (
              <>
                <span className="text-sm font-medium text-[#10B981]">
                  {totalPiiScrubbed} {language === "ar" ? "بيانات شخصية محمية" : "PII items scrubbed"}
                </span>
                <span className="text-muted-foreground">|</span>
              </>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {totalAnonymousRequests} {language === "ar" ? "طلب مجهول" : "anonymous requests"}
            </span>
          </div>
          <p className="text-xs text-[#C6AD90]/70 mt-0.5">
            {hasActivity
              ? (language === "ar" ? "بياناتك محمية" : "Your data is protected")
              : (language === "ar" ? "جاهز لحماية بياناتك" : "Ready to protect your data")
            }
          </p>
        </div>

        {/* Expand/collapse icon */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* PII Scrubbed - REAL from session */}
                <div className="bg-card/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#10B981]">
                    {totalPiiScrubbed}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "بيانات محمية" : "PII Scrubbed"}
                  </p>
                </div>

                {/* Anonymous Requests - REAL from session */}
                <div className="bg-card/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#2563EB]">
                    {totalAnonymousRequests}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "طلبات مجهولة" : "Anonymous"}
                  </p>
                </div>

                {/* Cookies - Always 0 (we don't use tracking cookies) */}
                <div className="bg-card/50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl font-bold text-foreground">0</span>
                    <Check className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "ملفات تتبع" : "Tracking Cookies"}
                  </p>
                </div>

                {/* Encryption */}
                <div className="bg-card/50 rounded-xl p-3 text-center">
                  <Badge className="bg-[#10B981]/10 text-[#10B981] border-0">
                    <Lock className="h-3 w-3 me-1" aria-hidden="true" />
                    {language === "ar" ? "نشط" : "Active"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "التشفير" : "Encryption"}
                  </p>
                </div>

                {/* Auto-Delete Countdown - REAL timer */}
                <div className="bg-card/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-[#9B7A58]">{countdown}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "حذف تلقائي" : "Auto-Delete"}
                  </p>
                </div>
              </div>

              {/* Session Activity Log */}
              {metrics.fetchLog.length > 0 && (
                <div className="space-y-2">
                  <h4 className={cn("text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL && "text-right")}>
                    {language === "ar" ? "نشاط الجلسة الأخير" : "Recent Session Activity"}
                  </h4>
                  <div className="bg-card/30 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className={cn("p-2 text-muted-foreground font-medium", "text-start")}>
                            {language === "ar" ? "الإجراء" : "Action"}
                          </th>
                          <th className={cn("p-2 text-muted-foreground font-medium hidden sm:table-cell", "text-start")}>
                            {language === "ar" ? "الوقت" : "Time"}
                          </th>
                          <th className={cn("p-2 text-muted-foreground font-medium hidden md:table-cell", "text-start")}>
                            {language === "ar" ? "المنطقة" : "Region"}
                          </th>
                          <th className={cn("p-2 text-muted-foreground font-medium", "text-end")}>
                            {language === "ar" ? "الحالة" : "Status"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.fetchLog.slice(0, 5).map((entry: FetchLogEntry, index: number) => (
                          <tr key={index} className="border-b border-border/30 last:border-0">
                            <td className={cn("p-2 font-mono truncate max-w-[150px]", "text-start")}>
                              <div className="flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3 text-[#10B981]" aria-hidden="true" />
                                <span>{entry.url}</span>
                              </div>
                            </td>
                            <td className={cn("p-2 text-muted-foreground hidden sm:table-cell", "text-start")}>
                              {formatTimestamp(entry.timestamp)}
                            </td>
                            <td className={cn("p-2 hidden md:table-cell", "text-start")}>
                              <div className="flex items-center gap-1">
                                <Globe className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                                <span>{entry.proxyRegion}</span>
                              </div>
                            </td>
                            <td className={cn("p-2", "text-end")}>
                              <Badge variant="secondary" className="bg-[#10B981]/10 text-[#10B981] text-[10px]">
                                {entry.piiScrubbed && entry.piiScrubbed > 0
                                  ? `${entry.piiScrubbed} PII`
                                  : entry.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Empty state when no activity yet */}
              {metrics.fetchLog.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  {language === "ar"
                    ? "ابدأ محادثة لرؤية نشاط الخصوصية"
                    : "Start a conversation to see privacy activity"
                  }
                </div>
              )}

              {/* Tagline */}
              <p className={cn("text-xs text-[#C6AD90]/60 italic text-center pt-2 border-t border-[rgba(255,255,255,0.08)]")}>
                {language === "ar"
                  ? "بياناتك لا تصل أبداً إلى خادم يحمل اسمك"
                  : "Your data never touches a server with your name on it"
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
