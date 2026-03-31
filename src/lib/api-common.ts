/**
 * Common API utilities shared across all API modules
 * Provides consistent error handling, retry logic, and header management
 */

import { getCsrfToken } from "./csrf"
import { withRetry, withCircuitBreaker, type RetryOptions } from "./resilience"
import { checkRateLimit, RateLimitError } from "./rate-limiter"
import {
  getCorrelationId,
  getSessionId,
  auditApiCall,
  auditRateLimitHit,
} from "./audit-logger"

// Default retry config for read-only (GET) API calls
export const DEFAULT_READ_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  jitterFactor: 0.3,
}

// Default retry config for mutating (POST/PUT/DELETE) API calls
export const DEFAULT_MUTATION_RETRY: RetryOptions = {
  maxRetries: 1,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  jitterFactor: 0.2,
}

// Helper to check if error is AbortError
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

/**
 * Get common headers for API requests
 * Injects correlation ID and session ID on every request for full audit trail.
 * @param userId - Optional user ID to include in headers
 * @param contentType - Content type (defaults to application/json)
 */
export function getHeaders(userId?: string, contentType = "application/json"): HeadersInit {
  const headers: HeadersInit = {}

  if (contentType) {
    headers["Content-Type"] = contentType
  }

  if (userId) {
    headers["X-User-ID"] = userId
  }

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
  }

  // AUD-001: Inject correlation & session IDs for end-to-end audit trail
  // These headers link frontend events to backend logs
  try {
    headers["X-Correlation-Id"] = getCorrelationId()
    headers["X-Session-Id"] = getSessionId()
  } catch {
    // Never break a request because of audit header injection failure
  }

  return headers
}

/**
 * Get headers for file uploads (no Content-Type)
 */
export function getUploadHeaders(userId?: string): HeadersInit {
  return getHeaders(userId, "")
}

/**
 * Resilient fetch with retry, circuit breaker, and full audit trail.
 * @param url - The URL to fetch
 * @param init - Request init options
 * @param circuitName - Circuit breaker name for this API
 * @param retryOpts - Retry configuration (defaults based on method)
 */
export async function resilientFetch(
  url: string,
  init: RequestInit,
  circuitName: string,
  retryOpts?: RetryOptions
): Promise<Response> {
  // Default retry options based on HTTP method
  const method = (init.method || "GET").toUpperCase()
  const isReadOnly = method === "GET" || method === "HEAD" || method === "OPTIONS"
  const defaultRetry = isReadOnly ? DEFAULT_READ_RETRY : DEFAULT_MUTATION_RETRY
  const finalRetryOpts = retryOpts || defaultRetry

  // Strip query params from endpoint path for logging (may contain PII)
  let endpoint = url
  try {
    endpoint = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://x").pathname
  } catch {
    endpoint = url.split("?")[0]
  }

  // SEC-RL-001: Enforce client-side rate limit before any network request.
  // AUD-002: Log rate limit hits as security events for audit trail.
  try {
    checkRateLimit(url)
  } catch (err) {
    if (err instanceof RateLimitError) {
      try { auditRateLimitHit(err.group, endpoint) } catch { /* never break */ }
    }
    throw err
  }

  const startMs = Date.now()

  try {
    const response = await withCircuitBreaker(circuitName, () =>
      withRetry(
        async () => {
          const fetchResponse = await fetch(url, { ...init, credentials: "include" })

          // Retry on server errors
          if (!fetchResponse.ok && [500, 502, 503, 504].includes(fetchResponse.status)) {
            throw new Error(`API error: ${fetchResponse.status}`)
          }

          return fetchResponse
        },
        { ...finalRetryOpts, signal: init.signal as AbortSignal | undefined }
      )
    )

    // AUD-003: Log every API call with status, latency, and request ID
    try {
      auditApiCall({
        method,
        endpoint,
        statusCode: response.status,
        latencyMs: Date.now() - startMs,
        requestId: response.headers.get("x-request-id") ?? undefined,
      })
    } catch { /* never break */ }

    return response
  } catch (err) {
    // AUD-004: Log failed API calls
    try {
      auditApiCall({
        method,
        endpoint,
        latencyMs: Date.now() - startMs,
        error: err instanceof Error ? err.message : "fetch_failed",
      })
    } catch { /* never break */ }

    throw err
  }
}