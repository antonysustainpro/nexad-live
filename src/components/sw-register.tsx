"use client"

/**
 * PWA-002: Service Worker Registration
 *
 * Registers the service worker on production builds.
 * Handles updates gracefully by logging to console.
 * Does NOT register in development to avoid caching issues.
 */

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "development"
    ) {
      return
    }

    // Register after the page fully loads to avoid competing for bandwidth
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        })

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available — could show a toast here in the future
              console.log("[NexusAD] New version available. Refresh to update.")
            }
          })
        })
      } catch (error) {
        console.error("[NexusAD] Service worker registration failed:", error)
      }
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register, { once: true })
    }
  }, [])

  return null
}
