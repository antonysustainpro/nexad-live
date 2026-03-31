"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { memo, useCallback, useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "motion/react"
import { Home, MessageCircle, Mic, Lock, MoreHorizontal, Compass, Shield, Crown, User, Settings, X, Bell, CreditCard, Users, Gift, HelpCircle, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from "@/components/ui/sheet"

const iconMap = {
  Home,
  MessageCircle,
  Mic,
  Lock,
  MoreHorizontal,
  Compass,
  Shield,
  Crown,
  User,
  Settings,
  Bell,
  CreditCard,
  Users,
  Gift,
  HelpCircle,
} as const

type IconName = keyof typeof iconMap

interface TabItem {
  path: string
  labelEn: string
  labelAr: string
  icon: IconName
  isGold?: boolean
}

const tabItems: TabItem[] = [
  { path: "/butler", labelEn: "Butler", labelAr: "الخادم", icon: "Crown", isGold: true },
  { path: "/", labelEn: "Dashboard", labelAr: "الرئيسية", icon: "Home" },
  { path: "/chat", labelEn: "Chat", labelAr: "المحادثة", icon: "MessageCircle" },
  { path: "/voice", labelEn: "Voice", labelAr: "الصوت", icon: "Mic" },
  { path: "/vault", labelEn: "Vault", labelAr: "الخزنة", icon: "Lock", isGold: true },
]

const moreItems: TabItem[] = [
  { path: "/domains", labelEn: "Domains", labelAr: "المجالات", icon: "Compass" },
  { path: "/notifications", labelEn: "Notifications", labelAr: "الإشعارات", icon: "Bell" },
  { path: "/billing", labelEn: "Billing", labelAr: "الفواتير", icon: "CreditCard" },
  { path: "/team", labelEn: "Team", labelAr: "الفريق", icon: "Users" },
  { path: "/referral", labelEn: "Referrals", labelAr: "الإحالات", icon: "Gift" },
  { path: "/profile", labelEn: "Profile", labelAr: "الملف الشخصي", icon: "User" },
  { path: "/help", labelEn: "Help", labelAr: "المساعدة", icon: "HelpCircle" },
  { path: "/settings", labelEn: "Settings", labelAr: "الإعدادات", icon: "Settings" },
]

// Memoized tab item component for performance
const TabItemComponent = memo(function TabItemComponent({
  item,
  isActive,
  language,
}: {
  item: TabItem
  isActive: boolean
  language: string
}) {
  const Icon = iconMap[item.icon]
  const label = language === "ar" ? item.labelAr : item.labelEn
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <Link
      href={item.path}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 py-2 transition-all",
        "active:scale-95 touch-manipulation",
        isActive ? (item.isGold ? "text-nexus-gold" : "text-nexus-jade") : "text-muted-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Active indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className={cn(
              "absolute -top-0.5 w-8 h-1 rounded-full",
              item.isGold ? "bg-nexus-gold" : "bg-nexus-jade"
            )}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>

      {/* Icon with gold highlight for vault */}
      <motion.div
        whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {item.isGold ? (
          <div className="relative">
            <Icon
              className={cn(
                "h-6 w-6 transition-colors",
                isActive ? "text-nexus-gold" : "text-nexus-gold/60"
              )}
            />
            {/* Gold glow effect when active */}
            {isActive && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 -z-10 blur-md bg-nexus-gold/30"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                aria-hidden="true"
              />
            )}
            {isActive && prefersReducedMotion && (
              <div className="absolute inset-0 -z-10 blur-md bg-nexus-gold/30 opacity-45" aria-hidden="true" />
            )}
          </div>
        ) : (
          <Icon
            className={cn(
              "h-6 w-6 transition-colors",
              isActive ? "text-nexus-jade" : "text-muted-foreground"
            )}
          />
        )}
      </motion.div>

      <span
        className={cn(
          "text-[10px] font-medium transition-colors",
          isActive && !item.isGold && "text-nexus-jade",
          isActive && item.isGold && "text-nexus-gold"
        )}
      >
        {label}
      </span>
    </Link>
  )
})

// Memoized more item component
const MoreItemComponent = memo(function MoreItemComponent({
  item,
  isActive,
  language,
  index,
  onClose,
}: {
  item: TabItem
  isActive: boolean
  language: string
  index: number
  onClose: () => void
}) {
  const Icon = iconMap[item.icon]
  const label = language === "ar" ? item.labelAr : item.labelEn

  return (
    <motion.li
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        href={item.path}
        onClick={onClose}
        className={cn(
          "flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all",
          "active:scale-95 touch-manipulation",
          isActive
            ? "bg-nexus-jade/10 text-nexus-jade border border-nexus-jade/20"
            : "bg-secondary/50 hover:bg-secondary border border-transparent"
        )}
      >
        <div
          className={cn(
            "p-2 rounded-xl transition-colors",
            isActive ? "bg-nexus-jade/10" : "bg-background"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              isActive ? "text-nexus-jade" : "text-muted-foreground"
            )}
          />
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            isActive ? "text-nexus-jade" : "text-foreground"
          )}
        >
          {label}
        </span>
      </Link>
    </motion.li>
  )
})

// Swipe-up indicator for bottom sheet
const SwipeIndicator = memo(function SwipeIndicator() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <div className="absolute top-3 inset-x-0 flex justify-center" aria-hidden="true">
      {prefersReducedMotion ? (
        <div className="w-10 h-1 rounded-full bg-muted" />
      ) : (
        <motion.div
          className="w-10 h-1 rounded-full bg-muted"
          animate={{ scaleX: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
  )
})

export function MobileTabBar() {
  const pathname = usePathname()
  const { language, isRTL } = useNexus()
  const [sheetOpen, setSheetOpen] = useState(false)
  const containerRef = useRef<HTMLElement>(null)

  // Use container query-like behavior with resize observer
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Gesture handling for swipe up to open more menu
  const y = useMotionValue(0)
  const sheetProgress = useTransform(y, [-100, 0], [1, 0])

  const handlePan = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.y < -50 && info.velocity.y < -200) {
        setSheetOpen(true)
      }
    },
    []
  )

  // Memoize active check for more items
  const isMoreActive = useMemo(
    () => moreItems.some((item) => pathname === item.path || pathname.startsWith(item.path)),
    [pathname]
  )

  // Memoize close handler
  const handleClose = useCallback(() => setSheetOpen(false), [])

  // Don't show on welcome/onboarding or voice page
  if (pathname === "/welcome" || pathname === "/voice") {
    return null
  }

  // Compact mode for very small screens
  const isCompact = containerWidth > 0 && containerWidth < 360

  return (
    <>
      <motion.nav
        ref={containerRef}
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-md border-t border-border z-50",
          "safe-area-pb supports-[padding-bottom:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]"
        )}
        aria-label={language === "ar" ? "التنقل الرئيسي" : "Main navigation"}
        onPanEnd={handlePan}
        style={{ y }}
      >
        {/* Swipe up hint */}
        <motion.div
          className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ opacity: sheetProgress }}
        >
          <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
        </motion.div>

        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent opacity-50 pointer-events-none" />

        <ul
          className={cn(
            "relative flex items-center justify-around",
            isCompact ? "h-14" : "h-16",
            isRTL && "flex-row-reverse"
          )}
        >
          {tabItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path))

            return (
              <li key={item.path} className="flex-1">
                <TabItemComponent item={item} isActive={isActive} language={language} />
              </li>
            )
          })}

          {/* More Button */}
          <li className="flex-1">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 w-full py-2 transition-all",
                    "active:scale-95 touch-manipulation",
                    isMoreActive ? "text-nexus-jade" : "text-muted-foreground"
                  )}
                  aria-label={language === "ar" ? "المزيد" : "More"}
                >
                  {/* Active indicator for more items */}
                  {isMoreActive && (
                    <motion.div
                      className="absolute -top-0.5 w-8 h-1 rounded-full bg-nexus-jade"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <MoreHorizontal className="h-6 w-6" />
                  </motion.div>
                  <span className={cn("font-medium", isCompact ? "text-[9px]" : "text-[10px]")}>
                    {language === "ar" ? "المزيد" : "More"}
                  </span>
                </button>
              </SheetTrigger>

              <SheetContent
                side="bottom"
                className={cn(
                  "h-auto max-h-[70vh] rounded-t-3xl border-t-0",
                  "supports-[height:100dvh]:max-h-[70dvh]"
                )}
              >
                <SwipeIndicator />

                <SheetHeader className="flex flex-row items-center justify-between pt-4 pb-6">
                  <SheetTitle className="text-lg">
                    {language === "ar" ? "المزيد" : "More"}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    {language === "ar" ? "خيارات التنقل الإضافية" : "Additional navigation options"}
                  </SheetDescription>
                  <SheetClose asChild>
                    <button
                      className={cn(
                        "p-2 -me-2 rounded-full hover:bg-muted transition-colors",
                        "active:scale-95 touch-manipulation"
                      )}
                      aria-label="Close"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </SheetClose>
                </SheetHeader>

                <ul className="grid grid-cols-3 gap-3 pb-8 overflow-y-auto overscroll-contain">
                  {moreItems.map((item, index) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path)

                    return (
                      <MoreItemComponent
                        key={item.path}
                        item={item}
                        isActive={isActive}
                        language={language}
                        index={index}
                        onClose={handleClose}
                      />
                    )
                  })}
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </motion.nav>

      {/* Spacer for fixed tab bar with safe area */}
      <div className={cn("md:hidden", isCompact ? "h-14" : "h-16")} />
    </>
  )
}
