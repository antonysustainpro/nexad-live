"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { TrendingUp, Clock, Brain, ChevronLeft, ChevronRight, MessageCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useNexus } from "@/contexts/nexus-context"
import { getDailyBriefing } from "@/lib/api"
import type { BriefingResponse } from "@/lib/types"

// Icon map for dynamic briefing items from API
const ICON_MAP: Record<string, typeof TrendingUp> = {
  TrendingUp,
  Clock,
  Brain,
}

interface BriefingItem {
  id: string
  icon: typeof TrendingUp | string
  title: string
  titleAr: string
  summary: string
  summaryAr: string
  detail: string
  detailAr: string
  prompt: string
}


function AmbientIntro({ onComplete, displayItems }: { onComplete: () => void; displayItems: BriefingItem[] }) {
  const { language } = useNexus()
  const [showCards, setShowCards] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const hasItems = displayItems.length > 0

  const introText = language === "ar"
    ? (hasItems ? "ثلاثة أمور تحتاج انتباهك." : "لا توجد إحاطات بعد.")
    : (hasItems ? "Three things require your attention." : "No briefings yet.")

  const words = introText.split(" ")

  useEffect(() => {
    const cardTimer = setTimeout(() => setShowCards(true), 1500)
    const linkTimer = setTimeout(() => setShowLink(true), hasItems ? 4500 : 2500)
    return () => {
      clearTimeout(cardTimer)
      clearTimeout(linkTimer)
    }
  }, [hasItems])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h1 className="text-3xl md:text-4xl font-light text-white">
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.15, duration: 0.3 }}
              className="inline-block mx-1"
            >
              {word}
            </motion.span>
          ))}
        </h1>
      </motion.div>

      <AnimatePresence>
        {showCards && (
          hasItems ? (
            <div className="flex flex-col md:flex-row gap-4 max-w-4xl w-full">
              {displayItems.map((item, i) => {
                const Icon = typeof item.icon === 'string' ? (ICON_MAP[item.icon] || TrendingUp) : item.icon
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.8, duration: 0.3, ease: "easeOut" }}
                    className="flex-1"
                  >
                    <div className="bg-white/[0.06] border border-white/[0.1] backdrop-blur-lg rounded-2xl p-6">
                      <Icon className="h-6 w-6 text-muted-foreground mb-3" aria-hidden="true" />
                      <h3 className="text-white font-medium mb-1">
                        {language === "ar" ? item.titleAr : item.title}
                      </h3>
                      <p className="text-white/60 text-sm">
                        {language === "ar" ? item.summaryAr : item.summary}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-white/50 text-base text-center max-w-sm"
            >
              {language === "ar"
                ? "لا توجد إحاطات بعد. ابدأ المحادثة لتوليد رؤى مخصصة."
                : "No briefings yet. Start chatting to generate personalized insights."}
            </motion.p>
          )
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mt-12"
          >
            <Button
              variant="link"
              onClick={onComplete}
              className="text-nexus-jade hover:text-nexus-jade-hover text-lg"
            >
              {language === "ar" ? "عرض الإحاطة الكاملة" : "View Full Briefing"}
              <ArrowRight className="h-4 w-4 ms-2" aria-hidden="true" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExpandedBriefing({
  displayItems,
  currentDate,
  onNavigateDay,
  isLoading,
}: {
  displayItems: BriefingItem[]
  currentDate: Date
  onNavigateDay: (direction: number) => void
  isLoading: boolean
}) {
  const { language } = useNexus()

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const navigateDay = (direction: number) => {
    onNavigateDay(direction)
  }

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
          {language === "ar" ? "العودة للوحة التحكم" : "Back to Dashboard"}
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">
            {language === "ar" ? "الإحاطة اليومية" : "Daily Briefing"}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDay(-1)}
              className="h-8 w-8"
              disabled={isLoading}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[180px] text-center">
              {isLoading ? "..." : formatDate(currentDate)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDay(1)}
              className="h-8 w-8"
              disabled={isLoading || currentDate.toDateString() === new Date().toDateString()}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className={`space-y-6 transition-opacity duration-200 ${isLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          {displayItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <MessageCircle className="h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-muted-foreground text-base">
                {language === "ar"
                  ? "لا توجد إحاطات بعد. ابدأ المحادثة لتوليد رؤى مخصصة."
                  : "No briefings yet. Start chatting to generate personalized insights."}
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center mt-6 text-nexus-jade hover:text-nexus-jade-hover transition-colors text-sm font-medium"
              >
                <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
                {language === "ar" ? "ابدأ المحادثة" : "Start a conversation"}
                <ArrowRight className="h-3 w-3 ms-1" aria-hidden="true" />
              </Link>
            </motion.div>
          ) : (
            displayItems.map((item, i) => {
              const Icon = typeof item.icon === 'string' ? (ICON_MAP[item.icon] || TrendingUp) : item.icon
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="p-6 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-secondary/50">
                        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium mb-2">
                          {language === "ar" ? item.titleAr : item.title}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {language === "ar" ? item.detailAr : item.detail}
                        </p>
                        <Link
                          href={`/chat?prompt=${encodeURIComponent(item.prompt)}`}
                          className="inline-flex items-center text-nexus-jade hover:text-nexus-jade-hover transition-colors text-sm font-medium"
                        >
                          <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
                          {language === "ar" ? "ناقش مع NexusAD Ai" : "Discuss with NexusAD Ai"}
                          <ArrowRight className="h-3 w-3 ms-1" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function BriefingPage() {
  const [showExpanded, setShowExpanded] = useState(false)
  const [briefingData, setBriefingData] = useState<BriefingResponse | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isBriefingLoading, setIsBriefingLoading] = useState(false)

  // Format date as YYYY-MM-DD for the API
  const toDateParam = (date: Date) =>
    date.toISOString().split("T")[0]

  // Track whether this is the initial mount so the date-change effect skips it
  const isFirstRender = useRef(true)

  // Initial load uses no date param (backend returns today's briefing by default)
  useEffect(() => {
    getDailyBriefing().then(data => { if (data) setBriefingData(data) })
  }, [])

  // Re-fetch whenever currentDate changes (skip on first render — handled above)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const controller = new AbortController()
    setIsBriefingLoading(true)
    getDailyBriefing(toDateParam(currentDate), controller.signal).then(data => {
      if (data) setBriefingData(data)
      setIsBriefingLoading(false)
    })
    return () => {
      controller.abort()
      setIsBriefingLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate])

  const handleNavigateDay = (direction: number) => {
    setCurrentDate(prev => {
      const next = new Date(prev)
      next.setDate(next.getDate() + direction)
      return next
    })
  }

  // Only show real briefings from API; empty array until data arrives
  const displayItems: BriefingItem[] = briefingData?.items ?? []

  if (!showExpanded) {
    return <AmbientIntro onComplete={() => setShowExpanded(true)} displayItems={displayItems} />
  }

  return (
    <ExpandedBriefing
      displayItems={displayItems}
      currentDate={currentDate}
      onNavigateDay={handleNavigateDay}
      isLoading={isBriefingLoading}
    />
  )
}
