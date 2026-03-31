"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import {
  Shield,
  Brain,
  Zap,
  Search,
  GitMerge,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Scale,
  Sparkles,
  Users,
  Crown,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Progress } from "@/components/ui/progress"

export interface OrchestrationPhase {
  id: string
  phase: string
  message: string
  icon?: string
  providers?: string[]
  status?: "pending" | "active" | "complete" | "error"
  timestamp?: number
}

export interface AuditorResult {
  name: string
  provider: string
  model?: string
  score: number
  feedback?: string
  error?: boolean
}

export interface OrchestrationState {
  mode: "standard" | "fast" | "thinking" | "pro" | "document"
  phases: OrchestrationPhase[]
  currentPhase?: string
  auditors?: AuditorResult[]
  ceoApproved?: boolean
  ceoScore?: number
  ceoFeedback?: string
  iteration?: number
  maxIterations?: number
  shardCount?: number
  providers?: string[]
  totalTokens?: number
  elapsedMs?: number
}

interface OrchestrationPhasesProps {
  state: OrchestrationState
  isActive: boolean
  onClose?: () => void
}

const phaseIcons: Record<string, React.ElementType> = {
  init: Shield,
  brainstorm: Brain,
  enhance: Sparkles,
  search: Globe,
  search_done: CheckCircle,
  decompose: Brain,
  shards: Zap,
  shards_done: CheckCircle,
  cross_audit: Scale,
  cross_audit_done: CheckCircle,
  merge: GitMerge,
  audit: Users,
  ceo_gate: Crown,
  complete: CheckCircle,
  error: XCircle,
}

const phaseLabels: Record<string, { en: string; ar: string }> = {
  init: { en: "Initializing sovereign pipeline", ar: "جاري إعداد نظام السيادة..." },
  brainstorm: { en: "Analyzing your request", ar: "نحلل طلبك..." },
  enhance: { en: "Enhancing query", ar: "نحسّن صياغة السؤال..." },
  search: { en: "Searching the web", ar: "نبحث في الويب..." },
  search_done: { en: "Real-time data loaded", ar: "تم تحميل أحدث البيانات" },
  decompose: { en: "Breaking down into specialist tasks", ar: "نوزع المهمة على المختصين..." },
  shards: { en: "Consulting specialists", ar: "ننسق مع المختصين..." },
  shards_done: { en: "All specialists responded", ar: "وصلت ردود جميع المختصين" },
  cross_audit: { en: "Reviewing shard consistency", ar: "نراجع تناسق الردود..." },
  cross_audit_done: { en: "Consistency check complete", ar: "اكتملت مراجعة الجودة" },
  merge: { en: "Synthesizing intelligence", ar: "نجمع المعلومات في رد واحد..." },
  audit: { en: "Multi-auditor review", ar: "مراجعة نهائية بعدة مدققين..." },
  ceo_gate: { en: "Final CEO gate", ar: "المراجعة النهائية قبل الإجابة..." },
  complete: { en: "Report complete", ar: "اكتمل التقرير" },
  error: { en: "Pipeline error", ar: "حدث خطأ، يرجى المحاولة مجدداً" },
  // Default phases for thinking mode when backend sends generic/empty phase keys
  analyze: { en: "Analyzing your request", ar: "نحلل طلبك..." },
  consult: { en: "Consulting AI specialists", ar: "ننسق مع المختصين..." },
  cross_examine: { en: "Cross-examining responses", ar: "نراجع الردود..." },
  synthesize: { en: "Synthesizing final answer", ar: "نجمع الإجابة النهائية..." },
  // Default phases for fast mode
  fast_analyze: { en: "Analyzing your request", ar: "نحلل طلبك..." },
  fast_generate: { en: "Generating fast response", ar: "نُعد رداً سريعاً..." },
  fast_verify: { en: "Verifying answer", ar: "نتحقق من الإجابة..." },
}

// Positional fallback labels when phase key is missing or unrecognized
const defaultPhaseByIndex: Array<{ en: string; ar: string }> = [
  { en: "Analyzing your request", ar: "نحلل طلبك..." },
  { en: "Consulting AI specialists", ar: "ننسق مع المختصين..." },
  { en: "Cross-examining responses", ar: "نراجع الردود..." },
  { en: "Synthesizing final answer", ar: "نجمع الإجابة النهائية..." },
  { en: "Finalizing response", ar: "نُعد ردك النهائي..." },
  { en: "Quality review", ar: "مراجعة الجودة..." },
  { en: "Completing pipeline", ar: "اللمسات الأخيرة..." },
]

export function OrchestrationPhases({ state, isActive, onClose }: OrchestrationPhasesProps) {
  const { language, isRTL } = useNexus()
  const [expandedAuditors, setExpandedAuditors] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Announce phase changes to screen readers
  useEffect(() => {
    if (state.currentPhase && liveRegionRef.current) {
      const label = phaseLabels[state.currentPhase]
      const announcement = language === "ar" ? label?.ar : label?.en
      if (announcement) {
        liveRegionRef.current.textContent = announcement
      }
    }
  }, [state.currentPhase, language])

  // Focus close button when overlay opens for keyboard accessibility
  useEffect(() => {
    if (isActive && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [isActive])

  if (!isActive && state.phases.length === 0) return null

  const completedPhases = state.phases.filter(p => p.status === "complete").length
  const totalPhases = state.mode === "pro" ? 10 : state.mode === "thinking" ? 7 : 3
  const progress = Math.min((completedPhases / totalPhases) * 100, 100)

  // Animation variants respecting reduced motion preference
  const containerVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } }

  return (
    <motion.div
      initial={containerVariants.initial}
      animate={containerVariants.animate}
      exit={containerVariants.exit}
      dir={isRTL ? "rtl" : "ltr"}
      lang={language}
      role="status"
      aria-label={language === "ar" ? "حالة التنسيق" : "Orchestration status"}
      className={cn(
        "bg-card/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-lg",
        "max-w-md w-full mx-auto"
      )}
    >
      {/* Screen reader live region for phase announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between mb-3",
        isRTL && "flex-row-reverse"
      )}>
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            state.mode === "pro" && "bg-nexus-gold/20 text-nexus-gold",
            state.mode === "thinking" && "bg-blue-500/20 text-blue-500",
            state.mode === "fast" && "bg-yellow-500/20 text-yellow-500",
            state.mode === "standard" && "bg-nexus-jade/20 text-nexus-jade"
          )}>
            {state.mode.toUpperCase()}
          </span>
          {state.shardCount && (
            <span className="text-xs text-muted-foreground">
              {state.shardCount} {language === "ar" ? "خوادم" : "shards"}
            </span>
          )}
        </div>
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          {state.iteration && state.maxIterations && (
            <span className="text-xs text-muted-foreground">
              {language === "ar" ? `المحاولة ${state.iteration}/${state.maxIterations}` : `Iteration ${state.iteration}/${state.maxIterations}`}
            </span>
          )}
          {onClose && (
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-1 rounded-full hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-nexus-gold"
              aria-label={language === "ar" ? "إغلاق" : "Close"}
            >
              <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar - Premium sovereignty gradient */}
      <Progress value={progress} variant="sovereignty" className="h-1.5 mb-4" />

      {/* Phases List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {state.phases.map((phase, index) => {
            const Icon = phaseIcons[phase.phase] || Loader2
            // Resolve label with robust fallback chain:
            // 1. Known phaseLabels key match
            // 2. phase.message from backend (if non-empty)
            // 3. Positional fallback based on index
            // 4. Ultimate fallback "Processing..."
            const knownLabel = phase.phase ? phaseLabels[phase.phase] : undefined
            const messageLabel = phase.message ? { en: phase.message, ar: phase.message } : undefined
            const positionalLabel = defaultPhaseByIndex[index]
            const ultimateFallback = { en: "Processing...", ar: "جارٍ المعالجة..." }
            const label = knownLabel || messageLabel || positionalLabel || ultimateFallback
            const isActive = phase.status === "active"
            const isComplete = phase.status === "complete"
            const isError = phase.status === "error"

            // Phase animation variants respecting reduced motion
            const phaseVariants = prefersReducedMotion
              ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
              : { initial: { opacity: 0, x: isRTL ? 20 : -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: isRTL ? -20 : 20 } }

            return (
              <motion.div
                key={phase.id || `${phase.phase}-${index}`}
                initial={phaseVariants.initial}
                animate={phaseVariants.animate}
                exit={phaseVariants.exit}
                transition={prefersReducedMotion ? undefined : { delay: index * 0.05 }}
                className={cn(
                  "flex items-start gap-3 p-2 rounded-lg transition-colors",
                  isActive && "bg-nexus-gold/10",
                  isComplete && "opacity-60",
                  isError && "bg-red-500/10",
                  isRTL && "flex-row-reverse"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-full flex-shrink-0",
                  isActive && "bg-nexus-gold/20 motion-safe:animate-pulse",
                  isComplete && "bg-green-500/20",
                  isError && "bg-red-500/20"
                )}>
                  {isActive ? (
                    <Loader2 className="h-4 w-4 text-nexus-gold motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <Icon className={cn(
                      "h-4 w-4",
                      isComplete && "text-green-500",
                      isError && "text-red-500",
                      !isComplete && !isError && "text-muted-foreground"
                    )} aria-hidden="true" />
                  )}
                </div>
                <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                  <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <p className={cn(
                      "text-sm font-medium",
                      isActive && "text-nexus-gold"
                    )}>
                      {language === "ar" ? label.ar : label.en}
                    </p>
                    {isActive && (
                      <span className="text-xs text-nexus-gold/70 motion-safe:animate-pulse">
                        {language === "ar" ? "جارٍ..." : "Working..."}
                      </span>
                    )}
                  </div>
                  {phase.providers && phase.providers.length > 0 && (
                    <div className={cn(
                      "flex flex-wrap gap-1 mt-1",
                      isRTL && "justify-end"
                    )}>
                      {phase.providers.map((provider, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground"
                        >
                          {provider}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Auditors Panel (Pro Mode) */}
      {state.auditors && state.auditors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => setExpandedAuditors(!expandedAuditors)}
            aria-expanded={expandedAuditors}
            aria-controls="auditor-panel"
            className={cn(
              "flex items-center justify-between w-full text-sm font-medium mb-2",
              isRTL && "flex-row-reverse"
            )}
          >
            <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Users className="h-4 w-4" aria-hidden="true" />
              {language === "ar" ? "لجنة المدققين" : "Auditor Board"}
            </span>
            <span className="text-xs text-muted-foreground">
              {state.auditors.filter(a => a.score >= 9 && !a.error).length}/{state.auditors.length} {language === "ar" ? "اجتازوا" : "passed"}
            </span>
          </button>

          <AnimatePresence>
            {expandedAuditors && (
              <motion.div
                id="auditor-panel"
                initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
                role="region"
                aria-label={language === "ar" ? "تفاصيل المدققين" : "Auditor details"}
              >
                {state.auditors.map((auditor, i) => (
                  <div
                    key={auditor.name}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg bg-secondary/50",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      {auditor.score >= 9 && !auditor.error ? (
                        <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                      ) : auditor.error ? (
                        <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                      )}
                      <span className="text-sm">{auditor.name}</span>
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      auditor.score >= 9 ? "text-green-500" : auditor.score >= 7 ? "text-yellow-500" : "text-red-500"
                    )}>
                      {auditor.error ? "ERR" : `${auditor.score}/10`}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CEO Gate (Pro Mode) */}
      {state.ceoScore !== undefined && (
        <div className={cn(
          "mt-4 p-3 rounded-lg",
          state.ceoApproved ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
        )}>
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Crown className={cn(
                "h-5 w-5",
                state.ceoApproved ? "text-green-500" : "text-red-500"
              )} aria-hidden="true" />
              <span className="font-medium">
                {language === "ar" ? "البوابة النهائية للرئيس" : "CEO Final Gate"}
              </span>
            </div>
            <span className={cn(
              "text-lg font-bold",
              state.ceoApproved ? "text-green-500" : "text-red-500"
            )}>
              {state.ceoScore}/10
            </span>
          </div>
          {state.ceoFeedback && (
            <p className="text-xs text-muted-foreground mt-2">
              {state.ceoFeedback}
            </p>
          )}
        </div>
      )}

      {/* Stats Footer */}
      {(state.totalTokens || state.elapsedMs) && (
        <div className={cn(
          "mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground",
          isRTL && "flex-row-reverse"
        )}>
          {state.totalTokens && (
            <span>{state.totalTokens.toLocaleString()} {language === "ar" ? "كلمة معالجة" : "tokens"}</span>
          )}
          {state.elapsedMs && (
            <span>{(state.elapsedMs / 1000).toFixed(1)}s</span>
          )}
          {state.providers && (
            <span>{state.providers.length} {language === "ar" ? "مزودين" : "providers"}</span>
          )}
        </div>
      )}
    </motion.div>
  )
}
