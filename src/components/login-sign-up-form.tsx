"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Loader2, Shield, Check } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { LoginTierSelector } from "./login-tier-selector"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getCsrfToken } from "@/lib/csrf"
import { TIER_CONFIG, USD_TO_AED, type BillingTier } from "@/lib/billing-api"
import { auditAuth } from "@/lib/audit-logger"

interface LoginSignUpFormProps {
  onSwitchToSignIn: () => void
}

export function LoginSignUpForm({ onSwitchToSignIn }: LoginSignUpFormProps) {
  const router = useRouter()
  const { language, updatePreferences } = useNexus()
  const isRTL = language === "ar"
  const locale = language === "ar" ? "ar-AE" : "en-US"

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: User info
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")

  // Step 2: Tier selection
  const [selectedTier, setSelectedTier] = useState<BillingTier>("FREE")

  // Step 3: Confirmation
  const [termsAccepted, setTermsAccepted] = useState(false)

  // SEC-BL-009: Match backend email validation — format check + 254 char limit (RFC 5321)
  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254

  const canProceedStep1 = fullName.trim().length >= 2 && validateEmail(email)
  const canProceedStep3 = termsAccepted

  const handleNext = () => {
    if (step === 1 && !canProceedStep1) {
      setError(language === "ar" ? "الرجاء إدخال الاسم والبريد الإلكتروني" : "Please enter name and email")
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, 3))
  }

  const handleBack = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
    if (!canProceedStep3) {
      setError(language === "ar" ? "الرجاء الموافقة على الشروط" : "Please accept the terms")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // SEC-AUTH-007: Include CSRF token in register request.
      // Without this, the POST will be rejected by middleware CSRF validation.
      const csrfToken = getCsrfToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken

      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName,
          email,
          company: company || undefined,
          tier: selectedTier,
        }),
      }).catch(() => null)

      if (!response || !response.ok) {
        const message = response
          ? await response.text().catch(() => "")
          : ""
        setError(
          language === "ar"
            ? "فشل التسجيل، يرجى المحاولة مرة أخرى"
            : message || "Registration failed. Please try again."
        )
        // AUD-009: Log failed registration
        auditAuth("register.failed", { reason: "api_error", tier: selectedTier })
        setIsLoading(false)
        return
      }

      // AUD-009: Log successful registration
      auditAuth("register.success", { tier: selectedTier })

      // Save user info
      updatePreferences({ name: fullName })

      // Redirect to welcome page for key ceremony
      if (selectedTier === "PRO" || selectedTier === "ENTERPRISE") {
        // Store tier for post-ceremony redirect
        try {
          sessionStorage.setItem("nexusad-selected-tier", selectedTier)
        } catch {
          // Storage not available
        }
      }

      router.push("/welcome")
    } catch {
      setError(
        language === "ar"
          ? "خطأ في الاتصال، يرجى المحاولة مرة أخرى"
          : "Connection error, please try again"
      )
      // AUD-009: Log connection error during registration
      auditAuth("register.failed", { reason: "connection_error" })
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (usd: number) => {
    const aed = Math.round(usd * USD_TO_AED)
    return {
      usd: usd.toLocaleString(locale, { style: "currency", currency: "USD", minimumFractionDigits: 0 }),
      aed: aed.toLocaleString(locale, { style: "currency", currency: "AED", minimumFractionDigits: 0 }),
    }
  }

  const tierConfig = TIER_CONFIG[selectedTier]
  const price = formatPrice(tierConfig.priceUsdMonthly)

  const BackIcon = isRTL ? ArrowRight : ArrowLeft
  const NextIcon = isRTL ? ArrowLeft : ArrowRight

  return (
    <div className={cn("space-y-6", isRTL && "text-right")}>
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={language === "ar" ? `الخطوة ${step} من 3` : `Step ${step} of 3`}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            aria-hidden="true"
            className={cn(
              "h-2 rounded-full transition-all",
              s === step ? "w-8 bg-nexus-jade" : s < step ? "w-2 bg-nexus-jade/50" : "w-2 bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {language === "ar" ? `الخطوة ${step} من 3` : `Step ${step} of 3`}
      </p>

      {/* Step 1: User Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{language === "ar" ? "الاسم الكامل" : "Full name"}</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(null) }}
              placeholder={language === "ar" ? "اسمك الكامل" : "Your full name"}
              aria-label={language === "ar" ? "اسمك الكامل" : "Your full name"}
              className="h-12"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              placeholder="email@example.com"
              aria-label={language === "ar" ? "البريد الإلكتروني" : "Email address"}
              className="h-12"
              maxLength={254}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-muted-foreground">
              {language === "ar" ? "الشركة (اختياري)" : "Company (optional)"}
            </Label>
            <Input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={language === "ar" ? "الشركة أو مكتب العائلة" : "Company or family office"}
              aria-label={language === "ar" ? "الشركة أو مكتب العائلة" : "Company or family office"}
              className="h-12"
              maxLength={200}
            />
          </div>
        </div>
      )}

      {/* Step 2: Tier Selection */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">
            {language === "ar" ? "اختر خطتك" : "Choose Your Plan"}
          </h3>
          <LoginTierSelector selectedTier={selectedTier} onSelectTier={setSelectedTier} />
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">
            {language === "ar" ? "تأكيد الحساب" : "Confirm Your Account"}
          </h3>

          <Card className="bg-secondary/50">
            <CardContent className="p-4 space-y-3">
              <div className={cn("flex justify-between text-sm", isRTL && "flex-row-reverse")}>
                <span className="text-muted-foreground">{language === "ar" ? "الاسم" : "Name"}</span>
                <span className="font-medium">{fullName}</span>
              </div>
              <div className={cn("flex justify-between text-sm", isRTL && "flex-row-reverse")}>
                <span className="text-muted-foreground">{language === "ar" ? "البريد" : "Email"}</span>
                <span className="font-medium">{email}</span>
              </div>
              <div className={cn("flex justify-between text-sm", isRTL && "flex-row-reverse")}>
                <span className="text-muted-foreground">{language === "ar" ? "الخطة" : "Plan"}</span>
                <span className="font-medium">{selectedTier}</span>
              </div>
              <div className={cn("flex justify-between text-sm", isRTL && "flex-row-reverse")}>
                <span className="text-muted-foreground">{language === "ar" ? "السعر" : "Price"}</span>
                <span className="font-medium">
                  {tierConfig.priceUsdMonthly === 0 ? (language === "ar" ? "مجاني" : "Free") : `${price.usd}/mo`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Terms */}
          <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(c) => { setTermsAccepted(!!c); setError(null) }}
              aria-label={language === "ar" ? "الموافقة على الشروط" : "Accept terms"}
            />
            <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
              {language === "ar" ? (
                <>أوافق على <Link href="/terms" className="text-nexus-jade hover:underline">شروط الخدمة</Link> و<Link href="/privacy" className="text-nexus-jade hover:underline">سياسة الخصوصية</Link> من NexusAD</>
              ) : (
                <>I agree to NexusAD <Link href="/terms" className="text-nexus-jade hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-nexus-jade hover:underline">Privacy Policy</Link></>
              )}
            </Label>
          </div>

          {/* Fine print */}
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <Shield className="h-3 w-3" aria-hidden="true" />
            {language === "ar"
              ? "مفاتيح التشفير الخاصة بك يتم إنشاؤها محليًا. لن نرى مفتاحك الخاص أبدًا."
              : "Your encryption keys are generated locally. We never see your private key."}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive text-center" role="alert">
          {error}
        </p>
      )}

      {/* Navigation buttons */}
      <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-12"
            aria-label={language === "ar" ? "الرجوع" : "Go back"}
          >
            <BackIcon className="h-4 w-4 me-2" />
            {language === "ar" ? "الرجوع" : "Back"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onSwitchToSignIn}
            className="flex-1 h-12"
            aria-label={language === "ar" ? "تسجيل الدخول" : "Sign in"}
          >
            {language === "ar" ? "تسجيل الدخول" : "Sign In"}
          </Button>
        )}

        {step < 3 ? (
          <Button
            type="button"
            onClick={handleNext}
            className="flex-1 h-12 bg-nexus-jade hover:bg-nexus-jade-hover text-background"
            disabled={step === 1 && !canProceedStep1}
            aria-label={language === "ar" ? "التالي" : "Next"}
          >
            {language === "ar" ? "التالي" : "Next"}
            <NextIcon className="h-4 w-4 ms-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !canProceedStep3}
            className="flex-1 h-12 bg-nexus-jade hover:bg-nexus-jade-hover text-background"
            aria-label={language === "ar" ? "إنشاء مفتاحي السيادي" : "Generate my sovereign key"}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5 me-2" />
                {language === "ar" ? "إنشاء مفتاحي السيادي" : "Generate My Sovereign Key"}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
