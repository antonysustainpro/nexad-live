"use client"

import { useState } from "react"
import { motion, useMotionValue, useTransform, PanInfo } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  ExternalLink,
  Bookmark,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ButlerCard as ButlerCardType, ButlerCategory } from "@/lib/types"

interface ButlerCardProps {
  card: ButlerCardType
  onTap: (cardId: string) => void
  onDismiss: (cardId: string) => void
  onSave: (cardId: string) => void
  language: "en" | "ar" | "bilingual"
  isRTL: boolean
  index?: number
}

// Category color mappings - EXACT spec colors from Design Alignment Reference
// Colors are for LEFT EDGE border accent only - kept subtle and premium
const categoryColors: Record<ButlerCategory, { accent: string; border: string; bg: string }> = {
  deal: { accent: "#10B981", border: "border-[#10B981]/40", bg: "bg-[#10B981]/5" },           // green - money saved
  market: { accent: "#2563EB", border: "border-[#2563EB]/40", bg: "bg-[#2563EB]/5" },         // blue - intelligence
  crypto: { accent: "#2563EB", border: "border-[#2563EB]/40", bg: "bg-[#2563EB]/5" },         // blue - intelligence
  alert: { accent: "#EF4444", border: "border-[#EF4444]/40", bg: "bg-[#EF4444]/5" },          // red - urgent
  regulatory: { accent: "#EF4444", border: "border-[#EF4444]/40", bg: "bg-[#EF4444]/5" },     // red - urgent
  news: { accent: "#8E8E93", border: "border-[#8E8E93]/40", bg: "bg-[#8E8E93]/5" },           // neutral - informational
  event: { accent: "#D4A574", border: "border-[#D4A574]/40", bg: "bg-[#D4A574]/5" },          // warm gold - lifestyle
  entertainment: { accent: "#D4A574", border: "border-[#D4A574]/40", bg: "bg-[#D4A574]/5" }, // warm gold - lifestyle
  health: { accent: "#4CAF50", border: "border-[#4CAF50]/40", bg: "bg-[#4CAF50]/5" },         // green - wellness
  school: { accent: "#5B8DEF", border: "border-[#5B8DEF]/40", bg: "bg-[#5B8DEF]/5" },         // blue - learning
  education: { accent: "#5B8DEF", border: "border-[#5B8DEF]/40", bg: "bg-[#5B8DEF]/5" },      // blue - learning
  recipe: { accent: "#C6AD90", border: "border-[#C6AD90]/40", bg: "bg-[#C6AD90]/5" },         // sand - personal
  home: { accent: "#C6AD90", border: "border-[#C6AD90]/40", bg: "bg-[#C6AD90]/5" },           // sand - personal
  insight: { accent: "#2563EB", border: "border-[#2563EB]/40", bg: "bg-[#2563EB]/5" },        // blue - intelligence
  travel: { accent: "#8B7EC8", border: "border-[#8B7EC8]/40", bg: "bg-[#8B7EC8]/5" },         // purple - experience
  restaurants: { accent: "#C6AD90", border: "border-[#C6AD90]/40", bg: "bg-[#C6AD90]/5" },    // sand - food
  fitness: { accent: "#10B981", border: "border-[#10B981]/40", bg: "bg-[#10B981]/5" },        // green - sports
  tech: { accent: "#8E8E93", border: "border-[#8E8E93]/40", bg: "bg-[#8E8E93]/5" },           // slate - tech
  fashion: { accent: "#8B7EC8", border: "border-[#8B7EC8]/40", bg: "bg-[#8B7EC8]/5" },        // purple - style
  "real estate": { accent: "#2563EB", border: "border-[#2563EB]/40", bg: "bg-[#2563EB]/5" }, // blue - investment
  art: { accent: "#8B7EC8", border: "border-[#8B7EC8]/40", bg: "bg-[#8B7EC8]/5" },            // purple - creative
  sports: { accent: "#10B981", border: "border-[#10B981]/40", bg: "bg-[#10B981]/5" },         // green - fitness
  automotive: { accent: "#8E8E93", border: "border-[#8E8E93]/40", bg: "bg-[#8E8E93]/5" },     // slate - tech
  gaming: { accent: "#8B7EC8", border: "border-[#8B7EC8]/40", bg: "bg-[#8B7EC8]/5" },         // purple - entertainment
  pets: { accent: "#4CAF50", border: "border-[#4CAF50]/40", bg: "bg-[#4CAF50]/5" },           // sage - wellness
  gardening: { accent: "#4CAF50", border: "border-[#4CAF50]/40", bg: "bg-[#4CAF50]/5" },      // sage - wellness
  beauty: { accent: "#8B7EC8", border: "border-[#8B7EC8]/40", bg: "bg-[#8B7EC8]/5" },         // purple - style
  investment: { accent: "#2563EB", border: "border-[#2563EB]/40", bg: "bg-[#2563EB]/5" },     // blue - finance
}

// Category labels - all 28 categories
const categoryLabels: Record<ButlerCategory, { en: string; ar: string }> = {
  deal: { en: "Deal", ar: "عرض" },
  market: { en: "Market", ar: "السوق" },
  alert: { en: "Alert", ar: "تنبيه" },
  news: { en: "News", ar: "أخبار" },
  event: { en: "Event", ar: "فعالية" },
  entertainment: { en: "Entertainment", ar: "ترفيه" },
  health: { en: "Health", ar: "صحة" },
  school: { en: "School", ar: "مدرسة" },
  education: { en: "Education", ar: "تعليم" },
  recipe: { en: "Recipe", ar: "وصفة" },
  home: { en: "Home", ar: "منزل" },
  insight: { en: "Insight", ar: "رؤية" },
  regulatory: { en: "Regulatory", ar: "تنظيمي" },
  crypto: { en: "Crypto", ar: "عملات رقمية" },
  travel: { en: "Travel", ar: "سفر" },
  restaurants: { en: "Restaurant", ar: "مطعم" },
  fitness: { en: "Fitness", ar: "لياقة" },
  tech: { en: "Tech", ar: "تقنية" },
  fashion: { en: "Fashion", ar: "أزياء" },
  "real estate": { en: "Real Estate", ar: "عقارات" },
  art: { en: "Art", ar: "فن" },
  sports: { en: "Sports", ar: "رياضة" },
  automotive: { en: "Automotive", ar: "سيارات" },
  gaming: { en: "Gaming", ar: "ألعاب" },
  pets: { en: "Pets", ar: "حيوانات" },
  gardening: { en: "Gardening", ar: "حدائق" },
  beauty: { en: "Beauty", ar: "جمال" },
  investment: { en: "Investment", ar: "استثمار" },
}

export function ButlerCard({ card, onTap, onDismiss, onSave, language, isRTL, index = 0 }: ButlerCardProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0])
  const scale = useTransform(x, [-200, 0, 200], [0.8, 1, 0.8])
  const bgColor = useTransform(
    x,
    [-100, 0, 100],
    ["rgba(239, 68, 68, 0.1)", "rgba(0,0,0,0)", "rgba(16, 185, 129, 0.1)"]
  )

  const colors = categoryColors[card.category] || categoryColors.news
  const categoryLabel = categoryLabels[card.category] || categoryLabels.news

  const title = language === "ar" ? card.titleAr : card.title
  const summary = language === "ar" ? card.summaryAr : card.summary
  const affiliateText = language === "ar" ? card.affiliateDisclosureAr : card.affiliateDisclosure

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    
    if (diffMins < 60) {
      return language === "ar" ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`
    } else if (diffHours < 24) {
      return language === "ar" ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`
    } else {
      return date.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { month: "short", day: "numeric" })
    }
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -100) {
      setIsDismissed(true)
      setTimeout(() => onDismiss(card.id), 300)
    } else if (info.offset.x > 100) {
      setIsSaved(true)
      setTimeout(() => {
        setIsSaved(false)
        onSave(card.id)
      }, 500)
    }
  }

  if (isDismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -200 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{ x, opacity, scale }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleDragEnd}
      className="touch-pan-y"
    >
      <motion.div style={{ backgroundColor: bgColor }} className="rounded-2xl">
        <Card 
          className={cn(
            "relative overflow-hidden cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-lg",
            "bg-[#1C1C1E] border-[rgba(255,255,255,0.08)]",
            isSaved && "ring-2 ring-[#9B7A58]/50"
          )}
          style={{ borderLeftWidth: "4px", borderLeftColor: colors.accent }}
          onClick={() => onTap(card.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(card.id) } }}
          tabIndex={0}
          role="article"
          aria-label={title}
        >
          {/* Priority indicator */}
          {(card.priority === "urgent" || card.priority === "high") && (
            <motion.div
              className={cn(
                "absolute top-3 end-3 w-2.5 h-2.5 rounded-full",
                card.priority === "urgent" ? "bg-[#EF4444]" : "bg-[#9B7A58]"
              )}
              animate={card.priority === "urgent" ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}

          <CardContent className="p-4">
            {/* Header: Category + Timestamp */}
            <div className={cn("flex items-center justify-between mb-2", isRTL && "flex-row-reverse")}>
              <Badge variant="secondary" className={cn("text-xs font-medium text-[#F5F5F7]", colors.bg)} style={{ borderLeft: `2px solid ${colors.accent}` }}>
                {language === "ar" ? categoryLabel.ar : categoryLabel.en}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(card.timestamp)}
              </span>
            </div>

            {/* Title */}
            <h3 className={cn("font-semibold text-foreground mb-1 line-clamp-2", isRTL && "text-right")}>
              {title}
            </h3>

            {/* Summary */}
            <p className={cn("text-sm text-muted-foreground mb-3 line-clamp-2", isRTL && "text-right")}>
              {summary}
            </p>

            {/* Deal-specific content */}
            {card.category === "deal" && (card.priceOriginal || card.priceDiscounted) && (
              <div className={cn("flex items-center gap-2 mb-3", isRTL && "flex-row-reverse")}>
                {card.priceOriginal && (
                  <span className="text-sm text-muted-foreground line-through">{card.priceOriginal}</span>
                )}
                {card.priceDiscounted && (
                  <span className="text-lg font-bold text-[#10B981]">{card.priceDiscounted}</span>
                )}
                {card.rating && (
                  <div className="flex items-center gap-1 ms-auto">
                    <Star className="h-4 w-4 fill-[#D4A574] text-[#D4A574]" aria-hidden="true" />
                    <span className="text-sm font-medium">{card.rating}</span>
                  </div>
                )}
              </div>
            )}

            {/* Market-specific content */}
            {(card.category === "market" || card.category === "crypto") && card.marketData && (
              <div className={cn("flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/50", isRTL && "flex-row-reverse")}>
                <span className="font-mono font-semibold">{card.marketData.symbol}</span>
                <span className="font-medium">${card.marketData.price.toLocaleString()}</span>
                <div className={cn(
                  "flex items-center gap-1 ms-auto",
                  card.marketData.change >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                )}>
                  {card.marketData.change >= 0 ? (
                    <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="text-sm font-medium">
                    {card.marketData.change >= 0 ? "+" : ""}{card.marketData.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Alert-specific content */}
            {card.alertSeverity && (
              <div className={cn("flex items-center gap-2 mb-3", isRTL && "flex-row-reverse")}>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs",
                    card.alertSeverity === "critical" && "bg-[#EF4444]/10 text-[#EF4444] motion-safe:animate-pulse",
                    card.alertSeverity === "warning" && "bg-[#F59E0B]/10 text-[#F59E0B]",
                    card.alertSeverity === "info" && "bg-[#2563EB]/10 text-[#2563EB]"
                  )}
                >
                  {card.alertSeverity === "critical" && <AlertCircle className="h-3 w-3 me-1" aria-hidden="true" />}
                  {card.alertSeverity === "warning" && <AlertTriangle className="h-3 w-3 me-1" aria-hidden="true" />}
                  {card.alertSeverity === "info" && <Info className="h-3 w-3 me-1" aria-hidden="true" />}
                  {card.alertSeverity.charAt(0).toUpperCase() + card.alertSeverity.slice(1)}
                </Badge>
              </div>
            )}

            {/* Footer: Action + Source */}
            <div className={cn("flex items-center justify-between pt-2 border-t border-border/50", isRTL && "flex-row-reverse")}>
              {card.actionLabel ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 text-[#C6AD90] hover:text-[#D4C4A8]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTap(card.id)
                  }}
                >
                  {card.actionLabel}
                  {card.actionType === "external" && <ExternalLink className="h-3 w-3 ms-1" aria-hidden="true" />}
                </Button>
              ) : (
                <div />
              )}
              <span className="text-xs text-muted-foreground">{card.source}</span>
            </div>

            {/* Affiliate disclosure */}
            {affiliateText && (
              <p className="text-[10px] text-muted-foreground/60 mt-2 pt-2 border-t border-border/30">
                {affiliateText}
              </p>
            )}
          </CardContent>

          {/* Swipe indicators */}
          <motion.div
            className="absolute inset-y-0 start-0 w-12 flex items-center justify-center pointer-events-none"
            style={{ opacity: useTransform(x, [-100, -50, 0], [1, 0.5, 0]) }}
          >
            <X className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </motion.div>
          <motion.div
            className="absolute inset-y-0 end-0 w-12 flex items-center justify-center pointer-events-none"
            style={{ opacity: useTransform(x, [0, 50, 100], [0, 0.5, 1]) }}
          >
            <Bookmark className="h-6 w-6 text-[#9B7A58]" aria-hidden="true" />
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
