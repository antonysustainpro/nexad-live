import { NextRequest, NextResponse } from "next/server"

/**
 * SEC-AUTH-SESSION-001: This endpoint previously allowed any caller to set an
 * arbitrary session token cookie without authentication or CSRF validation,
 * enabling session fixation attacks.
 *
 * FIX: Endpoint is now disabled. Session cookies are set exclusively by:
 * - /api/v1/auth/login    (email + password)
 * - /api/v1/auth/register (new account)
 * - /api/v1/auth/verify   (API key)
 * - /api/v1/auth/verify-email (OTP code)
 * - /auth/callback        (OAuth callback — server-side redirect with httpOnly cookie)
 *
 * All of those routes validate credentials against the backend before setting
 * any cookie. No unauthenticated token injection is permitted.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  )
}

/**
 * Block all other methods too — explicit is safer than implicit.
 */
export async function GET(_req: NextRequest) {
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
