"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Sun, TrendingUp, TrendingDown, Minus, 
  Gavel, Lightbulb, X, Settings, ChevronRight,
  Crown
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface BriefingItem {
  id: string
  type: "market" | "regulatory" | "insight"
  title: string
  titleAr: string
  detail: string
  detailAr: string
  tag: string
  trend?: "up" | "down" | "neutral"
  actionable?: boolean
  prefilledQuery?: string
}

interface MorningBriefingCardProps {
  clientName?: string
  items?: BriefingItem[]
  cost?: number
  onDismiss?: () => void
  onDeepDive?: () => void
  onSettings?: () => void
  onItemClick?: (item: BriefingItem) => void
  hasProfile?: boolean
  onConfigureProfile?: () => void
}

// Empty default - briefing items loaded from API based on user's vault and preferences
const defaultItems: BriefingItem[] = []

export function MorningBriefingCard({
  clientName,
  items = defaultItems,
  cost = 0.08,
  onDismiss,
  onDeepDive,
  onSettings,
  onItemClick,
  hasProfile = true,
  onConfigureProfile,
}: MorningBriefingCardProps) {
  const { language, isRTL, preferences } = useNexus()
  const [isVisible, setIsVisible] = useState(true)
  const [currentDate] = useState(() => {
    const date = new Date()
    return date.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  })

  const displayName = clientName || preferences.name || (language === "ar" ? "المستخدم" : "User")
  const greeting = language === "ar" ? `صباح الخير، ${displayName}` : `Good morning, ${displayName}`

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  // Empty state if no profile or no briefing items
  if (!hasProfile || items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "w-full rounded-xl overflow-hidden mb-4",
          "border border-[rgba(255,255,255,0.08)]"
        )}
        style={{
          background: "rgba(15, 29, 50, 0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Top gradient border */}
        <div 
          className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, var(--nexus-jade), var(--nexus-pink))" }}
        />
        
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#0A1628] flex items-center justify-center mx-auto mb-3">
            <Sun className="h-6 w-6 text-[#D4A574]" aria-hidden="true" />
          </div>
          <p className="text-sm text-[#94A3B8] mb-4">
            {language === "ar" 
              ? "قم بإعداد ملفك الشخصي في الخزنة السيادية لتلقي إحاطات صباحية مخصصة"
              : "Set up your Sovereign Vault profile to receive personalized morning briefs"
            }
          </p>
          <Button
            onClick={onConfigureProfile}
            className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white"
          >
            {language === "ar" ? "إعداد الملف الشخصي" : "Configure Profile"}
            <ChevronRight className="h-4 w-4 ms-1" aria-hidden="true" />
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "w-full rounded-xl overflow-hidden mb-4",
        "border border-[rgba(255,255,255,0.08)]"
      )}
      style={{
        background: "rgba(15, 29, 50, 0.8)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Top gradient border */}
      <div 
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg, var(--nexus-jade), var(--nexus-pink))" }}
      />

      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A574] to-[#B8860B] flex items-center justify-center">
              <Crown className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{greeting}</h2>
              <p className="text-xs text-[#94A3B8]">
                {language === "ar" ? "إحاطتك الاستخباراتية اليومية" : "Your Daily Intelligence Brief"} • {currentDate}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            aria-label={language === "ar" ? "إغلاق" : "Dismiss"}
          >
            <X className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Briefing Items */}
      <div className="px-4 pb-3 space-y-2">
        {items.map((item) => (
          <BriefingItemCard 
            key={item.id} 
            item={item} 
            language={language}
            onClick={() => onItemClick?.(item)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <span className="text-[10px] text-[#94A3B8]">
          {language === "ar" 
            ? `مدعوم بالذكاء السريع • التكلفة: $${cost.toFixed(2)}`
            : `Powered by Fast Intelligence • Cost: $${cost.toFixed(2)}`
          }
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-[#94A3B8] hover:text-white text-xs h-7"
          >
            {language === "ar" ? "إغلاق" : "Dismiss"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeepDive}
            className="text-[#2563EB] hover:text-[#2563EB] hover:bg-[#2563EB]/10 text-xs h-7"
          >
            {language === "ar" ? "تحليل معمق" : "Deep Dive"}
            <ChevronRight className="h-3 w-3 ms-1" aria-hidden="true" />
          </Button>
          <button
            onClick={onSettings}
            className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            aria-label={language === "ar" ? "الإعدادات" : "Settings"}
          >
            <Settings className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function BriefingItemCard({
  item,
  language,
  onClick,
}: {
  item: BriefingItem
  language: string
  onClick?: () => void
}) {
  const getIcon = () => {
    switch (item.type) {
      case "market":
        if (item.trend === "up") return <TrendingUp className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
        if (item.trend === "down") return <TrendingDown className="h-4 w-4 text-[#EF4444]" aria-hidden="true" />
        return <Minus className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
      case "regulatory":
        return <Gavel className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
      case "insight":
        return <Lightbulb className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
      default:
        return null
    }
  }

  const getTagColor = () => {
    switch (item.type) {
      case "market": return "bg-[#2563EB]/20 text-[#2563EB]"
      case "regulatory": return "bg-[#F59E0B]/20 text-[#F59E0B]"
      case "insight": return "bg-[#10B981]/20 text-[#10B981]"
      default: return "bg-[#94A3B8]/20 text-[#94A3B8]"
    }
  }

  return (
    <motion.button
      onClick={item.actionable ? onClick : undefined}
      className={cn(
        "w-full p-3 rounded-lg text-start transition-all",
        "bg-[#0A1628] border border-[rgba(255,255,255,0.05)]",
        item.actionable && "cursor-pointer hover:border-[#2563EB]/50 hover:bg-[#0A1628]/80"
      )}
      whileHover={item.actionable ? { scale: 1.01 } : {}}
      whileTap={item.actionable ? { scale: 0.99 } : {}}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white truncate">
              {language === "ar" ? item.titleAr : item.title}
            </span>
            <Badge className={cn("text-[10px] h-5", getTagColor())}>
              {item.tag}
            </Badge>
          </div>
          <p className="text-xs text-[#94A3B8] line-clamp-2">
            {language === "ar" ? item.detailAr : item.detail}
          </p>
        </div>
        {item.actionable && (
          <ChevronRight className="h-4 w-4 text-[#94A3B8] flex-shrink-0 mt-1" aria-hidden="true" />
        )}
      </div>
    </motion.button>
  )
}
