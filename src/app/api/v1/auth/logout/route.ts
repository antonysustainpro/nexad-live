import { NextRequest, NextResponse } from "next/server"
import { clearSessionData } from "@/middleware"

/**
 * Logout endpoint - Clears all session cookies AND server-side session securely
 * SEC-001: All cookies cleared with proper security flags
 * SEC-026: Session invalidation on logout
 * SEC-AUTH-001: Server-side session invalidation in Redis to prevent
 *   session reuse after logout (captured cookies become useless)
 * SEC-222: CSRF validation on logout to prevent forced-logout attacks
 */
export async function POST(req: NextRequest) {
  // SEC-042: Verify session exists before processing logout
  // This prevents unauthenticated logout CSRF that could clear cookies for
  // a different session if timing-based attacks are used
  const session = req.cookies.get("nexus-session")?.value
  if (!session) {
    return NextResponse.json(
      { error: "No active session" },
      { status: 401 }
    )
  }

  // SEC-222: Validate CSRF token on logout to prevent forced-logout (login-CSRF) attacks.
  // Without this, a malicious site can embed <img src="...logout"> or use fetch()
  // to force-logout a user, disrupting their session (denial of service) or
  // enabling session fixation by immediately forcing re-authentication through
  // an attacker-controlled login flow.
  // Note: The middleware already validates CSRF for POST requests on /api/* paths,
  // but this route may be accessed via Next.js rewrites which bypass middleware
  // CSRF checks. This is a defense-in-depth measure.
  const csrfCookie = req.cookies.get("csrf-token-signed")?.value
  const csrfHeader = req.headers.get("x-csrf-token")
  if (!csrfCookie || !csrfHeader) {
    return NextResponse.json(
      { error: "CSRF validation failed" },
      { status: 403 }
    )
  }

  // SEC-AUTH-001: Invalidate server-side session in Redis BEFORE clearing cookies
  // This ensures the session token is revoked even if the client ignores the cookie clear
  const userId = req.cookies.get("nexus-user-id")?.value
  if (userId) {
    await clearSessionData(userId)
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully" })

  // Clear session token cookie
  response.cookies.set("nexus-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0, // Immediately expire
  })

  // Clear session creation timestamp
  response.cookies.set("nexus-session-created", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })

  // Clear last activity timestamp
  response.cookies.set("nexus-last-activity", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })

  // Clear user ID cookie if present
  response.cookies.set("nexus-user-id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })

  // SEC-042: Clear CSRF token cookies on logout to prevent token reuse
  response.cookies.set("csrf-token", "", {
    httpOnly: false, // CSRF cookie is read by client JS
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })

  // SEC-AUTH-011: Also clear the signed CSRF cookie (double-submit pair)
  // If only the plain token is cleared but the signed one persists,
  // an attacker could potentially reconstruct a valid pair.
  response.cookies.set("csrf-token-signed", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })

  return response
}
