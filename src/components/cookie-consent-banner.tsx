"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Cookie, Shield, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { recordConsentServer } from "@/lib/api"
import Link from "next/link"

// Cookie consent categories
interface ConsentPreferences {
  essential: true // Always required, cannot be disabled
  analytics: boolean
  functional: boolean
}

const CONSENT_STORAGE_KEY = "nexusad-cookie-consent"
const CONSENT_VERSION = "1.0" // Bump when consent categories change

interface StoredConsent {
  version: string
  preferences: ConsentPreferences
  timestamp: string
  method: "accept-all" | "reject-all" | "custom"
}

function getStoredConsent(): StoredConsent | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as StoredConsent
    // Invalidate if consent version changed (re-consent required)
    if (parsed.version !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function storeConsent(preferences: ConsentPreferences, method: StoredConsent["method"]): void {
  try {
    const consent: StoredConsent = {
      version: CONSENT_VERSION,
      preferences,
      timestamp: new Date().toISOString(),
      method,
    }
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))

    // GDPR Art.7(1): Persist consent record server-side for auditable proof.
    // Fire-and-forget -- localStorage is the immediate gate, server is the audit trail.
    void recordConsentServer({
      preferences,
      method,
      version: CONSENT_VERSION,
    })
  } catch {
    // Storage unavailable (Safari private mode)
  }
}

/**
 * Check if analytics consent has been given.
 * Used by other components to gate analytics loading.
 */
export function hasAnalyticsConsent(): boolean {
  const consent = getStoredConsent()
  return consent?.preferences.analytics ?? false
}

export function CookieConsentBanner() {
  const { language, isRTL } = useNexus()
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    essential: true,
    analytics: false,
    functional: false,
  })

  useEffect(() => {
    // Only show if no valid consent exists
    const existing = getStoredConsent()
    if (!existing) {
      // Small delay to avoid layout shift on page load
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAcceptAll = useCallback(() => {
    const allAccepted: ConsentPreferences = {
      essential: true,
      analytics: true,
      functional: true,
    }
    storeConsent(allAccepted, "accept-all")
    setIsVisible(false)
    // Reload to apply analytics
    window.location.reload()
  }, [])

  const handleRejectAll = useCallback(() => {
    const essentialOnly: ConsentPreferences = {
      essential: true,
      analytics: false,
      functional: false,
    }
    storeConsent(essentialOnly, "reject-all")
    setIsVisible(false)
  }, [])

  const handleSaveCustom = useCallback(() => {
    storeConsent(preferences, "custom")
    setIsVisible(false)
    if (preferences.analytics) {
      window.location.reload()
    }
  }, [preferences])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-20 md:bottom-0 inset-x-0 z-[100] p-4 md:p-6"
        role="dialog"
        aria-label={language === "ar" ? "موافقة ملفات تعريف الارتباط" : "Cookie consent"}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* Main banner */}
          <div className="p-5">
            <div className={cn("flex items-start gap-4", isRTL && "flex-row-reverse")}>
              <div className="p-2 rounded-lg bg-nexus-gold/10 shrink-0">
                <Cookie className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground mb-1">
                  {language === "ar" ? "نحن نحترم خصوصيتك" : "We Respect Your Privacy"}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {language === "ar"
                    ? "نستخدم ملفات تعريف الارتباط الأساسية فقط لتشغيل الخدمة. ملفات تعريف الارتباط التحليلية اختيارية ويمكنك التحكم فيها."
                    : "We use essential cookies to operate our service. Analytics cookies are optional and you control them."}
                  {" "}
                  <Link href="/privacy-policy" className="text-nexus-jade hover:underline inline-flex items-center gap-1">
                    <Shield className="h-3 w-3" aria-hidden="true" />
                    {language === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
                  </Link>
                </p>
              </div>
            </div>

            {/* Expandable details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-3 transition-colors"
            >
              {showDetails
                ? (language === "ar" ? "إخفاء التفاصيل" : "Hide details")
                : (language === "ar" ? "تخصيص الإعدادات" : "Customize settings")}
              {showDetails ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4 border-t border-border mt-3">
                    {/* Essential cookies - always on */}
                    <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                      <div className={cn(isRTL && "text-right")}>
                        <Label className="font-medium">
                          {language === "ar" ? "ملفات تعريف ارتباط أساسية" : "Essential Cookies"}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {language === "ar"
                            ? "مطلوبة لتشغيل الخدمة (الجلسة، CSRF، اللغة)"
                            : "Required for service operation (session, CSRF, language)"}
                        </p>
                      </div>
                      <Switch checked disabled aria-label="Essential cookies (always enabled)" />
                    </div>

                    {/* Analytics cookies */}
                    <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                      <div className={cn(isRTL && "text-right")}>
                        <Label className="font-medium">
                          {language === "ar" ? "ملفات تعريف ارتباط تحليلية" : "Analytics Cookies"}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {language === "ar"
                            ? "تساعدنا على فهم كيفية استخدام الخدمة (Vercel Analytics)"
                            : "Help us understand how the service is used (Vercel Analytics)"}
                        </p>
                      </div>
                      <Switch
                        checked={preferences.analytics}
                        onCheckedChange={(checked) =>
                          setPreferences((p) => ({ ...p, analytics: checked }))
                        }
                        aria-label={language === "ar" ? "ملفات تعريف ارتباط تحليلية" : "Analytics cookies"}
                      />
                    </div>

                    {/* Functional cookies */}
                    <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                      <div className={cn(isRTL && "text-right")}>
                        <Label className="font-medium">
                          {language === "ar" ? "ملفات تعريف ارتباط وظيفية" : "Functional Cookies"}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {language === "ar"
                            ? "تحسين تجربتك (تذكر التفضيلات، السمة)"
                            : "Enhance your experience (remember preferences, theme)"}
                        </p>
                      </div>
                      <Switch
                        checked={preferences.functional}
                        onCheckedChange={(checked) =>
                          setPreferences((p) => ({ ...p, functional: checked }))
                        }
                        aria-label={language === "ar" ? "ملفات تعريف ارتباط وظيفية" : "Functional cookies"}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className={cn(
            "flex gap-2 p-4 pt-0",
            showDetails ? "flex-col sm:flex-row" : "flex-row",
            isRTL && "flex-row-reverse"
          )}>
            {showDetails ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="flex-1"
                >
                  {language === "ar" ? "رفض الكل" : "Reject All"}
                </Button>
                <Button
                  onClick={handleSaveCustom}
                  className="flex-1 bg-nexus-jade hover:bg-nexus-jade-hover text-background"
                >
                  {language === "ar" ? "حفظ التفضيلات" : "Save Preferences"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="flex-1"
                >
                  {language === "ar" ? "الأساسية فقط" : "Essential Only"}
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-nexus-jade hover:bg-nexus-jade-hover text-background"
                >
                  {language === "ar" ? "قبول الكل" : "Accept All"}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
