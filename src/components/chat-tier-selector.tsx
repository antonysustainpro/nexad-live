"use client"

import { memo } from "react"
import { motion } from "motion/react"
import { MessageCircle, Mic, Video, Volume2, Zap, HeadphonesIcon, Check, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { type ChatTier, CHAT_TIER_CONFIGS } from "@/lib/types"

interface ChatTierSelectorProps {
  currentTier: ChatTier
  onSelectTier?: (tier: ChatTier) => void
  onUpgrade?: (tier: ChatTier) => void
  compact?: boolean
}

const tierIcons: Record<ChatTier, React.ElementType> = {
  basic: MessageCircle,
  pro: Mic,
  enterprise: Video,
}

const featureIcons: Record<string, React.ElementType> = {
  text_chat: MessageCircle,
  voice_input: Mic,
  voice_output: Volume2,
  video_call: Video,
  screen_share: Video,
  file_upload: MessageCircle,
  priority: Zap,
  dedicated: HeadphonesIcon,
  history: MessageCircle,
}

export const ChatTierSelector = memo(function ChatTierSelector({
  currentTier,
  onSelectTier,
  onUpgrade,
  compact = false,
}: ChatTierSelectorProps) {
  const { language, isRTL } = useNexus()

  const tiers: ChatTier[] = ["basic", "pro", "enterprise"]

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
        {tiers.map((tier) => {
          const config = CHAT_TIER_CONFIGS[tier]
          const Icon = tierIcons[tier]
          const isActive = currentTier === tier
          const isLocked = tiers.indexOf(tier) > tiers.indexOf(currentTier)

          return (
            <button
              key={tier}
              onClick={() => isLocked ? onUpgrade?.(tier) : onSelectTier?.(tier)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                isActive && "bg-nexus-jade/20 text-nexus-jade",
                !isActive && !isLocked && "bg-secondary hover:bg-secondary/80",
                isLocked && "bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80"
              )}
            >
              {isLocked ? (
                <Lock className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Icon className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{language === "ar" ? config.nameAr : config.name}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTier"
                  className="absolute inset-0 rounded-full border-2 border-nexus-jade"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-3", isRTL && "direction-rtl")}>
      {tiers.map((tier, index) => {
        const config = CHAT_TIER_CONFIGS[tier]
        const Icon = tierIcons[tier]
        const isActive = currentTier === tier
        const isLocked = tiers.indexOf(tier) > tiers.indexOf(currentTier)

        return (
          <motion.div
            key={tier}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                "relative overflow-hidden transition-all cursor-pointer",
                isActive && "ring-2 ring-nexus-jade",
                !isActive && "hover:border-nexus-jade/50",
                tier === "enterprise" && "border-nexus-gold/30"
              )}
              onClick={() => isLocked ? onUpgrade?.(tier) : onSelectTier?.(tier)}
            >
              {/* Premium badge for enterprise */}
              {tier === "enterprise" && (
                <div className="absolute top-0 end-0 px-3 py-1 bg-nexus-gold text-black text-[10px] font-bold rounded-es-lg">
                  {language === "ar" ? "مميز" : "PREMIUM"}
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-xl",
                      tier === "basic" && "bg-muted",
                      tier === "pro" && "bg-nexus-jade/10",
                      tier === "enterprise" && "bg-nexus-gold/10"
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "h-5 w-5",
                        tier === "basic" && "text-muted-foreground",
                        tier === "pro" && "text-nexus-jade",
                        tier === "enterprise" && "text-nexus-gold"
                      )}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {language === "ar" ? config.nameAr : config.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {language === "ar" ? config.descriptionAr : config.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Pricing */}
                <div className="mb-4">
                  {config.pricing.monthly === 0 ? (
                    <span className="text-2xl font-bold">
                      {language === "ar" ? "مجاني" : "Free"}
                    </span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">${config.pricing.monthly}</span>
                      <span className="text-sm text-muted-foreground">
                        /{language === "ar" ? "شهر" : "mo"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-4">
                  {config.features.slice(0, 5).map((feature) => {
                    const FeatureIcon = featureIcons[feature.id] || MessageCircle
                    return (
                      <li key={feature.id} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-nexus-jade flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {language === "ar" ? feature.nameAr : feature.name}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* Limits */}
                <div className="space-y-1 text-xs text-muted-foreground border-t pt-3">
                  <div className="flex justify-between">
                    <span>{language === "ar" ? "الرسائل/يوم" : "Messages/day"}</span>
                    <span className="font-medium text-foreground">
                      {config.limits.messagesPerDay === "unlimited"
                        ? (language === "ar" ? "غير محدود" : "Unlimited")
                        : config.limits.messagesPerDay.toLocaleString()
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === "ar" ? "دقائق الصوت/شهر" : "Voice min/mo"}</span>
                    <span className="font-medium text-foreground">
                      {config.limits.voiceMinutesPerMonth || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === "ar" ? "حجم الملف الأقصى" : "Max file size"}</span>
                    <span className="font-medium text-foreground">
                      {config.limits.maxFileSizeMb}MB
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-4">
                  {isActive ? (
                    <Badge
                      variant="secondary"
                      className="w-full justify-center py-2 bg-nexus-jade/10 text-nexus-jade"
                    >
                      {language === "ar" ? "الخطة الحالية" : "Current Plan"}
                    </Badge>
                  ) : isLocked ? (
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full",
                        tier === "enterprise" && "border-nexus-gold text-nexus-gold hover:bg-nexus-gold/10"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onUpgrade?.(tier)
                      }}
                    >
                      <Lock className="h-4 w-4 me-2" aria-hidden="true" />
                      {language === "ar" ? "ترقية" : "Upgrade"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectTier?.(tier)
                      }}
                    >
                      {language === "ar" ? "اختيار" : "Select"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
})

// Compact tier badge for showing current tier
export const ChatTierBadge = memo(function ChatTierBadge({
  tier,
  showLabel = true,
}: {
  tier: ChatTier
  showLabel?: boolean
}) {
  const { language } = useNexus()
  const config = CHAT_TIER_CONFIGS[tier]
  const Icon = tierIcons[tier]

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1",
        tier === "basic" && "bg-muted text-muted-foreground",
        tier === "pro" && "bg-nexus-jade/10 text-nexus-jade",
        tier === "enterprise" && "bg-nexus-gold/10 text-nexus-gold"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {showLabel && (
        <span className="text-xs">
          {language === "ar" ? config.nameAr : config.name}
        </span>
      )}
    </Badge>
  )
})
