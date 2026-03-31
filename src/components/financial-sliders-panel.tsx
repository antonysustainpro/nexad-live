"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { SlidersHorizontal, X, RotateCcw, TrendingUp, TrendingDown } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface SliderConfig {
  id: string
  labelEn: string
  labelAr: string
  min: number
  max: number
  default: number
  step: number
  format: "percent" | "currency" | "years" | "number"
}

interface FinancialSlidersPanelProps {
  isOpen: boolean
  onClose: () => void
  onGenerateScenario?: (assumptions: Record<string, number>) => void
  sliders?: SliderConfig[]
  baseMetrics?: {
    irr: number
    npv: number
    payback: number
    cashOnCash: number
  }
}

const defaultSliders: SliderConfig[] = [
  { id: "occupancy", labelEn: "Occupancy Rate", labelAr: "معدل الإشغال", min: 60, max: 100, default: 85, step: 1, format: "percent" },
  { id: "rentGrowth", labelEn: "Annual Rent Growth", labelAr: "نمو الإيجار السنوي", min: -5, max: 15, default: 5, step: 0.5, format: "percent" },
  { id: "exitCap", labelEn: "Exit Cap Rate", labelAr: "معدل رأس المال عند الخروج", min: 4, max: 12, default: 7, step: 0.25, format: "percent" },
  { id: "financingRate", labelEn: "Financing Rate", labelAr: "معدل التمويل", min: 2, max: 10, default: 5.5, step: 0.25, format: "percent" },
  { id: "costVariance", labelEn: "Construction Cost Variance", labelAr: "تباين تكلفة البناء", min: -20, max: 30, default: 0, step: 1, format: "percent" },
]

const defaultBaseMetrics = {
  irr: 16.2,
  npv: 10.5,
  payback: 4.8,
  cashOnCash: 8.3,
}

export function FinancialSlidersPanel({
  isOpen,
  onClose,
  onGenerateScenario,
  sliders = defaultSliders,
  baseMetrics = defaultBaseMetrics,
}: FinancialSlidersPanelProps) {
  const { language, isRTL } = useNexus()
  const [values, setValues] = useState<Record<string, number>>(() => 
    Object.fromEntries(sliders.map(s => [s.id, s.default]))
  )
  const [showComparison, setShowComparison] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Close panel on Escape key
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener("keydown", handleEscapeKey)
    return () => document.removeEventListener("keydown", handleEscapeKey)
  }, [isOpen, handleEscapeKey])

  // Focus trap: keep Tab/Shift+Tab cycling within the dialog
  useEffect(() => {
    if (!isOpen) return

    // Store the element that had focus before the panel opened
    previouslyFocusedRef.current = document.activeElement as HTMLElement

    // Move focus into the panel
    const timer = setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length > 0) focusable[0].focus()
    }, 50)

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", handleTab)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", handleTab)
      // Restore focus to the element that was focused before the panel opened
      previouslyFocusedRef.current?.focus()
    }
  }, [isOpen])

  // Calculate scenario metrics based on slider adjustments
  const scenarioMetrics = useMemo(() => {
    // Simplified scenario calculation (in production, use actual financial models)
    const occupancyDelta = (values.occupancy - 85) / 100
    const rentDelta = (values.rentGrowth - 5) / 100
    const capDelta = (values.exitCap - 7) / 100
    const financingDelta = (values.financingRate - 5.5) / 100
    const costDelta = (values.costVariance) / 100

    const irrAdjustment = occupancyDelta * 2 + rentDelta * 3 - capDelta * 1.5 - financingDelta * 2 - costDelta * 1.5
    const npvAdjustment = occupancyDelta * 1.5 + rentDelta * 2 - capDelta * 2 - financingDelta * 1 - costDelta * 2
    const paybackAdjustment = -occupancyDelta * 0.5 - rentDelta * 0.3 + capDelta * 0.4 + financingDelta * 0.3 + costDelta * 0.6
    const cocAdjustment = occupancyDelta * 1.5 + rentDelta * 1 - financingDelta * 1.5

    return {
      irr: Math.max(0, baseMetrics.irr + irrAdjustment),
      npv: baseMetrics.npv + npvAdjustment,
      payback: Math.max(0.5, baseMetrics.payback + paybackAdjustment),
      cashOnCash: Math.max(0, baseMetrics.cashOnCash + cocAdjustment),
    }
  }, [values, baseMetrics])

  const deltas = useMemo(() => ({
    irr: scenarioMetrics.irr - baseMetrics.irr,
    npv: scenarioMetrics.npv - baseMetrics.npv,
    payback: scenarioMetrics.payback - baseMetrics.payback,
    cashOnCash: scenarioMetrics.cashOnCash - baseMetrics.cashOnCash,
  }), [scenarioMetrics, baseMetrics])

  const handleReset = () => {
    setValues(Object.fromEntries(sliders.map(s => [s.id, s.default])))
  }

  // SEC-BL-010: Cleaned up redundant replace logic — sign is already correct from ternary
  const formatValue = (value: number, format: SliderConfig["format"]) => {
    switch (format) {
      case "percent": return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
      case "currency": return `AED ${value.toFixed(1)}M`
      case "years": return `${value.toFixed(1)} yrs`
      default: return value.toFixed(1)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-end"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={language === "ar" ? "إعدادات المعلمات المالية" : "Financial Parameters Settings"}
          initial={{ x: isRTL ? -400 : 400 }}
          animate={{ x: 0 }}
          exit={{ x: isRTL ? -400 : 400 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className={cn(
            "h-full w-[400px] max-w-[90vw] overflow-y-auto",
            isRTL ? "border-e" : "border-s",
            "border-[rgba(255,255,255,0.08)]"
          )}
          style={{
            background: "rgba(15, 29, 50, 0.95)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)] sticky top-0 bg-inherit z-10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-white">
                  {language === "ar" ? "مستكشف السيناريوهات" : "What-If Scenario Explorer"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label={language === "ar" ? "إغلاق" : "Close"}
                className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <X className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8]">
              {language === "ar"
                ? "عدّل الافتراضات لرؤية كيف تتغير التوقعات"
                : "Adjust assumptions to see how projections change"
              }
            </p>
          </div>

          {/* Sliders */}
          <div className="p-4 space-y-5">
            {sliders.map(slider => (
              <SliderRow
                key={slider.id}
                config={slider}
                value={values[slider.id]}
                onChange={(v) => setValues(prev => ({ ...prev, [slider.id]: v }))}
                language={language}
              />
            ))}
          </div>

          {/* Results */}
          <div className="p-4 border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">
                {language === "ar" ? "النتائج المتوقعة" : "Projected Outcomes"}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8]">
                  {language === "ar" ? "مقارنة مع الأساس" : "Compare with base"}
                </span>
                <Switch
                  checked={showComparison}
                  onCheckedChange={setShowComparison}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label={language === "ar" ? "العائد الداخلي" : "IRR"}
                value={`${scenarioMetrics.irr.toFixed(1)}%`}
                delta={deltas.irr}
                baseValue={showComparison ? `${baseMetrics.irr.toFixed(1)}%` : undefined}
                language={language}
              />
              <MetricCard
                label={language === "ar" ? "صافي القيمة الحالية" : "NPV"}
                value={`AED ${scenarioMetrics.npv.toFixed(1)}M`}
                delta={deltas.npv}
                baseValue={showComparison ? `AED ${baseMetrics.npv.toFixed(1)}M` : undefined}
                language={language}
              />
              <MetricCard
                label={language === "ar" ? "فترة الاسترداد" : "Payback"}
                value={`${scenarioMetrics.payback.toFixed(1)} ${language === "ar" ? "سنة" : "years"}`}
                delta={-deltas.payback} // Negative is better for payback
                baseValue={showComparison ? `${baseMetrics.payback.toFixed(1)} yrs` : undefined}
                language={language}
                invertColors
              />
              <MetricCard
                label={language === "ar" ? "العائد النقدي" : "Cash-on-Cash"}
                value={`${scenarioMetrics.cashOnCash.toFixed(1)}%`}
                delta={deltas.cashOnCash}
                baseValue={showComparison ? `${baseMetrics.cashOnCash.toFixed(1)}%` : undefined}
                language={language}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[rgba(255,255,255,0.08)] space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={() => onGenerateScenario?.(values)}
                className="flex-1 bg-[#2563EB] hover:bg-[#2563EB]/90"
              >
                {language === "ar" ? "إنشاء تقرير السيناريو ($25)" : "Generate Full Scenario Report ($25)"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleReset}
                className="text-[#94A3B8]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-[10px] text-[#94A3B8] text-center">
              {language === "ar" 
                ? "هذا تقدير مُنشأ بالذكاء الاصطناعي. تحقق مع مستشارين ماليين مؤهلين."
                : "This is an AI-generated estimate. Verify with qualified financial advisors."
              }
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function SliderRow({
  config,
  value,
  onChange,
  language,
}: {
  config: SliderConfig
  value: number
  onChange: (value: number) => void
  language: string
}) {
  // SEC-BL-010: Fixed redundant identical ternary branches
  const formatDisplay = (v: number) => {
    if (config.format === "percent") {
      return `${v}%`
    }
    if (config.format === "currency") {
      return `AED ${v.toLocaleString()}`
    }
    if (config.format === "years") {
      return `${v} yrs`
    }
    return v.toString()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white">
          {language === "ar" ? config.labelAr : config.labelEn}
        </span>
        <span className="text-sm font-mono text-[#2563EB]">
          {formatDisplay(value)}
        </span>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(e) => {
          // SEC-BL-011: Clamp value to min/max to prevent boundary bypass
          const raw = parseFloat(e.target.value)
          const clamped = Math.min(config.max, Math.max(config.min, isNaN(raw) ? config.default : raw))
          onChange(clamped)
        }}
        aria-label={language === "ar" ? config.labelAr : config.labelEn}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2563EB 0%, #2563EB ${((value - config.min) / (config.max - config.min)) * 100}%, rgba(255,255,255,0.1) ${((value - config.min) / (config.max - config.min)) * 100}%, rgba(255,255,255,0.1) 100%)`
        }}
      />
      <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1">
        <span>{formatDisplay(config.min)}</span>
        <span>{formatDisplay(config.max)}</span>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  delta,
  baseValue,
  language,
  invertColors = false,
}: {
  label: string
  value: string
  delta: number
  baseValue?: string
  language: string
  invertColors?: boolean
}) {
  const isPositive = invertColors ? delta < 0 : delta > 0
  const isNegative = invertColors ? delta > 0 : delta < 0
  
  return (
    <div className="p-3 rounded-lg bg-[#0A1628] border border-[rgba(255,255,255,0.08)]">
      <span className="text-xs text-[#94A3B8]">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-lg font-semibold text-white">{value}</span>
        {Math.abs(delta) > 0.01 && (
          <span className={cn(
            "text-xs font-medium flex items-center",
            isPositive && "text-[#10B981]",
            isNegative && "text-[#EF4444]",
            !isPositive && !isNegative && "text-[#F59E0B]"
          )}>
            {isPositive ? <TrendingUp className="h-3 w-3 me-0.5" aria-hidden="true" /> : <TrendingDown className="h-3 w-3 me-0.5" aria-hidden="true" />}
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}
            {label.includes("%") || label.includes("IRR") || label.includes("Cash") ? "%" : ""}
          </span>
        )}
      </div>
      {baseValue && (
        <span className="text-[10px] text-[#94A3B8]">
          {language === "ar" ? "الأساس:" : "Base:"} {baseValue}
        </span>
      )}
    </div>
  )
}

// Trigger button for use in Pro reports
export function FinancialSlidersTrigger({ onClick }: { onClick: () => void }) {
  const { language } = useNexus()
  
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/10"
    >
      <SlidersHorizontal className="h-4 w-4 me-2" aria-hidden="true" />
      {language === "ar" ? "استكشف السيناريوهات" : "Explore Scenarios"}
    </Button>
  )
}
