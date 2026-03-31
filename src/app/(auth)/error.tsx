"use client"

/**
 * REL-002: Error Boundary for Auth Route Group
 *
 * Catches errors in login, register, verify-email, and forgot-password pages.
 * Uses minimal dependencies to avoid cascading failures.
 *
 * Bilingual: Detects language from localStorage ("nexus-language") to show
 * Arabic or English text. Falls back to English if unavailable.
 */

import { useEffect, useState } from "react"

function getStoredLanguage(): "en" | "ar" {
  try {
    const lang = typeof window !== "undefined" ? localStorage.getItem("nexus-language") : null
    return lang === "ar" ? "ar" : "en"
  } catch {
    return "en"
  }
}

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [lang, setLang] = useState<"en" | "ar">("en")

  useEffect(() => {
    setLang(getStoredLanguage())
  }, [])

  useEffect(() => {
    console.error("[AuthError] Authentication page error:", error?.message)
  }, [error])

  const isAr = lang === "ar"

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center" dir={isAr ? "rtl" : "ltr"}>
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-destructive"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold mb-2">
        {isAr ? "خطأ في المصادقة" : "Authentication Error"}
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        {isAr
          ? "حدث خطأ ما. يرجى المحاولة مرة أخرى أو العودة إلى صفحة تسجيل الدخول."
          : "Something went wrong. Please try again or return to the login page."}
      </p>
      {error?.digest && (
        <p className="text-xs text-muted-foreground/60 mb-4 font-mono">
          {isAr ? "رمز الخطأ:" : "Error Code:"} {error.digest.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-nexus-jade text-background px-6 py-2 rounded-lg font-medium hover:bg-nexus-jade-hover transition-colors"
        >
          {isAr ? "حاول مرة أخرى" : "Try Again"}
        </button>
        <a
          href="/login"
          className="px-6 py-2 rounded-lg font-medium border border-white/10 hover:bg-secondary/50 transition-colors"
        >
          {isAr ? "العودة لتسجيل الدخول" : "Back to Login"}
        </a>
      </div>
    </div>
  )
}
