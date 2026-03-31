"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, KeyRound, HelpCircle } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { getCsrfToken } from "@/lib/csrf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { auditAuth } from "@/lib/audit-logger"

interface LoginSignInFormProps {
  onSwitchToSignUp: () => void
}

export function LoginSignInForm({ onSwitchToSignUp }: LoginSignInFormProps) {
  const router = useRouter()
  const { language, updatePreferences } = useNexus()
  const isRTL = language === "ar"

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) {
      setError(language === "ar" ? "الرجاء إدخال مفتاح API" : "Please enter your API key")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const csrfToken = getCsrfToken()
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      }
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken
      const response = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers,
      }).catch(() => null)

      if (!response || !response.ok) {
        setError(language === "ar" ? "مفتاح API غير صالح" : "Invalid API key")
        // AUD-008: Log failed auth attempt
        auditAuth("login.failed", { reason: "invalid_api_key" })
        setIsLoading(false)
        return
      }

      // Session is managed via httpOnly cookie set by server
      // No client-side storage of API keys for security
      // AUD-008: Log successful login
      auditAuth("login.success")
      updatePreferences({ hasCompletedOnboarding: true })
      router.push("/")
    } catch {
      setError(
        language === "ar"
          ? "خطأ في الاتصال، يرجى المحاولة مرة أخرى"
          : "Connection error, please try again"
      )
      // AUD-008: Log connection-level auth failure
      auditAuth("login.failed", { reason: "connection_error" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", isRTL && "text-right")}>
      {/* API Key Input */}
      <div className="space-y-2">
        <Label htmlFor="api-key" className="text-sm font-medium">
          {language === "ar" ? "مفتاح API" : "API Key"}
        </Label>
        <div className="relative">
          <Input
            id="api-key"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setError(null)
            }}
            placeholder={language === "ar" ? "أدخل مفتاح API الخاص بك" : "Enter your API key"}
            aria-label={language === "ar" ? "أدخل مفتاح API الخاص بك" : "Enter your API key"}
            autoComplete="off"
            className={cn(
              "h-12 pe-10",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showKey ? (language === "ar" ? "إخفاء المفتاح" : "Hide key") : (language === "ar" ? "إظهار المفتاح" : "Show key")}
          >
            {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Sign In Button */}
      <Button
        type="submit"
        className="w-full h-12 bg-nexus-jade hover:bg-nexus-jade-hover text-background"
        disabled={isLoading}
        aria-label={language === "ar" ? "تسجيل الدخول" : "Sign in"}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <>
            <KeyRound className="h-5 w-5 me-2" aria-hidden="true" />
            {language === "ar" ? "تسجيل الدخول" : "Sign In"}
          </>
        )}
      </Button>

      {/* Lost your key */}
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "هل فقدت مفتاحك؟" : "Lost your key?"}
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "استعادة المفتاح" : "Key Recovery"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "مفتاح API الخاص بك يتم إنشاؤه محليًا ولا يمكن استرداده. إذا فقدت مفتاحك، يجب عليك إنشاء حساب جديد وإعادة تشغيل مراسم المفتاح."
                : "Your API key is generated locally and cannot be recovered. If you've lost your key, you'll need to create a new account and run the key ceremony again."}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onSwitchToSignUp} className="w-full mt-4">
            {language === "ar" ? "إنشاء حساب جديد" : "Create New Account"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {language === "ar" ? "أو" : "or"}
          </span>
        </div>
      </div>

      {/* Create Account Link */}
      <button
        type="button"
        onClick={onSwitchToSignUp}
        className="w-full text-sm text-nexus-jade hover:text-nexus-jade-hover transition-colors font-medium"
      >
        {language === "ar" ? "إنشاء حساب مجاني" : "Create a free account"}
      </button>
    </form>
  )
}
