import { NextRequest, NextResponse } from "next/server"

// Backend API URL (includes /api/v1)
const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || ""

/**
 * Google OAuth initiation endpoint.
 *
 * The login page does: window.location.href = "/api/v1/auth/google"
 * This route redirects the browser to the backend's Google OAuth URL so the
 * backend can manage the OAuth state parameter and callback.
 *
 * The backend handles:
 *   1. Generating the Google OAuth consent URL with a state param
 *   2. Receiving the /auth/google/callback from Google
 *   3. Exchanging the code for tokens, creating/updating the user
 *   4. Redirecting back to the frontend with a session token
 *
 * Security: We redirect to the backend URL directly. The backend is
 * responsible for setting the httpOnly session cookie on the callback.
 * The NEXT_PUBLIC_APP_URL is passed as redirect_uri context so the backend
 * knows where to send the user after successful OAuth.
 */
export async function GET(req: NextRequest) {
  if (!BACKEND_API_URL) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 503 }
    )
  }

  // Build the backend Google OAuth URL.
  // Pass the frontend origin as redirect_after so the backend can redirect
  // the browser back to the app after completing OAuth.
  const origin = req.nextUrl.origin
  const backendGoogleUrl = new URL(`${BACKEND_API_URL}/auth/google`)
  backendGoogleUrl.searchParams.set("redirect_after", origin)

  return NextResponse.redirect(backendGoogleUrl.toString())
}
