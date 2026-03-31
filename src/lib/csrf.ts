/**
 * CSRF Protection utilities
 * Retrieves CSRF token from meta tag for inclusion in mutation requests
 */

export function getCsrfToken(): string | null {
  if (typeof document !== "undefined") {
    // Read from csrf-token cookie (set by middleware)
    const cookies = document.cookie.split(";")
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=")
      if (name === "csrf-token") {
        return decodeURIComponent(value)
      }
    }
    // Fallback: try meta tag (legacy)
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta?.getAttribute("content") || null
  }
  return null
}

/**
 * Generate a random CSRF token (for server-side use)
 * SEC-AUTH-002: Removed Math.random() fallback - crypto.randomUUID() is available
 * in all supported environments (Node 19+, all modern browsers).
 * Math.random() is NOT cryptographically secure and must never be used for tokens.
 */
export function generateCsrfToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: use crypto.getRandomValues which IS cryptographically secure
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")
  }
  throw new Error("SEC-AUTH-002: No cryptographically secure random source available. Cannot generate CSRF token.")
}
