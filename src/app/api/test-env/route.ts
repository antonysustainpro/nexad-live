import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    has_backend_url: !!process.env.BACKEND_API_URL,
    has_api_key: !!process.env.BACKEND_API_KEY,
    backend_url_prefix: process.env.BACKEND_API_URL?.substring(0, 30) + "...",
    api_key_prefix: process.env.BACKEND_API_KEY?.substring(0, 5) + "...",
  })
}