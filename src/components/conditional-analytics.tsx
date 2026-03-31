"use client"

import { useState, useEffect } from "react"
import { Analytics } from "@vercel/analytics/next"

const CONSENT_STORAGE_KEY = "nexusad-cookie-consent"

/**
 * GDPR-compliant analytics wrapper.
 * Only loads Vercel Analytics if the user has explicitly consented to analytics cookies.
 * Without consent, no analytics scripts are loaded or tracking occurs.
 */
export function ConditionalAnalytics() {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (parsed?.preferences?.analytics === true) {
        setHasConsent(true)
      }
    } catch {
      // No consent or storage unavailable
    }
  }, [])

  if (!hasConsent) return null

  return <Analytics />
}
