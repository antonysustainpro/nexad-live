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
