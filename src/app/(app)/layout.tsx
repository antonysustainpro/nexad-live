"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SovereigntyRibbon } from "@/components/sovereignty-ribbon"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"

// Pages that are immersive - no shell
const IMMERSIVE_PAGES = ["/voice", "/onboarding", "/login", "/welcome"]

// PERF: Replaced framer-motion AnimatePresence page transitions with lightweight
// CSS transitions. framer-motion was being loaded in 58+ files — removing it from
// the root layout eliminates a forced dependency on every page load. The 200ms
// fade-in is visually equivalent to the previous { opacity: 0→1, y: 8→0 } animation.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { isRTL, language } = useNexus()
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Trigger a brief CSS transition on route change
  useEffect(() => {
    setIsTransitioning(true)
    const timer = setTimeout(() => setIsTransitioning(false), 50)
    return () => clearTimeout(timer)
  }, [pathname])

  // Immersive pages have no shell
  if (IMMERSIVE_PAGES.includes(pathname)) {
    return <>{children}</>
  }

  return (
    <div className={cn("flex min-h-screen", isRTL && "flex-row-reverse")}>
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-nexus-jade focus:text-background focus:rounded-md"
      >
        {language === "ar" ? "تخطي إلى المحتوى" : "Skip to content"}
      </a>
      {/* Desktop Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Sovereignty Ribbon */}
        <SovereigntyRibbon />

        {/* Page Content with CSS-based transition (replaced framer-motion) */}
        <main id="main-content" className="flex-1 overflow-auto pt-4" role="main" aria-label="Main content">
          <div
            key={pathname}
            className={cn(
              "min-h-full transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            )}
          >
            {children}
          </div>
        </main>

        {/* Mobile Tab Bar */}
        <MobileTabBar />
      </div>

      {/* Post-onboarding checklist */}
      <OnboardingChecklist />
    </div>
  )
}
