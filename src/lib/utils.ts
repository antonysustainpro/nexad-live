import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * SEC-UI-100: Validate URLs to prevent open redirects and javascript: XSS.
 * Only allows https:, http:, mailto:, and relative paths.
 * Returns the URL if safe, or a fallback ("#") if dangerous.
 */
export function sanitizeUrl(url: string | undefined | null, fallback = "#"): string {
  if (!url || typeof url !== "string") return fallback
  const trimmed = url.trim()
  if (trimmed === "") return fallback

  // Allow relative paths (starting with / but not //)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed

  // Allow safe protocols only
  try {
    const parsed = new URL(trimmed)
    const safeProtocols = ["https:", "http:", "mailto:"]
    if (safeProtocols.includes(parsed.protocol)) return trimmed
  } catch {
    // Not a valid absolute URL - could be a relative path without leading /
    // Block it to be safe
  }

  return fallback
}

/**
 * SEC-UI-101: Validate image src URLs to prevent data exfiltration via tracking pixels.
 * Only allows https:, http:, data:image/*, and blob: URLs.
 */
export function sanitizeImageUrl(url: string | undefined | null, fallback = ""): string {
  if (!url || typeof url !== "string") return fallback
  const trimmed = url.trim()
  if (trimmed === "") return fallback

  // Allow relative paths
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed

  // Allow blob: URLs (used for createObjectURL previews)
  if (trimmed.startsWith("blob:")) return trimmed

  // Allow data:image/* URLs only (not data:text/html etc)
  if (trimmed.startsWith("data:image/")) return trimmed

  // Allow https/http
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return trimmed
  } catch {
    // Invalid URL
  }

  return fallback
}

/**
 * SEC-UI-115: Sanitize filenames for download to prevent path traversal and injection.
 * Strips directory separators, null bytes, control characters, and shell metacharacters.
 * Limits length to 200 chars and ensures a safe fallback if nothing remains.
 */
export function sanitizeFilename(name: string, fallback = "download"): string {
  if (!name || typeof name !== "string") return fallback
  // Remove null bytes, control characters, and path separators
  let safe = name
    .replace(/[\x00-\x1f\x7f]/g, "") // Control chars
    .replace(/[/\\:*?"<>|]/g, "_")    // Path separators and shell metacharacters
    .replace(/\.\./g, "_")            // Directory traversal
    .trim()
  // Prevent hidden files (starting with .)
  if (safe.startsWith(".")) safe = "_" + safe.slice(1)
  // Limit length
  if (safe.length > 200) safe = safe.slice(0, 200)
  return safe || fallback
}

/**
 * SEC-UI-102: Sanitize objects parsed from localStorage/JSON to prevent prototype pollution.
 * Strips __proto__, constructor, and prototype keys recursively.
 */
export function sanitizeParsedJson<T>(obj: T, depth = 0): T {
  if (depth > 10) return obj
  if (obj === null || obj === undefined || typeof obj !== "object") return obj
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeParsedJson(item, depth + 1)) as T
  }

  const clean: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Block prototype pollution keys
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue
    clean[key] = sanitizeParsedJson((obj as Record<string, unknown>)[key], depth + 1)
  }
  return clean as T
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-PII-STORAGE-001: COMPREHENSIVE CLIENT-SIDE PII STORAGE SCANNER
// ═══════════════════════════════════════════════════════════════════════════════
//
// CRO FINDING: PII scrubbing was previously limited to localStorage only.
// This extends coverage to sessionStorage, document.cookie, and form inputs
// so that our "PII scrubbing" claim reflects what we actually enforce.
//
// PATTERNS matched (aligned with server-side LOG_PII_PATTERNS in middleware.ts):
//   - UAE Emirates ID (784-YYYY-NNNNNNN-C)
//   - Email addresses
//   - UAE mobile numbers (+971 5x...)
//   - UAE landline numbers
//   - Credit card numbers (16 digits)
//   - UAE IBAN (AE + 21 digits)
//   - Generic IBAN
// ═══════════════════════════════════════════════════════════════════════════════

export const CLIENT_PII_PATTERNS: RegExp[] = [
  /784-?\d{4}-?\d{7}-?\d/, // Emirates ID
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/, // Email
  /(?:\+971|00971|971)?[ .-]?5\d[ .-]?\d{3}[ .-]?\d{4}/, // UAE mobile
  /(?:\+971|00971|971)?[ .-]?0?[2-46-9][ .-]?\d{3}[ .-]?\d{4}/, // UAE landline
  /\b\d{4}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{4}\b/, // Credit card
  /\bAE\d{21}\b/i, // UAE IBAN (contiguous)
  /\bAE\d{2}[ \-]?\d{3}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{4}\b/i, // UAE IBAN (with separators)
  /\b[A-Z]{2}\d{2}[ \-]?[A-Z0-9]{4}[ \-]?[A-Z0-9]{4}[ \-]?[A-Z0-9]{4}[ \-]?[A-Z0-9]{0,6}\b/i, // Generic IBAN
]

/**
 * Check if a string value contains any PII pattern.
 */
export function containsPii(value: string): boolean {
  if (!value || typeof value !== "string") return false
  return CLIENT_PII_PATTERNS.some((pattern) => pattern.test(value))
}

export interface PiiStorageScanResult {
  /** Stores that contained PII-like values */
  affectedStores: Array<"localStorage" | "sessionStorage" | "cookie">
  /** Number of key-value pairs that contained PII */
  piiKeyCount: number
  /** Whether any PII was found */
  hasPii: boolean
}

/**
 * SEC-PII-STORAGE-001: Scan all client-side storage for PII patterns.
 *
 * Checks localStorage, sessionStorage, and document.cookie values for
 * common UAE/international PII patterns. Returns a report without modifying
 * any data — callers decide whether to redact, warn, or clear.
 *
 * Safe to call client-side only (returns empty result on server).
 */
export function scanClientStorageForPii(): PiiStorageScanResult {
  const result: PiiStorageScanResult = {
    affectedStores: [],
    piiKeyCount: 0,
    hasPii: false,
  }

  if (typeof window === "undefined") return result

  // Scan localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const value = localStorage.getItem(key) ?? ""
      if (containsPii(value)) {
        result.piiKeyCount++
        if (!result.affectedStores.includes("localStorage")) {
          result.affectedStores.push("localStorage")
        }
      }
    }
  } catch {
    // Safari private mode or quota errors — skip safely
  }

  // Scan sessionStorage
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key) continue
      const value = sessionStorage.getItem(key) ?? ""
      if (containsPii(value)) {
        result.piiKeyCount++
        if (!result.affectedStores.includes("sessionStorage")) {
          result.affectedStores.push("sessionStorage")
        }
      }
    }
  } catch {
    // sessionStorage unavailable — skip safely
  }

  // Scan document.cookie (client-readable cookies only — httpOnly are invisible here)
  try {
    if (typeof document !== "undefined" && document.cookie) {
      const cookies = document.cookie.split(";")
      for (const cookie of cookies) {
        const eqIndex = cookie.indexOf("=")
        if (eqIndex === -1) continue
        const value = decodeURIComponent(cookie.slice(eqIndex + 1).trim())
        if (containsPii(value)) {
          result.piiKeyCount++
          if (!result.affectedStores.includes("cookie")) {
            result.affectedStores.push("cookie")
          }
        }
      }
    }
  } catch {
    // Cookie parsing errors — skip safely
  }

  result.hasPii = result.piiKeyCount > 0
  return result
}

/**
 * SEC-PII-STORAGE-001: Scrub PII from a sessionStorage value by redacting matched patterns.
 * Returns the redacted string.
 */
export function redactPiiFromString(value: string): string {
  let result = value
  for (const pattern of CLIENT_PII_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, "gi"), "[PII_REDACTED]")
  }
  return result
}

/**
 * SEC-PII-STORAGE-001: Scan sessionStorage for PII and redact matching values in-place.
 * Safe to call on session start and logout.
 *
 * Unlike localStorage (which stores UI prefs and is cleared on logout), sessionStorage
 * can hold transient form state (e.g. selected billing tier) that may contain PII if
 * a user typed sensitive data into a form field that cached to session storage.
 */
export function scrubSessionStoragePii(): number {
  if (typeof window === "undefined") return 0
  let scrubbed = 0
  try {
    const keysToCheck: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key) keysToCheck.push(key)
    }
    for (const key of keysToCheck) {
      const value = sessionStorage.getItem(key)
      if (value && containsPii(value)) {
        const redacted = redactPiiFromString(value)
        sessionStorage.setItem(key, redacted)
        scrubbed++
      }
    }
  } catch {
    // sessionStorage unavailable — skip safely
  }
  return scrubbed
}

/**
 * SEC-PII-FILE-001: Scan extracted text from an uploaded file for PII patterns.
 * Returns a count of distinct PII matches found.
 *
 * Only works on text-based files. Binary files (images, PDFs) require server-side
 * OCR/parsing which is handled by the backend.
 */
export function scanTextForPii(text: string): { count: number; types: string[] } {
  const types: string[] = []
  let count = 0

  const patternLabels: [RegExp, string][] = [
    [/784-?\d{4}-?\d{7}-?\d/, "Emirates ID"],
    [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/, "Email"],
    [/(?:\+971|00971|971)?[ .-]?5\d[ .-]?\d{3}[ .-]?\d{4}/, "UAE Phone"],
    [/\b\d{4}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{4}\b/, "Credit Card"],
    [/\bAE\d{21}\b/i, "UAE IBAN"],
    [/\b[A-Z]{2}\d{2}[ \-]?[A-Z0-9]{4}[ \-]?[A-Z0-9]{4}[ \-]?[A-Z0-9]{4}\b/i, "IBAN"],
  ]

  for (const [pattern, label] of patternLabels) {
    const matches = text.match(new RegExp(pattern.source, "gi"))
    if (matches && matches.length > 0) {
      count += matches.length
      if (!types.includes(label)) types.push(label)
    }
  }

  return { count, types }
}
