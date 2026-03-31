"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { language, setLanguage, isRTL } = useNexus()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  const motionProps = prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : undefined

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Animated background gradient - respects reduced motion */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className={`absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-nexus-jade/5 to-transparent rounded-full blur-3xl ${prefersReducedMotion ? "" : "animate-pulse-sovereignty"}`} />
        <div className={`absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-nexus-gold/5 to-transparent rounded-full blur-3xl ${prefersReducedMotion ? "" : "animate-pulse-sovereignty"}`} style={prefersReducedMotion ? undefined : { animationDelay: "416ms" }} />
      </div>

      {/* Language toggle */}
      <div className="absolute top-4 end-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="gap-2 text-muted-foreground hover:text-foreground"
          aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          {language === "ar" ? "English" : "العربية"}
        </Button>
      </div>

      <main className="flex flex-col items-center w-full z-10">
        {/* Logo */}
        <Link href="/" className="mb-8" aria-label="NexusAD Home">
          <motion.div
            {...(motionProps || { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 } })}
            transition={prefersReducedMotion ? undefined : { duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <div className="text-2xl font-bold tracking-tight">
              <span className="text-foreground">Nexus</span>
              <span className="text-nexus-gold">AD</span>
            </div>
          </motion.div>
        </Link>

        {/* Content */}
        <motion.div
          {...(motionProps || { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } })}
          transition={prefersReducedMotion ? undefined : { duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md"
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        {...(motionProps || { initial: { opacity: 0 }, animate: { opacity: 1 } })}
        transition={prefersReducedMotion ? undefined : { duration: 0.5, delay: 0.3 }}
        className="mt-8 text-center text-sm text-muted-foreground z-10"
      >
        <p>
          {language === "ar"
            ? "© 2026 NexusAD. جميع الحقوق محفوظة."
            : "© 2026 NexusAD. All rights reserved."}
        </p>
      </motion.footer>
    </div>
  )
}
