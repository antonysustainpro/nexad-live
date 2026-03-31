/**
 * SEC-RL-001: Client-Side Rate Limiting
 *
 * Implements per-endpoint token bucket rate limiting to protect the backend
 * from being flooded, even from a single browser session.
 *
 * Design:
 *  - Token bucket algorithm: each endpoint has a bucket with a max capacity.
 *    Tokens refill continuously at `ratePerMinute / 60` tokens per second.
 *  - When a request arrives, one token is consumed. If the bucket is empty,
 *    a RateLimitError is thrown immediately (fail fast, no silent queuing).
 *  - All state is in-memory (per session). Refreshing the page resets limits.
 *  - Exponential backoff is already handled by `resilience.ts`; this layer
 *    prevents requests from even being dispatched when the client is over limit.
 *
 * Endpoint groups and their limits (requests per minute):
 *  chat          10  – LLM calls are expensive; hard cap to avoid runaway loops
 *  voice         6   – TTS/STT are very heavy; 1 every 10 s is generous
 *  auth          5   – Login/register brute-force protection
 *  vault         20  – Vault reads/writes; reasonable for interactive use
 *  billing       5   – Billing mutations should never be hammered
 *  sovereignty   15  – Status checks / score refreshes
 *  butler        15  – Feed polling
 *  conversations 30  – List/get are lightweight but still bounded
 *  search        10  – Semantic search is backend-expensive
 *  default       30  – Any endpoint not in the table above
 */

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum tokens (= burst size) */
  capacity: number
  /** How many tokens are added per minute */
  ratePerMinute: number
}

/** Canonical per-group limits. Adjust numbers here and the whole system follows. */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  chat:          { capacity: 10,  ratePerMinute: 10  },
  voice:         { capacity: 6,   ratePerMinute: 6   },
  auth:          { capacity: 5,   ratePerMinute: 5   },
  vault:         { capacity: 20,  ratePerMinute: 20  },
  billing:       { capacity: 5,   ratePerMinute: 5   },
  sovereignty:   { capacity: 15,  ratePerMinute: 15  },
  butler:        { capacity: 15,  ratePerMinute: 15  },
  conversations: { capacity: 30,  ratePerMinute: 30  },
  search:        { capacity: 10,  ratePerMinute: 10  },
  default:       { capacity: 30,  ratePerMinute: 30  },
}

// ──────────────────────────────────────────────────────────────────────────────
// Token Bucket implementation
// ──────────────────────────────────────────────────────────────────────────────

interface TokenBucket {
  /** Current available tokens (fractional to allow sub-second refill) */
  tokens: number
  /** Wall-clock timestamp of last refill calculation (ms) */
  lastRefillAt: number
  config: RateLimitConfig
}

/** All active buckets, keyed by endpoint group name */
const buckets = new Map<string, TokenBucket>()

function getOrCreateBucket(group: string): TokenBucket {
  let bucket = buckets.get(group)
  if (!bucket) {
    const config = RATE_LIMIT_CONFIGS[group] ?? RATE_LIMIT_CONFIGS.default
    bucket = {
      tokens: config.capacity,   // start full
      lastRefillAt: Date.now(),
      config,
    }
    buckets.set(group, bucket)
  }
  return bucket
}

/**
 * Refill the bucket based on elapsed time since last call.
 * Tokens are capped at capacity.
 */
function refillBucket(bucket: TokenBucket): void {
  const now = Date.now()
  const elapsedMs = now - bucket.lastRefillAt
  const tokensToAdd = (elapsedMs / 60_000) * bucket.config.ratePerMinute
  bucket.tokens = Math.min(bucket.config.capacity, bucket.tokens + tokensToAdd)
  bucket.lastRefillAt = now
}

/**
 * Attempt to consume one token from the named group's bucket.
 * Returns `true` if the token was granted, `false` if the bucket is empty.
 */
export function tryConsume(group: string): boolean {
  const bucket = getOrCreateBucket(group)
  refillBucket(bucket)

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return true
  }
  return false
}

/**
 * How many seconds until the next token is available for a group.
 * Returns 0 if tokens are currently available.
 */
export function secondsUntilNextToken(group: string): number {
  const bucket = getOrCreateBucket(group)
  refillBucket(bucket)

  if (bucket.tokens >= 1) return 0
  const deficit = 1 - bucket.tokens
  const refillRatePerSecond = bucket.config.ratePerMinute / 60
  return Math.ceil(deficit / refillRatePerSecond)
}

/**
 * Get a snapshot of a bucket's current state. Useful for debug UIs.
 */
export function getBucketSnapshot(group: string): {
  group: string
  tokens: number
  capacity: number
  ratePerMinute: number
} {
  const bucket = getOrCreateBucket(group)
  refillBucket(bucket)
  return {
    group,
    tokens: Math.floor(bucket.tokens),
    capacity: bucket.config.capacity,
    ratePerMinute: bucket.config.ratePerMinute,
  }
}

/**
 * Reset a specific bucket (e.g., for testing or manual operator override).
 */
export function resetBucket(group: string): void {
  buckets.delete(group)
}

/**
 * Reset ALL buckets. Use sparingly (e.g., on user logout so a fresh session
 * starts with full allowances).
 */
export function resetAllBuckets(): void {
  buckets.clear()
}

// ──────────────────────────────────────────────────────────────────────────────
// Error class
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when the client-side rate limit for an endpoint group is exceeded.
 *
 * @example
 * ```ts
 * try {
 *   await callChatApi(...)
 * } catch (err) {
 *   if (err instanceof RateLimitError) {
 *     showToast(`Too many requests. Try again in ${err.retryAfterSeconds}s.`)
 *   }
 * }
 * ```
 */
export class RateLimitError extends Error {
  /** The endpoint group that was rate limited */
  public readonly group: string
  /** Suggested number of seconds to wait before retrying */
  public readonly retryAfterSeconds: number
  /** Human-readable message safe to display in the UI */
  public readonly userMessage: string

  constructor(group: string, retryAfterSeconds: number) {
    const msg = `Slow down — you can send ${RATE_LIMIT_CONFIGS[group]?.ratePerMinute ?? RATE_LIMIT_CONFIGS.default.ratePerMinute} requests per minute to "${group}". Try again in ${retryAfterSeconds}s.`
    super(msg)
    this.name = "RateLimitError"
    this.group = group
    this.retryAfterSeconds = retryAfterSeconds
    this.userMessage = `Too many requests. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} before trying again.`
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// URL → group mapping
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Derive the rate-limit group from a URL path.
 *
 * Rules are checked top-to-bottom; first match wins.
 * Extend this table whenever a new API area is added.
 */
export function urlToGroup(url: string): string {
  // Normalise to just the path portion for matching
  let path = url
  try {
    path = new URL(url, "http://x").pathname
  } catch {
    // url is already a relative path — use as-is
  }

  const p = path.toLowerCase()

  if (p.includes("/chat"))           return "chat"
  if (p.includes("/voice"))          return "voice"
  if (p.includes("/auth"))           return "auth"
  if (p.includes("/vault"))          return "vault"
  if (p.includes("/billing"))        return "billing"
  if (p.includes("/sovereignty"))    return "sovereignty"
  if (p.includes("/butler"))         return "butler"
  if (p.includes("/conversations"))  return "conversations"
  if (p.includes("/memory/search"))  return "search"

  return "default"
}

// ──────────────────────────────────────────────────────────────────────────────
// Guard function — the single integration point for fetch wrappers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check the rate limit for `url` and throw `RateLimitError` if exceeded.
 * Call this at the top of any fetch wrapper before dispatching the request.
 *
 * @example
 * ```ts
 * // In resilientFetch or any fetch wrapper:
 * checkRateLimit(url)
 * const response = await fetch(url, init)
 * ```
 */
export function checkRateLimit(url: string): void {
  const group = urlToGroup(url)
  const allowed = tryConsume(group)
  if (!allowed) {
    const waitSeconds = secondsUntilNextToken(group)
    throw new RateLimitError(group, waitSeconds)
  }
}
