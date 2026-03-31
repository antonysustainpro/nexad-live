"use client"

/**
 * REL-001: Global Error Boundary
 *
 * This is the LAST resort error boundary. It catches errors that escape
 * the root layout itself. Because the root layout may have crashed,
 * this component must render its own <html> and <body> tags and
 * CANNOT use any context providers (NexusProvider is gone).
 *
 * It deliberately uses no imports beyond React and basic HTML so
 * it is virtually impossible for this boundary to crash on re-render.
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

export default function GlobalError({
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
    // Log to console; in production this would go to an error reporting service
    console.error("[GlobalError] Unrecoverable application error:", error?.message)
  }, [error])

  const isAr = lang === "ar"

  return (
    <html lang={isAr ? "ar" : "en"} dir={isAr ? "rtl" : "ltr"} className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{isAr ? "NexusAD - خطأ حرج" : "NexusAD - Critical Error"}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0A0A0A;
            color: #E5E5E5;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { text-align: center; max-width: 480px; padding: 2rem; }
          .icon {
            width: 64px; height: 64px; margin: 0 auto 1.5rem;
            border-radius: 50%; background: rgba(239,68,68,0.1);
            display: flex; align-items: center; justify-content: center;
            font-size: 2rem;
          }
          h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
          p { color: #A3A3A3; margin-bottom: 1.5rem; line-height: 1.6; }
          .code { font-family: monospace; font-size: 0.75rem; color: #737373; margin-bottom: 2rem; }
          .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
          button, a {
            display: inline-flex; align-items: center; gap: 0.5rem;
            padding: 0.625rem 1.25rem; border-radius: 0.5rem;
            font-size: 0.875rem; font-weight: 500; cursor: pointer;
            text-decoration: none; border: none; transition: opacity 0.15s;
          }
          button:hover, a:hover { opacity: 0.85; }
          .btn-primary { background: #2DD4A8; color: #0A0A0A; }
          .btn-secondary { background: transparent; color: #E5E5E5; border: 1px solid rgba(255,255,255,0.15); }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon" aria-hidden="true">!</div>
          <h1>{isAr ? "حدث خطأ ما" : "Something Went Wrong"}</h1>
          <p>
            {isAr
              ? "حدث خطأ حرج. بياناتك تبقى مشفرة وآمنة. يرجى محاولة تحديث الصفحة."
              : "A critical error occurred. Your data remains encrypted and secure. Please try refreshing the page."}
          </p>
          {error?.digest && (
            <div className="code">
              {isAr ? "رمز الخطأ:" : "Error Code:"} {error.digest.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}
            </div>
          )}
          <div className="actions">
            <button className="btn-primary" onClick={reset}>
              {isAr ? "حاول مرة أخرى" : "Try Again"}
            </button>
            <a className="btn-secondary" href="/">
              {isAr ? "الصفحة الرئيسية" : "Go Home"}
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
