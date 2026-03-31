"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Home, Search, MessageCircle, FileText, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const recentPages = [
  { href: "/chat", icon: MessageCircle, label: "Chat", labelAr: "المحادثة" },
  { href: "/vault", icon: FileText, label: "Vault", labelAr: "الخزنة" },
  { href: "/settings", icon: Settings, label: "Settings", labelAr: "الإعدادات" },
]

export default function NotFound() {
  const { language, isRTL } = useNexus()
  const [searchQuery, setSearchQuery] = useState("")
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  return (
    <main
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Animated background - respects reduced motion */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {prefersReducedMotion ? (
          <>
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-nexus-jade/5 to-transparent rounded-full blur-3xl" />
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-nexus-gold/5 to-transparent rounded-full blur-3xl" />
          </>
        ) : (
          <>
            <motion.div
              animate={{
                x: [0, 100, 0],
                y: [0, -50, 0],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-nexus-jade/5 to-transparent rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                x: [0, -100, 0],
                y: [0, 50, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-nexus-gold/5 to-transparent rounded-full blur-3xl"
            />
          </>
        )}
      </div>

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Glitch 404 */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.5, type: "spring" }}
          className="relative mb-8"
        >
          <h1
            className="text-[80px] sm:text-[120px] md:text-[150px] font-bold leading-none text-foreground/90"
          >
            404
          </h1>

          {/* Floating robot illustration - decorative */}
          <div
            className="absolute -top-4 -right-4"
            aria-hidden="true"
          >
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-nexus-jade" role="img" aria-hidden="true">
              <circle cx="40" cy="30" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="34" cy="26" r="3" fill="currentColor" />
              <circle cx="46" cy="26" r="3" fill="currentColor" />
              <path d="M32 34 Q40 40 48 34" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="35" y="50" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M25 55 L35 55" stroke="currentColor" strokeWidth="2" />
              <path d="M45 55 L55 55" stroke="currentColor" strokeWidth="2" />
              <circle cx="22" cy="55" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="58" cy="55" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
        >
          <h2 className="text-title-1 mb-2">
            {language === "ar" ? "الصفحة غير موجودة" : "Page Not Found"}
          </h2>
          <p className="text-muted-foreground mb-8">
            {language === "ar"
              ? "يبدو أن هذه الصفحة قد تاهت في الفضاء الرقمي"
              : "Looks like this page got lost in the digital void"}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { delay: 0.3 }}
          className="mb-8"
        >
          <form
            onSubmit={(e) => { e.preventDefault(); /* handle search */ }}
            className="relative max-w-md mx-auto"
            role="search"
            aria-label={language === "ar" ? "البحث في الموقع" : "Site search"}
          >
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
              isRTL ? "right-4" : "left-4"
            )} aria-hidden="true" />
            <label htmlFor="not-found-search" className="sr-only">
              {language === "ar" ? "ابحث عما تريد" : "Search for what you need"}
            </label>
            <Input
              id="not-found-search"
              type="text"
              placeholder={language === "ar" ? "ابحث عما تريد..." : "Search for what you need..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "bg-secondary/50 border-white/10 focus:border-nexus-jade h-12",
                isRTL ? "pr-12" : "pl-12"
              )}
            />
          </form>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-8"
        >
          <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press">
            <Link href="/">
              <Home className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "العودة للرئيسية" : "Go Home"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 hover:bg-secondary/50 btn-press">
            <Link href="/chat">
              <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "تحدث معنا" : "Chat with Us"}
            </Link>
          </Button>
        </motion.div>

        {/* Recent pages */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-sm text-muted-foreground mb-4">
            {language === "ar" ? "أو جرب هذه الصفحات:" : "Or try these pages:"}
          </p>
          <div className="flex justify-center gap-4">
            {recentPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <page.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">
                  {language === "ar" ? page.labelAr : page.label}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  )
}
