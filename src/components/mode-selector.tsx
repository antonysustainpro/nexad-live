"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Zap, Brain, Crown, ChevronDown, Sparkles, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type IntelligenceMode = "standard" | "fast" | "thinking" | "pro" | "document"

interface ModeSelectorProps {
  mode: IntelligenceMode
  onModeChange: (mode: IntelligenceMode) => void
  disabled?: boolean
}

const modeConfig: Record<IntelligenceMode, {
  icon: React.ElementType
  label: string
  labelAr: string
  description: string
  descriptionAr: string
  color: string
  features: string[]
  featuresAr: string[]
}> = {
  standard: {
    icon: Sparkles,
    label: "Standard",
    labelAr: "عادي",
    description: "Balanced AI for everyday questions",
    descriptionAr: "ذكاء متوازن للأسئلة اليومية",
    color: "text-nexus-jade",
    features: ["Smart routing", "13 providers", "Privacy-first", "End-to-end encrypted"],
    featuresAr: ["توجيه ذكي", "13 مزوداً", "الخصوصية أولاً", "تشفير كامل"],
  },
  fast: {
    icon: Zap,
    label: "Fast",
    labelAr: "سريع",
    description: "Cerebras + Grok ultrafast debate",
    descriptionAr: "نقاش فائق السرعة مع Cerebras و Grok",
    color: "text-yellow-500",
    features: ["Cerebras Llama-4", "Groq", "Sovereign synthesis", "Privacy-first"],
    featuresAr: ["Cerebras Llama-4", "Groq", "تجميع سيادي", "الخصوصية أولاً"],
  },
  thinking: {
    icon: Brain,
    label: "Thinking",
    labelAr: "تفكير",
    description: "Board of Directors debate with auditing",
    descriptionAr: "نقاش مجلس الإدارة مع التدقيق",
    color: "text-blue-500",
    features: ["4 specialists", "Cross-examination", "Audit trail", "Sovereign gate"],
    featuresAr: ["4 متخصصين", "فحص متقاطع", "سجل التدقيق", "بوابة سيادية"],
  },
  pro: {
    icon: Crown,
    label: "Pro",
    labelAr: "برو",
    description: "Comprehensive documents & deep analysis",
    descriptionAr: "مستندات شاملة وتحليل عميق",
    color: "text-nexus-gold",
    features: ["10-page reports", "O3 strategic brain", "Section specialists", "Export PDF/DOCX"],
    featuresAr: ["تقارير 10 صفحات", "عقل O3 الاستراتيجي", "متخصصون بالأقسام", "تصدير PDF/DOCX"],
  },
  document: {
    icon: FileText,
    label: "Document",
    labelAr: "مستند",
    description: "McKinsey-grade document generation",
    descriptionAr: "توليد مستندات بمستوى ماكنزي",
    color: "text-purple-500",
    features: ["10-page reports", "O3 strategic brain", "Section specialists", "Export PDF/DOCX"],
    featuresAr: ["تقارير 10 صفحات", "عقل O3 الاستراتيجي", "متخصصون بالأقسام", "تصدير PDF/DOCX"],
  },
}

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  const { language, isRTL } = useNexus()
  const [open, setOpen] = useState(false)

  const currentMode = modeConfig[mode]
  const Icon = currentMode.icon

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={language === "ar" ? "اختيار وضع الذكاء" : "Select intelligence mode"}
          className={cn(
            "gap-2 border-border/50 bg-card/80 backdrop-blur-sm",
            currentMode.color,
            isRTL && "flex-row-reverse"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="font-medium">
            {language === "ar" ? currentMode.labelAr : currentMode.label}
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180"
          )} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRTL ? "end" : "start"}
        className="w-72 p-2"
      >
        <AnimatePresence>
          {(Object.keys(modeConfig) as IntelligenceMode[]).map((modeKey, index) => {
            const config = modeConfig[modeKey]
            const ModeIcon = config.icon
            const isSelected = mode === modeKey

            return (
              <motion.div
                key={modeKey}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <DropdownMenuItem
                  onClick={() => {
                    onModeChange(modeKey)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 cursor-pointer rounded-lg",
                    isSelected && "bg-secondary",
                    isRTL && "items-end text-right"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2 w-full",
                    isRTL && "flex-row-reverse"
                  )}>
                    <ModeIcon className={cn("h-4 w-4", config.color)} />
                    <span className="font-medium">
                      {language === "ar" ? config.labelAr : config.label}
                    </span>
                    {isSelected && (
                      <span className="ms-auto text-xs text-nexus-jade">
                        {language === "ar" ? "نشط" : "Active"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? config.descriptionAr : config.description}
                  </p>
                  <div className={cn(
                    "flex flex-wrap gap-1 mt-1",
                    isRTL && "justify-end"
                  )}>
                    {(language === "ar" ? config.featuresAr : config.features).map((feature, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </DropdownMenuItem>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Compact inline indicator for mobile
export function ModeIndicator({ mode }: { mode: IntelligenceMode }) {
  const { language } = useNexus()
  const config = modeConfig[mode]
  const Icon = config.icon

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      mode === "pro" && "bg-nexus-gold/20 text-nexus-gold",
      mode === "document" && "bg-purple-500/20 text-purple-500",
      mode === "thinking" && "bg-blue-500/20 text-blue-500",
      mode === "fast" && "bg-yellow-500/20 text-yellow-500",
      mode === "standard" && "bg-nexus-jade/20 text-nexus-jade"
    )}>
      <Icon className="h-3 w-3" />
      <span>{language === "ar" ? config.labelAr : config.label}</span>
    </div>
  )
}
