import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * OAuth callback handler - receives token and sets session cookie
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=no_token", req.url))
  }

  const now = Math.floor(Date.now() / 1000)
  const SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60 // 24 hours
  const SESSION_IDLE_TIMEOUT = 15 * 60 // 15 minutes

  // Create response with redirect
  const response = NextResponse.redirect(new URL("/chat", req.url))

  // Set session cookie (matching login route exactly)
  response.cookies.set("nexus-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // Match login route
    path: "/",
    maxAge: SESSION_ABSOLUTE_TIMEOUT, // 24h to match login
  })

  // Set session creation timestamp
  response.cookies.set("nexus-session-created", String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_ABSOLUTE_TIMEOUT,
  })

  // Set last activity timestamp
  response.cookies.set("nexus-last-activity", String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_IDLE_TIMEOUT,
  })

  return response
}
