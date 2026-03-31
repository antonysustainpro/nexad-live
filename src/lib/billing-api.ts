/**
 * Billing API Client Functions
 * Uses server-side proxy to protect API keys
 * All functions support AbortSignal for proper cleanup
 *
 * REL-004: All functions use billingResilientFetch for automatic retry
 * with exponential backoff and circuit breaker protection.
 */

import { getCsrfToken } from "./csrf"
import { withRetry, withCircuitBreaker, type RetryOptions } from "./resilience"

// Use server-side proxy to hide API keys from client
const API_BASE = "/api/proxy"

// REL-004: Default retry config for read-only (GET) billing API calls
const BILLING_READ_RETRY: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 800,
  maxDelayMs: 5000,
  jitterFactor: 0.3,
}

// REL-004: Default retry config for mutating (POST) billing API calls
const BILLING_MUTATION_RETRY: RetryOptions = {
  maxRetries: 1,
  baseDelayMs: 1500,
  maxDelayMs: 5000,
  jitterFactor: 0.2,
}

/**
 * REL-004: Fetch with retry and circuit breaker for billing API.
 */
async function billingResilientFetch(
  url: string,
  init: RequestInit,
  retryOpts: RetryOptions = BILLING_READ_RETRY
): Promise<Response> {
  return withCircuitBreaker("billing-api", () =>
    withRetry(
      async () => {
        const response = await fetch(url, init)
        if (!response.ok && [500, 502, 503, 504].includes(response.status)) {
          throw new Error(`Billing API error: ${response.status}`)
        }
        return response
      },
      { ...retryOpts, signal: init.signal as AbortSignal | undefined }
    )
  )
}

// Helper to check if error is AbortError
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

// Helper to get auth headers with CSRF protection
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
  }
  return headers
}

export type BillingTier = "FREE" | "PRO" | "ENTERPRISE"

export interface Subscription {
  tier: BillingTier
  status: "active" | "canceled" | "past_due" | "trialing"
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  priceUsd: number
  priceAed: number
}

export interface UsageData {
  requests: { used: number; limit: number }
  domains: { active: number; limit: number }
  storage: { usedMb: number; limitMb: number }
}

export interface Invoice {
  id: string
  date: string
  amountUsd: number
  amountAed: number
  status: "paid" | "pending" | "failed"
  pdfUrl: string
}

export interface SubscribeRequest {
  tier: BillingTier
  payment_method_id: string
  billing_cycle: "monthly" | "annual"
}

export interface UpgradeRequest {
  new_tier: BillingTier
}

export interface DowngradeRequest {
  new_tier: BillingTier
}

/**
 * Get current subscription details
 * @param signal - AbortSignal for cancellation
 */
export async function getSubscription(signal?: AbortSignal): Promise<Subscription | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/subscription`,
      { headers: getAuthHeaders(), signal }
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Get current usage data
 * @param signal - AbortSignal for cancellation
 */
export async function getUsage(signal?: AbortSignal): Promise<UsageData | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/usage`,
      { headers: getAuthHeaders(), signal }
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Get invoice history
 * @param signal - AbortSignal for cancellation
 */
export async function getInvoices(signal?: AbortSignal): Promise<Invoice[] | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/invoices`,
      { headers: getAuthHeaders(), signal }
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Subscribe to a plan
 * @param data - Subscription request details
 * @param signal - AbortSignal for cancellation
 */
export async function subscribe(data: SubscribeRequest, signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/subscribe`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
        signal,
      },
      BILLING_MUTATION_RETRY
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Upgrade to a higher tier
 * @param data - Upgrade request details
 * @param signal - AbortSignal for cancellation
 */
export async function upgradePlan(data: UpgradeRequest, signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/upgrade`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
        signal,
      },
      BILLING_MUTATION_RETRY
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Downgrade to a lower tier
 * @param data - Downgrade request details
 * @param signal - AbortSignal for cancellation
 */
export async function downgradePlan(data: DowngradeRequest, signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/downgrade`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
        signal,
      },
      BILLING_MUTATION_RETRY
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Cancel current subscription
 * @param signal - AbortSignal for cancellation
 */
export async function cancelSubscription(signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await billingResilientFetch(
      `${API_BASE}/billing/cancel`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        signal,
      },
      BILLING_MUTATION_RETRY
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Tier configuration
export const TIER_CONFIG = {
  FREE: {
    priceUsdMonthly: 0,
    priceUsdAnnual: 0,
    requestsPerMin: 10,
    domains: 5,
    storageMb: 100,
    voice: false,
    rag: false,
    priority: false,
    dedicatedSupport: false,
    customSla: false,
  },
  PRO: {
    priceUsdMonthly: 500,
    priceUsdAnnual: 4800, // 20% discount
    requestsPerMin: 100,
    domains: 15,
    storageMb: 5000,
    voice: true,
    rag: true,
    priority: true,
    dedicatedSupport: false,
    customSla: false,
  },
  ENTERPRISE: {
    priceUsdMonthly: 1500,
    priceUsdAnnual: 14400, // 20% discount
    requestsPerMin: 1000,
    domains: -1, // unlimited
    storageMb: 50000,
    voice: true,
    rag: true,
    priority: true,
    dedicatedSupport: true,
    customSla: true,
  },
} as const

// Currency conversion
export const USD_TO_AED = 3.67

// SEC-BL-020: Guard against NaN/Infinity amounts producing garbage output
export function formatCurrency(
  amount: number,
  currency: "USD" | "AED",
  locale: string
): string {
  if (!Number.isFinite(amount)) return `${currency} 0`
  return amount.toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// SEC-BL-019: Guard against invalid date strings returning "Invalid Date"
export function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString // Fallback to raw string if unparseable
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
