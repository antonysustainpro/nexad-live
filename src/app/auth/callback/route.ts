import { NextRequest, NextResponse } from "next/server"

/**
 * OAuth callback handler - receives token from backend OAuth redirect and sets
 * a httpOnly session cookie, then redirects to the app.
 *
 * SEC-AUTH-CALLBACK-001: Token format validation.
 *   The token arrives as a URL query parameter from the backend OAuth flow.
 *   We validate that it looks like a plausible JWT or opaque token before
 *   writing it into the session cookie — this blocks null bytes, HTML injection,
 *   and obviously malformed values from reaching the cookie jar.
 *
 * SEC-AUTH-CALLBACK-002: Redirect is always fixed to /chat.
 *   We never reflect user-supplied redirect paths in this handler.
 *   Using req.nextUrl.origin (not req.url) prevents Host-header injection.
 */

// SEC-AUTH-CALLBACK-001: Token MUST match this pattern.
// Allows JWT (xxx.yyy.zzz) and opaque hex/base64 tokens up to 2 KB.
// Rejects anything containing whitespace, null bytes, HTML, or newlines.
const TOKEN_PATTERN = /^[A-Za-z0-9\-_.+/=]{10,2048}$/

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=no_token", req.nextUrl.origin))
  }

  // SEC-AUTH-CALLBACK-001: Validate token format before setting cookie.
  // Reject tokens that don't match the expected pattern.
  if (!TOKEN_PATTERN.test(token)) {
    console.error("[SEC-AUTH-CALLBACK-001] OAuth callback: token failed format validation")
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.nextUrl.origin))
  }

  const now = Math.floor(Date.now() / 1000)
  const SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60 // 24 hours
  const SESSION_IDLE_TIMEOUT = 15 * 60 // 15 minutes

  // SEC-AUTH-CALLBACK-002: Always redirect to /chat via trusted origin.
  // Never accept a redirect target from user-supplied query params.
  const response = NextResponse.redirect(new URL("/chat", req.nextUrl.origin))

  // Set session cookie (matching login route exactly)
  response.cookies.set("nexus-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Changed from strict to lax for OAuth compatibility
    path: "/",
    maxAge: SESSION_ABSOLUTE_TIMEOUT, // 24h to match login
  })

  // Set session creation timestamp
  response.cookies.set("nexus-session-created", String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Changed for OAuth compatibility
    path: "/",
    maxAge: SESSION_ABSOLUTE_TIMEOUT,
  })

  // Set last activity timestamp
  response.cookies.set("nexus-last-activity", String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Changed for OAuth compatibility
    path: "/",
    maxAge: SESSION_IDLE_TIMEOUT,
  })

  return response
}
