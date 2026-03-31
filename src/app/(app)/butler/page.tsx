"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { ButlerCard } from "@/components/butler-card"
import { ButlerCardDetail } from "@/components/butler-card-detail"
import { PrivacyGlass } from "@/components/privacy-glass"
import { ButlerCardSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Crown, ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getButlerFeed, butlerInteract, triggerButlerRefresh } from "@/lib/api"
import type { ButlerCard as ButlerCardType } from "@/lib/types"
import Link from "next/link"

/** Get the authenticated user ID from the login-stored display info.
 *  Falls back to generating a random ID only when no authenticated user exists.
 *  SEC: Using the real user ID prevents cross-session data pollution where
 *  User A's random butler ID persists after logout and User B logs in. */
function getOrCreateUserId(): string {
  // First, try to use the real authenticated user ID
  try {
    const stored = localStorage.getItem("nexus-user-display")
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.id) return parsed.id
    }
  } catch {
    // Parse failed or storage unavailable
  }

  // Fallback: generate a random ID for unauthenticated/anonymous usage
  const STORAGE_KEY = "nexus-user-id"
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
  } catch {
    // storage unavailable
  }

  const id = "usr_" + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // storage unavailable
  }
  return id
}

// Time-aware greeting (reused pattern from dashboard)
function getGreeting(language: "en" | "ar" | "bilingual"): string {
  const hour = new Date().getHours()
  if (hour < 12) {
    return language === "ar" ? "صباح الخير" : "Good morning"
  } else if (hour < 18) {
    return language === "ar" ? "مساء الخير" : "Good afternoon"
  } else {
    return language === "ar" ? "مساء الخير" : "Good evening"
  }
}


export default function ButlerPage() {
  const { language, isRTL, preferences } = useNexus()
  const [cards, setCards] = useState<ButlerCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCard, setSelectedCard] = useState<ButlerCardType | null>(null)

  const userId = useMemo(() => {
    if (typeof window === "undefined") return "" // SSR placeholder, will be replaced on client
    return getOrCreateUserId()
  }, [])

  // Fetch data - skip if userId is empty (SSR)
  const fetchData = useCallback(async () => {
    if (!userId) return
    try {
      const feedData = await getButlerFeed(userId)

      if (feedData?.cards) {
        setCards(feedData.cards)
      } else {
        setCards([])
      }
    } catch {
      // Fallback to empty state on error
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 15 minutes
  // SEC: Include userId in deps to prevent stale closure using wrong user's ID
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(() => {
      triggerButlerRefresh(userId).then((data) => {
        if (data?.cards) setCards(data.cards)
      })
    }, 15 * 60 * 1000)

    return () => clearInterval(interval)
  }, [userId])

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await triggerButlerRefresh(userId)
      if (data?.cards) {
        setCards(data.cards)
      } else {
        await fetchData()
      }
    } catch {
      await fetchData()
    } finally {
      setRefreshing(false)
    }
  }

  // Handle card interactions
  const handleDismiss = async (cardId: string) => {
    await butlerInteract(cardId, "dismiss")
    setCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  const handleSave = async (cardId: string) => {
    await butlerInteract(cardId, "save")
  }

  const handleCardAction = (cardId: string, actionType: string) => {
    if (actionType === "dismiss") {
      handleDismiss(cardId)
    } else if (actionType === "save") {
      handleSave(cardId)
    }
  }

  const greeting = getGreeting(language)
  const name = preferences.name || (language === "ar" ? "صديقي" : "friend")

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Onboarding Banner */}
        {!preferences.butlerOnboarded && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[rgba(15,29,50,0.95)] border border-[rgba(255,255,255,0.08)] backdrop-blur-[12px] rounded-xl p-4"
          >
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="p-2 bg-[#D4A574]/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-[#D4A574]" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className={cn("font-medium text-foreground", isRTL && "text-right")}>
                  {language === "ar" ? "مرحباً! قم بإعداد خادمك" : "Welcome! Set up your Butler"}
                </p>
                <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>
                  {language === "ar" 
                    ? "خصص موجزك للحصول على المحتوى الأكثر صلة"
                    : "Personalize your feed to get the most relevant content"
                  }
                </p>
              </div>
              <Button asChild size="sm" className="bg-[#C6AD90] hover:bg-[#D4C4A8] text-background rounded-md">
                <Link href="/butler/onboarding">
                  {language === "ar" ? "ابدأ" : "Start"}
                  <ArrowRight className={cn("h-4 w-4 ms-1", isRTL && "rotate-180")} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Header with Greeting */}
        <div className={cn("space-y-2", isRTL && "text-right")}>
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Crown className="h-6 w-6 text-[#D4A574]" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {name}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? `وجد خادمك ${cards.length} عناصر لك.`
              : `Your Butler found ${cards.length} items for you.`
            }
          </p>
        </div>

        {/* Privacy Glass - Uses real session metrics from PrivacyMetricsContext */}
        <PrivacyGlass language={language} isRTL={isRTL} />

        {/* Persona Badge */}
        {preferences.butlerPersona && (
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "يُعرض كـ:" : "Showing as:"}
            </span>
            <Badge variant="secondary" className="capitalize">
              {preferences.butlerPersona}
            </Badge>
          </div>
        )}

        {/* Card Feed */}
        {loading ? (
          // Skeleton loading — uses shared ButlerCardSkeleton for consistency
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ButlerCardSkeleton key={i} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <div className="p-4 bg-[#D4A574]/10 rounded-full w-fit mx-auto mb-4">
              <Crown className="h-8 w-8 text-[#D4A574]" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {language === "ar" ? "خادمك يستعد" : "Your Butler is getting ready"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {language === "ar" 
                ? "أكمل الإعداد لتخصيص موجزك."
                : "Complete onboarding to personalize your feed."
              }
            </p>
            <Button asChild className="bg-[#C6AD90] hover:bg-[#D4C4A8] text-background rounded-md">
              <Link href="/butler/onboarding">
                {language === "ar" ? "إعداد الخادم" : "Set up Butler"}
              </Link>
            </Button>
          </div>
        ) : (
          // Card grid
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {cards.map((card, index) => (
                <ButlerCard
                  key={card.id}
                  card={card}
                  onTap={(id) => setSelectedCard(cards.find((c) => c.id === id) || null)}
                  onDismiss={handleDismiss}
                  onSave={handleSave}
                  language={language}
                  isRTL={isRTL}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Card Detail Sheet */}
        <ButlerCardDetail
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onAction={handleCardAction}
          language={language}
          isRTL={isRTL}
        />

        {/* Floating Refresh Button */}
        <motion.div
          className="fixed bottom-20 md:bottom-8 end-4 z-40"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="icon"
            className="h-12 w-12 rounded-full bg-[#C6AD90] hover:bg-[#D4C4A8] shadow-lg"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={language === "ar" ? "تحديث الموجز" : "Refresh feed"}
          >
            <RefreshCw className={cn("h-5 w-5 text-background", refreshing && "motion-safe:animate-spin")} aria-hidden="true" />
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
