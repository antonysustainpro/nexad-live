import { NextRequest, NextResponse } from "next/server"
import { LoginRequestSchema, validateRequestBody } from "@/lib/api-validation"
import {
  recordFailedAuthAttempt,
  clearFailedAuthAttempts,
  buildRateLimitKeyFromParts,
} from "@/middleware"

// Auth endpoints are mounted at root, not under /api/v1
const BACKEND_BASE_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "")

// Session timeout constants (SEC-026)
const SESSION_IDLE_TIMEOUT = 15 * 60 // 15 minutes in seconds
const SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60 // 24 hours in seconds

/**
 * Extract client IP from request headers (mirrors middleware logic)
 * SEC-207: IP header trust order matters for security.
 * SEC-208: Validate extracted IP format to prevent header injection.
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

  const resolved =
    validateIp(cfIp) ||
    validateIp(realIp) ||
    validateIp(forwarded?.split(",")[0] ?? null) ||
    "127.0.0.1"
  return resolved
}

// SEC-038: Maximum request body size for auth endpoints (1KB - login payloads are tiny)
const MAX_AUTH_BODY_SIZE = 1024

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)

  try {
    // SEC-227: Enforce Content-Type: application/json on auth endpoints.
    // Without this, attackers can send application/x-www-form-urlencoded or
    // text/plain bodies which may be parsed differently by JSON.parse(),
    // or use charset tricks (UTF-7) to bypass input validation.
    const reqContentType = req.headers.get("content-type") || ""
    if (!reqContentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      )
    }

    // SEC-038: Enforce body size limit to prevent DoS via large payloads
    // Auth routes may bypass the middleware proxy body check when served via Next.js rewrites
    const contentLength = req.headers.get("content-length")
    if (contentLength && parseInt(contentLength, 10) > MAX_AUTH_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request payload too large" },
        { status: 413 }
      )
    }

    // SEC-219: Also enforce actual body size, not just Content-Length header.
    // An attacker can set Content-Length: 100 but send a 10MB body (header lies).
    // Next.js may buffer the full body regardless of the header.
    let body: unknown
    try {
      const rawText = await req.text()
      if (rawText.length > MAX_AUTH_BODY_SIZE) {
        return NextResponse.json(
          { error: "Request payload too large" },
          { status: 413 }
        )
      }
      body = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    // Validate and sanitize input (SEC-008 + SEC-024)
    const validation = validateRequestBody(LoginRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Build rate limit key using email as identifier (before we know userId)
    // This tracks failed attempts per email + IP combo (SEC-006)
    const rateLimitKey = buildRateLimitKeyFromParts(clientIp, email)

    // SEC-041: Add timeout to prevent slow-loris amplification against backend
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!backendResponse.ok) {
      // Consume the response body but don't leak backend error details
      await backendResponse.json().catch(() => ({}))

      // SEC-006: Record failed auth attempt for exponential backoff
      await recordFailedAuthAttempt(rateLimitKey)

      // SEC-039: Return generic 401 for ALL auth failures.
      // Never forward backend status codes (e.g., 500, 503) as they reveal
      // backend infrastructure details. Auth failures are always "invalid credentials".
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // SEC-006: Clear failed attempts on successful login
    await clearFailedAuthAttempts(rateLimitKey)

    const data = await backendResponse.json()

    // Debug: Log the structure of backend response
    console.log("[Login] Backend response structure:", {
      hasUser: !!data.user,
      hasToken: !!data.token,
      tokenLength: data.token?.length,
      userKeys: data.user ? Object.keys(data.user) : []
    })

    const response = NextResponse.json({ user: data.user, success: true })

    // SEC-027: Generate new session token on successful login (token regeneration)
    // The backend provides a new token on each login, which is set here
    const sessionToken = data.token
    const now = Math.floor(Date.now() / 1000)

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

    return response
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
