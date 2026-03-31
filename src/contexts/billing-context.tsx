"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getSubscription, type BillingTier, type Subscription } from "@/lib/billing-api"
import { useAuth } from "@/contexts/auth-context"

interface BillingContextType {
  subscription: Subscription | null
  tier: BillingTier
  loading: boolean
  refreshSubscription: () => Promise<void>
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSubscription = async (signal?: AbortSignal) => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }

    try {
      const sub = await getSubscription(signal)
      setSubscription(sub)
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Failed to load subscription:", error)
      }
      setSubscription(null)
    } finally {
      if (signal && !signal.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadSubscription(controller.signal)
    return () => controller.abort()
  }, [user])

  const refreshSubscription = async () => {
    setLoading(true)
    await loadSubscription()
  }

  const tier = subscription?.status === "active" ? subscription.tier : "FREE"

  return (
    <BillingContext.Provider value={{ subscription, tier, loading, refreshSubscription }}>
      {children}
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const context = useContext(BillingContext)
  if (context === undefined) {
    throw new Error("useBilling must be used within a BillingProvider")
  }
  return context
}