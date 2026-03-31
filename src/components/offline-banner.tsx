"use client"

/**
 * REL-010: Offline Detection Banner
 *
 * Displays a non-intrusive banner when the user loses network connectivity.
 * Automatically hides when the connection is restored.
 * Uses the browser's navigator.onLine API + online/offline events.
 */

import { useState, useEffect } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { onNetworkStatusChange, isOnline } from "@/lib/resilience"
import { cn } from "@/lib/utils"

export function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)

  useEffect(() => {
    // Set initial state
    setOnline(isOnline())

    const unsubscribe = onNetworkStatusChange((isNowOnline) => {
      setOnline(isNowOnline)

      if (isNowOnline) {
        // Show a brief "back online" message
        setShowRecovery(true)
        const timer = setTimeout(() => setShowRecovery(false), 3000)
        return () => clearTimeout(timer)
      }
    })

    return unsubscribe
  }, [])

  // Nothing to show when online and not recovering
  if (online && !showRecovery) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-300 safe-area-pt",
        online
          ? "bg-emerald-600/90 text-white"
          : "bg-amber-600/90 text-white"
      )}
    >
      {online ? (
        <>
          <Wifi className="h-4 w-4" aria-hidden="true" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>You are offline. Some features may be unavailable.</span>
        </>
      )}
    </div>
  )
}
