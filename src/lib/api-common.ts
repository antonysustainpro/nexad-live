/**
 * Common API utilities shared across all API modules
 * Provides consistent error handling, retry logic, and header management
 */

import { getCsrfToken } from "./csrf"
import { withRetry, withCircuitBreaker, type RetryOptions } from "./resilience"

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

  return headers
}

/**
 * Get headers for file uploads (no Content-Type)
 */
export function getUploadHeaders(userId?: string): HeadersInit {
  return getHeaders(userId, "")
}

/**
 * Resilient fetch with retry and circuit breaker
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

  return withCircuitBreaker(circuitName, () =>
    withRetry(
      async () => {
        const response = await fetch(url, { ...init, credentials: "include" })

        // Retry on server errors
        if (!response.ok && [500, 502, 503, 504].includes(response.status)) {
          throw new Error(`API error: ${response.status}`)
        }

        return response
      },
      { ...finalRetryOpts, signal: init.signal as AbortSignal | undefined }
    )
  )
}