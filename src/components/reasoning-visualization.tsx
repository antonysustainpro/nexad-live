"use client"

import { memo, useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { Brain, Sparkles, Shield, Globe, Zap, Lock, Search, FileSearch, Network, Pause, Play, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReasoningStep {
  id: string
  phase: "routing" | "retrieval" | "reasoning" | "security" | "generating"
  label: string
  labelAr: string
  icon: React.ReactNode
  duration: number
}

const REASONING_STEPS: ReasoningStep[] = [
  { id: "route", phase: "routing", label: "Domain Routing", labelAr: "توجيه المجال", icon: <Globe className="w-4 h-4" aria-hidden="true" />, duration: 400 },
  { id: "provider", phase: "routing", label: "Provider Selection", labelAr: "اختيار المزود", icon: <Network className="w-4 h-4" aria-hidden="true" />, duration: 300 },
  { id: "retrieve", phase: "retrieval", label: "RAG Search", labelAr: "بحث RAG", icon: <FileSearch className="w-4 h-4" aria-hidden="true" />, duration: 600 },
  { id: "context", phase: "retrieval", label: "Context Assembly", labelAr: "تجميع السياق", icon: <Search className="w-4 h-4" aria-hidden="true" />, duration: 400 },
  { id: "pii", phase: "security", label: "PII Scrubbing", labelAr: "إزالة البيانات الحساسة", icon: <Shield className="w-4 h-4" aria-hidden="true" />, duration: 300 },
  { id: "encrypt", phase: "security", label: "Sovereign Encryption", labelAr: "تشفير سيادي", icon: <Lock className="w-4 h-4" aria-hidden="true" />, duration: 500 },
  { id: "think", phase: "reasoning", label: "Deep Reasoning", labelAr: "تفكير عميق", icon: <Brain className="w-4 h-4" aria-hidden="true" />, duration: 1500 },
  { id: "generate", phase: "generating", label: "Response Generation", labelAr: "توليد الرد", icon: <Sparkles className="w-4 h-4" aria-hidden="true" />, duration: 800 },
]

interface ReasoningVisualizationProps {
  isActive: boolean
  className?: string
  language?: "en" | "ar"
  dir?: "ltr" | "rtl"
  provider?: string
  domain?: string
  variant?: "full" | "compact" | "inline"
  onSkip?: () => void
}

// Memoized step component for performance
const StepItem = memo(function StepItem({
  step,
  index,
  isCompleted,
  isCurrent,
  language,
  dir,
}: {
  step: ReasoningStep
  index: number
  isCompleted: boolean
  isCurrent: boolean
  language: "en" | "ar"
  dir: "ltr" | "rtl"
}) {
  return (
    <motion.div
      role="listitem"
      aria-current={isCurrent ? "step" : undefined}
      initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
      animate={{
        opacity: isCompleted || isCurrent ? 1 : 0.4,
        x: 0
      }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg transition-all",
        isCurrent && "bg-nexus-gold/10 border border-nexus-gold/30",
        isCompleted && "opacity-60"
      )}
    >
      <div className={cn(
        "p-1.5 rounded transition-colors",
        isCurrent ? "bg-nexus-gold/20 text-nexus-gold" :
        isCompleted ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"
      )}>
        {isCompleted ? <Zap className="w-4 h-4" aria-hidden="true" /> : step.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isCurrent && "text-nexus-gold"
        )}>
          {language === "ar" ? step.labelAr : step.label}
        </p>
      </div>

      {isCurrent && (
        <motion.div className="flex gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="w-1.5 h-1.5 rounded-full bg-nexus-gold"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.2 }}
            />
          ))}
        </motion.div>
      )}

      {isCompleted && (
        <span className="text-xs text-emerald-400">
          {language === "ar" ? "تم" : "done"}
        </span>
      )}
    </motion.div>
  )
})

export const ReasoningVisualization = memo(function ReasoningVisualization({
  isActive,
  className,
  language = "en",
  dir = language === "ar" ? "rtl" : "ltr",
  provider,
  domain,
  variant = "full",
  onSkip,
}: ReasoningVisualizationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // WCAG: Respect reduced motion preference
  const prefersReducedMotion = useReducedMotion()

  // Pause/resume handler
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev)
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      togglePause()
    } else if (e.key === "Escape" && onSkip) {
      onSkip()
    }
  }, [togglePause, onSkip])

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(0)
      setCompletedSteps(new Set())
      setElapsedMs(0)
      setIsPaused(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    if (isPaused) {
      pausedTimeRef.current = Date.now()
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    // Adjust start time if resuming from pause
    if (pausedTimeRef.current > 0) {
      startTimeRef.current += Date.now() - pausedTimeRef.current
      pausedTimeRef.current = 0
    } else if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now()
    }

    // Progress through steps
    let stepIndex = currentStep
    const progressSteps = () => {
      if (stepIndex < REASONING_STEPS.length && !isPaused) {
        const step = REASONING_STEPS[stepIndex]
        setCurrentStep(stepIndex)

        const timeout = setTimeout(() => {
          setCompletedSteps(prev => new Set([...prev, step.id]))
          stepIndex++
          if (stepIndex < REASONING_STEPS.length) {
            progressSteps()
          }
        }, prefersReducedMotion ? 100 : step.duration)

        return () => clearTimeout(timeout)
      }
    }
    progressSteps()

    // Timer
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive, isPaused, currentStep, prefersReducedMotion])

  if (!isActive) return null

  const formatTime = (ms: number) => (ms / 1000).toFixed(1) + "s"
  const currentPhase = REASONING_STEPS[currentStep]?.phase || "routing"

  // Text summary for accessibility
  const textSummary = REASONING_STEPS.map((step, i) => {
    const status = completedSteps.has(step.id) ? "completed" : i === currentStep ? "in progress" : "pending"
    return `${step.label}: ${status}`
  }).join(". ")

  if (variant === "inline") {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-label={language === "ar" ? "جاري التفكير" : "AI is reasoning"}
        dir={dir}
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
      >
        <motion.div
          animate={prefersReducedMotion ? {} : { rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Brain className="w-4 h-4 text-nexus-gold" aria-hidden="true" />
        </motion.div>
        <span>{language === "ar" ? REASONING_STEPS[currentStep]?.labelAr : REASONING_STEPS[currentStep]?.label}</span>
        <span className="text-xs opacity-60">{formatTime(elapsedMs)}</span>
        {/* Screen reader text */}
        <span className="sr-only">{textSummary}</span>
      </motion.div>
    )
  }

  if (variant === "compact") {
    return (
      <motion.div
        ref={containerRef}
        role="status"
        aria-live="polite"
        aria-label={language === "ar" ? "جاري معالجة الطلب" : "Processing your request"}
        dir={dir}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "rounded-lg bg-card/80 backdrop-blur-sm border border-nexus-gold/20 p-3 focus:outline-none focus:ring-2 focus:ring-nexus-gold/50",
          className
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <motion.div
              animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: isPaused ? 0 : Infinity }}
            >
              <Brain className="w-5 h-5 text-nexus-gold" aria-hidden="true" />
            </motion.div>
            <span className="text-sm font-medium">
              {language === "ar" ? "يفكر..." : "Reasoning..."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* WCAG 2.2.2: Pause button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePause}
              aria-pressed={isPaused}
              aria-label={isPaused
                ? (language === "ar" ? "متابعة التفكير" : "Resume animation")
                : (language === "ar" ? "إيقاف مؤقت" : "Pause animation")
              }
              className="h-6 w-6 p-0"
            >
              {isPaused ? <Play className="w-3 h-3" aria-hidden="true" /> : <Pause className="w-3 h-3" aria-hidden="true" />}
            </Button>
            <span className="text-xs text-muted-foreground font-mono">{formatTime(elapsedMs)}</span>
          </div>
        </div>

        {/* Progress bar with ARIA */}
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuenow={completedSteps.size}
          aria-valuemin={0}
          aria-valuemax={REASONING_STEPS.length}
          aria-label={`${completedSteps.size} of ${REASONING_STEPS.length} steps completed`}
        >
          {REASONING_STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                completedSteps.has(step.id) ? "bg-nexus-gold" :
                i === currentStep ? "bg-nexus-gold/50" : "bg-muted"
              )}
              initial={prefersReducedMotion ? {} : { scaleX: 0 }}
              animate={{ scaleX: completedSteps.has(step.id) || i === currentStep ? 1 : 0.3 }}
            />
          ))}
        </div>

        {/* Screen reader summary */}
        <span className="sr-only">{textSummary}</span>
      </motion.div>
    )
  }

  // Full variant
  return (
    <motion.div
      ref={containerRef}
      role="region"
      aria-label={language === "ar" ? "تصور التفكير العميق" : "Deep Reasoning Visualization"}
      dir={dir}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "rounded-xl bg-gradient-to-br from-card via-card to-card/80 border border-nexus-gold/20 p-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-nexus-gold/50",
        className
      )}
    >
      {/* Skip link for screen readers */}
      {onSkip && (
        <a
          href="#reasoning-summary"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:px-2 focus:py-1 focus:bg-card focus:rounded"
          onClick={(e) => { e.preventDefault(); onSkip() }}
        >
          {language === "ar" ? "تخطي الرسوم المتحركة" : "Skip animation"}
        </a>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={prefersReducedMotion || isPaused ? {} : {
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity }
            }}
            className="p-2 rounded-lg bg-nexus-gold/10"
          >
            <Brain className="w-6 h-6 text-nexus-gold" aria-hidden="true" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-sm">
              {language === "ar" ? "التفكير العميق" : "Deep Reasoning"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {provider && `${provider} | `}
              {domain && `${domain}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* WCAG 2.2.2: Pause/Play button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePause}
            aria-pressed={isPaused}
            aria-label={isPaused
              ? (language === "ar" ? "استئناف" : "Resume")
              : (language === "ar" ? "إيقاف مؤقت" : "Pause")
            }
            className="h-8 w-8 p-0"
          >
            {isPaused ? <Play className="w-4 h-4" aria-hidden="true" /> : <Pause className="w-4 h-4" aria-hidden="true" />}
          </Button>
          <div className="text-end">
            <span className="font-mono text-lg text-nexus-gold">{formatTime(elapsedMs)}</span>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "الوقت المنقضي" : "elapsed"}
            </p>
          </div>
        </div>
      </div>

      {/* Steps list with ARIA */}
      <div role="list" aria-label={language === "ar" ? "خطوات المعالجة" : "Processing steps"} className="space-y-2">
        {REASONING_STEPS.map((step, i) => (
          <StepItem
            key={step.id}
            step={step}
            index={i}
            isCompleted={completedSteps.has(step.id)}
            isCurrent={i === currentStep}
            language={language}
            dir={dir}
          />
        ))}
      </div>

      {/* Neural Network Animation - only if not reduced motion */}
      {!prefersReducedMotion && !isPaused && (
        <div className="mt-4 relative h-12 overflow-hidden rounded-lg bg-black/20" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full" style={{ transform: dir === "rtl" ? "scaleX(-1)" : undefined }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.line
                key={i}
                x1={`${10 + i * 20}%`}
                y1="10%"
                x2={`${20 + i * 15}%`}
                y2="90%"
                stroke="rgba(155, 122, 88, 0.3)"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: i * 0.2, repeat: Infinity, repeatType: "reverse" }}
              />
            ))}
            {[15, 35, 55, 75, 90].map((x, i) => (
              <motion.circle
                key={i}
                cx={`${x}%`}
                cy="50%"
                r="4"
                fill="#9B7A58"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, delay: i * 0.15, repeat: Infinity }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 bg-gradient-to-r from-card via-transparent to-card" />
        </div>
      )}

      {/* Summary toggle for accessibility */}
      <div id="reasoning-summary" className="mt-4 pt-3 border-t border-nexus-gold/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSummary(!showSummary)}
          aria-expanded={showSummary}
          className="w-full justify-between text-xs text-muted-foreground"
        >
          {language === "ar" ? "ملخص نصي" : "Text Summary"}
          <ChevronDown className={cn("w-4 h-4 transition-transform", showSummary && "rotate-180")} aria-hidden="true" />
        </Button>
        {showSummary && (
          <div className="mt-2 p-2 rounded bg-muted/50 text-xs space-y-1">
            {REASONING_STEPS.map((step, i) => {
              const status = completedSteps.has(step.id) ? "✓" : i === currentStep ? "⟳" : "○"
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <span>{status}</span>
                  <span>{language === "ar" ? step.labelAr : step.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
})

export default ReasoningVisualization
