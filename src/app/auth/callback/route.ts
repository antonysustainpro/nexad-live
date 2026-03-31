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

  // Set the session cookie
  const cookieStore = await cookies()
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  // Redirect to home page
  return NextResponse.redirect(new URL("/", req.url))
}
