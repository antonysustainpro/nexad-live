"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  Mic,
  FileText,
  Bell,
  Check,
  X,
  Sparkles,
  ChevronRight
} from "lucide-react"
import { cn, sanitizeParsedJson } from "@/lib/utils"
import Link from "next/link"

interface ChecklistItem {
  id: string
  titleEn: string
  titleAr: string
  descEn: string
  descAr: string
  icon: typeof MessageSquare
  href: string
  completed: boolean
}

const STORAGE_KEY = "nexus-onboarding-checklist"

export function OnboardingChecklist() {
  const { language, isRTL, preferences } = useNexus()
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: "chat",
      titleEn: "Send your first message",
      titleAr: "أرسل رسالتك الأولى",
      descEn: "Try the AI chat",
      descAr: "جرب المحادثة الذكية",
      icon: MessageSquare,
      href: "/chat",
      completed: false
    },
    {
      id: "voice",
      titleEn: "Try voice command",
      titleAr: "جرب الأمر الصوتي",
      descEn: "Speak to your assistant",
      descAr: "تحدث إلى مساعدك",
      icon: Mic,
      href: "/voice",
      completed: false
    },
    {
      id: "vault",
      titleEn: "Save a document",
      titleAr: "احفظ مستنداً",
      descEn: "Secure your files",
      descAr: "أمّن ملفاتك",
      icon: FileText,
      href: "/vault",
      completed: false
    },
    {
      id: "butler",
      titleEn: "Create a reminder",
      titleAr: "أنشئ تذكيراً",
      descEn: "Set up Butler",
      descAr: "أعد مساعدك الشخصي",
      icon: Bell,
      href: "/butler",
      completed: false
    }
  ])

  // Load from storage
  useEffect(() => {
    // Only show if user completed onboarding
    if (!preferences?.butlerOnboarded) {
      setIsVisible(false)
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        // SEC-UI-116: Sanitize parsed JSON to prevent prototype pollution
        const data = sanitizeParsedJson(JSON.parse(stored))
        if (data.dismissed) {
          setIsVisible(false)
          return
        }
        setItems(prev => prev.map(item => ({
          ...item,
          completed: data.completed?.includes(item.id) || false
        })))
      }
    } catch {
      // SEC: Corrupted localStorage data - use defaults rather than crashing
    }
    setIsVisible(true)
  }, [preferences?.butlerOnboarded])

  // Save to storage
  const saveProgress = (completedIds: string[], dismissed = false) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completed: completedIds,
      dismissed
    }))
  }

  const markComplete = (id: string) => {
    setItems(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, completed: true } : item
      )
      const completedIds = updated.filter(i => i.completed).map(i => i.id)
      saveProgress(completedIds)
      return updated
    })
  }

  const dismiss = () => {
    saveProgress(items.filter(i => i.completed).map(i => i.id), true)
    setIsVisible(false)
  }

  const completedCount = items.filter(i => i.completed).length
  const progress = (completedCount / items.length) * 100

  if (!isVisible) return null

  // All completed - show celebration then hide
  if (completedCount === items.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-nexus-jade to-emerald-500 rounded-2xl p-4 shadow-xl text-black max-w-xs"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">
              {language === "ar" ? "رائع! أنت جاهز!" : "Amazing! You're all set!"}
            </p>
            <p className="text-sm opacity-80">
              {language === "ar" ? "استمتع بـ NexusAd" : "Enjoy NexusAd"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 text-black/50 hover:text-black hover:bg-white/20"
          onClick={dismiss}
          aria-label={language === "ar" ? "إغلاق رسالة التهنئة" : "Dismiss celebration"}
        >
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={cn(
          "fixed bottom-4 z-50 bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden",
          "end-4",
          isMinimized ? "w-auto" : "w-80"
        )}
      >
        {/* Header */}
        <div className="relative p-4">
          <button
            type="button"
            className="w-full cursor-pointer text-start"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-expanded={!isMinimized}
            aria-label={isMinimized ? (language === "ar" ? "توسيع قائمة البدء" : "Expand getting started checklist") : (language === "ar" ? "تصغير قائمة البدء" : "Minimize getting started checklist")}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-nexus-jade/20 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-nexus-jade" />
              </div>
              {!isMinimized && (
                <div>
                  <p className="text-sm font-semibold text-white">
                    {language === "ar" ? "ابدأ هنا" : "Get Started"}
                  </p>
                  <p className="text-xs text-[#8E8E93]">
                    {completedCount}/{items.length} {language === "ar" ? "مكتمل" : "completed"}
                  </p>
                </div>
              )}
            </div>
          </button>
          {!isMinimized && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 end-4 h-6 w-6 p-0 text-[#8E8E93] hover:text-white"
              onClick={dismiss}
              aria-label={language === "ar" ? "إغلاق قائمة البدء" : "Dismiss getting started checklist"}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Progress bar */}
          {!isMinimized && (
            <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-nexus-jade rounded-full"
              />
            </div>
          )}
        </div>

        {/* Items */}
        {!isMinimized && (
          <div className="px-2 pb-2 space-y-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => markComplete(item.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all group",
                    item.completed
                      ? "bg-nexus-jade/10"
                      : "hover:bg-white/5"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    item.completed
                      ? "bg-nexus-jade text-black"
                      : "bg-white/10 text-[#8E8E93] group-hover:text-white"
                  )}>
                    {item.completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      item.completed ? "text-nexus-jade" : "text-white"
                    )}>
                      {language === "ar" ? item.titleAr : item.titleEn}
                    </p>
                    <p className="text-xs text-[#8E8E93] truncate">
                      {language === "ar" ? item.descAr : item.descEn}
                    </p>
                  </div>
                  {!item.completed && (
                    <ChevronRight className="h-4 w-4 text-[#8E8E93] group-hover:text-white transition-colors" />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
