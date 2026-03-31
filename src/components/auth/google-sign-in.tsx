"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { getCsrfToken } from "@/lib/csrf"

declare global {
  interface Window {
    google: any
  }
}

interface GoogleSignInProps {
  language: "en" | "ar" | "bilingual"
  onSuccess?: () => void
}

export function GoogleSignIn({ language, onSuccess }: GoogleSignInProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    // Only initialize once
    if (isInitialized.current) return
    isInitialized.current = true

    // Load Google Identity Services library
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    document.body.appendChild(script)

    script.onload = () => {
      if (!window.google) return

      // Initialize Google Sign-In
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      })

      // Render the button
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(
          buttonRef.current,
          {
            theme: "outline",
            size: "large",
            width: buttonRef.current.offsetWidth,
            text: "continue_with",
            locale: language === "ar" ? "ar" : "en",
          }
        )
      }
    }

    return () => {
      // Cleanup on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [language])

  const handleCredentialResponse = async (response: any) => {
    try {
      // Get the ID token from Google
      const idToken = response.credential

      // Send to our backend
      const csrfToken = getCsrfToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken

      const res = await fetch("/api/proxy/auth/google/oauth-login", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ access_token: idToken }),
      })

      if (res.ok) {
        const data = await res.json()

        // Store minimal display info
        try {
          if (data.user) {
            const safeUserInfo = {
              id: data.user.id,
              displayName: data.user.fullName?.split(" ")[0] || data.user.name?.split(" ")[0] || "User",
            }
            localStorage.setItem("nexus-user-display", JSON.stringify(safeUserInfo))
          }
        } catch {
          // localStorage unavailable
        }

        // If backend returns a token, we need to set it as a session cookie
        if (data.token) {
          // Call our auth callback endpoint to set the session cookie
          const callbackRes = await fetch(`/auth/callback?token=${encodeURIComponent(data.token)}`, {
            method: "GET",
            credentials: "include",
          })

          if (callbackRes.ok) {
            toast.success(language === "ar" ? "تم تسجيل الدخول بنجاح" : "Login successful")

            // Hard navigation to ensure cookies are properly set
            if (onSuccess) {
              onSuccess()
            } else {
              window.location.href = "/"
            }
          } else {
            throw new Error("Failed to set session")
          }
        } else {
          throw new Error("No token received from backend")
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Login failed")
      }
    } catch (error: any) {
      console.error("Google login error:", error)
      toast.error(
        error.message ||
        (language === "ar" ? "فشل تسجيل الدخول بواسطة Google" : "Google login failed")
      )
    }
  }

  // Fallback button if Google script doesn't load
  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="outline"
      className="w-full border-white/10 bg-secondary/50 hover:bg-secondary/80"
      onClick={() => {
        // Trigger Google Sign-In programmatically
        if (window.google?.accounts?.id) {
          window.google.accounts.id.prompt()
        } else {
          toast.error(language === "ar" ? "خدمة Google غير متاحة" : "Google service unavailable")
        }
      }}
    >
      <svg className="h-5 w-5 me-2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {language === "ar" ? "المتابعة مع Google" : "Continue with Google"}
    </Button>
  )
}