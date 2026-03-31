import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { RegisterRequestSchema, validateRequestBody } from "@/lib/api-validation"

// Auth endpoints are mounted at root, not under /api/v1
const BACKEND_BASE_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "")

// Session timeout constants (SEC-026)
const SESSION_IDLE_TIMEOUT = 15 * 60 // 15 minutes in seconds
const SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60 // 24 hours in seconds

// SEC-038: Maximum request body size for auth endpoints (2KB - registration payloads are small)
const MAX_AUTH_BODY_SIZE = 2048

export async function POST(req: NextRequest) {
  try {
    // SEC-227: Enforce Content-Type: application/json on auth endpoints.
    // Without this, attackers can send form-urlencoded or text/plain bodies
    // which may cause parser confusion or charset-based XSS bypass.
    const reqContentType = req.headers.get("content-type") || ""
    if (!reqContentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      )
    }

    // SEC-038: Enforce body size limit to prevent DoS via large payloads
    const contentLength = req.headers.get("content-length")
    if (contentLength && parseInt(contentLength, 10) > MAX_AUTH_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request payload too large" },
        { status: 413 }
      )
    }

    // SEC-219: Also enforce actual body size, not just Content-Length header.
    // An attacker can set Content-Length: 100 but send a 10MB body (header lies).
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
    const validation = validateRequestBody(RegisterRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }

    const { fullName, email, password, company, tier } = validation.data

    // For sovereign-key (API-key-based) registrations no password is supplied by
    // the client.  Generate a cryptographically-random placeholder so that the
    // backend's password field is always satisfied.  The user will never use this
    // password — authentication happens exclusively via the sovereign key.
    const effectivePassword = password ?? randomBytes(32).toString("hex")

    // SEC-041: Add timeout to prevent slow-loris amplification against backend
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        password: effectivePassword,
        ...(company ? { company } : {}),
        ...(tier ? { tier } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!backendResponse.ok) {
      // SEC-039/SEC-209: Consume response body but NEVER forward raw backend errors.
      // Previously leaked backend error messages via errorData.message fallback.
      await backendResponse.json().catch(() => ({}))

      // SEC-210: User enumeration prevention - do NOT distinguish between
      // "email already exists" (409) and other registration failures.
      // Telling the user an email exists allows attackers to enumerate valid accounts.
      // Instead, return a generic message for ALL registration failures.
      return NextResponse.json(
        { error: "Registration failed. Please check your details and try again." },
        { status: 400 }
      )
    }

    const data = await backendResponse.json()
    const response = NextResponse.json({
      user: data.user,
      success: true,
      email_verification_required: data.email_verification_required ?? true,
    })

    // SEC-001 + SEC-026 + SEC-027: Set httpOnly cookie for session token with all security flags
    if (data.token) {
      const sessionToken = data.token
      const now = Math.floor(Date.now() / 1000)

      // Main session token cookie with security flags (SEC-001)
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
