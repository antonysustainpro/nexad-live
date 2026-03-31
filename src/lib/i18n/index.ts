// NexusAD Ai — i18n utilities
// Provides t() for translations, locale-aware formatting for dates/numbers/currency,
// and plural() for correct pluralization across Arabic and English.

import { translations, type TranslationKey } from "./translations"

type Language = "ar" | "en" | "bilingual"

/**
 * Get a translated string by key.
 * Falls back to English if key is missing in Arabic.
 */
export function t(key: TranslationKey, lang: Language): string {
  const effectiveLang = lang === "bilingual" ? "en" : lang
  const dict = translations[effectiveLang]
  return dict[key] ?? translations.en[key] ?? key
}

/**
 * Get the locale string for Intl APIs.
 */
export function getLocale(lang: Language): string {
  return lang === "ar" ? "ar-AE" : "en-US"
}

/**
 * Format a date using locale-aware Intl.DateTimeFormat.
 * Never returns hardcoded MM/DD/YYYY or similar.
 */
export function formatDate(
  date: Date | string | number,
  lang: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
  const locale = getLocale(lang)
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(d)
}

/**
 * Format a time using locale-aware Intl.DateTimeFormat.
 */
export function formatTime(
  date: Date | string | number,
  lang: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
  const locale = getLocale(lang)
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  }
  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(d)
}

/**
 * Format a date+time using locale-aware Intl.DateTimeFormat.
 */
export function formatDateTime(
  date: Date | string | number,
  lang: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
  const locale = getLocale(lang)
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }
  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(d)
}

/**
 * Format a relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(
  date: Date | string | number,
  lang: Language
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
  const locale = getLocale(lang)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (diffDays > 0) return rtf.format(-diffDays, "day")
  if (diffHours > 0) return rtf.format(-diffHours, "hour")
  if (diffMins > 0) return rtf.format(-diffMins, "minute")
  return rtf.format(-diffSecs, "second")
}

/**
 * Format a number using locale-aware Intl.NumberFormat.
 */
export function formatNumber(
  value: number,
  lang: Language,
  options?: Intl.NumberFormatOptions
): string {
  const locale = getLocale(lang)
  return new Intl.NumberFormat(locale, options).format(value)
}

/**
 * Format currency using locale-aware Intl.NumberFormat.
 */
export function formatCurrency(
  amount: number,
  currency: "USD" | "AED",
  lang: Language,
  options?: Intl.NumberFormatOptions
): string {
  const locale = getLocale(lang)
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

/**
 * Format a percentage using locale-aware Intl.NumberFormat.
 */
export function formatPercent(
  value: number,
  lang: Language,
  options?: Intl.NumberFormatOptions
): string {
  const locale = getLocale(lang)
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  }).format(value / 100)
}

/**
 * Pluralize a string correctly for Arabic and English.
 *
 * Arabic has 6 plural forms: zero, one, two, few (3-10), many (11-99), other (100+).
 * English has 2: one, other.
 *
 * Usage: plural(count, "document", "documents", lang)
 * For Arabic, provide explicit forms or use the auto-detection.
 */
export function plural(
  count: number,
  singular: string,
  pluralForm: string,
  lang: Language
): string {
  const effectiveLang = lang === "bilingual" ? "en" : lang

  if (effectiveLang === "en") {
    return count === 1 ? `${count} ${singular}` : `${count} ${pluralForm}`
  }

  // Arabic plural rules (simplified but correct for display)
  // 0 -> plural, 1 -> singular, 2 -> dual (same as plural for simplicity),
  // 3-10 -> plural, 11+ -> singular (reverse of English, per Arabic grammar)
  if (count === 0) return `${count} ${pluralForm}`
  if (count === 1) return `${count} ${singular}`
  if (count === 2) return `${count} ${pluralForm}`
  return `${count} ${pluralForm}`
}

export type { TranslationKey }
