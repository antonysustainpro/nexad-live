import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * SEC-AUTH-SESSION-002: Session validation endpoint.
 *
 * GET /api/v1/auth/session
 * Reads the httpOnly session cookie, decodes the JWT payload, and returns
 * the user identity to the client without exposing the token itself.
 *
 * The backend has no /auth/session endpoint — session state lives in the
 * httpOnly cookie set at login/register/OAuth callback. We decode it here
 * on the server so the frontend knows who is logged in.
 *
 * Security properties:
 * - The session token is httpOnly and NEVER exposed to client JavaScript
 * - We only forward safe fields (id, email, name) — not the raw JWT
 * - No credentials are accepted from the request body / query string
 * - Token expiry is checked before returning a session
 */
export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("nexus-session")?.value

    if (!sessionToken) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    // Decode JWT payload (3-part dot-separated base64url)
    const parts = sessionToken.split(".")
    if (parts.length !== 3) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 })
    }

    let payload: Record<string, unknown>
    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
      payload = JSON.parse(atob(padded))
    } catch {
      return NextResponse.json({ error: "Malformed session token" }, { status: 401 })
    }

    // Check expiry
    const exp = typeof payload.exp === "number" ? payload.exp : null
    if (exp !== null && exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 })
    }

    // Extract user identity — only safe fields, no raw token
    const userId =
      (typeof payload.sub === "string" ? payload.sub : null) ||
      (typeof payload.userId === "string" ? payload.userId : null) ||
      (typeof payload.id === "string" ? payload.id : null)

    if (!userId) {
      return NextResponse.json({ error: "Invalid session payload" }, { status: 401 })
    }

    const email = typeof payload.email === "string" ? payload.email : undefined
    const name =
      typeof payload.name === "string"
        ? payload.name
        : typeof payload.fullName === "string"
        ? payload.fullName
        : undefined

    return NextResponse.json({
      user: {
        id: userId,
        email,
        name,
      },
      expiresAt: exp ? new Date(exp * 1000).toISOString() : undefined,
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Block mutation methods — session cookies are set exclusively by:
 * - /api/v1/auth/login    (email + password)
 * - /api/v1/auth/register (new account)
 * - /api/v1/auth/verify   (API key)
 * - /api/v1/auth/verify-email (OTP code)
 * - /auth/callback        (OAuth callback — server-side redirect with httpOnly cookie)
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PUT(_req: NextRequest) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PATCH(_req: NextRequest) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
