/**
 * REL-003: Frontend Resilience Utilities
 *
 * Provides retry with exponential backoff, circuit breaker pattern,
 * and network connectivity detection for the NexusAD frontend.
 *
 * These utilities make API calls resilient to transient failures
 * (network blips, 502/503/504 from backend) without overwhelming
 * a struggling server.
 */

// ============================================================
// Retry with Exponential Backoff (REL-004)
// ============================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number
  /** Jitter factor 0-1 to randomize delay (default: 0.3) */
  jitterFactor?: number
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses?: number[]
  /** AbortSignal to cancel retries */
  signal?: AbortSignal
  /** Called before each retry with attempt number and delay */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504]

/**
 * Determine if an error is retryable.
 * Network errors and specific HTTP statuses are retryable.
 * Abort errors and 4xx client errors (except 408/429) are NOT retryable.
 */
function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  // Never retry abort errors
  if (error instanceof Error && error.name === "AbortError") {
    return false
  }

  // Network failure (TypeError from fetch) is retryable
  if (error instanceof TypeError) {
    return true
  }

  // Check for HTTP status code errors
  if (error instanceof Error) {
    // Extract status from error message like "Chat API error: 503"
    const statusMatch = error.message.match(/(\d{3})/)
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10)
      return retryableStatuses.includes(status)
    }
  }

  return false
}

/**
 * Calculate delay with exponential backoff and jitter.
 * Formula: min(maxDelay, baseDelay * 2^attempt) * (1 + random * jitter)
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
  const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor
  return Math.round(exponentialDelay * jitter)
}

/**
 * Execute an async function with automatic retry and exponential backoff.
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetch('/api/data').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() }),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitterFactor = 0.3,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    signal,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if aborted before each attempt
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError")
    }

    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if this was the last attempt
      if (attempt >= maxRetries) {
        break
      }

      // Don't retry non-retryable errors
      if (!isRetryableError(error, retryableStatuses)) {
        break
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor)

      onRetry?.(attempt + 1, delay, error)

      // Wait with abort support
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay)

        if (signal) {
          const onAbort = () => {
            clearTimeout(timer)
            reject(new DOMException("The operation was aborted.", "AbortError"))
          }
          signal.addEventListener("abort", onAbort, { once: true })
          // Clean up listener when timer fires
          const originalResolve = resolve
          resolve = () => {
            signal.removeEventListener("abort", onAbort)
            originalResolve()
          }
        }
      })
    }
  }

  throw lastError
}

// ============================================================
// Circuit Breaker (REL-005)
// ============================================================

type CircuitState = "closed" | "open" | "half-open"

interface CircuitBreakerConfig {
  /** Number of consecutive failures to open the circuit (default: 5) */
  failureThreshold?: number
  /** Time in ms the circuit stays open before trying half-open (default: 60000) */
  resetTimeoutMs?: number
  /** Number of successful calls in half-open to close the circuit (default: 2) */
  halfOpenSuccessThreshold?: number
}

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  lastFailureTime: number
  halfOpenSuccessCount: number
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

function getOrCreateBreaker(name: string): CircuitBreakerState {
  let breaker = circuitBreakers.get(name)
  if (!breaker) {
    breaker = {
      state: "closed",
      failureCount: 0,
      lastFailureTime: 0,
      halfOpenSuccessCount: 0,
    }
    circuitBreakers.set(name, breaker)
  }
  return breaker
}

/**
 * Execute a function through a circuit breaker.
 *
 * When the circuit is open (too many recent failures), calls are rejected
 * immediately without hitting the backend, preventing cascade failures.
 *
 * @param name - Circuit breaker name (e.g., "chat-api", "vault-api")
 * @param fn - The async function to execute
 * @param config - Circuit breaker configuration
 *
 * @example
 * ```ts
 * const result = await withCircuitBreaker("chat-api", () => streamChat(request))
 * ```
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config: CircuitBreakerConfig = {}
): Promise<T> {
  const {
    failureThreshold = 5,
    resetTimeoutMs = 60_000,
    halfOpenSuccessThreshold = 2,
  } = config

  const breaker = getOrCreateBreaker(name)

  // Check if circuit should transition from open to half-open
  if (
    breaker.state === "open" &&
    Date.now() - breaker.lastFailureTime >= resetTimeoutMs
  ) {
    breaker.state = "half-open"
    breaker.halfOpenSuccessCount = 0
  }

  // Reject immediately if circuit is open
  if (breaker.state === "open") {
    const retryAfterMs = resetTimeoutMs - (Date.now() - breaker.lastFailureTime)
    throw new CircuitBreakerOpenError(name, retryAfterMs)
  }

  try {
    const result = await fn()

    // On success: close circuit or increment half-open success count
    if (breaker.state === "half-open") {
      breaker.halfOpenSuccessCount++
      if (breaker.halfOpenSuccessCount >= halfOpenSuccessThreshold) {
        breaker.state = "closed"
        breaker.failureCount = 0
      }
    } else {
      // Reset failure count on success in closed state
      breaker.failureCount = 0
    }

    return result
  } catch (error) {
    breaker.failureCount++
    breaker.lastFailureTime = Date.now()

    if (breaker.failureCount >= failureThreshold) {
      breaker.state = "open"
    }

    // In half-open state, any failure reopens the circuit
    if (breaker.state === "half-open") {
      breaker.state = "open"
    }

    throw error
  }
}

/**
 * Custom error thrown when the circuit breaker is open.
 * Consumers can check `error instanceof CircuitBreakerOpenError`
 * to show appropriate UI (e.g., "service temporarily unavailable").
 */
export class CircuitBreakerOpenError extends Error {
  public readonly circuitName: string
  public readonly retryAfterMs: number

  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit breaker '${circuitName}' is open. Retry after ${Math.round(retryAfterMs / 1000)}s.`)
    this.name = "CircuitBreakerOpenError"
    this.circuitName = circuitName
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Get the current state of a circuit breaker (useful for UI indicators).
 */
export function getCircuitBreakerState(name: string): CircuitState {
  return circuitBreakers.get(name)?.state ?? "closed"
}

/**
 * Reset a circuit breaker manually (e.g., after user clicks "retry").
 */
export function resetCircuitBreaker(name: string): void {
  circuitBreakers.delete(name)
}

// ============================================================
// Network Status Detection (REL-010)
// ============================================================

type NetworkStatusListener = (online: boolean) => void

const networkListeners: Set<NetworkStatusListener> = new Set()
let networkStatusInitialized = false

/**
 * Subscribe to network status changes.
 * Returns an unsubscribe function.
 *
 * @example
 * ```ts
 * const unsubscribe = onNetworkStatusChange((online) => {
 *   if (!online) showOfflineBanner()
 *   else hideOfflineBanner()
 * })
 * ```
 */
export function onNetworkStatusChange(listener: NetworkStatusListener): () => void {
  networkListeners.add(listener)

  // Initialize event listeners once
  if (typeof window !== "undefined" && !networkStatusInitialized) {
    networkStatusInitialized = true
    window.addEventListener("online", () => {
      networkListeners.forEach((l) => l(true))
    })
    window.addEventListener("offline", () => {
      networkListeners.forEach((l) => l(false))
    })
  }

  return () => {
    networkListeners.delete(listener)
  }
}

/**
 * Check if the browser is currently online.
 * Returns true on the server or if navigator.onLine is unavailable.
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true
  return navigator.onLine
}

// ============================================================
// Idempotency Key Generation (REL-011)
// ============================================================

/**
 * Generate an idempotency key for mutation requests.
 * This prevents duplicate operations if a request is retried.
 *
 * @returns A unique string key
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `idem_${crypto.randomUUID()}`
  }
  // Fallback
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  }
  return `idem_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`
}
