import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || ""

/**
 * Google OAuth callback - redirect to RunPod which handles token exchange.
 * RunPod will redirect back to /auth/callback?token=xxx
 */
export async function GET(req: NextRequest) {
  if (!BACKEND_BASE_URL) {
    return NextResponse.redirect(new URL("/login?error=backend_not_configured", req.url))
  }

  // Forward all query params to the backend callback
  const backendCallbackUrl = new URL(`${BACKEND_BASE_URL}/auth/google/callback`)
  req.nextUrl.searchParams.forEach((value, key) => {
    backendCallbackUrl.searchParams.set(key, value)
  })

  // Redirect to backend - it will redirect back to /auth/callback with token
  return NextResponse.redirect(backendCallbackUrl.toString())
}
