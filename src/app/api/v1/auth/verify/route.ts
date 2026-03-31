import { NextRequest, NextResponse } from "next/server"
import { sanitizeString } from "@/lib/api-validation"
import {
  recordFailedAuthAttempt,
  clearFailedAuthAttempts,
  buildRateLimitKeyFromParts,
} from "@/middleware"

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || ""

// Session timeout constants (SEC-026)
const SESSION_IDLE_TIMEOUT = 15 * 60 // 15 minutes in seconds
const SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60 // 24 hours in seconds

/**
 * Extract client IP from request headers (mirrors middleware logic)
 * SEC-207: IP header trust order matters for security.
 * - cf-connecting-ip: Set by Cloudflare (trusted if using CF)
 * - x-real-ip: Set by trusted reverse proxy (nginx)
 * - x-forwarded-for: Can be spoofed by clients unless stripped by proxy
 *
 * SEC-208: Validate extracted IP format to prevent header injection.
 * An attacker could inject arbitrary strings via these headers.
 */
function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip")
  const realIp = request.headers.get("x-real-ip")
  const forwarded = request.headers.get("x-forwarded-for")

  // SEC-208: Validate IP format - must be a plausible IPv4 or IPv6 address
  const IP_PATTERN = /^[\da-fA-F.:]{3,45}$/
  const validateIp = (ip: string | null): string | null => {
    if (!ip) return null
    const trimmed = ip.trim()
    return IP_PATTERN.test(trimmed) ? trimmed : null
  }

  // Trust order: CF > Real-IP > Forwarded-For (first entry only)
  const resolved =
    validateIp(cfIp) ||
    validateIp(realIp) ||
    validateIp(forwarded?.split(",")[0] ?? null) ||
    "127.0.0.1"
  return resolved
}

/**
 * API Key verification endpoint
 * Accepts POST with API key in X-API-Key header
 * Validates against backend and sets httpOnly session cookies on success
 * SEC-001: httpOnly cookies, secure flags, sameSite strict
 * SEC-006: Rate limiting via failed attempt tracking
 * SEC-008: Input validation and sanitization
 * SEC-024: Input sanitization to prevent injection
 * SEC-026: Session timeout cookies
 * SEC-027: New session token on each successful authentication
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)

  try {
    // SEC-227: Enforce Content-Type for auth endpoints.
    // The verify endpoint uses X-API-Key header (not body), but if a body is sent
    // it must be application/json. Block form-urlencoded and other types.
    const reqContentType = req.headers.get("content-type") || ""
    // Allow empty content-type (API key is in header, no body needed)
    if (reqContentType && !reqContentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      )
    }

    // SEC-008: Extract and validate API key from X-API-Key header
    const rawApiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key")

    if (!rawApiKey || !rawApiKey.trim()) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    // SEC-024: Sanitize the API key input to prevent injection
    const apiKey = sanitizeString(rawApiKey)

    if (!apiKey) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 400 }
      )
    }

    // SEC-040: Validate API key length to prevent excessively long keys
    // that could be used for denial-of-service or header injection
    if (apiKey.length > 256) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 400 }
      )
    }

    // Build rate limit key using API key prefix as identifier (SEC-006)
    // Using only first 8 chars of key to avoid storing the full secret in the rate limit store
    const keyPrefix = apiKey.substring(0, 8)
    const rateLimitKey = buildRateLimitKeyFromParts(clientIp, keyPrefix)

    // Forward to backend for validation — try /auth/verify first, fall back to /auth/api-key-login
    // SEC-041: Add timeout to prevent slow-loris amplification against backend
    const BACKEND_TIMEOUT_MS = 10_000
    let backendResponse: Response | null = null

    backendResponse = await fetch(`${BACKEND_URL}/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    }).catch(() => null)

    // If /auth/verify doesn't exist on the backend, try /auth/api-key-login
    if (!backendResponse || backendResponse.status === 404) {
      backendResponse = await fetch(`${BACKEND_URL}/auth/api-key-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
        signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      }).catch(() => null)
    }

    if (!backendResponse) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      )
    }

    if (!backendResponse.ok) {
      // Consume response body but don't forward backend error details
      await backendResponse.json().catch(() => ({}))

      // SEC-006: Record failed auth attempt for exponential backoff
      await recordFailedAuthAttempt(rateLimitKey)

      // SEC-039: Return generic 401 for ALL auth failures.
      // Never forward backend error messages as they may reveal internal details.
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      )
    }

    // SEC-006: Clear failed attempts on successful authentication
    await clearFailedAuthAttempts(rateLimitKey)

    const data = await backendResponse.json()
    const response = NextResponse.json({ user: data.user, success: true })

    // SEC-027: Use session token provided by backend on successful auth
    const sessionToken = data.token
    const now = Math.floor(Date.now() / 1000)

    if (sessionToken) {
      // SEC-001 + SEC-026: Set httpOnly cookie for session token with all security flags
      response.cookies.set("nexus-session", sessionToken, {
        httpOnly: true, // Prevent XSS access to token
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        sameSite: "strict", // Strict CSRF protection
        path: "/",
        maxAge: SESSION_ABSOLUTE_TIMEOUT, // 24h absolute timeout (SEC-026)
      })

      // SEC-026: Set session creation timestamp for absolute timeout tracking
      response.cookies.set("nexus-session-created", String(now), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_ABSOLUTE_TIMEOUT,
      })

      // SEC-026: Set last activity timestamp for idle timeout (expires in 15 min)
      response.cookies.set("nexus-last-activity", String(now), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_IDLE_TIMEOUT, // Auto-expires after 15 min idle
      })
    }

    return response
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
