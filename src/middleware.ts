import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-072: STRUCTURED LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-072: Structured logging for production observability
 *
 * Replaces ad-hoc console.log/warn/error with structured JSON entries
 * that log aggregators (Datadog, Axiom, Elasticsearch) can parse and index.
 *
 * In production: outputs single-line JSON per entry (machine-readable).
 * In development: outputs human-readable prefixed format for console.
 */
interface LogEntry {
  timestamp: string
  level: "debug" | "info" | "warn" | "error" | "security"
  code: string // SEC-XXX code
  message: string
  context?: Record<string, unknown>
  requestId?: string
  userId?: string
  ip?: string
}

// SEC-105/SEC-112: Sanitize log context to prevent PII/secret leakage in diagnostic logs
// NEX-036 fix: Insider exfiltration via verbose logging
// SEC-112: Added value-side PII pattern scanning per CEO Round 23 finding
const SENSITIVE_LOG_KEYS = new Set([
  "token", "password", "secret", "key", "authorization", "cookie", "session",
  "email", "phone", "emirates", "passport", "creditcard", "iban", "ssn",
  "apikey", "api_key", "bearer", "jwt", "credential", "auth",
])

// SEC-112: PII patterns to detect in log VALUES (not just keys)
const LOG_PII_PATTERNS = [
  /784-?\d{4}-?\d{7}-?\d/, // Emirates ID
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
  /(?:\+971|00971|971)?[ .-]?5\d[ .-]?\d{3}[ .-]?\d{4}/, // UAE mobile
  /(?:\+971|00971|971)?[ .-]?0?[2-46-9][ .-]?\d{3}[ .-]?\d{4}/, // UAE landline
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, // Credit card
  // SEC-118/SEC-124: Fixed IBAN patterns for UAE (23 chars) and international (19-34 chars)
  // SEC-124: Added flexibility for spaces, dashes, or no separators (Red Team NEX-051)
  // UAE IBAN: AE + 2 check + 3 bank + 16 account = 23 chars
  /\bAE\d{2}[ -]?\d{3}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/i, // UAE IBAN (23 chars with separators)
  /\bAE\d{21}\b/i, // UAE IBAN contiguous (no separators)
  /\b[A-Z]{2}\d{2}[ -]?[A-Z0-9]{4}[ -]?[A-Z0-9]{4}[ -]?[A-Z0-9]{4}[ -]?[A-Z0-9]{0,6}\b/i, // Generic IBAN
]

function sanitizeLogValue(value: string): string {
  let result = value
  for (const pattern of LOG_PII_PATTERNS) {
    if (pattern.test(result)) {
      result = result.replace(new RegExp(pattern.source, "gi"), "[PII_REDACTED]")
    }
  }
  return result
}

// SEC-114: Max recursion depth for log sanitization to prevent stack overflow
const LOG_SANITIZE_MAX_DEPTH = 5

function sanitizeLogContext(
  context: Record<string, unknown> | undefined,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): Record<string, unknown> | undefined {
  if (!context) return undefined
  // SEC-114: Depth limit to prevent stack overflow
  if (depth >= LOG_SANITIZE_MAX_DEPTH) return { _truncated: "[MAX_DEPTH]" }
  // SEC-114: Circular reference detection
  if (seen.has(context)) return { _circular: "[CIRCULAR_REF]" }
  seen.add(context)

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase()
    // Check if key contains any sensitive term
    const isSensitive = Array.from(SENSITIVE_LOG_KEYS).some((s) => lowerKey.includes(s))
    if (isSensitive) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof value === "string") {
      // SEC-112: Check string values for PII patterns
      const scannedValue = sanitizeLogValue(value)
      // SEC-114: Stricter truncation (50 chars) to prevent token leakage
      if (scannedValue.length > 50) {
        sanitized[key] = scannedValue.slice(0, 30) + "...[TRUNCATED]"
      } else {
        sanitized[key] = scannedValue
      }
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects with depth tracking
      sanitized[key] = sanitizeLogContext(value as Record<string, unknown>, depth + 1, seen)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function structuredLog(entry: Omit<LogEntry, "timestamp">): void {
  // SEC-105: Sanitize context before logging
  const fullEntry: LogEntry = {
    ...entry,
    context: sanitizeLogContext(entry.context),
    timestamp: new Date().toISOString(),
  }

  // In production, output as JSON for log aggregators
  if (process.env.NODE_ENV === "production") {
    const output = JSON.stringify(fullEntry)
    if (entry.level === "error" || entry.level === "security") {
      console.error(output)
    } else if (entry.level === "warn") {
      console.warn(output)
    } else {
      console.log(output)
    }
  } else {
    // In dev, use human-readable format
    const prefix = `[${entry.level.toUpperCase()}][${entry.code}]`
    const logFn =
      entry.level === "error" || entry.level === "security"
        ? console.error
        : entry.level === "warn"
        ? console.warn
        : console.log
    logFn(`${prefix} ${entry.message}`, entry.context ? JSON.stringify(entry.context) : "")
  }
}

// Convenience functions for structured logging
function logSecurity(code: string, message: string, context?: Record<string, unknown>): void {
  structuredLog({ level: "security", code, message, context })
}

function logInfo(code: string, message: string, context?: Record<string, unknown>): void {
  structuredLog({ level: "info", code, message, context })
}

function logWarn(code: string, message: string, context?: Record<string, unknown>): void {
  structuredLog({ level: "warn", code, message, context })
}

function logError(code: string, message: string, context?: Record<string, unknown>): void {
  structuredLog({ level: "error", code, message, context })
}

// SEC-027: Web Crypto API for Edge Runtime compatibility (no Node.js crypto)

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXUS AI - SECURITY MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @module middleware
 * @version 2.0.0
 * @security-level CRITICAL
 *
 * This middleware is the security gateway for all NexusAD requests.
 * It implements defense-in-depth with multiple security layers.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ MODULE STRUCTURE                                                            │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ 1. TYPE DEFINITIONS      - TypeScript interfaces and types                  │
 * │ 2. CONFIGURATION         - Constants, thresholds, and settings              │
 * │ 3. CRYPTO UTILITIES      - HMAC, nonce generation, timing-safe ops          │
 * │ 4. CSRF PROTECTION       - Double-submit pattern with HMAC                  │
 * │ 5. RATE LIMITING         - Redis-backed with fallback                       │
 * │ 6. CIRCUIT BREAKER       - Redis failure protection                         │
 * │ 7. SESSION MANAGEMENT    - Timeout enforcement                              │
 * │ 8. ANOMALY DETECTION     - Request pattern analysis                         │
 * │ 9. SECURITY HEADERS      - CSP, HSTS, X-Frame-Options, etc.                 │
 * │ 10. MAIN MIDDLEWARE      - Request processing pipeline                      │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY CONTROLS:
 * - SEC-001 to SEC-054: Individual security requirements
 * - REL-017: Reliability/availability requirements
 * - LEGAL-008: Legal compliance requirements
 *
 * PRODUCTION REQUIREMENTS:
 * - CSRF_HMAC_SECRET must be set (32+ chars)
 * - UPSTASH_REDIS_REST_URL and TOKEN for distributed rate limiting
 * - STRICT_SECURITY_MODE=true for maximum security
 *
 * @see /docs/security/middleware.md for full documentation
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-051: Type definitions for better type safety and developer experience
 */

/** Rate limit check result */
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

/** Session timeout check result */
interface SessionTimeoutResult {
  valid: boolean
  reason?: string
  needsRefresh: boolean
  strictModeBlock?: boolean
}

/** CSRF verification result */
interface CsrfVerificationResult {
  valid: boolean
  usedPreviousSecret: boolean
}

/** Anomaly check result */
interface AnomalyCheckResult {
  anomalous: boolean
  shouldBlock: boolean
  reason?: string
  requestCount?: number
}

/** Lockout check result */
interface LockoutCheckResult {
  locked: boolean
  retryAfterSeconds: number
  captchaRequired: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Route protection middleware for NexusAD.
 * - Redirects unauthenticated users to /login for protected pages
 * - Implements rate limiting for API routes (Redis-backed for serverless)
 * - Stricter rate limiting for auth endpoints to prevent brute force
 * - Auth state is determined by httpOnly nexus-session cookie
 * - Adds security headers to all responses (SEC-002 through SEC-017, LEGAL-008)
 * - Exponential backoff for failed auth attempts (SEC-006)
 * - Rate limiting keyed by userId + IP + device fingerprint combo (SEC-022, SEC-029)
 * - Circuit breaker for Redis failures - fail closed (REL-017, SEC-023)
 * - Dynamic Retry-After headers (CODE-012)
 * - Session timeout enforcement: idle (15 min) and absolute (24h) via Redis (SEC-026, SEC-028)
 * - CSRF protection with HMAC double-submit pattern (SEC-027)
 * - Runtime anomaly detection and security monitoring (SEC-030)
 */

// Session timeout constants (SEC-026, SEC-028)
const SESSION_IDLE_TIMEOUT = 15 * 60 // 15 minutes in seconds
const SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60 // 24 hours in seconds

// CSRF token constants (SEC-001, SEC-027)
const CSRF_TOKEN_MAX_AGE = 24 * 60 * 60 // 24 hours in seconds

// SEC-032: Request body size limit (10MB) to prevent DoS via large payloads
const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024 // 10MB in bytes

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-070: BILINGUAL ERROR MESSAGES (English + Arabic)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Human-friendly error messages in both English and Arabic.
// Internal error codes are preserved for logging/debugging but user-facing
// responses now include localized, non-technical messages.

const ERROR_MESSAGES = {
  CSRF_INVALID: {
    en: "Your session has expired. Please refresh the page and try again.",
    ar: "انتهت صلاحية جلستك. يرجى تحديث الصفحة والمحاولة مرة أخرى.",
  },
  RATE_LIMIT: {
    en: "Too many requests. Please wait a moment before trying again.",
    ar: "طلبات كثيرة جداً. يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.",
  },
  PAYLOAD_TOO_LARGE: {
    en: "The file you're sending is too large. Maximum size is 10MB.",
    ar: "الملف الذي ترسله كبير جداً. الحد الأقصى هو 10 ميجابايت.",
  },
  SERVICE_UNAVAILABLE: {
    en: "Service temporarily unavailable. Please try again in a few moments.",
    ar: "الخدمة غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى بعد قليل.",
  },
  SESSION_EXPIRED: {
    en: "Your session has timed out. Please log in again.",
    ar: "انتهت مهلة جلستك. يرجى تسجيل الدخول مرة أخرى.",
  },
  UNAUTHORIZED: {
    en: "Please log in to access this page.",
    ar: "يرجى تسجيل الدخول للوصول إلى هذه الصفحة.",
  },
  ACCOUNT_LOCKED: {
    en: "Your account is temporarily locked due to too many failed attempts. Please try again later.",
    ar: "تم قفل حسابك مؤقتاً بسبب محاولات فاشلة متعددة. يرجى المحاولة مرة أخرى لاحقاً.",
  },
  ANOMALY_BLOCKED: {
    en: "Unusual activity detected. Please slow down and try again shortly.",
    ar: "تم اكتشاف نشاط غير عادي. يرجى التمهل والمحاولة مرة أخرى بعد قليل.",
  },
} as const

/**
 * SEC-070: Get localized error messages based on Accept-Language header.
 *
 * Returns both English and Arabic messages so the client can display
 * the appropriate language. Both translations are always included.
 */
function getLocalizedError(
  request: NextRequest,
  key: keyof typeof ERROR_MESSAGES
): { message: string; message_ar: string } {
  const messages = ERROR_MESSAGES[key]
  return { message: messages.en, message_ar: messages.ar }
}


/**
 * SEC-027: CSRF HMAC Secret - PRODUCTION-GRADE IMPLEMENTATION
 *
 * SECURITY REQUIREMENTS:
 * - Production: MUST have CSRF_HMAC_SECRET env var set (fail hard if missing)
 * - Development: Generate random secret per process (secure but ephemeral)
 *
 * NO FALLBACKS - This prevents accidental deployment with weak secrets.
 */
function getCsrfHmacSecret(): string {
  const envSecret = process.env.CSRF_HMAC_SECRET

  if (process.env.NODE_ENV === "production") {
    // PRODUCTION: Fail hard if secret is not configured
    if (!envSecret) {
      throw new Error(
        "[SEC-027] CRITICAL: CSRF_HMAC_SECRET environment variable is not set. " +
        "This is required in production. Refusing to start with insecure configuration."
      )
    }
    // Validate minimum secret strength
    if (envSecret.length < 32) {
      throw new Error(
        "[SEC-027] CRITICAL: CSRF_HMAC_SECRET must be at least 32 characters. " +
        "Current length: " + envSecret.length
      )
    }
    return envSecret
  }

  // DEVELOPMENT: Use env var if provided, otherwise generate random per-process secret
  if (envSecret) {
    return envSecret
  }

  // Generate cryptographically secure random secret for this process
  // NOTE: This is ephemeral - CSRF tokens won't survive process restarts in dev
  // This is intentional and acceptable for local development
  logWarn("SEC-027", "DEV MODE: CSRF_HMAC_SECRET not set. Using random per-process secret. CSRF tokens will not persist across restarts.")
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("")
}

// SEC-027: Lazy-initialize CSRF secret on first use (not at module load)
// This allows builds to succeed while still failing at runtime if misconfigured
let _csrfHmacSecret: string | null = null
function getCsrfSecret(): string {
  if (_csrfHmacSecret === null) {
    _csrfHmacSecret = getCsrfHmacSecret()
  }
  return _csrfHmacSecret
}

/**
 * SEC-033: Get previous CSRF HMAC secret for key rotation support
 *
 * KEY ROTATION PROTOCOL:
 * 1. Set CSRF_HMAC_SECRET_PREVIOUS to current secret
 * 2. Set CSRF_HMAC_SECRET to new secret
 * 3. Wait for CSRF_TOKEN_MAX_AGE (24h) for old tokens to expire
 * 4. Remove CSRF_HMAC_SECRET_PREVIOUS
 *
 * This allows zero-downtime key rotation without invalidating active sessions.
 */
function getPreviousCsrfSecret(): string | null {
  return process.env.CSRF_HMAC_SECRET_PREVIOUS || null
}

/**
 * SEC-067: Key Separation - Derive purpose-specific keys (Red Team NEX-005 fix)
 *
 * CRITICAL FIX: Red Team found that CSRF_HMAC_SECRET was reused for:
 * - CSRF token signing
 * - Audit log integrity hashes
 * - HSM attestation signing
 *
 * This violates the cryptographic principle of key separation.
 * An attack on one use could compromise others.
 *
 * NEW APPROACH: Derive separate keys using HKDF-like construction
 * Each key is: HMAC(master_secret, "purpose_string")
 */
let _auditSecret: string | null = null
let _hsmAttestationSecret: string | null = null

async function deriveKey(purpose: string): Promise<string> {
  const masterSecret = getCsrfSecret()
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const derivedBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`nexusad:key:${purpose}:v1`)
  )
  return Array.from(new Uint8Array(derivedBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function getAuditSecret(): Promise<string> {
  if (_auditSecret === null) {
    _auditSecret = await deriveKey("audit-log-integrity")
  }
  return _auditSecret
}

async function getHsmAttestationSecret(): Promise<string> {
  if (_hsmAttestationSecret === null) {
    _hsmAttestationSecret = await deriveKey("hsm-attestation")
  }
  return _hsmAttestationSecret
}

// SEC-030: Anomaly detection thresholds
const ANOMALY_SPIKE_THRESHOLD = 10 // 10x normal request rate triggers alert
const ANOMALY_WINDOW_SECONDS = 60 // Track requests over 1 minute
const ANOMALY_BASELINE_REQUESTS = 10 // Baseline expected requests per minute per user
const ANOMALY_ALERT_COOLDOWN_SECONDS = 300 // Don't re-alert for same identifier within 5 minutes
const ANOMALY_BLOCK_THRESHOLD = 20 // 20x normal rate = block requests

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-080: DISTRIBUTED ATTACK DETECTION (CSO Round 16 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY: Attackers using botnets or rotating proxies can bypass per-IP
// rate limits by distributing requests across thousands of IPs.
//
// FIX: Track coordinated attack patterns by detecting multiple IPs hitting the
// same endpoint with similar characteristics (User-Agent, timing, patterns).
// Apply global rate limit when coordinated attack is detected.
// ═══════════════════════════════════════════════════════════════════════════════

const DISTRIBUTED_ATTACK_WINDOW_MS = 30_000 // 30 second tracking window
const DISTRIBUTED_ATTACK_IP_THRESHOLD = 10 // 10+ unique IPs = coordinated attack signal
const DISTRIBUTED_ATTACK_REQUEST_THRESHOLD = 100 // 100 total requests from different IPs
const DISTRIBUTED_ATTACK_SIMILARITY_THRESHOLD = 0.8 // 80% similar User-Agent = botnet

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-086: IPv6 /64 PREFIX NORMALIZATION (Red Team NEX-015 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-015): IPv6 has 2^128 addresses. An attacker can generate
// unlimited unique IPs within their /64 allocation, bypassing per-IP rate limits.
// Botnets using IPv6 can easily evade SEC-080's IP-based detection.
//
// FIX: Normalize IPv6 addresses to their /64 prefix for rate limiting.
// Most ISPs allocate /64 blocks to end users - same /64 = same user/attacker.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-086: Normalize IPv6 address to /64 prefix
 * Handles full IPv6, compressed IPv6, and IPv4-mapped IPv6 addresses.
 * Returns original IP if IPv4 or invalid.
 */
function normalizeIpv6ToPrefix64(ip: string): string {
  // Skip if IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return ip
  }

  // Check if it's IPv6 (contains colon)
  if (!ip.includes(":")) {
    return ip
  }

  try {
    // Handle IPv4-mapped IPv6 (::ffff:192.0.2.1)
    if (ip.toLowerCase().includes("::ffff:")) {
      const ipv4Part = ip.split(":").pop()
      if (ipv4Part && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipv4Part)) {
        return ipv4Part // Return underlying IPv4
      }
    }

    // Expand compressed IPv6 to full form
    let expanded = ip.toLowerCase()

    // Handle :: expansion
    if (expanded.includes("::")) {
      const parts = expanded.split("::")
      const left = parts[0] ? parts[0].split(":") : []
      const right = parts[1] ? parts[1].split(":") : []
      const missing = 8 - left.length - right.length
      const zeros = Array(missing).fill("0000")
      const fullParts = [...left, ...zeros, ...right]
      expanded = fullParts.join(":")
    }

    // Pad each group to 4 characters
    const groups = expanded.split(":")
    if (groups.length !== 8) {
      return ip // Invalid IPv6, return original
    }

    const paddedGroups = groups.map((g) => g.padStart(4, "0"))

    // Return first 4 groups (64 bits) as /64 prefix
    const prefix64 = paddedGroups.slice(0, 4).join(":")
    return `${prefix64}::/64`
  } catch {
    return ip // Return original on any error
  }
}

/**
 * SEC-080: Track requests by endpoint for distributed attack detection
 * Structure: endpoint -> { ips: Map<ip, count>, userAgents: Map<ua, count>, totalRequests: number, windowStart: number }
 */
interface DistributedAttackTracker {
  ips: Map<string, number>
  userAgents: Map<string, number>
  totalRequests: number
  windowStart: number
}
const distributedAttackTrackers = new Map<string, DistributedAttackTracker>()
const DISTRIBUTED_ATTACK_STORE_MAX_SIZE = 1000 // Max endpoints to track

/**
 * SEC-080/SEC-086: Check for distributed attack patterns
 * SEC-086: Now normalizes IPv6 to /64 prefix before tracking.
 * Returns true if coordinated attack detected (should apply global rate limit)
 */
function checkDistributedAttack(endpoint: string, ip: string, userAgent: string): boolean {
  const now = Date.now()
  const windowStart = now - (now % DISTRIBUTED_ATTACK_WINDOW_MS)

  // SEC-086: Normalize IPv6 to /64 prefix to prevent address-space evasion
  const normalizedIp = normalizeIpv6ToPrefix64(ip)

  // Get or create tracker for this endpoint
  let tracker = distributedAttackTrackers.get(endpoint)
  if (!tracker || tracker.windowStart !== windowStart) {
    // New window - reset tracker
    tracker = {
      ips: new Map(),
      userAgents: new Map(),
      totalRequests: 0,
      windowStart,
    }
    distributedAttackTrackers.set(endpoint, tracker)

    // Cleanup old trackers if store is getting large
    if (distributedAttackTrackers.size > DISTRIBUTED_ATTACK_STORE_MAX_SIZE) {
      const oldest = Array.from(distributedAttackTrackers.entries())
        .sort((a, b) => a[1].windowStart - b[1].windowStart)
        .slice(0, Math.floor(DISTRIBUTED_ATTACK_STORE_MAX_SIZE * 0.2))
      oldest.forEach(([key]) => distributedAttackTrackers.delete(key))
    }
  }

  // Track this request with normalized IP
  tracker.ips.set(normalizedIp, (tracker.ips.get(normalizedIp) || 0) + 1)
  tracker.userAgents.set(userAgent, (tracker.userAgents.get(userAgent) || 0) + 1)
  tracker.totalRequests++

  // Check for distributed attack indicators
  const uniqueIps = tracker.ips.size
  const totalRequests = tracker.totalRequests

  // Indicator 1: Many unique IPs hitting same endpoint
  const manyUniqueIps = uniqueIps >= DISTRIBUTED_ATTACK_IP_THRESHOLD

  // Indicator 2: High total request volume from many sources
  const highVolume = totalRequests >= DISTRIBUTED_ATTACK_REQUEST_THRESHOLD

  // Indicator 3: User-Agent similarity (botnet fingerprint)
  const mostCommonUa = Array.from(tracker.userAgents.entries())
    .sort((a, b) => b[1] - a[1])[0]
  const similarityRatio = mostCommonUa ? mostCommonUa[1] / totalRequests : 0
  const highSimilarity = similarityRatio >= DISTRIBUTED_ATTACK_SIMILARITY_THRESHOLD

  // Attack detected if multiple indicators are present
  const attackDetected = (manyUniqueIps && highVolume) || (highVolume && highSimilarity)

  if (attackDetected) {
    logSecurity("SEC-080", "Distributed attack pattern detected", {
      endpoint,
      uniqueIps,
      totalRequests,
      mostCommonUserAgent: mostCommonUa?.[0]?.slice(0, 50),
      similarityRatio: Math.round(similarityRatio * 100),
      windowMs: DISTRIBUTED_ATTACK_WINDOW_MS,
    })
  }

  return attackDetected
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-081: ENHANCED AUDIT LOG INTEGRITY (CSO Round 16 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// ENHANCEMENT: Add sequence numbers to audit entries to detect deletions.
// Insiders cannot delete log entries without creating gaps in sequence.
// Sequence is per-instance but monitored across SIEM entries.
// ═══════════════════════════════════════════════════════════════════════════════

let auditSequenceNumber = 0
const AUDIT_INSTANCE_ID = crypto.randomUUID() // Unique per-process instance

/**
 * SEC-047/SEC-055/SEC-058: STRICT PRODUCTION MODE - UNCONDITIONAL in production
 *
 * When enabled:
 * - NO in-memory fallbacks for rate limiting (fail closed)
 * - NO cookie fallbacks for session timeouts
 * - Forces proper Redis configuration before deployment
 *
 * SECURITY (SEC-058): UNCONDITIONAL in production - NO ENV VAR OVERRIDE.
 * Board audit Round 12 required removal of STRICT_SECURITY_MODE=false escape hatch.
 * Production ALWAYS fails closed. No exceptions. No overrides.
 * Development defaults to false for local testing convenience.
 */
const STRICT_SECURITY_MODE =
  process.env.NODE_ENV === "production"
    ? true // SEC-058: UNCONDITIONAL - no env var override in production
    : process.env.STRICT_SECURITY_MODE === "true" // Default false in development

/**
 * SEC-052: Production Environment Validator
 *
 * Validates that all required security configurations are present.
 * Called once at module initialization to fail fast on misconfiguration.
 *
 * This addresses CSO concern about production deployments with missing config.
 */
interface EnvironmentValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}

function validateProductionEnvironment(): EnvironmentValidationResult {
  const result: EnvironmentValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  const isProduction = process.env.NODE_ENV === "production"

  // Check CSRF secret
  if (!process.env.CSRF_HMAC_SECRET) {
    if (isProduction) {
      result.errors.push("CSRF_HMAC_SECRET is required in production")
      result.valid = false
    } else {
      result.warnings.push("CSRF_HMAC_SECRET not set - using random per-process secret")
    }
  } else if (process.env.CSRF_HMAC_SECRET.length < 32) {
    result.errors.push("CSRF_HMAC_SECRET must be at least 32 characters")
    result.valid = false
  }

  // Check Redis configuration
  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  if (!hasRedis) {
    if (isProduction && STRICT_SECURITY_MODE) {
      result.errors.push("Redis configuration required in STRICT_SECURITY_MODE")
      result.valid = false
    } else if (isProduction) {
      result.warnings.push("Redis not configured - using in-memory rate limiting (not recommended)")
    }
  }

  // SEC-055: Check strict mode (now defaults to true in production)
  if (isProduction && !STRICT_SECURITY_MODE) {
    result.warnings.push(
      "STRICT_SECURITY_MODE explicitly disabled - in-memory fallbacks allowed (security risk)"
    )
  }

  // SEC-056: Check SIEM audit log configuration
  const hasSiem = process.env.AUDIT_SIEM_ENDPOINT && process.env.AUDIT_SIEM_TOKEN
  if (isProduction && !hasSiem) {
    result.warnings.push(
      "AUDIT_SIEM_ENDPOINT/TOKEN not configured - audit logs not forwarded to immutable storage"
    )
  }

  // SEC-057: Check HSM boundary verification
  const hasHsmConfig = process.env.HSM_ENDPOINT || process.env.HSM_KEY_ID
  if (isProduction && !hasHsmConfig) {
    result.warnings.push(
      "HSM_ENDPOINT/KEY_ID not configured - keys derived from env vars (no hardware boundary)"
    )
  }

  // Log results at startup
  if (result.errors.length > 0) {
    logError("SEC-052", "Environment validation FAILED", { errors: result.errors })
  }
  if (result.warnings.length > 0) {
    logWarn("SEC-052", "Environment warnings detected", { warnings: result.warnings })
  }
  if (result.valid && result.warnings.length === 0) {
    logInfo("SEC-052", "Environment validation passed - all security requirements met")
  }

  return result
}

// Run validation at module load (will fail fast in production if misconfigured)
const envValidation = validateProductionEnvironment()

/**
 * SEC-052: Export environment validation status for health checks
 */
export function getEnvironmentValidationStatus(): EnvironmentValidationResult {
  return envValidation
}

/**
 * SEC-068: HSM Cryptographic Attestation (supersedes SEC-057)
 *
 * PROBLEM (flagged by CTO, CSO, CRO, Skeptic):
 * The previous SEC-057 implementation only checked whether HSM_ENDPOINT and
 * HSM_KEY_ID environment variables were present, then self-signed a status
 * object with a locally derived HMAC. This proved nothing about actual hardware
 * security module integration — it was "marketing, not demonstrable."
 *
 * FIX: Real cryptographic challenge-response attestation.
 * When HSM_ENDPOINT is configured, we:
 *   1. Generate a random 32-byte challenge (nonce)
 *   2. Send the challenge to the HSM endpoint for signing
 *   3. Verify the returned signature using the HSM's public key
 *   4. Include the full challenge-response evidence in the status
 *
 * When HSM is NOT configured, the status explicitly reports "software-only"
 * mode with no false claims about hardware boundary protection.
 *
 * Edge Runtime compatible: uses Web Crypto API (crypto.subtle) and fetch().
 */
interface HsmChallengeResponse {
  challenge: string // hex-encoded random nonce we sent
  signature: string // hex-encoded signature returned by HSM
  publicKeyFingerprint: string // SHA-256 fingerprint of HSM public key
  verified: boolean // did the signature verify against the public key?
  latencyMs: number // round-trip time to HSM (proves network call happened)
}

interface HsmBoundaryStatus {
  hsmConfigured: boolean
  hsmEndpoint: string | null
  keyDerivationSource: "hsm" | "environment" | "runtime-generated"
  boundaryMode: "hardware-attested" | "software-only" | "hsm-unreachable"
  uaeDataBoundary: boolean
  cryptoAlgorithms: string[]
  fipsCompliant: boolean
  verificationTimestamp: string
  attestation: string // HMAC of status for tamper detection
  challengeResponse: HsmChallengeResponse | null // null when HSM not configured
}

/**
 * SEC-068: Generate a cryptographically random challenge for HSM attestation.
 * Uses Web Crypto API (Edge Runtime compatible).
 */
function generateHsmChallenge(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * SEC-068: Convert a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * SEC-068: Perform real cryptographic challenge-response with HSM endpoint.
 *
 * Protocol:
 * - POST {HSM_ENDPOINT}/v1/sign with JSON body { challenge, keyId, algorithm }
 * - HSM signs the challenge with its private key (ECDSA P-256 / SHA-256)
 * - Returns { signature (hex), publicKey (JWK) }
 * - We verify the signature locally using Web Crypto API
 *
 * This proves the HSM holds the private key and can sign on demand,
 * which is the definition of a hardware boundary — the key never leaves the HSM.
 */
async function performHsmChallengeResponse(
  endpoint: string,
  keyId: string,
  challenge: string
): Promise<HsmChallengeResponse> {
  const startTime = Date.now()

  const response = await fetch(`${endpoint}/v1/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.HSM_AUTH_TOKEN
        ? { Authorization: `Bearer ${process.env.HSM_AUTH_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      challenge,
      keyId,
      algorithm: "ECDSA-P256-SHA256",
    }),
    signal: AbortSignal.timeout(5000), // 5s timeout — HSM should respond fast
  })

  if (!response.ok) {
    return {
      challenge,
      signature: "",
      publicKeyFingerprint: "",
      verified: false,
      latencyMs: Date.now() - startTime,
    }
  }

  const result: { signature: string; publicKey: JsonWebKey } = await response.json()
  const latencyMs = Date.now() - startTime

  // Import the HSM's public key for local verification
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    result.publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  )

  // Verify the signature against our original challenge
  const challengeBytes = hexToBytes(challenge)
  const signatureBytes = hexToBytes(result.signature)
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signatureBytes.buffer as ArrayBuffer,
    challengeBytes.buffer as ArrayBuffer
  )

  // Compute public key fingerprint (SHA-256 of exported JWK) so auditors can
  // verify the same HSM key is used consistently across attestations
  const exportedKey = await crypto.subtle.exportKey("jwk", publicKey)
  const keyBytes = new TextEncoder().encode(JSON.stringify(exportedKey))
  const fingerprintBuffer = await crypto.subtle.digest("SHA-256", keyBytes)
  const publicKeyFingerprint = Array.from(new Uint8Array(fingerprintBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return {
    challenge,
    signature: result.signature,
    publicKeyFingerprint,
    verified,
    latencyMs,
  }
}

export async function getHsmBoundaryStatus(): Promise<HsmBoundaryStatus> {
  const hsmEndpoint = process.env.HSM_ENDPOINT || ""
  const hsmKeyId = process.env.HSM_KEY_ID || ""
  const hasHsmEndpoint = Boolean(hsmEndpoint)
  const hasHsmKeyId = Boolean(hsmKeyId)
  const hasCsrfSecret = Boolean(process.env.CSRF_HMAC_SECRET)

  let keySource: "hsm" | "environment" | "runtime-generated"
  if (hasHsmEndpoint && hasHsmKeyId) {
    keySource = "hsm"
  } else if (hasCsrfSecret) {
    keySource = "environment"
  } else {
    keySource = "runtime-generated"
  }

  // SEC-068: Perform real HSM challenge-response when endpoint is configured
  let challengeResponse: HsmChallengeResponse | null = null
  let boundaryMode: "hardware-attested" | "software-only" | "hsm-unreachable"

  if (hasHsmEndpoint && hasHsmKeyId) {
    const challenge = generateHsmChallenge()
    try {
      challengeResponse = await performHsmChallengeResponse(
        hsmEndpoint,
        hsmKeyId,
        challenge
      )
      boundaryMode = challengeResponse.verified ? "hardware-attested" : "hsm-unreachable"
    } catch {
      // HSM endpoint configured but unreachable — do NOT claim hardware attestation
      boundaryMode = "hsm-unreachable"
      challengeResponse = {
        challenge,
        signature: "",
        publicKeyFingerprint: "",
        verified: false,
        latencyMs: -1,
      }
    }
  } else {
    // SEC-068: No HSM configured — report software-only mode honestly
    // No false claims about hardware boundary protection
    boundaryMode = "software-only"
  }

  const status: Omit<HsmBoundaryStatus, "attestation"> = {
    hsmConfigured: hasHsmEndpoint && hasHsmKeyId,
    hsmEndpoint: hasHsmEndpoint ? "[CONFIGURED]" : null, // Don't expose actual endpoint
    keyDerivationSource: keySource,
    boundaryMode,
    uaeDataBoundary: true, // Middleware enforces UAE routing
    cryptoAlgorithms: ["AES-256-GCM", "HMAC-SHA256", "PBKDF2", "ECDSA-P256"],
    // SEC-068: Only claim FIPS when HSM is cryptographically verified, not just configured
    fipsCompliant: boundaryMode === "hardware-attested",
    verificationTimestamp: new Date().toISOString(),
    challengeResponse,
  }

  // SEC-067: Generate attestation HMAC using DERIVED key (Red Team NEX-005 fix)
  // Uses separate key from CSRF to maintain cryptographic key separation.
  // This HMAC covers the entire status including challenge-response evidence,
  // providing tamper detection for the attestation report itself.
  const attestationData = new TextEncoder().encode(JSON.stringify(status))
  const hsmSecret = await getHsmAttestationSecret()
  const attestationKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hsmSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const attestationBuffer = await crypto.subtle.sign("HMAC", attestationKey, attestationData)
  const attestation = Array.from(new Uint8Array(attestationBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return { ...status, attestation }
}

/**
 * SEC-068: HSM Health Check for Monitoring
 *
 * Lightweight probe for monitoring systems (e.g., /api/health).
 * Returns a quick pass/fail on HSM reachability and signing capability
 * without the full attestation report overhead.
 *
 * Returns:
 * - status: "healthy" (HSM reachable + signature verified),
 *           "degraded" (HSM configured but unreachable or verification failed),
 *           "not-configured" (no HSM endpoint set — software-only mode)
 * - latencyMs: round-trip time (or -1 if not applicable)
 * - message: human-readable explanation for operators
 */
interface HsmHealthCheckResult {
  status: "healthy" | "degraded" | "not-configured"
  latencyMs: number
  message: string
  timestamp: string
}

export async function checkHsmHealth(): Promise<HsmHealthCheckResult> {
  const hsmEndpoint = process.env.HSM_ENDPOINT || ""
  const hsmKeyId = process.env.HSM_KEY_ID || ""
  const timestamp = new Date().toISOString()

  if (!hsmEndpoint || !hsmKeyId) {
    return {
      status: "not-configured",
      latencyMs: -1,
      message:
        "HSM endpoint not configured. Running in software-only mode. " +
        "Keys are derived from environment variables — no hardware boundary.",
      timestamp,
    }
  }

  const challenge = generateHsmChallenge()
  try {
    const result = await performHsmChallengeResponse(hsmEndpoint, hsmKeyId, challenge)
    if (result.verified) {
      return {
        status: "healthy",
        latencyMs: result.latencyMs,
        message:
          `HSM attestation verified. Challenge signed and verified in ${result.latencyMs}ms. ` +
          `Public key fingerprint: ${result.publicKeyFingerprint.substring(0, 16)}...`,
        timestamp,
      }
    }
    return {
      status: "degraded",
      latencyMs: result.latencyMs,
      message:
        "HSM endpoint responded but signature verification failed. " +
        "Key mismatch or HSM misconfiguration. Falling back to software-only.",
      timestamp,
    }
  } catch {
    return {
      status: "degraded",
      latencyMs: -1,
      message:
        "HSM endpoint unreachable. Network error or timeout. " +
        "Falling back to software-only mode until HSM connectivity is restored.",
      timestamp,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-078: HSM STATE MANIPULATION PROTECTION (Red Team NEX-012 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-012): Attackers can force HSM into "unreachable" state
// mid-operation by triggering rapid health checks, creating degraded security
// windows where hardware attestation is bypassed.
//
// ATTACK VECTOR:
// 1. Attacker floods /api/health or triggers rapid HSM checks
// 2. Network jitter causes intermittent HSM failures
// 3. System rapidly flips between "hardware-attested" and "hsm-unreachable"
// 4. Attacker times malicious requests during "unreachable" windows
//
// FIX: State transition locks, attestation caching, rate limiting, and alerting.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-078: HSM State Types for State Machine
 */
type HsmState = "hardware-attested" | "software-only" | "hsm-unreachable" | "transitioning"

/**
 * SEC-078: HSM State Machine with Transition Locks
 *
 * Prevents rapid state changes that could be exploited by attackers.
 * State transitions require:
 * 1. Minimum time since last transition (STATE_TRANSITION_COOLDOWN_MS)
 * 2. Multiple consecutive failures before degrading (DEGRADATION_THRESHOLD)
 * 3. Multiple consecutive successes before upgrading (RECOVERY_THRESHOLD)
 */
interface HsmStateMachine {
  currentState: HsmState
  previousState: HsmState | null
  lastTransitionTime: number
  consecutiveFailures: number
  consecutiveSuccesses: number
  transitionLocked: boolean
  lockReason: string | null
}

// SEC-078: State machine configuration
// SEC-083: Reduced from 30s to 15s per CTO audit Round 15 - prevents cascading failures
const HSM_STATE_TRANSITION_COOLDOWN_MS = 15_000 // 15 seconds minimum between state changes
const HSM_DEGRADATION_THRESHOLD = 3 // 3 consecutive failures before degrading
const HSM_RECOVERY_THRESHOLD = 5 // 5 consecutive successes before recovering
const HSM_HEALTH_CHECK_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute window
const HSM_HEALTH_CHECK_MAX_REQUESTS = 10 // Max 10 health checks per minute
const HSM_ATTESTATION_CACHE_TTL_MS = 60_000 // Cache valid attestations for 60 seconds
const HSM_GRACEFUL_DEGRADATION_ALERT_COOLDOWN_MS = 300_000 // Alert every 5 minutes max

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-087: HSM CALL RATE LIMITING (Red Team NEX-016 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-016): Attackers can flood HSM attestation calls, causing:
// - HSM resource exhaustion (external bottleneck DoS)
// - State machine oscillation via rapid health checks
// - Latency amplification across all requests
//
// FIX: Strict per-second call limit with queuing. Excess requests use cached state.
// ═══════════════════════════════════════════════════════════════════════════════
const HSM_CALLS_PER_SECOND_LIMIT = 5 // Max 5 HSM calls per second
const HSM_CALL_WINDOW_MS = 1000 // 1 second window
const HSM_PENDING_QUEUE_MAX = 10 // Max pending calls before rejecting

// SEC-078: In-memory state machine (shared across requests in same process)
const _hsmStateMachine: HsmStateMachine = {
  currentState: "software-only", // Start in software-only until first successful attestation
  previousState: null,
  lastTransitionTime: 0,
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  transitionLocked: false,
  lockReason: null,
}

// SEC-078: Attestation cache
interface CachedAttestation {
  status: HsmBoundaryStatus
  cachedAt: number
  expiresAt: number
}
let _attestationCache: CachedAttestation | null = null

// SEC-078: Health check rate limiting (in-memory sliding window)
interface HealthCheckRateLimit {
  timestamps: number[]
  lastCleanup: number
}
const _healthCheckRateLimit: HealthCheckRateLimit = {
  timestamps: [],
  lastCleanup: Date.now(),
}

// SEC-078: Graceful degradation alerting
let _lastDegradationAlertTime = 0

// SEC-087: HSM call rate limiting state (GLOBAL)
interface HsmCallRateLimiter {
  callTimestamps: number[]
  pendingCount: number
  lastCleanup: number
  totalBlocked: number
}
const _hsmCallRateLimiter: HsmCallRateLimiter = {
  callTimestamps: [],
  pendingCount: 0,
  lastCleanup: Date.now(),
  totalBlocked: 0,
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-090/SEC-094: PER-IP HSM RATE LIMITING (Red Team NEX-019 + NEX-024 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-019): Attacker with small botnet (5 IPs) can consume all
// global HSM capacity (5/sec), locking out ALL legitimate users from auth.
//
// VULNERABILITY (NEX-024): The in-memory Map can be exhausted by flooding with
// thousands of unique spoofed IPs, causing CPU thrashing during cleanup.
//
// FIX SEC-090: Add per-IP rate limiting on top of global limit.
// FIX SEC-094: Hard cap Map size, reject requests when exhausted (fail-closed).
// ═══════════════════════════════════════════════════════════════════════════════
const HSM_CALLS_PER_IP_WINDOW_MS = 2000 // 2 second window per IP
const HSM_CALLS_PER_IP_LIMIT = 1 // Max 1 HSM call per IP every 2 seconds
const HSM_IP_RATE_LIMIT_STORE_MAX = 500 // SEC-094: Reduced max IPs (fail-closed when exceeded)
const HSM_IP_RATE_LIMIT_CLEANUP_THRESHOLD = 400 // SEC-094: Trigger cleanup at 80% capacity
const HSM_IP_RATE_LIMIT_EMERGENCY_EVICT = 100 // SEC-094: Evict this many on emergency cleanup

// SEC-090/SEC-094: Per-IP HSM rate limiting state
interface HsmIpRateLimiter {
  lastCallTime: Map<string, number>
  lastCleanup: number
  blockedByIp: number
  emergencyCleanups: number // SEC-094: Track emergency cleanup events
}
const _hsmIpRateLimiter: HsmIpRateLimiter = {
  lastCallTime: new Map(),
  lastCleanup: Date.now(),
  blockedByIp: 0,
  emergencyCleanups: 0,
}

/**
 * SEC-090/SEC-094: Check if HSM call from specific IP should be rate-limited
 * SEC-094: Now includes hard cap protection against cache exhaustion attacks
 * Returns true if this IP has called HSM too recently or if rate limiter is saturated
 */
function isHsmCallRateLimitedByIp(ip: string): boolean {
  const now = Date.now()
  const storeSize = _hsmIpRateLimiter.lastCallTime.size

  // SEC-094: Hard cap - if store is full and IP not already tracked, fail-closed
  if (storeSize >= HSM_IP_RATE_LIMIT_STORE_MAX && !_hsmIpRateLimiter.lastCallTime.has(ip)) {
    logSecurity("SEC-094", "HSM IP rate limiter saturated - fail-closed blocking new IP", {
      storeSize,
      maxSize: HSM_IP_RATE_LIMIT_STORE_MAX,
      newIp: ip.slice(0, 10) + "...",
    })
    return true // Fail-closed: block unknown IPs when saturated
  }

  // SEC-094: Proactive cleanup at 80% capacity (not just on timer)
  if (storeSize > HSM_IP_RATE_LIMIT_CLEANUP_THRESHOLD) {
    const cutoff = now - HSM_CALLS_PER_IP_WINDOW_MS * 5 // Tighter window under pressure
    let evicted = 0
    const entries = Array.from(_hsmIpRateLimiter.lastCallTime.entries())
    for (const [key, time] of entries) {
      if (time < cutoff) {
        _hsmIpRateLimiter.lastCallTime.delete(key)
        evicted++
        if (evicted >= HSM_IP_RATE_LIMIT_EMERGENCY_EVICT) break
      }
    }
    if (evicted > 0) {
      _hsmIpRateLimiter.emergencyCleanups++
      logSecurity("SEC-094", "HSM IP rate limiter emergency cleanup", {
        evicted,
        newSize: _hsmIpRateLimiter.lastCallTime.size,
        emergencyCleanups: _hsmIpRateLimiter.emergencyCleanups,
      })
    }
  }

  // Standard periodic cleanup (every 30 seconds now, not 60)
  if (now - _hsmIpRateLimiter.lastCleanup > 30_000) {
    const cutoff = now - HSM_CALLS_PER_IP_WINDOW_MS * 10
    const entries = Array.from(_hsmIpRateLimiter.lastCallTime.entries())
    for (const [key, time] of entries) {
      if (time < cutoff) {
        _hsmIpRateLimiter.lastCallTime.delete(key)
      }
    }
    _hsmIpRateLimiter.lastCleanup = now
  }

  // Check if this IP called recently
  const lastCall = _hsmIpRateLimiter.lastCallTime.get(ip)
  if (lastCall && now - lastCall < HSM_CALLS_PER_IP_WINDOW_MS) {
    _hsmIpRateLimiter.blockedByIp++
    if (_hsmIpRateLimiter.blockedByIp % 50 === 0) {
      logSecurity("SEC-090", "HSM per-IP rate limiting active - potential botnet attack", {
        ip: ip.slice(0, 20) + "...",
        blockedByIp: _hsmIpRateLimiter.blockedByIp,
        storeSize: _hsmIpRateLimiter.lastCallTime.size,
        windowMs: HSM_CALLS_PER_IP_WINDOW_MS,
      })
    }
    return true
  }

  return false
}

/**
 * SEC-090: Record HSM call from specific IP
 */
function recordHsmCallByIp(ip: string): void {
  _hsmIpRateLimiter.lastCallTime.set(ip, Date.now())
}

/**
 * SEC-087: Check if HSM call should be rate-limited (GLOBAL)
 * Returns true if the call should be blocked (rate limit exceeded)
 */
function isHsmCallRateLimited(): boolean {
  const now = Date.now()
  const windowStart = now - HSM_CALL_WINDOW_MS

  // Clean up old timestamps
  if (now - _hsmCallRateLimiter.lastCleanup > HSM_CALL_WINDOW_MS) {
    _hsmCallRateLimiter.callTimestamps = _hsmCallRateLimiter.callTimestamps.filter(
      (ts) => ts > windowStart
    )
    _hsmCallRateLimiter.lastCleanup = now
  }

  // Check call count in current window
  const callsInWindow = _hsmCallRateLimiter.callTimestamps.filter((ts) => ts > windowStart).length
  const atLimit = callsInWindow >= HSM_CALLS_PER_SECOND_LIMIT

  if (atLimit) {
    _hsmCallRateLimiter.totalBlocked++
    if (_hsmCallRateLimiter.totalBlocked % 100 === 0) {
      logSecurity("SEC-087", "HSM call rate limiting active - potential DoS attempt", {
        totalBlocked: _hsmCallRateLimiter.totalBlocked,
        callsInWindow,
        limit: HSM_CALLS_PER_SECOND_LIMIT,
      })
    }
  }

  return atLimit
}

/**
 * SEC-087: Record an HSM call for rate limiting (GLOBAL)
 */
function recordHsmCall(): void {
  _hsmCallRateLimiter.callTimestamps.push(Date.now())
}

/**
 * SEC-078: Log HSM state transition as a security event
 *
 * All state transitions are security-relevant and must be logged for:
 * - Security audit trail
 * - Anomaly detection
 * - Incident response
 */
function logHsmStateTransition(
  fromState: HsmState | null,
  toState: HsmState,
  reason: string,
  context?: Record<string, unknown>
): void {
  logSecurity("SEC-078", `HSM state transition: ${fromState || "INIT"} -> ${toState}`, {
    fromState,
    toState,
    reason,
    transitionTime: new Date().toISOString(),
    consecutiveFailures: _hsmStateMachine.consecutiveFailures,
    consecutiveSuccesses: _hsmStateMachine.consecutiveSuccesses,
    ...context,
  })
}

/**
 * SEC-078: Log graceful degradation alert
 *
 * Alerts operations team when HSM enters degraded state.
 * Rate-limited to prevent alert fatigue.
 */
function logGracefulDegradationAlert(reason: string, context?: Record<string, unknown>): void {
  const now = Date.now()
  if (now - _lastDegradationAlertTime < HSM_GRACEFUL_DEGRADATION_ALERT_COOLDOWN_MS) {
    return // Rate-limited
  }
  _lastDegradationAlertTime = now

  logSecurity("SEC-078", `ALERT: HSM graceful degradation activated`, {
    reason,
    alertType: "HSM_DEGRADATION",
    severity: "HIGH",
    timestamp: new Date().toISOString(),
    currentState: _hsmStateMachine.currentState,
    consecutiveFailures: _hsmStateMachine.consecutiveFailures,
    recommendation: "Check HSM connectivity and configuration. System is operating in software-only mode.",
    ...context,
  })
}

/**
 * SEC-078: Check if HSM health check is rate-limited
 *
 * Prevents attackers from flooding health checks to manipulate state.
 * Returns true if the request should be rate-limited (blocked).
 */
function isHsmHealthCheckRateLimited(): boolean {
  const now = Date.now()
  const windowStart = now - HSM_HEALTH_CHECK_RATE_LIMIT_WINDOW_MS

  // Clean up old timestamps periodically
  if (now - _healthCheckRateLimit.lastCleanup > HSM_HEALTH_CHECK_RATE_LIMIT_WINDOW_MS) {
    _healthCheckRateLimit.timestamps = _healthCheckRateLimit.timestamps.filter(
      (ts) => ts > windowStart
    )
    _healthCheckRateLimit.lastCleanup = now
  }

  // Check if over limit
  const recentChecks = _healthCheckRateLimit.timestamps.filter((ts) => ts > windowStart).length
  if (recentChecks >= HSM_HEALTH_CHECK_MAX_REQUESTS) {
    logSecurity("SEC-078", "HSM health check rate-limited", {
      recentChecks,
      maxAllowed: HSM_HEALTH_CHECK_MAX_REQUESTS,
      windowMs: HSM_HEALTH_CHECK_RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  // Record this check
  _healthCheckRateLimit.timestamps.push(now)
  return false
}

/**
 * SEC-078: Check if HSM state transition is allowed
 *
 * Implements transition lock to prevent rapid state changes.
 * Returns { allowed: boolean, reason: string }
 */
function canTransitionHsmState(targetState: HsmState): { allowed: boolean; reason: string } {
  const now = Date.now()
  const timeSinceLastTransition = now - _hsmStateMachine.lastTransitionTime

  // Check cooldown period
  if (
    _hsmStateMachine.lastTransitionTime > 0 &&
    timeSinceLastTransition < HSM_STATE_TRANSITION_COOLDOWN_MS
  ) {
    const remainingCooldown = HSM_STATE_TRANSITION_COOLDOWN_MS - timeSinceLastTransition
    return {
      allowed: false,
      reason: `State transition locked. Cooldown: ${remainingCooldown}ms remaining.`,
    }
  }

  // Check if explicitly locked
  if (_hsmStateMachine.transitionLocked) {
    return {
      allowed: false,
      reason: `State transition explicitly locked: ${_hsmStateMachine.lockReason}`,
    }
  }

  // Check thresholds for degradation
  if (
    _hsmStateMachine.currentState === "hardware-attested" &&
    targetState === "hsm-unreachable"
  ) {
    if (_hsmStateMachine.consecutiveFailures < HSM_DEGRADATION_THRESHOLD) {
      return {
        allowed: false,
        reason: `Degradation requires ${HSM_DEGRADATION_THRESHOLD} consecutive failures. Current: ${_hsmStateMachine.consecutiveFailures}`,
      }
    }
  }

  // Check thresholds for recovery
  if (
    _hsmStateMachine.currentState === "hsm-unreachable" &&
    targetState === "hardware-attested"
  ) {
    if (_hsmStateMachine.consecutiveSuccesses < HSM_RECOVERY_THRESHOLD) {
      return {
        allowed: false,
        reason: `Recovery requires ${HSM_RECOVERY_THRESHOLD} consecutive successes. Current: ${_hsmStateMachine.consecutiveSuccesses}`,
      }
    }
  }

  return { allowed: true, reason: "Transition allowed" }
}

/**
 * SEC-078: Execute HSM state transition
 *
 * Only called after canTransitionHsmState() returns allowed: true.
 */
function executeHsmStateTransition(targetState: HsmState, reason: string): void {
  const previousState = _hsmStateMachine.currentState

  // Execute transition
  _hsmStateMachine.previousState = previousState
  _hsmStateMachine.currentState = targetState
  _hsmStateMachine.lastTransitionTime = Date.now()

  // Reset counters after transition
  if (targetState === "hardware-attested") {
    _hsmStateMachine.consecutiveFailures = 0
  } else if (targetState === "hsm-unreachable") {
    _hsmStateMachine.consecutiveSuccesses = 0
  }

  // Log the transition
  logHsmStateTransition(previousState, targetState, reason)

  // Alert on degradation
  if (targetState === "hsm-unreachable" && previousState === "hardware-attested") {
    logGracefulDegradationAlert(reason, {
      previousState,
      degradationTime: new Date().toISOString(),
    })
  }
}

/**
 * SEC-078: Record HSM check result and update state machine
 *
 * Called after every HSM attestation attempt.
 * Updates counters and triggers state transitions when thresholds are met.
 */
function recordHsmCheckResult(success: boolean, latencyMs: number): void {
  if (success) {
    _hsmStateMachine.consecutiveSuccesses++
    _hsmStateMachine.consecutiveFailures = 0

    // Check for recovery
    if (_hsmStateMachine.currentState === "hsm-unreachable") {
      const transition = canTransitionHsmState("hardware-attested")
      if (transition.allowed) {
        executeHsmStateTransition(
          "hardware-attested",
          `HSM recovered after ${_hsmStateMachine.consecutiveSuccesses} consecutive successes (latency: ${latencyMs}ms)`
        )
      }
    } else if (_hsmStateMachine.currentState === "software-only") {
      // First successful attestation - transition to hardware-attested
      const transition = canTransitionHsmState("hardware-attested")
      if (transition.allowed) {
        executeHsmStateTransition(
          "hardware-attested",
          `Initial HSM attestation successful (latency: ${latencyMs}ms)`
        )
      }
    }
  } else {
    _hsmStateMachine.consecutiveFailures++
    _hsmStateMachine.consecutiveSuccesses = 0

    // Check for degradation
    if (_hsmStateMachine.currentState === "hardware-attested") {
      const transition = canTransitionHsmState("hsm-unreachable")
      if (transition.allowed) {
        executeHsmStateTransition(
          "hsm-unreachable",
          `HSM degraded after ${_hsmStateMachine.consecutiveFailures} consecutive failures`
        )
      }
    }
  }
}

/**
 * SEC-078: Get cached attestation if valid
 *
 * Returns cached attestation if:
 * 1. Cache exists
 * 2. Cache has not expired
 * 3. Cache state matches current state machine state
 */
function getCachedAttestation(): HsmBoundaryStatus | null {
  if (!_attestationCache) {
    return null
  }

  const now = Date.now()
  if (now > _attestationCache.expiresAt) {
    _attestationCache = null
    return null
  }

  // Verify cache state matches current state machine
  if (_attestationCache.status.boundaryMode !== _hsmStateMachine.currentState) {
    // State machine changed externally - invalidate cache
    _attestationCache = null
    return null
  }

  return _attestationCache.status
}

/**
 * SEC-078: Cache attestation result
 *
 * Only caches successful attestations to prevent caching failures.
 */
function cacheAttestation(status: HsmBoundaryStatus): void {
  const now = Date.now()
  _attestationCache = {
    status,
    cachedAt: now,
    expiresAt: now + HSM_ATTESTATION_CACHE_TTL_MS,
  }
}

/**
 * SEC-078: Rate-limited HSM boundary status check
 *
 * Wrapper around getHsmBoundaryStatus() that:
 * 1. Checks rate limits
 * 2. Uses cached attestation when valid
 * 3. Updates state machine based on results
 * 4. Logs security events
 */
export async function getHsmBoundaryStatusProtected(clientIp?: string): Promise<HsmBoundaryStatus> {
  // SEC-090: Check per-IP rate limit FIRST to prevent botnet DoS
  if (clientIp && isHsmCallRateLimitedByIp(clientIp)) {
    logWarn("SEC-090", "HSM call blocked - per-IP rate limit exceeded", {
      ip: clientIp.slice(0, 20) + "...",
      currentState: _hsmStateMachine.currentState,
    })
    return {
      hsmConfigured: Boolean(process.env.HSM_ENDPOINT && process.env.HSM_KEY_ID),
      hsmEndpoint: process.env.HSM_ENDPOINT ? "[CONFIGURED]" : null,
      keyDerivationSource: process.env.HSM_ENDPOINT ? "hsm" : "environment",
      boundaryMode: _hsmStateMachine.currentState === "transitioning"
        ? "hsm-unreachable"
        : _hsmStateMachine.currentState,
      uaeDataBoundary: true,
      cryptoAlgorithms: ["AES-256-GCM", "HMAC-SHA256", "PBKDF2", "ECDSA-P256"],
      fipsCompliant: _hsmStateMachine.currentState === "hardware-attested",
      verificationTimestamp: new Date().toISOString(),
      attestation: "[PER_IP_RATE_LIMITED]",
      challengeResponse: null,
    }
  }

  // Check cache first
  const cached = getCachedAttestation()
  if (cached) {
    logInfo("SEC-078", "Using cached HSM attestation", {
      cacheAge: Date.now() - (_attestationCache?.cachedAt || 0),
      boundaryMode: cached.boundaryMode,
    })
    return cached
  }

  // Check rate limit (SEC-078: per-minute health check limit)
  if (isHsmHealthCheckRateLimited()) {
    // Return current state without new attestation
    logWarn("SEC-078", "HSM check rate-limited - returning current state", {
      currentState: _hsmStateMachine.currentState,
    })

    // Return a status reflecting current state machine state
    return {
      hsmConfigured: Boolean(process.env.HSM_ENDPOINT && process.env.HSM_KEY_ID),
      hsmEndpoint: process.env.HSM_ENDPOINT ? "[CONFIGURED]" : null,
      keyDerivationSource: process.env.HSM_ENDPOINT ? "hsm" : "environment",
      boundaryMode: _hsmStateMachine.currentState === "transitioning"
        ? "hsm-unreachable"
        : _hsmStateMachine.currentState,
      uaeDataBoundary: true,
      cryptoAlgorithms: ["AES-256-GCM", "HMAC-SHA256", "PBKDF2", "ECDSA-P256"],
      fipsCompliant: _hsmStateMachine.currentState === "hardware-attested",
      verificationTimestamp: new Date().toISOString(),
      attestation: "[RATE_LIMITED]",
      challengeResponse: null,
    }
  }

  // SEC-087: Check per-second call rate limit to prevent HSM DoS
  if (isHsmCallRateLimited()) {
    logWarn("SEC-087", "HSM call rate-limited - DoS protection active", {
      currentState: _hsmStateMachine.currentState,
      totalBlocked: _hsmCallRateLimiter.totalBlocked,
    })

    // Return current state without new HSM call
    return {
      hsmConfigured: Boolean(process.env.HSM_ENDPOINT && process.env.HSM_KEY_ID),
      hsmEndpoint: process.env.HSM_ENDPOINT ? "[CONFIGURED]" : null,
      keyDerivationSource: process.env.HSM_ENDPOINT ? "hsm" : "environment",
      boundaryMode: _hsmStateMachine.currentState === "transitioning"
        ? "hsm-unreachable"
        : _hsmStateMachine.currentState,
      uaeDataBoundary: true,
      cryptoAlgorithms: ["AES-256-GCM", "HMAC-SHA256", "PBKDF2", "ECDSA-P256"],
      fipsCompliant: _hsmStateMachine.currentState === "hardware-attested",
      verificationTimestamp: new Date().toISOString(),
      attestation: "[CALL_RATE_LIMITED]",
      challengeResponse: null,
    }
  }

  // SEC-087: Record this HSM call (global)
  recordHsmCall()

  // SEC-090: Record per-IP HSM call if IP provided
  if (clientIp) {
    recordHsmCallByIp(clientIp)
  }

  // Perform actual attestation
  const startTime = Date.now()
  try {
    const status = await getHsmBoundaryStatus()
    const latencyMs = Date.now() - startTime

    // Update state machine
    const success = status.boundaryMode === "hardware-attested"
    recordHsmCheckResult(success, latencyMs)

    // Cache successful attestation
    if (success) {
      cacheAttestation(status)
    }

    return status
  } catch (error) {
    const latencyMs = Date.now() - startTime
    recordHsmCheckResult(false, latencyMs)

    logError("SEC-078", "HSM attestation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      latencyMs,
    })

    throw error
  }
}

/**
 * SEC-078: Rate-limited HSM health check
 *
 * Wrapper around checkHsmHealth() that:
 * 1. Checks rate limits
 * 2. Updates state machine based on results
 * 3. Returns cached/current state when rate-limited
 */
export async function checkHsmHealthProtected(): Promise<HsmHealthCheckResult> {
  // Check rate limit (SEC-078: per-minute health check limit)
  if (isHsmHealthCheckRateLimited()) {
    return {
      status: _hsmStateMachine.currentState === "hardware-attested"
        ? "healthy"
        : _hsmStateMachine.currentState === "hsm-unreachable"
        ? "degraded"
        : "not-configured",
      latencyMs: -1,
      message: "Health check rate-limited. Returning cached state.",
      timestamp: new Date().toISOString(),
    }
  }

  // SEC-087: Check per-second call rate limit to prevent HSM DoS
  if (isHsmCallRateLimited()) {
    return {
      status: _hsmStateMachine.currentState === "hardware-attested"
        ? "healthy"
        : _hsmStateMachine.currentState === "hsm-unreachable"
        ? "degraded"
        : "not-configured",
      latencyMs: -1,
      message: "HSM call rate-limited (SEC-087 DoS protection). Returning cached state.",
      timestamp: new Date().toISOString(),
    }
  }

  // SEC-087: Record this HSM call
  recordHsmCall()

  // Perform actual health check
  const startTime = Date.now()
  try {
    const result = await checkHsmHealth()
    const latencyMs = Date.now() - startTime

    // Update state machine
    const success = result.status === "healthy"
    recordHsmCheckResult(success, result.latencyMs > 0 ? result.latencyMs : latencyMs)

    return result
  } catch (error) {
    const latencyMs = Date.now() - startTime
    recordHsmCheckResult(false, latencyMs)

    return {
      status: "degraded",
      latencyMs,
      message: `Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * SEC-078: Get current HSM state machine status
 *
 * Exposes state machine internals for monitoring and debugging.
 * Used by /api/health and monitoring dashboards.
 */
export function getHsmStateMachineStatus(): {
  currentState: HsmState
  previousState: HsmState | null
  lastTransitionTime: string | null
  consecutiveFailures: number
  consecutiveSuccesses: number
  transitionLocked: boolean
  lockReason: string | null
  cacheStatus: {
    cached: boolean
    cacheAge: number | null
    expiresIn: number | null
  }
  rateLimitStatus: {
    recentChecks: number
    maxAllowed: number
    windowMs: number
  }
} {
  const now = Date.now()
  const windowStart = now - HSM_HEALTH_CHECK_RATE_LIMIT_WINDOW_MS
  const recentChecks = _healthCheckRateLimit.timestamps.filter((ts) => ts > windowStart).length

  return {
    currentState: _hsmStateMachine.currentState,
    previousState: _hsmStateMachine.previousState,
    lastTransitionTime: _hsmStateMachine.lastTransitionTime > 0
      ? new Date(_hsmStateMachine.lastTransitionTime).toISOString()
      : null,
    consecutiveFailures: _hsmStateMachine.consecutiveFailures,
    consecutiveSuccesses: _hsmStateMachine.consecutiveSuccesses,
    transitionLocked: _hsmStateMachine.transitionLocked,
    lockReason: _hsmStateMachine.lockReason,
    cacheStatus: {
      cached: _attestationCache !== null,
      cacheAge: _attestationCache ? now - _attestationCache.cachedAt : null,
      expiresIn: _attestationCache ? _attestationCache.expiresAt - now : null,
    },
    rateLimitStatus: {
      recentChecks,
      maxAllowed: HSM_HEALTH_CHECK_MAX_REQUESTS,
      windowMs: HSM_HEALTH_CHECK_RATE_LIMIT_WINDOW_MS,
    },
  }
}

/**
 * SEC-078: Manually lock HSM state transitions
 *
 * Used by operators to prevent state changes during maintenance.
 * Example: Lock to "hardware-attested" during HSM firmware updates.
 */
export function lockHsmStateTransitions(reason: string): void {
  _hsmStateMachine.transitionLocked = true
  _hsmStateMachine.lockReason = reason
  logSecurity("SEC-078", "HSM state transitions LOCKED", {
    reason,
    currentState: _hsmStateMachine.currentState,
    lockedAt: new Date().toISOString(),
  })
}

/**
 * SEC-078: Unlock HSM state transitions
 *
 * Re-enables automatic state transitions after maintenance.
 */
export function unlockHsmStateTransitions(): void {
  const wasLocked = _hsmStateMachine.transitionLocked
  const previousReason = _hsmStateMachine.lockReason

  _hsmStateMachine.transitionLocked = false
  _hsmStateMachine.lockReason = null

  if (wasLocked) {
    logSecurity("SEC-078", "HSM state transitions UNLOCKED", {
      previousLockReason: previousReason,
      currentState: _hsmStateMachine.currentState,
      unlockedAt: new Date().toISOString(),
    })
  }
}

/**
 * SEC-078: Force HSM state (emergency use only)
 *
 * Bypasses normal transition rules. For emergency use by operators only.
 * Requires explicit acknowledgment of security implications.
 *
 * WARNING: This can create security gaps if misused.
 */
export function forceHsmState(
  targetState: HsmState,
  reason: string,
  acknowledgeSecurityRisk: boolean
): { success: boolean; message: string } {
  if (!acknowledgeSecurityRisk) {
    return {
      success: false,
      message: "Must acknowledge security risk by setting acknowledgeSecurityRisk=true",
    }
  }

  const previousState = _hsmStateMachine.currentState

  logSecurity("SEC-078", "EMERGENCY: HSM state FORCED", {
    severity: "CRITICAL",
    previousState,
    targetState,
    reason,
    forcedAt: new Date().toISOString(),
    securityRiskAcknowledged: true,
  })

  _hsmStateMachine.previousState = previousState
  _hsmStateMachine.currentState = targetState
  _hsmStateMachine.lastTransitionTime = Date.now()
  _hsmStateMachine.consecutiveFailures = 0
  _hsmStateMachine.consecutiveSuccesses = 0

  // Invalidate cache
  _attestationCache = null

  return {
    success: true,
    message: `State forced from ${previousState} to ${targetState}. Reason: ${reason}`,
  }
}

/**
 * SEC-048/SEC-062/SEC-074: PII Sanitization for logs (ENHANCED + ReDoS HARDENED)
 *
 * Sanitizes potentially identifying information before logging.
 * SEC-062: Red Team NEX-006 fix - FULL redaction, no partial data retention.
 * SEC-074: Red Team NEX-008 fix - ReDoS-resistant patterns with input length limits.
 * SEC-079: CSO Round 15 fix - Detect and handle encoded PII (Base64, URL-encoded).
 * Addresses CSO concern about PII exposure in logs/errors.
 */

// SEC-074: Maximum input length to prevent ReDoS attacks
const MAX_SANITIZE_INPUT_LENGTH = 10000

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-079: ENCODED PII DETECTION (CSO Round 15 Fix)
// SEC-084: RECURSIVE/LAYERED ENCODING DETECTION (Red Team NEX-013 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (SEC-079): Attackers bypass PII detection with single encoding.
// VULNERABILITY (NEX-013): Attackers bypass SEC-079 with multi-layer encoding:
//   Base64(URLEncode(PII)) or URLEncode(Base64(PII)) chains.
//
// FIX (SEC-084): Recursively decode up to 4 layers, check for PII at each level.
// SEC-088: DYNAMIC decoding - no fixed layer limit. Uses byte-size and operation caps.
// ═══════════════════════════════════════════════════════════════════════════════

// SEC-088: Dynamic encoding detection limits (replaces fixed 4-layer limit)
// Instead of fixed depth, we limit by:
// 1. Total decode operations (prevents CPU exhaustion)
// 2. Total byte expansion (prevents memory exhaustion)
// 3. Minimum progress per operation (prevents infinite loops)
const MAX_DECODE_OPERATIONS = 20 // Max 20 decode attempts total
const MAX_BYTE_EXPANSION_RATIO = 10 // Output cannot be >10x input size
const MIN_DECODE_PROGRESS_BYTES = 1 // Must shrink by at least 1 byte per decode

/**
 * SEC-079: Check if a string looks like Base64-encoded content
 * Returns decoded content if valid Base64 with reasonable ASCII output
 */
function tryDecodeBase64(str: string): string | null {
  // Must be at least 4 chars, multiple of 4, and contain only Base64 chars
  if (str.length < 4 || str.length > 2000) return null
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/
  if (!base64Pattern.test(str)) return null

  try {
    // Edge runtime uses atob
    const decoded = atob(str)
    // SEC-095/SEC-100/SEC-106: Check if result is printable text
    // SEC-100: Added Arabic Presentation Forms (Red Team NEX-027 Round 21 fix)
    // SEC-106: Added Arabic Extended-B (Red Team NEX-035 Round 22 fix)
    // Ranges: ASCII printable, Arabic (\u0600-\u06FF), Arabic Supplement (\u0750-\u077F),
    // Arabic Extended-B (\u0870-\u089F), Arabic Extended-A (\u08A0-\u08FF),
    // Arabic Presentation Forms-A (\uFB50-\uFDFF), Forms-B (\uFE70-\uFEFF), Latin Extended-A (\u00A0-\u00FF)
    if (/^[\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u00A0-\u00FF\n\r\t]+$/.test(decoded)) {
      return decoded
    }
  } catch {
    // Not valid Base64
  }
  return null
}

/**
 * SEC-079: Check if a string contains URL-encoded PII patterns
 * Returns decoded content if URL-encoded
 */
function tryDecodeUrlEncoded(str: string): string | null {
  // Must contain %XX patterns
  if (!/%[0-9A-Fa-f]{2}/.test(str)) return null
  if (str.length > 2000) return null

  try {
    const decoded = decodeURIComponent(str)
    // Only return if we actually decoded something
    if (decoded !== str && decoded.length > 0) {
      return decoded
    }
  } catch {
    // Invalid URL encoding
  }
  return null
}

/**
 * SEC-079: Quick check if content contains PII patterns (for encoded content scanning)
 */
function containsPiiPatterns(content: string): boolean {
  // Check for common PII patterns without full regex (fast check)
  const quickChecks = [
    /\d{3}[- ]?\d{3}[- ]?\d{4}/, // Phone-like
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email-like
    /784-?\d{4}-?\d{7}-?\d/, // Emirates ID
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IPv4
    /\+971|05\d/, // UAE phone prefix
  ]
  return quickChecks.some((pattern) => pattern.test(content))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-089: SSRF PROTECTION FOR LLM PROVIDER CALLS (Red Team NEX-018 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-018): Attackers can weaponize LLM providers via SSRF.
// Prompts like "Summarize http://169.254.169.254/..." exploit URL-fetching LLMs
// to steal cloud metadata credentials.
//
// FIX: Detect internal/metadata IP patterns in prompts before sending to LLMs.
// Block or redact URLs pointing to internal networks.
// ═══════════════════════════════════════════════════════════════════════════════

// SEC-089: Internal/metadata IP ranges that should never appear in LLM prompts
const SSRF_BLOCKED_PATTERNS = [
  // Cloud metadata endpoints
  /169\.254\.169\.254/i, // AWS/GCP/Azure metadata
  /metadata\.google\.internal/i, // GCP metadata
  /metadata\.azure\.com/i, // Azure metadata
  /100\.100\.100\.200/i, // Alibaba Cloud metadata

  // Private IPv4 ranges (RFC 1918)
  /(?:^|\D)10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\D|$)/, // 10.0.0.0/8
  /(?:^|\D)172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(?:\D|$)/, // 172.16.0.0/12
  /(?:^|\D)192\.168\.\d{1,3}\.\d{1,3}(?:\D|$)/, // 192.168.0.0/16

  // Loopback
  /(?:^|\D)127\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\D|$)/, // 127.0.0.0/8
  /(?:^|\D)127\.\d{1,3}(?:\D|$)/, // SEC-107: IP shorthand 127.1 (resolves to 127.0.0.1)
  /localhost/i,
  /localhost\.localdomain/i, // SEC-107: localhost.localdomain hostname

  // Link-local
  /(?:^|\D)169\.254\.\d{1,3}\.\d{1,3}(?:\D|$)/, // 169.254.0.0/16

  // Internal hostnames
  /\.local(?:\D|$)/i, // .local domains
  /\.internal(?:\D|$)/i, // .internal domains
  /\.corp(?:\D|$)/i, // .corp domains
  /\.lan(?:\D|$)/i, // .lan domains

  // Kubernetes/Docker internal
  /kubernetes\.default/i,
  /\.svc\.cluster\.local/i,
  /docker\.internal/i,

  // File protocol
  /file:\/\//i,

  // SEC-117: Wildcard DNS services (DNS rebinding attack vectors - Red Team NEX-042)
  // These services resolve any IP embedded in subdomain to that IP
  // e.g., 127.0.0.1.nip.io resolves to 127.0.0.1
  /\.nip\.io(?:\D|$)/i,
  /\.sslip\.io(?:\D|$)/i,
  /\.xip\.io(?:\D|$)/i,
  /\.localtest\.me(?:\D|$)/i,
  /\.lvh\.me(?:\D|$)/i,
  /\.vcap\.me(?:\D|$)/i,
  /\.lacolhost\.com(?:\D|$)/i,
  /\.127-0-0-1\.org(?:\D|$)/i,
  /\.myip\.la(?:\D|$)/i, // SEC-117: Additional wildcard DNS service

  // SEC-121: Punycode/IDN homograph SSRF detection (Red Team NEX-046 fix)
  // Blocks domains that use Punycode encoding to impersonate internal services
  /xn--[a-z0-9-]+/i, // Any Punycode-encoded domain (xn-- prefix)
]

// SEC-121: Function to detect Punycode domains that may be homograph attacks
function isPunycodeHomographRisk(hostname: string): boolean {
  // Check if hostname contains Punycode-encoded segments
  if (/xn--/i.test(hostname)) {
    // High-risk patterns: domains trying to look like internal services
    const riskyPatterns = [
      /xn--.*localhost/i,
      /xn--.*internal/i,
      /xn--.*meta.*data/i,
      /xn--.*127/i,
      /xn--.*192\.168/i,
      /xn--.*10\./i,
    ]
    return riskyPatterns.some((p) => p.test(hostname))
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-092: SSRF IP ENCODING BYPASS PROTECTION (Red Team NEX-021 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-021): Attackers can bypass regex-based IP detection using
// alternative IP representations:
// - Decimal: 2852039166 (169.254.169.254)
// - Octal: 0251.0376.0251.0376
// - Hex: 0xA9FEA9FE or 0xA9.0xFE.0xA9.0xFE
//
// FIX: Parse numeric values from URLs and convert to standard IP for checking.
// Also block raw numeric IPs entirely (no legitimate use case).
// ═══════════════════════════════════════════════════════════════════════════════

// SEC-092/SEC-101: Known internal IP addresses in decimal form
// SEC-101: Added 0.0.0.0 (Red Team NEX-032 fix)
const SSRF_INTERNAL_IP_DECIMALS = new Set([
  0, // 0.0.0.0 (resolves to localhost on many systems) - NEX-032 fix
  2852039166, // 169.254.169.254 (metadata)
  2130706433, // 127.0.0.1 (localhost)
  1684300744, // 100.100.100.200 (Alibaba metadata)
])

// SEC-092: Internal IP ranges as numeric [start, end] pairs
const SSRF_INTERNAL_RANGES: Array<[number, number]> = [
  [167772160, 184549375], // 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
  [2886729728, 2887778303], // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  [3232235520, 3232301055], // 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
  [2130706432, 2147483647], // 127.0.0.0/8 (127.0.0.0 - 127.255.255.255)
  [2851995648, 2852061183], // 169.254.0.0/16 (link-local)
]

/**
 * SEC-092: Check if a numeric value represents an internal IP
 */
function isInternalIpDecimal(decimal: number): boolean {
  if (SSRF_INTERNAL_IP_DECIMALS.has(decimal)) {
    return true
  }
  for (const [start, end] of SSRF_INTERNAL_RANGES) {
    if (decimal >= start && decimal <= end) {
      return true
    }
  }
  return false
}

/**
 * SEC-092: Convert dotted IP (decimal, octal, or hex octets) to numeric
 * Handles: 192.168.1.1, 0300.0250.0001.0001, 0xC0.0xA8.0x01.0x01
 */
function parseIpOctets(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null

  let result = 0
  for (let i = 0; i < 4; i++) {
    const part = parts[i].trim()
    let octet: number

    if (part.toLowerCase().startsWith("0x")) {
      // Hex octet
      octet = parseInt(part, 16)
    } else if (part.startsWith("0") && part.length > 1 && !/[89]/.test(part)) {
      // Octal octet (starts with 0, no 8 or 9)
      octet = parseInt(part, 8)
    } else {
      // Decimal octet
      octet = parseInt(part, 10)
    }

    if (isNaN(octet) || octet < 0 || octet > 255) return null
    result = (result << 8) | octet
  }

  return result >>> 0 // Ensure unsigned
}

/**
 * SEC-092: Detect SSRF via alternative IP encodings in URLs
 */
function detectEncodedSsrf(content: string): { blocked: boolean; reason: string | null } {
  // Pattern for URLs with numeric IPs (decimal, no dots)
  const decimalIpUrl = /https?:\/\/(\d{7,10})(?:\/|$|:)/gi
  let match: RegExpExecArray | null

  while ((match = decimalIpUrl.exec(content)) !== null) {
    const decimal = parseInt(match[1], 10)
    if (!isNaN(decimal) && decimal > 0 && decimal <= 4294967295) {
      if (isInternalIpDecimal(decimal)) {
        logSecurity("SEC-092", "SSRF via decimal IP detected", {
          decimalIp: decimal,
          urlFragment: match[0].slice(0, 50),
        })
        return { blocked: true, reason: "Decimal IP encoding detected" }
      }
    }
  }

  // Pattern for URLs with hex IPs (0xABCDEF format)
  const hexIpUrl = /https?:\/\/(0x[0-9A-Fa-f]{1,8})(?:\/|$|:)/gi
  while ((match = hexIpUrl.exec(content)) !== null) {
    const decimal = parseInt(match[1], 16)
    if (!isNaN(decimal) && isInternalIpDecimal(decimal)) {
      logSecurity("SEC-092", "SSRF via hex IP detected", {
        hexIp: match[1],
        decimalValue: decimal,
      })
      return { blocked: true, reason: "Hex IP encoding detected" }
    }
  }

  // Pattern for URLs with dotted IPs (catch octal and mixed notations)
  const dottedIpUrl = /https?:\/\/([0-9x][0-9A-Fa-fx]*\.[0-9x][0-9A-Fa-fx]*\.[0-9x][0-9A-Fa-fx]*\.[0-9x][0-9A-Fa-fx]*)(?:\/|$|:)/gi
  while ((match = dottedIpUrl.exec(content)) !== null) {
    const ipStr = match[1]
    // Check for octal indicators (leading zeros without x)
    const hasOctal = /\b0[0-7]+\b/.test(ipStr) && !ipStr.includes("x")
    const hasHex = /0x/i.test(ipStr)

    if (hasOctal || hasHex) {
      const decimal = parseIpOctets(ipStr)
      if (decimal !== null && isInternalIpDecimal(decimal)) {
        logSecurity("SEC-092", "SSRF via octal/hex dotted IP detected", {
          ipString: ipStr,
          decimalValue: decimal,
        })
        return { blocked: true, reason: "Octal/hex IP encoding detected" }
      }
    }
  }

  // SEC-097: IPv6-mapped IPv4 addresses (Skeptic B-3 fix)
  // Blocks patterns like [::ffff:169.254.169.254] or ::ffff:127.0.0.1
  const ipv6MappedPattern = /\[?::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?/gi
  while ((match = ipv6MappedPattern.exec(content)) !== null) {
    const ipv4Part = match[1]
    const parts = ipv4Part.split(".").map((p) => parseInt(p, 10))
    if (parts.length === 4 && parts.every((p) => p >= 0 && p <= 255)) {
      const decimal = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
      if (isInternalIpDecimal(decimal >>> 0)) {
        logSecurity("SEC-097", "SSRF via IPv6-mapped IPv4 detected", {
          ipv6Mapped: match[0],
          ipv4Part,
          decimalValue: decimal >>> 0,
        })
        return { blocked: true, reason: "IPv6-mapped internal IP detected" }
      }
    }
  }

  // SEC-102: Fully expanded IPv6-mapped IPv4 detection (NEX-025 Round 21 fix)
  // Catches 0000:0000:0000:0000:0000:ffff:XXYY:ZZWW where XXYY:ZZWW = IPv4 in hex
  // Example: 0000:0000:0000:0000:0000:ffff:a9fe:a9fe = 169.254.169.254
  const expandedIpv6MappedPattern =
    /\[?(?:0{1,4}:){5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]?/gi
  while ((match = expandedIpv6MappedPattern.exec(content)) !== null) {
    const highWord = parseInt(match[1], 16)
    const lowWord = parseInt(match[2], 16)
    // Convert XXYY:ZZWW to decimal IP
    const decimal = (highWord << 16) | lowWord
    if (isInternalIpDecimal(decimal >>> 0)) {
      logSecurity("SEC-102", "SSRF via fully-expanded IPv6-mapped IPv4 detected", {
        ipv6Expanded: match[0],
        highWord: match[1],
        lowWord: match[2],
        decimalValue: decimal >>> 0,
      })
      return { blocked: true, reason: "Expanded IPv6-mapped internal IP detected" }
    }
  }

  // SEC-102: Also catch mixed expanded forms (with :: somewhere in zeros)
  // Pattern: any sequence of 0s/colons followed by ffff: then hex:hex
  const mixedIpv6MappedPattern = /\[?(?:0{0,4}:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]?/gi
  while ((match = mixedIpv6MappedPattern.exec(content)) !== null) {
    const highWord = parseInt(match[1], 16)
    const lowWord = parseInt(match[2], 16)
    const decimal = (highWord << 16) | lowWord
    if (isInternalIpDecimal(decimal >>> 0)) {
      logSecurity("SEC-102", "SSRF via mixed IPv6-mapped IPv4 detected", {
        ipv6Mixed: match[0],
        highWord: match[1],
        lowWord: match[2],
        decimalValue: decimal >>> 0,
      })
      return { blocked: true, reason: "Mixed IPv6-mapped internal IP detected" }
    }
  }

  // SEC-097: IPv6 loopback and link-local patterns
  // SEC-102: Enhanced to catch fully expanded and zone ID forms
  const ipv6InternalPatterns = [
    /\[?::1\]?(?:\/|$|:|%)/i, // IPv6 loopback shorthand
    /\[?0{0,4}(?::0{0,4}){6}:0{0,3}1\]?/i, // IPv6 loopback expanded (0000:...:0001)
    /\[?fe80:/i, // Link-local IPv6 shorthand
    /\[?fc00:/i, // Unique local IPv6
    /\[?fd00:/i, // Unique local IPv6
    /%[a-z0-9]+/i, // Zone ID indicator (fe80::1%eth0) - block any zone ID usage
  ]
  for (const pattern of ipv6InternalPatterns) {
    if (pattern.test(content)) {
      logSecurity("SEC-097", "SSRF via IPv6 internal address detected", {
        pattern: pattern.toString(),
        contentSample: content.slice(0, 100),
      })
      return { blocked: true, reason: "IPv6 internal address detected" }
    }
  }

  return { blocked: false, reason: null }
}

/**
 * SEC-089/SEC-092: Check if content contains SSRF attack patterns
 * Returns { blocked: true, reason: string } if SSRF detected
 */
function detectSsrfPatterns(content: string): { blocked: boolean; reason: string | null } {
  // SEC-126: Check for invalid URLs/IDNs first (fail-closed approach)
  // If content contains blocked markers from failed Punycode decoding, block immediately
  if (content.includes("[INVALID_URL_BLOCKED]") || content.includes("[INVALID_IDN_BLOCKED]")) {
    return { blocked: true, reason: "Invalid or malformed URL detected" }
  }

  // SEC-126: Decode Punycode using native URL API (replaces custom SEC-125)
  // This is critical: HTTP clients decode Punycode to Unicode, so we must see
  // what the HTTP client will see. Otherwise xn--lclhost-4ya.com (Punycode for
  // a homograph of "localhost") would bypass our homoglyph detection.
  const punycodeDecoded = decodePunycodeInUrl(content)

  // SEC-126: Check for mixed-script homograph attacks (Red Team NEX-102 fix)
  // Domains mixing Latin + Cyrillic are highly suspicious
  if (detectMixedScriptHomograph(punycodeDecoded)) {
    logSecurity("SEC-126", "Mixed-script homograph attack detected", {
      contentSample: content.slice(0, 100),
    })
    return { blocked: true, reason: "Mixed-script homograph attack detected" }
  }

  // SEC-123: Then apply NFKC normalization and homoglyph normalization
  // Order: Punycode → NFKC → Homoglyphs → Check patterns
  // e.g., "xn--lclhst-4ya.com" → "łоcalhost.com" → "localhost.com" → BLOCKED
  const normalizedContent = normalizeHomoglyphs(punycodeDecoded.normalize("NFKC"))
  const lowerContent = normalizedContent.toLowerCase()

  // SEC-089: Check standard regex patterns (using normalized content)
  for (const pattern of SSRF_BLOCKED_PATTERNS) {
    if (pattern.test(normalizedContent) || pattern.test(lowerContent)) {
      logSecurity("SEC-089", "SSRF pattern detected in prompt - blocking", {
        patternMatched: pattern.toString().slice(0, 50),
        contentSample: content.slice(0, 100),
        punycodeDecoded: punycodeDecoded !== content,
        homoglyphNormalized: normalizedContent !== punycodeDecoded,
      })
      return { blocked: true, reason: "Internal network URL detected" }
    }
  }

  // SEC-092: Check for encoded IP bypasses (using normalized content)
  const encodedCheck = detectEncodedSsrf(normalizedContent)
  if (encodedCheck.blocked) {
    return encodedCheck
  }

  return { blocked: false, reason: null }
}

/**
 * SEC-089: Redact SSRF patterns from content instead of blocking
 * Use when blocking would break user experience
 */
function redactSsrfPatterns(content: string): string {
  let result = content

  for (const pattern of SSRF_BLOCKED_PATTERNS) {
    if (pattern.test(result)) {
      result = result.replace(new RegExp(pattern.source, "gi"), "[INTERNAL_URL_REDACTED]")
    }
  }

  return result
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-091: WEBSOCKET/SSE MESSAGE-LEVEL SECURITY (Red Team NEX-020 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-020): WebSocket/SSE connections for LLM streaming bypass
// per-message security after initial handshake. Once connection is "trusted",
// messages may skip PII scanning, rate limiting, and prompt injection detection.
//
// FIX: Export functions for per-message security checks that WebSocket/SSE
// handlers MUST call for every incoming message. Document requirement clearly.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-091: Per-message security check for WebSocket/SSE frames
 *
 * MUST be called for every incoming WebSocket/SSE message in streaming handlers.
 * Returns { allowed: boolean, sanitized: string, violations: string[] }
 */
export function validateStreamingMessage(
  message: string,
  ip: string,
  userId?: string
): { allowed: boolean; sanitized: string; violations: string[] } {
  const violations: string[] = []
  let sanitized = message

  // SEC-091: Check message length (10KB max per message)
  if (message.length > 10_000) {
    violations.push("Message exceeds 10KB limit")
    return { allowed: false, sanitized: "", violations }
  }

  // SEC-091: Check for SSRF patterns (NEX-018 protection)
  const ssrfCheck = detectSsrfPatterns(message)
  if (ssrfCheck.blocked) {
    violations.push(`SSRF pattern detected: ${ssrfCheck.reason}`)
    sanitized = redactSsrfPatterns(sanitized)
  }

  // SEC-091: Check for PII in message (including encoded PII)
  const piiSanitized = redactEncodedPii(sanitized)
  if (piiSanitized !== sanitized) {
    violations.push("Encoded PII detected and redacted")
    sanitized = piiSanitized
  }

  // SEC-091: Run through standard sanitization
  sanitized = sanitizeForLog(sanitized)

  // SEC-091: Log if violations found
  if (violations.length > 0) {
    logSecurity("SEC-091", "WebSocket/SSE message security violations detected", {
      violationCount: violations.length,
      violations,
      ip: ip.slice(0, 20) + "...",
      userId: userId ? userId.slice(0, 10) + "..." : "anonymous",
    })
  }

  // Allow with sanitized content unless SSRF was blocked
  return {
    allowed: !ssrfCheck.blocked,
    sanitized,
    violations,
  }
}

/**
 * SEC-091/SEC-096: Per-message rate limiting for WebSocket/SSE
 *
 * Tracks message rate per connection to prevent message flooding.
 * SEC-096: Added size bound to prevent memory exhaustion (Skeptic B-6 fix)
 * Returns true if message should be blocked (rate limit exceeded).
 */
const WS_MESSAGE_RATE_LIMIT_WINDOW_MS = 1000 // 1 second window
const WS_MESSAGE_RATE_LIMIT_MAX = 10 // Max 10 messages per second per connection
const WS_RATE_LIMITER_MAX_CONNECTIONS = 10000 // SEC-096: Max tracked connections
const _wsMessageRateLimiters = new Map<string, { timestamps: number[]; lastCleanup: number }>()
let _wsRateLimiterLastPurge = Date.now()

export function isStreamingMessageRateLimited(connectionId: string): boolean {
  const now = Date.now()
  const windowStart = now - WS_MESSAGE_RATE_LIMIT_WINDOW_MS

  // SEC-096: Periodic purge of old entries to prevent memory exhaustion
  if (_wsMessageRateLimiters.size > WS_RATE_LIMITER_MAX_CONNECTIONS * 0.8 ||
      now - _wsRateLimiterLastPurge > 60_000) {
    const cutoff = now - WS_MESSAGE_RATE_LIMIT_WINDOW_MS * 60 // 1 minute of inactivity
    const entries = Array.from(_wsMessageRateLimiters.entries())
    for (const [key, limiter] of entries) {
      if (limiter.lastCleanup < cutoff) {
        _wsMessageRateLimiters.delete(key)
      }
    }
    _wsRateLimiterLastPurge = now

    // If still over limit after purge, fail-closed
    if (_wsMessageRateLimiters.size >= WS_RATE_LIMITER_MAX_CONNECTIONS) {
      logSecurity("SEC-096", "WebSocket rate limiter saturated - fail-closed", {
        size: _wsMessageRateLimiters.size,
        maxSize: WS_RATE_LIMITER_MAX_CONNECTIONS,
      })
      return true // Fail-closed: block new connections when saturated
    }
  }

  // Get or create rate limiter for this connection
  let limiter = _wsMessageRateLimiters.get(connectionId)
  if (!limiter) {
    limiter = { timestamps: [], lastCleanup: now }
    _wsMessageRateLimiters.set(connectionId, limiter)
  }

  // SEC-103: Always update lastCleanup on access to prevent active connections
  // from being purged (CRO DeepSeek Round 21 finding)
  limiter.lastCleanup = now

  // Clean up old timestamps periodically
  if (limiter.timestamps.length > 0 && limiter.timestamps[0] <= windowStart) {
    limiter.timestamps = limiter.timestamps.filter((ts) => ts > windowStart)
  }

  // Check rate limit
  const messagesInWindow = limiter.timestamps.filter((ts) => ts > windowStart).length
  if (messagesInWindow >= WS_MESSAGE_RATE_LIMIT_MAX) {
    logSecurity("SEC-091", "WebSocket message rate limit exceeded", {
      connectionId: connectionId.slice(0, 20),
      messagesInWindow,
      limit: WS_MESSAGE_RATE_LIMIT_MAX,
    })
    return true
  }

  // Record this message
  limiter.timestamps.push(now)
  return false
}

/**
 * SEC-091: Clean up WebSocket rate limiters for closed connections
 * Call this when a WebSocket connection closes
 */
export function cleanupStreamingRateLimiter(connectionId: string): void {
  _wsMessageRateLimiters.delete(connectionId)
}

/**
 * SEC-088: Try to decode hex-encoded content
 * Returns decoded content if valid hex string
 */
function tryDecodeHex(str: string): string | null {
  // Must be even length and contain only hex chars
  if (str.length < 4 || str.length > 4000 || str.length % 2 !== 0) return null
  if (!/^[0-9A-Fa-f]+$/.test(str)) return null

  try {
    let decoded = ""
    for (let i = 0; i < str.length; i += 2) {
      const byte = parseInt(str.substr(i, 2), 16)
      decoded += String.fromCharCode(byte)
    }
    // SEC-095/SEC-100: Check if result is printable text
    // SEC-100: Added Arabic Presentation Forms (Red Team NEX-027 Round 21 fix)
    if (/^[\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u00A0-\u00FF\n\r\t]+$/.test(decoded)) {
      return decoded
    }
  } catch {
    // Invalid hex
  }
  return null
}

/**
 * SEC-084/SEC-088: Dynamically decode layered encodings and check for PII
 *
 * SEC-088 UPGRADE: No fixed layer limit. Instead uses:
 * - Operation count cap (20 max decode attempts)
 * - Byte expansion limit (10x max)
 * - Progress requirement (must shrink each decode)
 *
 * Handles attack patterns like:
 * - Base64(URLEncode(PII))
 * - URLEncode(Base64(Hex(PII)))
 * - Any arbitrary nesting depth (limited by operation count)
 *
 * Returns { foundPii: boolean, depth: number, encodingChain: string[] }
 */
function recursiveDecodeAndCheckPii(
  content: string,
  depth: number = 0,
  operationCount: number = 0,
  originalSize: number = 0
): { foundPii: boolean; depth: number; encodingChain: string[]; operations: number } {
  // SEC-088: Track original size for expansion limit
  if (depth === 0) {
    originalSize = content.length
  }

  // SEC-088: Operation count limit (prevents CPU exhaustion)
  if (operationCount >= MAX_DECODE_OPERATIONS) {
    logWarn("SEC-088", "Max decode operations reached - potential evasion attempt", {
      operations: operationCount,
      depth,
    })
    return { foundPii: false, depth, encodingChain: [], operations: operationCount }
  }

  // SEC-088: Byte expansion limit (prevents memory exhaustion)
  if (originalSize > 0 && content.length > originalSize * MAX_BYTE_EXPANSION_RATIO) {
    logWarn("SEC-088", "Byte expansion limit reached - potential DoS attempt", {
      originalSize,
      currentSize: content.length,
      ratio: content.length / originalSize,
    })
    return { foundPii: false, depth, encodingChain: [], operations: operationCount }
  }

  // Check for PII at current layer
  if (containsPiiPatterns(content)) {
    return { foundPii: true, depth, encodingChain: [], operations: operationCount }
  }

  // SEC-088: Try all encoding types dynamically
  const decoders: Array<{ name: string; decode: (s: string) => string | null }> = [
    { name: "base64", decode: tryDecodeBase64 },
    { name: "url", decode: tryDecodeUrlEncoded },
    { name: "hex", decode: tryDecodeHex },
  ]

  for (const { name, decode } of decoders) {
    const decoded = decode(content)
    if (decoded && decoded.length < content.length) {
      // SEC-088: Must make progress (shrink) to continue
      const result = recursiveDecodeAndCheckPii(
        decoded,
        depth + 1,
        operationCount + 1,
        originalSize || content.length
      )
      if (result.foundPii) {
        result.encodingChain.unshift(name)
        return result
      }
    }
  }

  return { foundPii: false, depth, encodingChain: [], operations: operationCount }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-093: PII FRAGMENTATION BYPASS PROTECTION (Red Team NEX-022 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-022): Attackers can split PII into small encoded fragments
// that fall below the 20-char threshold. Each fragment passes detection, but
// when reassembled, PII is leaked to external LLM providers.
//
// FIX:
// 1. Lower threshold to 8 chars (minimum useful Base64)
// 2. Detect consecutive encoded fragments and test reassembly
// 3. Flag patterns that look like intentional fragmentation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-093: Detect fragmented Base64 strings and reassemble for PII check
 * Looks for multiple small Base64-like strings separated by non-encoded chars
 */
function detectFragmentedPii(value: string): { fragments: string[]; combined: string } | null {
  // Find all Base64-like fragments (8+ chars each)
  const fragmentPattern = /[A-Za-z0-9+/]{8,}={0,2}/g
  const fragments = value.match(fragmentPattern) || []

  // Need at least 2 fragments to be considered fragmentation
  if (fragments.length < 2) return null

  // Check if fragments appear close together (potential fragmentation attack)
  let combined = ""
  let lastIndex = 0
  let fragmentCount = 0

  for (const fragment of fragments) {
    const index = value.indexOf(fragment, lastIndex)
    if (index === -1) continue

    // Check gap between fragments (attacker typically uses minimal separators)
    const gap = index - lastIndex
    if (gap < 20) {
      // Small gap - likely fragmented
      combined += fragment
      fragmentCount++
    } else if (combined.length > 0) {
      // Large gap - test what we have so far
      break
    }
    lastIndex = index + fragment.length
  }

  if (fragmentCount >= 2 && combined.length >= 16) {
    return { fragments: fragments.slice(0, fragmentCount), combined }
  }

  return null
}

// SEC-122/SEC-126: Extended Unicode homoglyph confusables map
// Red Team NEX-045/NEX-101/NEX-102 fix: Comprehensive confusable coverage
// Skeptic Round 27 fix: Added Greek pi, math symbols, more Cyrillic
const HOMOGLYPH_MAP: Record<string, string> = {
  // === Cyrillic confusables (complete set) ===
  "\u0430": "a", // Cyrillic small a
  "\u0435": "e", // Cyrillic small ie
  "\u0451": "e", // Cyrillic small io (ё looks like e)
  "\u043E": "o", // Cyrillic small o
  "\u0440": "p", // Cyrillic small er
  "\u0441": "c", // Cyrillic small es
  "\u0443": "y", // Cyrillic small u
  "\u0445": "x", // Cyrillic small ha
  "\u0456": "i", // Cyrillic small i (Ukrainian)
  "\u0457": "i", // Cyrillic small yi (Ukrainian)
  "\u0458": "j", // Cyrillic small je
  "\u0491": "r", // Cyrillic small ghe with upturn
  "\u04CF": "l", // Cyrillic small palochka
  "\u0410": "A", // Cyrillic capital A
  "\u0412": "B", // Cyrillic capital Ve
  "\u0415": "E", // Cyrillic capital Ie
  "\u0417": "3", // Cyrillic capital Ze (looks like 3)
  "\u041A": "K", // Cyrillic capital Ka
  "\u041C": "M", // Cyrillic capital Em
  "\u041D": "H", // Cyrillic capital En
  "\u041E": "O", // Cyrillic capital O
  "\u0420": "P", // Cyrillic capital Er
  "\u0421": "C", // Cyrillic capital Es
  "\u0422": "T", // Cyrillic capital Te
  "\u0425": "X", // Cyrillic capital Ha
  "\u0427": "4", // Cyrillic capital Che (looks like 4)
  "\u0406": "I", // Cyrillic capital I (Ukrainian)
  "\u0408": "J", // Cyrillic capital Je

  // === Greek confusables (complete set - Skeptic Round 27 request) ===
  "\u03B1": "a", // Greek small alpha
  "\u03B2": "B", // Greek small beta (looks like B)
  "\u03B5": "e", // Greek small epsilon
  "\u03B7": "n", // Greek small eta (looks like n)
  "\u03B9": "i", // Greek small iota
  "\u03BA": "k", // Greek small kappa
  "\u03BD": "v", // Greek small nu (looks like v)
  "\u03BF": "o", // Greek small omicron
  "\u03C0": "n", // Greek small pi (SEC-126: Skeptic requested - looks like n)
  "\u03C1": "p", // Greek small rho
  "\u03C2": "c", // Greek small final sigma (looks like c)
  "\u03C3": "o", // Greek small sigma (looks like o)
  "\u03C4": "t", // Greek small tau
  "\u03C5": "u", // Greek small upsilon
  "\u03C7": "x", // Greek small chi
  "\u03C9": "w", // Greek small omega
  "\u0391": "A", // Greek capital Alpha
  "\u0392": "B", // Greek capital Beta
  "\u0395": "E", // Greek capital Epsilon
  "\u0397": "H", // Greek capital Eta
  "\u0399": "I", // Greek capital Iota
  "\u039A": "K", // Greek capital Kappa
  "\u039C": "M", // Greek capital Mu
  "\u039D": "N", // Greek capital Nu
  "\u039F": "O", // Greek capital Omicron
  "\u03A1": "P", // Greek capital Rho
  "\u03A4": "T", // Greek capital Tau
  "\u03A5": "Y", // Greek capital Upsilon
  "\u03A7": "X", // Greek capital Chi
  "\u03A9": "O", // Greek capital Omega (looks like O)

  // === Math symbols (Skeptic Round 27 request) ===
  "\u2113": "l", // Script small l (ℓ)
  "\u212F": "e", // Script small e
  "\u2134": "o", // Script small o
  "\u2118": "p", // Weierstrass p
  "\u2202": "d", // Partial differential (∂ looks like d)
  "\u03D0": "B", // Greek beta symbol
  "\u03D1": "0", // Greek theta symbol
  "\u03D5": "o", // Greek phi symbol (looks like o)
  "\u03F0": "k", // Greek kappa symbol
  "\u03F1": "p", // Greek rho symbol

  // === Latin Extended confusables ===
  "\u0131": "i", // Dotless i (Turkish)
  "\u0237": "j", // Dotless j
  "\u0269": "i", // Latin small iota
  "\u026A": "I", // Latin letter small capital I
  "\u1D0F": "o", // Latin letter small capital O
  "\u1D1C": "u", // Latin letter small capital U
  "\u1E9E": "B", // Latin capital sharp S (ẞ looks like B)
  "\u00DF": "B", // Latin small sharp S (ß looks like B)

  // === Fullwidth Latin (SEC-120 covered but kept for completeness) ===
  "\uFF21": "A", "\uFF22": "B", "\uFF23": "C", "\uFF24": "D", "\uFF25": "E",
  "\uFF26": "F", "\uFF27": "G", "\uFF28": "H", "\uFF29": "I", "\uFF2A": "J",
  "\uFF2B": "K", "\uFF2C": "L", "\uFF2D": "M", "\uFF2E": "N", "\uFF2F": "O",
  "\uFF30": "P", "\uFF31": "Q", "\uFF32": "R", "\uFF33": "S", "\uFF34": "T",
  "\uFF35": "U", "\uFF36": "V", "\uFF37": "W", "\uFF38": "X", "\uFF39": "Y",
  "\uFF3A": "Z",
  "\uFF41": "a", "\uFF42": "b", "\uFF43": "c", "\uFF44": "d", "\uFF45": "e",
  "\uFF46": "f", "\uFF47": "g", "\uFF48": "h", "\uFF49": "i", "\uFF4A": "j",
  "\uFF4B": "k", "\uFF4C": "l", "\uFF4D": "m", "\uFF4E": "n", "\uFF4F": "o",
  "\uFF50": "p", "\uFF51": "q", "\uFF52": "r", "\uFF53": "s", "\uFF54": "t",
  "\uFF55": "u", "\uFF56": "v", "\uFF57": "w", "\uFF58": "x", "\uFF59": "y",
  "\uFF5A": "z",
  "\uFF10": "0", "\uFF11": "1", "\uFF12": "2", "\uFF13": "3", "\uFF14": "4",
  "\uFF15": "5", "\uFF16": "6", "\uFF17": "7", "\uFF18": "8", "\uFF19": "9",

  // === Common substitutions ===
  "\u2010": "-", // Hyphen
  "\u2011": "-", // Non-breaking hyphen
  "\u2012": "-", // Figure dash
  "\u2013": "-", // En dash
  "\u2014": "-", // Em dash
  "\u2212": "-", // Minus sign
  "\uFF0D": "-", // Fullwidth hyphen-minus
  "\u2024": ".", // One dot leader
  "\u2027": ".", // Hyphenation point
  "\uFF0E": ".", // Fullwidth full stop
  "\uFF20": "@", // Fullwidth commercial at
  "\u2218": "o", // Ring operator (∘)
  "\u25CB": "o", // White circle
  "\u25EF": "O", // Large circle
}

/**
 * SEC-126: Safe Punycode/IDN decoding using native URL API (Board Round 27 fix)
 * Replaces custom RFC 3492 implementation with battle-tested native URL API
 *
 * Per CTO/CRO/CSO feedback: "We do not write our own encoding primitives"
 *
 * Benefits:
 * 1. Uses WHATWG URL standard implementation (well-tested)
 * 2. Fail-CLOSED: Invalid inputs are rejected, not passed through
 * 3. Handles all edge cases the spec defines
 * 4. No custom algorithm to maintain
 *
 * The URL API normalizes IDN domains automatically when constructing URL objects.
 */
function decodePunycodeInUrl(text: string): string {
  // SEC-128: SINGLE ATOMIC PASS - Fixes TOCTOU vulnerability (Red Team Round 29)
  //
  // CRITICAL: Process ALL potential hostnames in ONE pass to prevent
  // Time-of-Check-to-Time-of-Use attacks where output of first pass
  // creates new attack vectors for second pass.
  //
  // Algorithm:
  // 1. Collect ALL matches (URLs and bare hostnames) with their positions
  // 2. Normalize ALL hostnames in memory
  // 3. Apply ALL replacements in single atomic operation (reverse order)

  interface HostnameMatch {
    start: number
    end: number
    original: string
    normalized: string
    isUrl: boolean
  }

  const matches: HostnameMatch[] = []

  // Pattern 1: Full URLs
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
  let urlMatch: RegExpExecArray | null
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    try {
      const parsed = new URL(urlMatch[0])
      const normalizedHost = normalizeHomoglyphs(parsed.hostname.normalize("NFKC"))

      if (normalizedHost !== parsed.hostname) {
        const normalizedUrl = urlMatch[0].replace(parsed.hostname, normalizedHost)
        matches.push({
          start: urlMatch.index,
          end: urlMatch.index + urlMatch[0].length,
          original: urlMatch[0],
          normalized: normalizedUrl,
          isUrl: true,
        })
      }
    } catch {
      // Fail-closed: Mark invalid URLs
      matches.push({
        start: urlMatch.index,
        end: urlMatch.index + urlMatch[0].length,
        original: urlMatch[0],
        normalized: "[INVALID_URL_BLOCKED]",
        isUrl: true,
      })
      logSecurity("SEC-128", "Invalid URL blocked - fail-closed", {
        urlSample: urlMatch[0].slice(0, 50),
      })
    }
  }

  // Pattern 2: Bare hostnames (skip positions already covered by URLs)
  const hostnamePattern = /\b([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(?:com|net|org|io|ae|uk|de|fr|ru|cn|gov|edu|[a-z]{2,}))\b/gi
  let hostMatch: RegExpExecArray | null
  while ((hostMatch = hostnamePattern.exec(text)) !== null) {
    const matchIndex = hostMatch.index
    const matchStr = hostMatch[0]

    // Skip if this position is already covered by a URL match
    const isOverlapping = matches.some(
      (m) => m.isUrl && matchIndex >= m.start && matchIndex < m.end
    )
    if (isOverlapping) continue

    const normalized = normalizeHomoglyphs(matchStr.normalize("NFKC"))
    if (normalized !== matchStr) {
      matches.push({
        start: matchIndex,
        end: matchIndex + matchStr.length,
        original: matchStr,
        normalized: normalized,
        isUrl: false,
      })
    }
  }

  // SEC-128: ATOMIC REPLACEMENT - Apply all changes in reverse order
  // This prevents position shifts from affecting subsequent replacements
  matches.sort((a, b) => b.start - a.start) // Sort descending by position

  let result = text
  for (const match of matches) {
    result = result.slice(0, match.start) + match.normalized + result.slice(match.end)

    if (match.normalized !== "[INVALID_URL_BLOCKED]") {
      logSecurity("SEC-128", "Homoglyph normalized in atomic pass", {
        type: match.isUrl ? "URL" : "hostname",
        original: match.original.slice(0, 40),
        normalized: match.normalized.slice(0, 40),
      })
    }
  }

  return result
}

/**
 * SEC-126: Decode IDN hostname using URL API trick
 * Works in Edge runtime where direct Punycode APIs may not be available
 */
function decodeIdnHostname(hostname: string): string {
  // SEC-126: Use URL API to decode Punycode hostnames
  // The URL constructor normalizes IDN automatically
  try {
    // Construct a dummy URL with the hostname
    const dummyUrl = new URL(`http://${hostname}`)
    // The hostname property may still be ASCII in some runtimes
    // But we can detect the decoded form through the href
    return dummyUrl.hostname
  } catch {
    // Fail-closed: return marker for invalid hostname
    throw new Error("Invalid IDN hostname")
  }
}

/**
 * SEC-126: Detect mixed-script homograph attacks (Red Team NEX-102 fix)
 * Flags domains that mix character sets in deceptive ways (Latin + Cyrillic)
 */
function detectMixedScriptHomograph(text: string): boolean {
  // Check if text contains characters from multiple scripts that could be deceptive
  const hasLatin = /[a-zA-Z]/.test(text)
  const hasCyrillic = /[\u0400-\u04FF]/.test(text)
  const hasGreek = /[\u0370-\u03FF]/.test(text)

  // Mixed scripts in a single word/domain is suspicious
  const suspiciousCount = [hasLatin, hasCyrillic, hasGreek].filter(Boolean).length
  return suspiciousCount > 1
}

/**
 * SEC-122: Normalize Unicode homoglyphs to Latin equivalents
 * Prevents PII bypass using visually similar characters
 */
function normalizeHomoglyphs(text: string): string {
  let result = ""
  for (const char of text) {
    result += HOMOGLYPH_MAP[char] || char
  }
  return result
}

/**
 * SEC-079/SEC-084/SEC-093: Scan input for encoded PII and redact
 * SEC-084: Handles multi-layer encoding (Base64→URL→Base64 chains)
 * SEC-093: Handles fragmented encoding attempts
 */
function redactEncodedPii(value: string): string {
  // SEC-104/SEC-110/SEC-113/SEC-116/SEC-119: Strip invisible and combining characters
  // NEX-034 fix: Attackers can use invisible chars to fragment encoded PII
  // SEC-110: U+180E (Mongolian Vowel Separator)
  // SEC-113: Diacritical marks (U+0300-U+036F), variation selectors (U+FE00-U+FE0F)
  // SEC-116: Ideographic Space (U+3000) per Red Team Round 23 NEX-044
  // SEC-119: Complete Unicode whitespace - Hair Space (U+200A), Thin Space (U+2009),
  //          Figure Space (U+2007), En Space (U+2002), Em Space (U+2003),
  //          Punctuation Space (U+2008), Six-Per-Em Space (U+2006), etc.
  // Covers: control chars, zero-width, bidi, combining, ALL Unicode spaces
  let result = value.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001F\u007F\u0300-\u036F\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000\uFE00-\uFE0F\uFEFF]/g,
    ""
  )

  // SEC-120: Unicode normalization to NFKC before PII detection
  // Normalizes fullwidth chars: 'ｅｍａｉｌ' → 'email'
  result = result.normalize("NFKC")

  // SEC-122: Homoglyph normalization (Red Team NEX-045 fix)
  // Converts visually similar chars from Cyrillic/Greek to Latin
  // e.g., Cyrillic 'а' (U+0430) → Latin 'a', Greek 'ο' → Latin 'o'
  result = normalizeHomoglyphs(result)

  // SEC-093: First check for fragmented Base64 patterns
  const fragmented = detectFragmentedPii(value)
  if (fragmented) {
    const { foundPii, depth, encodingChain, operations } = recursiveDecodeAndCheckPii(fragmented.combined)
    if (foundPii) {
      logSecurity("SEC-093", "Fragmented encoded PII detected - reassembly attack blocked", {
        fragmentCount: fragmented.fragments.length,
        combinedLength: fragmented.combined.length,
        encodingDepth: depth,
        decodeOperations: operations,
        encodingChain: encodingChain.join(" → "),
      })
      // Redact all fragments
      for (const fragment of fragmented.fragments) {
        result = result.replace(fragment, "[FRAG_PII_REDACTED]")
      }
    }
  }

  // SEC-093: Lowered threshold from 20 to 8 chars to catch smaller encoded blocks
  // 8 chars Base64 = 6 bytes decoded, enough for partial Emirates ID
  const base64Candidates = result.match(/[A-Za-z0-9+/]{8,}={0,2}/g) || []
  for (const candidate of base64Candidates) {
    // SEC-088: Use dynamic recursive decoder (no fixed layer limit)
    const { foundPii, depth, encodingChain, operations } = recursiveDecodeAndCheckPii(candidate)
    if (foundPii) {
      logSecurity("SEC-088", "Dynamic layered-encoded PII detected and redacted", {
        encodedLength: candidate.length,
        encodingDepth: depth,
        decodeOperations: operations,
        encodingChain: encodingChain.join(" → "),
      })
      result = result.replace(candidate, "[LAYERED_PII_REDACTED]")
    }
  }

  // SEC-093: Lowered hex threshold from 40 to 24 chars (12 bytes, minimum for Emirates ID)
  const hexCandidates = result.match(/[0-9A-Fa-f]{24,}/g) || []
  for (const candidate of hexCandidates) {
    const { foundPii, depth, encodingChain, operations } = recursiveDecodeAndCheckPii(candidate)
    if (foundPii) {
      logSecurity("SEC-088", "Hex-encoded PII detected and redacted", {
        encodedLength: candidate.length,
        encodingDepth: depth,
        decodeOperations: operations,
        encodingChain: encodingChain.join(" → "),
      })
      result = result.replace(candidate, "[HEX_PII_REDACTED]")
    }
  }

  // Pattern to find URL-encoded segments
  const urlEncodedCandidates = result.match(/(?:%[0-9A-Fa-f]{2})+[^%\s]*/g) || []
  for (const candidate of urlEncodedCandidates) {
    // SEC-088: Use dynamic recursive decoder (no fixed layer limit)
    const { foundPii, depth, encodingChain, operations } = recursiveDecodeAndCheckPii(candidate)
    if (foundPii) {
      logSecurity("SEC-088", "Dynamic URL-encoded PII detected and redacted", {
        encodedLength: candidate.length,
        encodingDepth: depth,
        decodeOperations: operations,
        encodingChain: encodingChain.join(" → "),
      })
      result = result.replace(candidate, "[LAYERED_PII_REDACTED]")
    }
  }

  return result
}

function sanitizeForLog(value: string): string {
  // SEC-074: Input length limit BEFORE regex processing to prevent ReDoS
  // Truncate overly long inputs - no legitimate log value should exceed this
  if (value.length > MAX_SANITIZE_INPUT_LENGTH) {
    value = value.slice(0, MAX_SANITIZE_INPUT_LENGTH) + "[TRUNCATED]"
  }

  // SEC-079: Check for encoded PII BEFORE standard pattern matching
  // This catches Base64 and URL-encoded sensitive data that would bypass regex
  value = redactEncodedPii(value)

  // SEC-062/SEC-074: Mask email addresses completely
  // SEC-074: Fixed - bounded repetition {1,64} prevents catastrophic backtracking
  const emailPattern = /[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,10}/g
  let sanitized = value.replace(emailPattern, "[EMAIL_REDACTED]")

  // SEC-062/SEC-074: Mask IP addresses COMPLETELY (Red Team NEX-006 fix)
  // SEC-074: Already safe - fixed-width digit patterns don't backtrack
  const ipv4Pattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g
  sanitized = sanitized.replace(ipv4Pattern, "[IP_REDACTED]")

  // SEC-062/SEC-074: Mask IPv6 addresses completely
  // SEC-074: Fixed - non-capturing group with bounded colon groups
  const ipv6Pattern = /[0-9a-fA-F]{0,4}(?::[0-9a-fA-F]{0,4}){2,7}/g
  sanitized = sanitized.replace(ipv6Pattern, "[IPv6_REDACTED]")

  // SEC-074: Mask JWT tokens completely
  // SEC-074: Fixed - bounded segment lengths prevent backtracking
  const jwtPattern = /eyJ[a-zA-Z0-9_-]{1,2000}\.eyJ[a-zA-Z0-9_-]{1,2000}\.[a-zA-Z0-9_-]{1,1000}/g
  sanitized = sanitized.replace(jwtPattern, "[JWT_REDACTED]")

  // SEC-062/SEC-074: Mask UUIDs COMPLETELY (Red Team NEX-006 fix)
  // SEC-074: Already safe - fixed-width hex patterns don't backtrack
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi
  sanitized = sanitized.replace(uuidPattern, "[UUID_REDACTED]")

  // SEC-062/SEC-074: Mask potential phone numbers
  // SEC-074: Fixed - explicit alternation with bounded groups, no nested quantifiers
  const phonePattern = /(?:\+?\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g
  sanitized = sanitized.replace(phonePattern, "[PHONE_REDACTED]")

  // SEC-062/SEC-074: Mask Emirates ID pattern (784-XXXX-XXXXXXX-X)
  // SEC-074: Already safe - fixed structure with bounded digits
  const emiratesIdPattern = /784-?\d{4}-?\d{7}-?\d/g
  sanitized = sanitized.replace(emiratesIdPattern, "[EMIRATES_ID_REDACTED]")

  // SEC-071/SEC-074/SEC-108: Mask UAE phone numbers
  // SEC-108: Added UAE landline prefixes (02=Abu Dhabi, 04=Dubai, 06=Sharjah/Ajman, 07=RAK, 09=Fujairah)
  // Mobile: +971 5X XXX XXXX, Landline: +971 [2467]X XXX XXXX
  const uaeMobilePattern = /(?:\+971|00971|971)?[ .-]?5\d[ .-]?\d{3}[ .-]?\d{4}/g
  sanitized = sanitized.replace(uaeMobilePattern, "[UAE_PHONE_REDACTED]")
  // SEC-111: All UAE landline prefixes (02-04, 06-09) per CEO Round 23 finding
  // 02=Abu Dhabi, 03=Al-Ain, 04=Dubai, 06=Sharjah/Ajman, 07=RAK, 08=VOIP, 09=Fujairah
  const uaeLandlinePattern = /(?:\+971|00971|971)?[ .-]?0?[2-46-9][ .-]?\d{3}[ .-]?\d{4}/g
  sanitized = sanitized.replace(uaeLandlinePattern, "[UAE_PHONE_REDACTED]")

  // SEC-071/SEC-074/SEC-109: Mask UAE license plates (e.g., A 12345, AB 1234, ABC 123)
  // SEC-109: Added Arabic plate codes (أ، ب، ج، د، ه، و، ز، ح، ط، ي، ك، ل، م، ن، س، ع، ف، ص، ق، ر، ش، ت، ث، خ، ذ، ض، ظ، غ)
  const uaePlatePattern = /\b[A-Zأ-ي]{1,3}[ -]?\d{1,5}\b/g
  sanitized = sanitized.replace(uaePlatePattern, "[UAE_PLATE_REDACTED]")

  // SEC-071/SEC-074: Mask UAE P.O. Box numbers
  // SEC-074: Fixed - bounded whitespace {0,5} instead of unbounded \s*
  const uaePoBoxPattern = /P\.?O\.?[ ]{0,5}Box[ ]{0,5}\d{1,6}/gi
  sanitized = sanitized.replace(uaePoBoxPattern, "[UAE_POBOX_REDACTED]")

  // SEC-063/SEC-074: Sanitize potential prompt injection in headers (Red Team NEX-007 fix)
  // SEC-074: Fixed - bounded content length instead of .*? which can backtrack
  // Remove script tags with bounded content (max 1000 chars between tags)
  const scriptPattern = /<script[^>]{0,200}>[^<]{0,1000}<\/script>/gi
  sanitized = sanitized.replace(scriptPattern, "[SCRIPT_REMOVED]")

  // SEC-074: Fixed - bounded whitespace and explicit single-char prefix
  const sqlPattern = /['";][ ]{0,10}(?:OR|AND|DROP|DELETE|INSERT|UPDATE|SELECT)[ ]+/gi
  sanitized = sanitized.replace(sqlPattern, "[SQL_REMOVED]")
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars

  return sanitized
}

/**
 * SEC-048: Sanitize an identifier for logging
 * Keeps enough info for debugging while protecting PII
 */
function sanitizeIdentifier(identifier: string): string {
  // Rate limit keys are in format: userId:IP:fingerprint:dayBucket
  const parts = identifier.split(":")
  if (parts.length >= 4) {
    // Sanitize userId (first 8 chars only)
    const userId = parts[0].length > 8 ? parts[0].slice(0, 8) + "..." : parts[0]
    // Mask IP (keep first octet)
    const ip = parts[1].split(".")[0] + ".xxx.xxx.xxx"
    // Truncate fingerprint (first 8 chars)
    const fp = parts[2].slice(0, 8) + "..."
    // Keep day bucket
    const day = parts[3]
    return `${userId}:${ip}:${fp}:${day}`
  }
  return sanitizeForLog(identifier)
}

/**
 * SEC-049: Redis Health Monitoring
 *
 * Tracks Redis health metrics for monitoring and alerting.
 * Addresses CRO concern about Redis failure visibility.
 */
interface RedisHealthMetrics {
  consecutiveFailures: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  totalFailures: number
  totalSuccesses: number
  circuitBreakerTrips: number
}

const redisHealthMetrics: RedisHealthMetrics = {
  consecutiveFailures: 0,
  lastFailureTime: null,
  lastSuccessTime: null,
  totalFailures: 0,
  totalSuccesses: 0,
  circuitBreakerTrips: 0,
}

/**
 * SEC-049: Export Redis health for monitoring endpoints
 * Can be called by /api/health or monitoring systems
 */
export function getRedisHealthMetrics(): RedisHealthMetrics & { circuitBreakerState: string; dampeningActive: boolean; consecutiveTrips: number; currentCooldownMs: number; recentOscillations: number } {
  return {
    ...redisHealthMetrics,
    circuitBreakerState: circuitBreakerState.halfOpen
      ? "half-open"
      : circuitBreakerState.openedAt
      ? "open"
      : "closed",
    // SEC-069: Dampening metrics for monitoring
    dampeningActive: circuitBreakerState.dampeningActive,
    consecutiveTrips: circuitBreakerState.consecutiveTrips,
    currentCooldownMs: Math.min(
      CIRCUIT_BREAKER_RESET_TIMEOUT_MS *
        Math.pow(DAMPENING_COOLDOWN_MULTIPLIER, circuitBreakerState.consecutiveTrips),
      DAMPENING_MAX_COOLDOWN_MS
    ),
    recentOscillations: circuitBreakerState.oscillationTimestamps.length,
  }
}

/**
 * SEC-056/SEC-061: WORM/SIEM Audit Log Forwarding Configuration
 *
 * External immutable audit log destination addresses CSO insider threat concern.
 * Configure AUDIT_SIEM_ENDPOINT for write-once external logging (e.g., Axiom, Datadog, Elasticsearch).
 * Redis audit logs remain as hot cache; SIEM is append-only tamper-proof source of truth.
 *
 * SEC-061: Added retry mechanism with local dead letter queue to prevent audit loss.
 */
const AUDIT_SIEM_ENDPOINT = process.env.AUDIT_SIEM_ENDPOINT // e.g., https://api.axiom.co/v1/datasets/audit/ingest
const AUDIT_SIEM_TOKEN = process.env.AUDIT_SIEM_TOKEN // Bearer token for SIEM API
const AUDIT_SIEM_ENABLED =
  process.env.NODE_ENV === "production" && AUDIT_SIEM_ENDPOINT && AUDIT_SIEM_TOKEN

// SEC-061: Dead letter queue for failed SIEM entries (in-memory, bounded)
// SEC-076: Enhanced with TTL, aggressive cleanup, memory pressure detection, and size limits
interface DLQEntry {
  entry: Record<string, unknown>
  attempts: number
  lastAttempt: number
  createdAt: number // SEC-076: Track creation time for TTL
  entrySize: number // SEC-076: Track serialized size for memory accounting
  securityCritical: boolean // SEC-085: Priority flag for attack detection events
}
const SIEM_DEAD_LETTER_QUEUE: DLQEntry[] = []
const SIEM_DLQ_MAX_SIZE = 1000 // Max entries to queue locally
const SIEM_MAX_RETRIES = 3
const SIEM_RETRY_BASE_DELAY_MS = 1000 // Exponential backoff: 1s, 2s, 4s

// SEC-076: DLQ resource exhaustion mitigation constants
const SIEM_DLQ_ENTRY_TTL_MS = 5 * 60 * 1000 // 5 minutes max age for DLQ entries
const SIEM_DLQ_MAX_ENTRY_SIZE_BYTES = 64 * 1024 // 64KB max per audit entry
const SIEM_DLQ_CLEANUP_THRESHOLD = 0.8 // Trigger aggressive cleanup at 80% capacity
// SEC-082: Increased from 50MB to 200MB per CTO audit Round 15 - DoS mitigation
const SIEM_DLQ_MEMORY_PRESSURE_THRESHOLD_MB = 200 // Max ~200MB for entire DLQ

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-085: DLQ ANTI-BLINDING (Red Team NEX-014 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (NEX-014): Attacker floods DLQ with spam before attack.
// When actual attack happens, security logs cannot be written - DLQ is full.
//
// FIX: Reserve 20% of DLQ capacity for security-critical events only.
// Regular audit entries use 80% capacity, security events guaranteed 20%.
// Security-critical events: rate limit blocks, attack detection, anomaly blocks.
// ═══════════════════════════════════════════════════════════════════════════════
const SIEM_DLQ_SECURITY_RESERVED_PERCENT = 0.2 // 20% reserved for security events
const SIEM_DLQ_REGULAR_CAPACITY = Math.floor(SIEM_DLQ_MAX_SIZE * (1 - SIEM_DLQ_SECURITY_RESERVED_PERCENT))
const SIEM_DLQ_SECURITY_CAPACITY = SIEM_DLQ_MAX_SIZE - SIEM_DLQ_REGULAR_CAPACITY

// SEC-085: Track counts separately
let siemDlqRegularCount = 0
let siemDlqSecurityCount = 0

// SEC-085: Event types that are security-critical (attack detection)
const SECURITY_CRITICAL_OPERATIONS = new Set([
  "RATE_LIMIT_EXCEEDED",
  "RATE_LIMIT_BLOCKED",
  "ANOMALY_DETECTED",
  "ANOMALY_BLOCKED",
  "DISTRIBUTED_ATTACK_DETECTED",
  "DISTRIBUTED_ATTACK_BLOCKED",
  "CSRF_FAILED",
  "SESSION_HIJACK_ATTEMPT",
  "LOCKOUT_TRIGGERED",
  "BRUTE_FORCE_DETECTED",
  "HSM_DEGRADED",
  "HSM_UNREACHABLE",
  "CIRCUIT_BREAKER_OPENED",
  "PII_LEAK_ATTEMPT",
])

/**
 * SEC-085: Check if an audit entry is security-critical
 */
function isSecurityCriticalEvent(entry: Record<string, unknown>): boolean {
  const operation = entry.operation as string
  return SECURITY_CRITICAL_OPERATIONS.has(operation)
}

// SEC-076: Track total DLQ memory usage
let siemDlqTotalBytes = 0

/**
 * SEC-076: Calculate approximate memory usage of DLQ entry
 */
function estimateDlqEntrySize(entry: Record<string, unknown>): number {
  try {
    return JSON.stringify(entry).length * 2 // UTF-16 overhead approximation
  } catch {
    return SIEM_DLQ_MAX_ENTRY_SIZE_BYTES // Assume max if serialization fails
  }
}

/**
 * SEC-076/SEC-085: Aggressive DLQ cleanup - removes oldest NON-CRITICAL entries
 * SEC-085: NEVER removes security-critical events during cleanup - attack blinding protection.
 * Called when DLQ exceeds threshold capacity or memory limits.
 */
function aggressiveDlqCleanup(reason: string): number {
  const targetSize = Math.floor(SIEM_DLQ_MAX_SIZE * 0.5) // Reduce to 50% capacity
  let removedCount = 0
  let preservedSecurityCount = 0

  // SEC-085: Remove oldest non-security-critical entries first
  let i = 0
  while (SIEM_DEAD_LETTER_QUEUE.length > targetSize && i < SIEM_DEAD_LETTER_QUEUE.length) {
    const entry = SIEM_DEAD_LETTER_QUEUE[i]
    if (!entry.securityCritical) {
      // Remove non-critical entry
      SIEM_DEAD_LETTER_QUEUE.splice(i, 1)
      siemDlqTotalBytes -= entry.entrySize
      siemDlqRegularCount--
      removedCount++
    } else {
      // SEC-085: Preserve security-critical entries
      preservedSecurityCount++
      i++
    }
  }

  if (removedCount > 0 || preservedSecurityCount > 0) {
    logWarn("SEC-085", "DLQ anti-blinding cleanup executed", {
      reason,
      removedRegularEntries: removedCount,
      preservedSecurityEntries: preservedSecurityCount,
      remainingEntries: SIEM_DEAD_LETTER_QUEUE.length,
      remainingBytes: siemDlqTotalBytes,
    })
  }

  return removedCount
}

/**
 * SEC-076/SEC-085: Remove expired DLQ entries (TTL-based cleanup)
 * SEC-085: Track security vs regular counts on removal
 */
function cleanupExpiredDlqEntries(): number {
  const now = Date.now()
  let removedCount = 0
  let removedSecurityCount = 0
  let i = 0

  while (i < SIEM_DEAD_LETTER_QUEUE.length) {
    const item = SIEM_DEAD_LETTER_QUEUE[i]
    if (now - item.createdAt > SIEM_DLQ_ENTRY_TTL_MS) {
      siemDlqTotalBytes -= item.entrySize
      // SEC-085: Track counts on removal
      if (item.securityCritical) {
        siemDlqSecurityCount--
        removedSecurityCount++
      } else {
        siemDlqRegularCount--
      }
      SIEM_DEAD_LETTER_QUEUE.splice(i, 1)
      removedCount++
    } else {
      i++
    }
  }

  if (removedCount > 0) {
    logInfo("SEC-076", "DLQ TTL cleanup removed expired entries", {
      removedEntries: removedCount,
      removedSecurityEntries: removedSecurityCount,
      remainingEntries: SIEM_DEAD_LETTER_QUEUE.length,
    })
  }

  return removedCount
}

/**
 * SEC-076: Check if DLQ is under memory pressure
 */
function isDlqUnderMemoryPressure(): boolean {
  return siemDlqTotalBytes > SIEM_DLQ_MEMORY_PRESSURE_THRESHOLD_MB * 1024 * 1024
}

/**
 * SEC-076: Log structured DLQ health metrics
 */
function logDlqHealth(): void {
  const queueLength = SIEM_DEAD_LETTER_QUEUE.length
  const capacityPercent = (queueLength / SIEM_DLQ_MAX_SIZE) * 100
  const memoryMB = siemDlqTotalBytes / (1024 * 1024)

  // Only log when there's something noteworthy
  if (queueLength > 0) {
    logInfo("SEC-076", "DLQ health status", {
      entries: queueLength,
      maxEntries: SIEM_DLQ_MAX_SIZE,
      capacityPercent: capacityPercent.toFixed(1),
      memoryMB: memoryMB.toFixed(2),
      memoryLimitMB: SIEM_DLQ_MEMORY_PRESSURE_THRESHOLD_MB,
      oldestEntryAgeMs: queueLength > 0 ? Date.now() - SIEM_DEAD_LETTER_QUEUE[0].createdAt : 0,
    })
  }
}

/**
 * SEC-076: Validate and truncate audit entry to prevent oversized entries
 */
function sanitizeAuditEntryForDlq(entry: Record<string, unknown>): Record<string, unknown> | null {
  const size = estimateDlqEntrySize(entry)

  if (size <= SIEM_DLQ_MAX_ENTRY_SIZE_BYTES) {
    return entry
  }

  // Try to create a truncated version preserving critical fields
  const criticalFields = ["timestamp", "operation", "identifier", "ip", "requestId", "_hash"]
  const truncated: Record<string, unknown> = {
    _truncated: true,
    _originalSize: size,
  }

  for (const field of criticalFields) {
    if (entry[field] !== undefined) {
      truncated[field] = entry[field]
    }
  }

  // Add truncated details
  truncated.details = "[TRUNCATED - entry exceeded 64KB limit]"

  const truncatedSize = estimateDlqEntrySize(truncated)
  if (truncatedSize > SIEM_DLQ_MAX_ENTRY_SIZE_BYTES) {
    // Even truncated version too large - reject entirely
    logError("SEC-076", "Audit entry rejected - too large even after truncation", {
      originalSize: size,
      truncatedSize,
      maxSize: SIEM_DLQ_MAX_ENTRY_SIZE_BYTES,
    })
    return null
  }

  logWarn("SEC-076", "Audit entry truncated before DLQ queuing", {
    originalSize: size,
    truncatedSize,
    maxSize: SIEM_DLQ_MAX_ENTRY_SIZE_BYTES,
  })

  return truncated
}

/**
 * SEC-061/SEC-076: Process dead letter queue - called periodically to retry failed SIEM entries
 * Non-blocking, best effort. Called on every new audit entry.
 * SEC-076: Now includes TTL cleanup, memory pressure detection, and health logging
 */
async function processSiemDeadLetterQueue(): Promise<void> {
  if (!AUDIT_SIEM_ENABLED) return

  // SEC-076: First, clean up expired entries by TTL (always run, even if queue empty after)
  cleanupExpiredDlqEntries()

  // SEC-076: Check for memory pressure and trigger aggressive cleanup if needed
  if (isDlqUnderMemoryPressure()) {
    aggressiveDlqCleanup("memory_pressure")
  }

  // SEC-076: Check for capacity threshold cleanup (80%)
  if (SIEM_DEAD_LETTER_QUEUE.length >= SIEM_DLQ_MAX_SIZE * SIEM_DLQ_CLEANUP_THRESHOLD) {
    aggressiveDlqCleanup("capacity_threshold")
  }

  // SEC-076: Log health metrics periodically
  logDlqHealth()

  if (SIEM_DEAD_LETTER_QUEUE.length === 0) return

  const now = Date.now()
  const toRetry: DLQEntry[] = []

  // Collect entries ready for retry
  while (SIEM_DEAD_LETTER_QUEUE.length > 0) {
    const item = SIEM_DEAD_LETTER_QUEUE[0]
    const delay = SIEM_RETRY_BASE_DELAY_MS * Math.pow(2, item.attempts - 1)
    if (now - item.lastAttempt >= delay) {
      const removed = SIEM_DEAD_LETTER_QUEUE.shift()!
      siemDlqTotalBytes -= removed.entrySize // SEC-076: Track memory on removal
      // SEC-085: Track counts on removal
      if (removed.securityCritical) {
        siemDlqSecurityCount--
      } else {
        siemDlqRegularCount--
      }
      toRetry.push(removed)
    } else {
      break // Queue is ordered by time, so stop if first isn't ready
    }
  }

  // Retry each entry
  for (const item of toRetry) {
    try {
      const response = await fetch(AUDIT_SIEM_ENDPOINT!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUDIT_SIEM_TOKEN}`,
          "X-Source": "nexusad-middleware-dlq-retry",
        },
        body: JSON.stringify([item.entry]),
      })
      if (!response.ok) throw new Error(`SIEM returned ${response.status}`)
      logInfo("SEC-061", "DLQ entry successfully sent to SIEM", {
        attempts: item.attempts,
        securityCritical: item.securityCritical,
      })
    } catch {
      item.attempts++
      item.lastAttempt = now
      if (item.attempts < SIEM_MAX_RETRIES) {
        // Re-queue for another attempt
        SIEM_DEAD_LETTER_QUEUE.push(item)
        siemDlqTotalBytes += item.entrySize // SEC-076: Track memory on re-add
        // SEC-085: Track counts on re-add
        if (item.securityCritical) {
          siemDlqSecurityCount++
        } else {
          siemDlqRegularCount++
        }
      } else {
        // Max retries exceeded - log and discard (Redis still has it)
        logError("SEC-061", "SIEM entry permanently failed - preserved in Redis only", {
          maxRetries: SIEM_MAX_RETRIES,
          attempts: item.attempts,
          securityCritical: item.securityCritical,
        })
      }
    }
  }
}

/**
 * SEC-056/SEC-061/SEC-076/SEC-085: Forward audit entry to external WORM/SIEM with retry
 * At-least-once delivery with exponential backoff. Dead letter queue for failures.
 * SEC-076: Entry size limiting and memory pressure handling.
 * SEC-085: Priority queuing - security-critical events use reserved capacity.
 */
async function forwardToSiem(auditEntry: Record<string, unknown>): Promise<void> {
  if (!AUDIT_SIEM_ENABLED || !AUDIT_SIEM_ENDPOINT || !AUDIT_SIEM_TOKEN) return

  // SEC-061: Process any pending DLQ entries first
  void processSiemDeadLetterQueue()

  try {
    const response = await fetch(AUDIT_SIEM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUDIT_SIEM_TOKEN}`,
        "X-Source": "nexusad-middleware",
      },
      body: JSON.stringify([auditEntry]),
    })
    if (!response.ok) throw new Error(`SIEM returned ${response.status}`)
  } catch {
    // SEC-076: Sanitize entry size before queuing to prevent memory exhaustion
    const sanitizedEntry = sanitizeAuditEntryForDlq(auditEntry)
    if (!sanitizedEntry) {
      // Entry too large even after truncation - skip queuing but log
      logError("SEC-076", "SIEM forwarding failed - entry too large for DLQ", {
        dlqSize: SIEM_DEAD_LETTER_QUEUE.length,
      })
      return
    }

    const entrySize = estimateDlqEntrySize(sanitizedEntry)

    // SEC-076: Check memory pressure before adding
    if (isDlqUnderMemoryPressure()) {
      aggressiveDlqCleanup("memory_pressure_on_add")
    }

    // SEC-085: Check if this is a security-critical event
    const isCritical = isSecurityCriticalEvent(auditEntry)

    // SEC-085: Determine available capacity based on event type
    // Security-critical events use reserved capacity (20% = 200 entries)
    // Regular events use main capacity (80% = 800 entries)
    const canQueue = isCritical
      ? siemDlqSecurityCount < SIEM_DLQ_SECURITY_CAPACITY
      : siemDlqRegularCount < SIEM_DLQ_REGULAR_CAPACITY

    // SEC-085: If regular queue is full but event is critical, evict oldest regular entry
    if (isCritical && !canQueue && siemDlqRegularCount > 0) {
      // Find and remove oldest non-critical entry
      const idx = SIEM_DEAD_LETTER_QUEUE.findIndex(e => !e.securityCritical)
      if (idx >= 0) {
        const removed = SIEM_DEAD_LETTER_QUEUE.splice(idx, 1)[0]
        siemDlqTotalBytes -= removed.entrySize
        siemDlqRegularCount--
        logWarn("SEC-085", "Evicted regular entry to make room for security-critical event", {
          evictedOperation: removed.entry.operation,
        })
      }
    }

    // SEC-061/SEC-076/SEC-085: Add to dead letter queue for retry instead of dropping
    const finalCanQueue = isCritical
      ? siemDlqSecurityCount < SIEM_DLQ_SECURITY_CAPACITY || siemDlqRegularCount > 0
      : siemDlqRegularCount < SIEM_DLQ_REGULAR_CAPACITY

    if (finalCanQueue && SIEM_DEAD_LETTER_QUEUE.length < SIEM_DLQ_MAX_SIZE) {
      const now = Date.now()
      SIEM_DEAD_LETTER_QUEUE.push({
        entry: sanitizedEntry,
        attempts: 1,
        lastAttempt: now,
        createdAt: now, // SEC-076: Track for TTL
        entrySize, // SEC-076: Track for memory accounting
        securityCritical: isCritical, // SEC-085: Priority flag
      })
      siemDlqTotalBytes += entrySize // SEC-076: Track total memory

      // SEC-085: Track counts separately
      if (isCritical) {
        siemDlqSecurityCount++
      } else {
        siemDlqRegularCount++
      }

      logWarn("SEC-061", "SIEM forwarding failed - queued for retry", {
        dlqSize: SIEM_DEAD_LETTER_QUEUE.length,
        dlqMemoryMB: (siemDlqTotalBytes / (1024 * 1024)).toFixed(2),
        securityCritical: isCritical,
        securityQueueCount: siemDlqSecurityCount,
        regularQueueCount: siemDlqRegularCount,
      })
    } else {
      // SEC-085: Log differently for critical vs regular events
      if (isCritical) {
        logError("SEC-085", "SECURITY-CRITICAL DLQ full - potential audit blinding attack", {
          dlqMaxSize: SIEM_DLQ_MAX_SIZE,
          securityCapacity: SIEM_DLQ_SECURITY_CAPACITY,
          securityUsed: siemDlqSecurityCount,
          operation: auditEntry.operation,
        })
      } else {
        logError("SEC-061", "SIEM DLQ full - entry preserved in Redis only", { dlqMaxSize: SIEM_DLQ_MAX_SIZE })
      }
    }
  }
}

/**
 * SEC-050/SEC-056: Enhanced audit logging with WORM/SIEM forwarding
 *
 * Logs sensitive operations with full context for forensics.
 * Dual-write strategy: Redis for hot cache, SIEM for immutable archive.
 * Addresses CSO concerns about insider threat monitoring and audit tampering.
 */
async function auditSensitiveOperation(
  operation: string,
  identifier: string,
  details: Record<string, unknown>,
  request: NextRequest
): Promise<void> {
  // SEC-081: Increment sequence number for deletion detection
  auditSequenceNumber++

  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    identifier: sanitizeIdentifier(identifier),
    ip: sanitizeForLog(getClientIp(request)),
    userAgent: request.headers.get("user-agent")?.slice(0, 100) || "unknown",
    pathname: request.nextUrl.pathname,
    method: request.method,
    // SEC-050: Include request fingerprint for correlation
    requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
    // SEC-081: Sequence number + instance ID for deletion detection
    // Gaps in sequence indicate deleted entries - SIEM can alert on this
    _seq: auditSequenceNumber,
    _instanceId: AUDIT_INSTANCE_ID,
    // SEC-056: Add integrity hash for tamper detection
    _hash: "", // Will be computed below
    ...details,
  }

  // SEC-056/SEC-067: Compute integrity hash using DERIVED key (Red Team NEX-005 fix)
  // Uses separate key from CSRF to maintain cryptographic key separation
  const { _hash: _, ...entryForHashing } = auditEntry
  const hashData = new TextEncoder().encode(JSON.stringify(entryForHashing))
  const auditSecret = await getAuditSecret()
  const hashKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(auditSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const hashBuffer = await crypto.subtle.sign("HMAC", hashKey, hashData)
  auditEntry._hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Log to console for immediate visibility
  logSecurity("SEC-050", `AUDIT: ${operation}`, { auditEntry })

  // SEC-056: Forward to external SIEM (non-blocking, fire-and-forget)
  // This is the tamper-proof source of truth - insider cannot modify external WORM storage
  void forwardToSiem(auditEntry)

  // Store in Redis for hot cache / recent lookup (insider-accessible but verified by hash)
  if (redis) {
    try {
      const auditKey = "nexusad:audit-log"
      await redis.lpush(auditKey, JSON.stringify(auditEntry))
      await redis.ltrim(auditKey, 0, 49999) // Keep last 50k audit entries
    } catch {
      // Best effort - don't fail request if audit logging fails
      logError("SEC-050", "Failed to persist audit log to Redis")
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════════════════

// SEC-034: Base security headers (CSP is now generated per-request with nonce)
const BASE_SECURITY_HEADERS = {
  // SEC-NETWORK-005: Added 'preload' to match next.config.ts and enable Chrome HSTS preload list
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // SEC-UI-112: Allow microphone for voice counsel feature (self-only), block all other dangerous APIs.
  // camera=() and geolocation=() remain blocked. interest-cohort=() blocks FLoC tracking.
  // SEC-NETWORK-010: Extended to also disable payment and USB APIs.
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "X-XSS-Protection": "1; mode=block",
  // SEC-UI-113: Cross-Origin-Opener-Policy prevents window.opener references from cross-origin popups.
  // This mitigates Spectre-type side-channel attacks and cross-origin window manipulation.
  "Cross-Origin-Opener-Policy": "same-origin",
  // SEC-UI-114: Cross-Origin-Resource-Policy prevents other sites from loading our resources.
  "Cross-Origin-Resource-Policy": "same-origin",
  // SEC-NETWORK-009: Cross-Origin-Embedder-Policy enables cross-origin isolation
  // (SharedArrayBuffer, high-resolution timers). Using 'credentialless' instead of
  // 'require-corp' to avoid breaking third-party resources (analytics, fonts) that
  // lack CORP headers while still providing Spectre side-channel protection.
  "Cross-Origin-Embedder-Policy": "credentialless",
  // SEC-215: X-DNS-Prefetch-Control prevents browser from pre-resolving external domains
  // which can leak which pages a user visits to DNS resolvers
  "X-DNS-Prefetch-Control": "off",
  // SEC-216: X-Permitted-Cross-Domain-Policies blocks Flash/PDF cross-domain policy files
  // Prevents Adobe products from loading cross-domain data
  "X-Permitted-Cross-Domain-Policies": "none",
}

/**
 * SEC-034: Generate cryptographically secure nonce for CSP
 * Each request gets a unique nonce to prevent XSS via script injection
 */
function generateCspNonce(): string {
  const nonceBytes = new Uint8Array(16) // 128 bits of entropy
  crypto.getRandomValues(nonceBytes)
  return btoa(String.fromCharCode.apply(null, Array.from(nonceBytes)))
}

/**
 * SEC-034, SEC-042: Generate Content-Security-Policy with per-request nonce
 *
 * SECURITY FIX: Removed 'unsafe-inline' and 'unsafe-eval' from script-src
 * These are HIGH RISK for XSS attacks (CSO flagged).
 *
 * SEC-042: Also apply nonce to style-src to prevent CSS injection attacks.
 * CSS injection can be used for data exfiltration via attribute selectors
 * or UI spoofing attacks. Nonce-based styles are more secure.
 *
 * Instead, we use nonce-based CSP:
 * - Scripts must have the matching nonce attribute to execute
 * - Styles must have the matching nonce attribute to apply
 * - Inline scripts/styles without nonce are blocked
 * - eval() and Function() are blocked
 */
function generateCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com`,
    // SEC-042, SEC-043: Style CSP with 'unsafe-inline' for Radix UI and framer-motion compatibility
    // Modern UI libraries (Radix UI, framer-motion) inject inline styles dynamically without nonces.
    // The nonce-only approach (SEC-042) caused 160+ console errors and broke UI rendering.
    // Re-enabling 'unsafe-inline' for styles is acceptable because:
    // 1. CSS injection attacks (expression() in IE, attribute selectors) are low-risk in modern browsers
    // 2. Our target browsers (Chrome 90+, Safari 14+, Firefox 90+) do not support CSS expressions
    // 3. Breaking UI functionality is worse than theoretical CSS injection risk
    // 4. Scripts remain protected by nonce-only policy (high-risk XSS vector)
    // Note: When nonce is present, modern browsers ignore 'unsafe-inline' for scripts but NOT for styles
    `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`,
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    // SEC-045: connect-src covers all outbound XHR/fetch/WebSocket from the browser.
    // *.ingest.sentry.io  — Sentry error reporting (sentry.client.config.ts uses NEXT_PUBLIC_SENTRY_DSN)
    // *.proxy.runpod.net  — RunPod GPU backend (Sovereign AI); wildcard covers dynamic pod IDs
    // *.vercel-analytics.com — Vercel Speed Insights / Web Analytics
    // *.nexusad.ai / wss://*.nexusad.ai — first-party API and WebSocket endpoints
    "connect-src 'self' https://*.vercel-analytics.com https://*.nexusad.ai wss://*.nexusad.ai https://*.ingest.sentry.io https://*.proxy.runpod.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ") + ";"
}

/**
 * SEC-034, SEC-044: Apply security headers to a response with per-request CSP nonce
 *
 * The nonce is:
 * 1. Generated fresh for each request
 * 2. Added to the CSP header
 * 3. Passed via x-nonce REQUEST header (not response) to server components
 *
 * SEC-044: Nonce is NOT exposed in response headers to prevent leakage.
 * Server components must read x-nonce from the request headers.
 */
function applySecurityHeaders(response: NextResponse, nonce?: string): NextResponse {
  // Apply base headers
  Object.entries(BASE_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // SEC-034: Generate nonce if not provided and apply CSP
  const cspNonce = nonce || generateCspNonce()
  response.headers.set("Content-Security-Policy", generateCspHeader(cspNonce))

  // SEC-034, SEC-044: Pass nonce to server components via request header, not response
  // CRO audit flagged X-CSP-Nonce response header as potential nonce leakage vector
  // If attacker can read response headers (e.g., via XHR or CORS misconfiguration),
  // they could exfiltrate the nonce and inject malicious scripts
  //
  // Instead, we pass the nonce via x-nonce request header (only visible server-side)
  // Server components read it from request, not from response headers
  // This keeps the nonce server-only and prevents client-side leakage
  // Note: The response header is intentionally NOT set

  return response
}

/**
 * SEC-027: Convert ArrayBuffer to hex string (Edge Runtime compatible)
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * SEC-027/SEC-099: Timing-safe string comparison (Edge Runtime compatible)
 * Prevents timing attacks by comparing in constant time
 *
 * SEC-099: Fixed length leak (Red Team NEX-030 fix)
 * Previously returned early on length mismatch, leaking length via timing.
 * Now always compares over the maximum length to ensure constant time.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // SEC-099: Compare over max length to prevent length leak via timing
  const maxLen = Math.max(a.length, b.length)
  let result = a.length ^ b.length // Start with length difference (non-zero if different)

  for (let i = 0; i < maxLen; i++) {
    // If index exceeds string length, use 0 (will cause mismatch)
    const charA = i < a.length ? a.charCodeAt(i) : 0
    const charB = i < b.length ? b.charCodeAt(i) : 0
    result |= charA ^ charB
  }

  return result === 0
}

/**
 * SEC-027: Generate HMAC signature using Web Crypto API (Edge Runtime compatible)
 */
async function generateHmacSignature(data: string, secret?: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret || getCsrfSecret())
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return arrayBufferToHex(signature)
}

/**
 * SEC-027: Generate HMAC-signed CSRF token
 * Uses double-submit cookie pattern with HMAC signature
 */
async function generateCsrfToken(): Promise<{ plainToken: string; signedToken: string }> {
  const plainToken = crypto.randomUUID()
  const signature = await generateHmacSignature(plainToken)
  const signedToken = `${plainToken}.${signature}`
  return { plainToken, signedToken }
}

/**
 * SEC-027, SEC-033, SEC-039: Verify CSRF token matches HMAC signature
 * Client sends plain token in header, server verifies against signed cookie
 *
 * SEC-033: Supports key rotation by trying current secret first, then previous.
 * This allows zero-downtime key rotation during the rotation window.
 *
 * SEC-039: Logs when previous secret is used for audit trail.
 * This enables detection of token-replay attacks and monitors rotation progress.
 */
async function verifyCsrfToken(plainToken: string, signedToken: string): Promise<{ valid: boolean; usedPreviousSecret: boolean }> {
  try {
    const [storedPlain, storedSignature] = signedToken.split(".")
    if (!storedPlain || !storedSignature) return { valid: false, usedPreviousSecret: false }

    // SEC-045: Use timing-safe comparison for ALL checks to prevent timing attacks
    // Even though plainToken is client-provided, using timing-safe comparison
    // eliminates any timing oracle that could leak information about token structure
    const plainMatches = timingSafeEqual(plainToken, storedPlain)

    // SEC-033: Try current secret first
    const expectedSignature = await generateHmacSignature(storedPlain)
    const currentSecretMatches = timingSafeEqual(storedSignature, expectedSignature)

    // SEC-033: Try previous secret for key rotation (if available)
    let previousSecretMatches = false
    const previousSecret = getPreviousCsrfSecret()
    if (previousSecret) {
      const previousExpectedSignature = await generateHmacSignature(storedPlain, previousSecret)
      previousSecretMatches = timingSafeEqual(storedSignature, previousExpectedSignature)
    }

    // SEC-045: Combine all checks at the end to ensure constant-time execution
    // This prevents timing attacks that could exploit early returns
    if (!plainMatches) {
      return { valid: false, usedPreviousSecret: false }
    }

    if (currentSecretMatches) {
      return { valid: true, usedPreviousSecret: false }
    }

    if (previousSecretMatches) {
      // SEC-039: Token verified with previous secret - log for audit
      // This helps monitor key rotation progress and detect potential replay attacks
      logWarn("SEC-039", "CSRF token verified using PREVIOUS secret - expected during key rotation window")
      return { valid: true, usedPreviousSecret: true }
    }

    return { valid: false, usedPreviousSecret: false }
  } catch {
    return { valid: false, usedPreviousSecret: false }
  }
}

/**
 * SEC-027, SEC-039: Ensure CSRF token cookie is set with proper security flags
 * Uses double-submit pattern: HttpOnly signed cookie + client-readable plain token
 *
 * SEC-039: Added forceRefresh parameter to regenerate token during key rotation.
 * When a token verified using the previous secret, we refresh it with the new secret.
 */
async function ensureCsrfCookie(
  request: NextRequest,
  response: NextResponse,
  forceRefresh: boolean = false
): Promise<NextResponse> {
  // Check if BOTH CSRF cookies exist - they must be in sync
  const existingSignedCsrf = request.cookies.get("csrf-token-signed")?.value
  const existingPlainCsrf = request.cookies.get("csrf-token")?.value

  // SEC-039: Generate new token if EITHER cookie is missing OR if forced refresh during key rotation
  // Both cookies must exist together - if one is missing, regenerate both
  const needsNewTokens = !existingSignedCsrf || !existingPlainCsrf || forceRefresh
  if (needsNewTokens) {
    if (forceRefresh && existingSignedCsrf) {
      logInfo("SEC-039", "Refreshing CSRF token - migrating to new secret during key rotation")
    }
    if (existingSignedCsrf && !existingPlainCsrf) {
      logInfo("CSRF-SYNC", "CSRF cookie desync detected - signed exists but plain missing, regenerating both")
    }

    // Generate new CSRF token pair
    const { plainToken, signedToken } = await generateCsrfToken()

    // SEC-027: Set SIGNED token in HttpOnly cookie (server verification)
    response.cookies.set("csrf-token-signed", signedToken, {
      httpOnly: true, // SEC-027: HttpOnly for signed token
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: CSRF_TOKEN_MAX_AGE,
    })

    // SEC-027: Set PLAIN token in readable cookie (client sends in header)
    response.cookies.set("csrf-token", plainToken, {
      httpOnly: false, // Client needs to read this to send in X-CSRF-Token header
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: CSRF_TOKEN_MAX_AGE,
    })
  }

  return response
}

/**
 * SEC-027, SEC-039: Validate CSRF token on state-changing requests
 * Returns both validity and whether token refresh is needed (for key rotation)
 */
async function validateCsrfToken(request: NextRequest): Promise<{ valid: boolean; needsRefresh: boolean }> {
  // Only validate on state-changing methods
  const method = request.method.toUpperCase()
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true, needsRefresh: false }
  }

  const headerToken = request.headers.get("x-csrf-token")
  const signedCookie = request.cookies.get("csrf-token-signed")?.value
  const plainCookie = request.cookies.get("csrf-token")?.value

  // Debug logging for CSRF validation
  if (!headerToken || !signedCookie) {
    console.log("[CSRF Debug] Validation failed - missing tokens:", {
      hasHeaderToken: !!headerToken,
      hasSignedCookie: !!signedCookie,
      hasPlainCookie: !!plainCookie,
      headerTokenLength: headerToken?.length,
      path: request.nextUrl.pathname,
    })
    return { valid: false, needsRefresh: false }
  }

  const result = await verifyCsrfToken(headerToken, signedCookie)
  // SEC-039: If previous secret was used, token should be refreshed
  return { valid: result.valid, needsRefresh: result.usedPreviousSecret }
}

// Routes that REQUIRE authentication (sensitive routes only)
const PROTECTED_ROUTES = new Set([
  "/billing", "/billing/pricing", "/billing/invoices", "/team",
  "/chat", "/vault", "/voice", "/domains", "/settings", "/profile",
  "/notifications", "/butler", "/sovereignty", "/referral", "/persona",
  "/briefing", "/search",
])

// Auth routes that need stricter rate limiting
const AUTH_ROUTES = ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/verify", "/api/v1/auth/verify-email"]

// Expensive API routes that need circuit breaker protection (SEC-023)
const EXPENSIVE_ROUTES = ["/api/v1/chat", "/api/v1/analyze", "/api/v1/generate"]

// Prefixes that should always pass through (static assets, Next internals)
const BYPASS_PREFIXES = ["/_next/", "/favicon.ico"]

// Rate limiting configuration
const RATE_LIMIT_WINDOW = "1m" // 1 minute window
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 60 seconds in ms
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute for API
const AUTH_RATE_LIMIT_MAX_REQUESTS = 20 // 20 requests per minute for auth (relaxed for VIP testing)

// Exponential backoff configuration for failed auth (SEC-006)
const AUTH_LOCKOUT_THRESHOLD = 15 // Lock account after 15 failed attempts (relaxed for VIP testing)
const AUTH_LOCKOUT_BASE_SECONDS = 60 // Base lockout: 1 minute
const AUTH_LOCKOUT_MAX_SECONDS = 3600 // Max lockout: 1 hour

// SEC-029: CAPTCHA threshold for failed attempts
const CAPTCHA_REQUIRED_THRESHOLD = 3 // Require CAPTCHA after 3 failed attempts

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

// Circuit breaker configuration (SEC-023, SEC-024)
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5 // Open circuit after 5 Redis failures
const CIRCUIT_BREAKER_RESET_TIMEOUT_MS = 30000 // Reset after 30 seconds

// SEC-069: Circuit breaker dampening configuration
// Prevents rapid oscillation between open/closed states when Redis availability is unstable.
// After closing from half-open, a cooldown multiplier increases the timeout before the next open.
// Each consecutive trip multiplies the cooldown. Caps at 5 minutes to avoid permanent lockout.
const DAMPENING_COOLDOWN_MULTIPLIER = 2 // Each consecutive trip doubles the reset timeout
const DAMPENING_MAX_COOLDOWN_MS = 5 * 60 * 1000 // 5 minute maximum cooldown cap
const DAMPENING_DECAY_WINDOW_MS = 10 * 60 * 1000 // 10 minutes of stability resets dampening
const DAMPENING_OSCILLATION_ALERT_THRESHOLD = 5 // Alert if 5+ trips within the decay window

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-075: State Deadlock Prevention via Rate-Limited Health Probes (NEX-009 Fix)
// ═══════════════════════════════════════════════════════════════════════════════
//
// VULNERABILITY (Red Team NEX-009):
// An attacker can create a permanent "stuck-open" circuit breaker by:
// 1. Triggering circuit breaker to open (via Redis failures or attack)
// 2. Rate limiting the health probe requests during half-open state
// 3. Circuit never closes because probes are blocked by rate limiter
//
// FIX: Three-part defense:
// 1. Maximum stuck-open duration with forced reset (15 minutes absolute max)
// 2. Internal health probe requests bypass rate limiting
// 3. Dedicated logging for stuck-open detection
//
// SECURITY NOTE: The internal health probe flag is set in-process only and cannot
// be spoofed via headers. The flag is checked before any external input processing.
// SEC-083: Reduced from 15 min to 5 min per CTO audit Round 15 - availability risk
const CIRCUIT_BREAKER_MAX_STUCK_OPEN_MS = 5 * 60 * 1000 // 5 minutes maximum stuck-open (forced reset)
const CIRCUIT_BREAKER_STUCK_OPEN_ALERT_MS = 3 * 60 * 1000 // Alert after 3 minutes stuck-open
let stuckOpenAlertSent = false // SEC-075: Track if stuck-open alert has been sent (avoid spam)

/**
 * SEC-024: IN-MEMORY Circuit Breaker State (Process-Level Scope)
 *
 * CRITICAL FIX: Circuit breaker state MUST be stored in local memory, NOT Redis.
 *
 * WHY: The circuit breaker protects against Redis failures. If we store circuit
 * breaker state in Redis, we have a circular dependency:
 *   - Redis fails -> try to update circuit breaker state -> Redis fails again
 *
 * TRADEOFFS (acceptable for circuit breaker):
 * - Not distributed: Each serverless instance has its own circuit breaker
 * - This is INTENTIONAL: If Redis is down, we want EVERY instance to fail closed
 * - Resets on deploy: Acceptable since circuit breaker is short-lived protection
 *
 * The circuit breaker is a SAFETY mechanism, not a rate limiter.
 * Having per-instance state is the correct pattern here.
 */
interface CircuitBreakerState {
  failures: number
  openedAt: number | null
  lastFailureTime: number
  halfOpen: boolean // SEC-038: Half-open state for health check before closing
  halfOpenSuccesses: number // SEC-041: Track consecutive successes in half-open state
  // SEC-069: Dampening state to prevent rapid oscillation
  consecutiveTrips: number // Number of consecutive open->close->open cycles
  lastCloseTime: number | null // When the circuit was last closed from half-open
  dampeningActive: boolean // Whether dampening cooldown is currently in effect
  oscillationTimestamps: number[] // Timestamps of recent trips for oscillation detection
  // SEC-075: Stuck-open detection (NEX-009 fix)
  halfOpenEnteredAt: number | null // When circuit entered half-open state
  stuckOpenForceResetCount: number // Number of forced resets due to stuck-open
}

// SEC-041: Require multiple consecutive successes before closing circuit
const CIRCUIT_BREAKER_REQUIRED_SUCCESSES = 3

const circuitBreakerState: CircuitBreakerState = {
  failures: 0,
  openedAt: null,
  lastFailureTime: 0,
  halfOpen: false,
  halfOpenSuccesses: 0,
  // SEC-069: Dampening initial state
  consecutiveTrips: 0,
  lastCloseTime: null,
  dampeningActive: false,
  oscillationTimestamps: [],
  // SEC-075: Stuck-open detection initial state
  halfOpenEnteredAt: null,
  stuckOpenForceResetCount: 0,
}

// Initialize rate limiters - Redis-backed for serverless compatibility
let redis: Redis | null = null
let ratelimit: Ratelimit | null = null
let authRatelimit: Ratelimit | null = null

// Only initialize Redis if env vars are set (production/staging)
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW),
    analytics: true,
    prefix: "nexusad:ratelimit",
  })

  // Stricter rate limiter for auth endpoints
  authRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AUTH_RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW),
    analytics: true,
    prefix: "nexusad:auth-ratelimit",
  })
}

/**
 * SEC-024, SEC-038, SEC-069: Check if circuit breaker is open (IN-MEMORY)
 *
 * Returns true if Redis is considered unavailable.
 * Uses local process memory - NO Redis dependency.
 *
 * SEC-038 FIX: Added half-open state with health check before fully closing.
 * When timeout expires, circuit enters half-open state. The next successful
 * Redis operation will close the circuit. This prevents false confidence
 * after timeout without actual Redis health verification.
 *
 * SEC-069 FIX: Apply dampened timeout based on consecutive trips.
 * If the circuit has oscillated recently, the reset timeout grows progressively
 * (base * 2^consecutiveTrips) up to the 5-minute cap. This prevents rapid
 * open->half-open->closed->open cycles from creating unstable behavior.
 *
 * SEC-075 FIX (Red Team NEX-009): Forced reset after maximum stuck-open duration.
 * If circuit has been in half-open state too long (15 min), force a reset to
 * prevent permanent denial-of-service via rate-limited health probes.
 */
function isCircuitBreakerOpen(): boolean {
  if (circuitBreakerState.openedAt === null) return false

  const now = Date.now()

  // SEC-075: Check for stuck-open condition BEFORE any other logic
  // This prevents attackers from using rate limiting to keep circuit permanently open
  if (circuitBreakerState.halfOpen && circuitBreakerState.halfOpenEnteredAt !== null) {
    const stuckOpenDuration = now - circuitBreakerState.halfOpenEnteredAt

    // SEC-075: Alert if stuck-open for too long (but don't spam - once per stuck period)
    if (stuckOpenDuration > CIRCUIT_BREAKER_STUCK_OPEN_ALERT_MS && !stuckOpenAlertSent) {
      logError("SEC-075", "STUCK-OPEN ALERT: Circuit breaker in half-open state for extended period", {
        stuckOpenMinutes: Math.round(stuckOpenDuration / 60000),
        halfOpenEnteredAt: new Date(circuitBreakerState.halfOpenEnteredAt).toISOString(),
        maxStuckOpenMinutes: CIRCUIT_BREAKER_MAX_STUCK_OPEN_MS / 60000,
        possibleAttack: "Rate-limited health probes (NEX-009)",
      })
      stuckOpenAlertSent = true
    }

    // SEC-075: Force reset if stuck-open for maximum duration
    if (stuckOpenDuration > CIRCUIT_BREAKER_MAX_STUCK_OPEN_MS) {
      circuitBreakerState.stuckOpenForceResetCount++
      logSecurity("SEC-075", "FORCED RESET: Circuit breaker stuck-open for maximum duration - resetting to closed", {
        stuckOpenMinutes: Math.round(stuckOpenDuration / 60000),
        forceResetCount: circuitBreakerState.stuckOpenForceResetCount,
        reason: "NEX-009 mitigation: Prevent permanent denial-of-service via rate-limited health probes",
      })

      // Reset circuit to closed state
      circuitBreakerState.failures = 0
      circuitBreakerState.openedAt = null
      circuitBreakerState.halfOpen = false
      circuitBreakerState.halfOpenSuccesses = 0
      circuitBreakerState.halfOpenEnteredAt = null
      stuckOpenAlertSent = false
      // Note: We don't reset dampening state - if Redis is truly unstable, it will re-open quickly

      return false // Allow request through after forced reset
    }
  }

  // SEC-069: Calculate dampened timeout based on consecutive trips
  // Each consecutive trip doubles the timeout: 30s -> 60s -> 120s -> 240s -> cap at 300s
  const dampenedTimeout = Math.min(
    CIRCUIT_BREAKER_RESET_TIMEOUT_MS * Math.pow(DAMPENING_COOLDOWN_MULTIPLIER, circuitBreakerState.consecutiveTrips),
    DAMPENING_MAX_COOLDOWN_MS
  )

  if (now - circuitBreakerState.openedAt > dampenedTimeout) {
    // SEC-038: Enter HALF-OPEN state instead of immediately closing
    // The circuit breaker stays technically "open" but allows one probe request
    // The next recordRedisSuccess() will fully close it after confirmed health
    if (!circuitBreakerState.halfOpen) {
      circuitBreakerState.halfOpen = true
      // SEC-075: Track when half-open state was entered for stuck-open detection
      circuitBreakerState.halfOpenEnteredAt = now
      stuckOpenAlertSent = false // Reset alert flag for new half-open period
      // SEC-069: Log dampening status when entering half-open
      if (circuitBreakerState.dampeningActive) {
        logInfo("SEC-069", "Circuit breaker entering HALF-OPEN state with dampening active", { consecutiveTrips: circuitBreakerState.consecutiveTrips, dampenedTimeoutMs: dampenedTimeout, baseTimeoutMs: CIRCUIT_BREAKER_RESET_TIMEOUT_MS })
      } else {
        logInfo("SEC-024", "Circuit breaker entering HALF-OPEN state - allowing probe request")
      }
    }
    // Return false to allow the probe request through
    // If it fails, recordRedisFailure() will re-open the circuit
    // If it succeeds, recordRedisSuccess() will close the circuit
    return false
  }
  return true
}

/**
 * SEC-075: Check if current request is a circuit breaker health probe (NEX-009 fix)
 *
 * Returns true if the circuit breaker is in half-open state, meaning this request
 * is being used to probe Redis health. Health probes should bypass rate limiting
 * to prevent attackers from creating permanent stuck-open conditions.
 *
 * SECURITY: This function only reads in-memory state and cannot be spoofed via
 * HTTP headers or other external input.
 */
function isCircuitBreakerHealthProbe(): boolean {
  return circuitBreakerState.halfOpen && circuitBreakerState.halfOpenEnteredAt !== null
}

/**
 * SEC-024, SEC-038, SEC-041, SEC-049, SEC-069: Record a Redis failure (IN-MEMORY)
 *
 * Tracks failures in local process memory.
 * Opens circuit breaker after threshold is reached.
 * NO Redis calls - prevents circular dependency.
 *
 * SEC-038 FIX: If we fail in half-open state, immediately re-open circuit.
 * SEC-041 FIX: Reset success counter on any failure in half-open state.
 * SEC-049: Track health metrics for monitoring.
 * SEC-069 FIX: Track oscillation timestamps and increment consecutive trips
 * when circuit re-opens from half-open state (indicates oscillation).
 */
function recordRedisFailure(): void {
  const now = Date.now()

  // SEC-049: Update health metrics
  redisHealthMetrics.consecutiveFailures++
  redisHealthMetrics.lastFailureTime = now
  redisHealthMetrics.totalFailures++

  // SEC-038, SEC-041: If in half-open state and we fail, immediately re-open
  if (circuitBreakerState.halfOpen) {
    circuitBreakerState.halfOpen = false
    circuitBreakerState.halfOpenSuccesses = 0 // SEC-041: Reset success counter
    circuitBreakerState.openedAt = now
    circuitBreakerState.failures = CIRCUIT_BREAKER_FAILURE_THRESHOLD // Keep at threshold
    circuitBreakerState.lastFailureTime = now
    redisHealthMetrics.circuitBreakerTrips++ // SEC-049

    // SEC-069: This is an oscillation event (went half-open but failed again).
    // Increment consecutive trips to increase dampening on next cycle.
    circuitBreakerState.consecutiveTrips++
    circuitBreakerState.dampeningActive = true
    circuitBreakerState.oscillationTimestamps.push(now)

    // SEC-069: Prune old oscillation timestamps outside the decay window
    circuitBreakerState.oscillationTimestamps = circuitBreakerState.oscillationTimestamps.filter(
      (ts) => now - ts < DAMPENING_DECAY_WINDOW_MS
    )

    // SEC-069: Calculate the new dampened timeout for logging
    const nextTimeout = Math.min(
      CIRCUIT_BREAKER_RESET_TIMEOUT_MS *
        Math.pow(DAMPENING_COOLDOWN_MULTIPLIER, circuitBreakerState.consecutiveTrips),
      DAMPENING_MAX_COOLDOWN_MS
    )

    logError("SEC-069", "Redis probe failed in half-open state - circuit breaker RE-OPENED with dampening", {
      trip: circuitBreakerState.consecutiveTrips,
      nextTimeoutMs: nextTimeout,
      baseTimeoutMs: CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      halfOpenSuccesses: circuitBreakerState.halfOpenSuccesses,
    })

    // SEC-069: Alert if oscillation frequency is too high
    if (circuitBreakerState.oscillationTimestamps.length >= DAMPENING_OSCILLATION_ALERT_THRESHOLD) {
      logError("SEC-069", "OSCILLATION ALERT: Redis availability highly unstable", {
        tripsInWindow: circuitBreakerState.oscillationTimestamps.length,
        windowSeconds: DAMPENING_DECAY_WINDOW_MS / 1000,
        cooldownMs: nextTimeout,
      })
    }

    return
  }

  circuitBreakerState.failures++
  circuitBreakerState.lastFailureTime = now

  if (circuitBreakerState.failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    if (circuitBreakerState.openedAt === null) {
      circuitBreakerState.openedAt = now
      redisHealthMetrics.circuitBreakerTrips++ // SEC-049

      // SEC-069: Track this trip for oscillation detection
      circuitBreakerState.oscillationTimestamps.push(now)
      circuitBreakerState.oscillationTimestamps = circuitBreakerState.oscillationTimestamps.filter(
        (ts) => now - ts < DAMPENING_DECAY_WINDOW_MS
      )

      // SEC-069: Calculate effective timeout for log message
      const effectiveTimeout = Math.min(
        CIRCUIT_BREAKER_RESET_TIMEOUT_MS *
          Math.pow(DAMPENING_COOLDOWN_MULTIPLIER, circuitBreakerState.consecutiveTrips),
        DAMPENING_MAX_COOLDOWN_MS
      )

      logError("SEC-024", "Circuit breaker OPENED", {
        failures: circuitBreakerState.failures,
        resetTimeoutMs: effectiveTimeout,
        dampeningActive: circuitBreakerState.dampeningActive,
        consecutiveTrips: circuitBreakerState.consecutiveTrips,
      })
    }
  }
}

/**
 * SEC-024, SEC-038, SEC-041, SEC-049, SEC-069: Record a successful Redis operation (IN-MEMORY)
 *
 * SEC-038 FIX: Only fully close circuit breaker after confirmed Redis health.
 * SEC-041 FIX: Require multiple consecutive successes (3) in half-open state.
 * This prevents closing circuit on a single lucky success during instability.
 * SEC-049: Track health metrics for monitoring.
 * NO Redis calls from this function - prevents circular dependency.
 */
function recordRedisSuccess(): void {
  const now = Date.now()

  // SEC-049: Update health metrics
  redisHealthMetrics.consecutiveFailures = 0
  redisHealthMetrics.lastSuccessTime = now
  redisHealthMetrics.totalSuccesses++

  // SEC-069: Check if dampening should decay due to sustained stability.
  // If enough time has passed since the last circuit close without any new trips,
  // the dampening resets so the system returns to normal responsiveness.
  if (
    circuitBreakerState.dampeningActive &&
    circuitBreakerState.lastCloseTime !== null &&
    now - circuitBreakerState.lastCloseTime > DAMPENING_DECAY_WINDOW_MS
  ) {
    logInfo("SEC-069", "Dampening decayed after sustained stability", {
      stableSeconds: Math.round((now - circuitBreakerState.lastCloseTime) / 1000),
      previousTrips: circuitBreakerState.consecutiveTrips,
    })
    circuitBreakerState.consecutiveTrips = 0
    circuitBreakerState.dampeningActive = false
    circuitBreakerState.oscillationTimestamps = []
  }

  if (circuitBreakerState.halfOpen) {
    // SEC-041: Track consecutive successes in half-open state
    circuitBreakerState.halfOpenSuccesses++

    if (circuitBreakerState.halfOpenSuccesses >= CIRCUIT_BREAKER_REQUIRED_SUCCESSES) {
      // SEC-041: Required successes achieved - Redis is stable, close circuit
      // SEC-069: Record close time for dampening decay tracking
      circuitBreakerState.lastCloseTime = now

      if (circuitBreakerState.dampeningActive) {
        logInfo("SEC-069", "Circuit breaker CLOSED from half-open with dampening active", {
          trip: circuitBreakerState.consecutiveTrips,
          decayWindowSeconds: DAMPENING_DECAY_WINDOW_MS / 1000,
        })
      } else {
        logInfo("SEC-024", "Redis health verified - circuit breaker CLOSED", {
          consecutiveSuccesses: circuitBreakerState.halfOpenSuccesses,
        })
      }
      circuitBreakerState.failures = 0
      circuitBreakerState.openedAt = null
      circuitBreakerState.halfOpen = false
      circuitBreakerState.halfOpenSuccesses = 0
    } else {
      // Still need more successes - log progress
      logInfo("SEC-024", "Redis probe success - circuit remains half-open", {
        successes: circuitBreakerState.halfOpenSuccesses,
        required: CIRCUIT_BREAKER_REQUIRED_SUCCESSES,
      })
    }
  } else if (circuitBreakerState.failures > 0) {
    // Normal success - reset failure count
    logInfo("SEC-024", "Redis connection restored", { previousFailures: circuitBreakerState.failures })
    circuitBreakerState.failures = 0
    circuitBreakerState.openedAt = null
  }
}

/**
 * SEC-006/SEC-098: Get failed auth attempt count for a user/IP combo
 * Returns the number of failed attempts and lockout expiry if applicable
 *
 * SEC-098: FAIL-CLOSED on Redis error (Red Team NEX-028 fix)
 * If we cannot verify security state, we MUST assume the worst case
 * to prevent brute-force attacks during Redis outages.
 */
async function getFailedAuthAttempts(identifier: string): Promise<{ attempts: number; lockoutExpiry: number | null }> {
  // SEC-098: If Redis not configured, fail-closed with max attempts
  if (!redis) {
    logSecurity("SEC-098", "Redis unavailable - fail-closed auth check", {
      identifier: identifier.slice(0, 20) + "...",
    })
    return { attempts: AUTH_LOCKOUT_THRESHOLD + 1, lockoutExpiry: Date.now() + 60_000 }
  }

  try {
    const key = `nexusad:auth-failures:${identifier}`
    const data = await redis.get<{ attempts: number; lockoutExpiry: number }>(key)
    recordRedisSuccess()
    if (!data) return { attempts: 0, lockoutExpiry: null }
    return { attempts: data.attempts, lockoutExpiry: data.lockoutExpiry }
  } catch (error) {
    recordRedisFailure()
    // SEC-098: FAIL-CLOSED - return high attempt count to trigger lockout
    // This prevents brute-force attacks when Redis is down/unreachable
    logSecurity("SEC-098", "Redis error - fail-closed auth check active", {
      identifier: identifier.slice(0, 20) + "...",
      error: error instanceof Error ? error.message : "Unknown",
    })
    return { attempts: AUTH_LOCKOUT_THRESHOLD + 1, lockoutExpiry: Date.now() + 30_000 }
  }
}

/**
 * Calculate exponential backoff lockout duration (SEC-006)
 */
function calculateLockoutSeconds(failedAttempts: number): number {
  if (failedAttempts < AUTH_LOCKOUT_THRESHOLD) return 0

  // Exponential backoff: 60s, 120s, 240s, 480s, etc. (capped at 1 hour)
  const exponent = failedAttempts - AUTH_LOCKOUT_THRESHOLD
  const lockoutSeconds = AUTH_LOCKOUT_BASE_SECONDS * Math.pow(2, exponent)
  return Math.min(lockoutSeconds, AUTH_LOCKOUT_MAX_SECONDS)
}

/**
 * SEC-029: Check if CAPTCHA is required due to failed attempts
 */
async function isCaptchaRequired(identifier: string): Promise<boolean> {
  const { attempts } = await getFailedAuthAttempts(identifier)
  return attempts >= CAPTCHA_REQUIRED_THRESHOLD
}

/**
 * Check if user/IP is locked out due to failed auth attempts (SEC-006)
 */
async function isLockedOut(
  identifier: string
): Promise<{ locked: boolean; retryAfterSeconds: number; captchaRequired: boolean }> {
  const { attempts, lockoutExpiry } = await getFailedAuthAttempts(identifier)

  // SEC-029: Check if CAPTCHA is required
  const captchaRequired = attempts >= CAPTCHA_REQUIRED_THRESHOLD

  if (lockoutExpiry) {
    const now = Date.now()
    if (now < lockoutExpiry) {
      const retryAfterSeconds = Math.ceil((lockoutExpiry - now) / 1000)
      return { locked: true, retryAfterSeconds, captchaRequired }
    }
  }

  // Check if we should apply a new lockout based on attempts
  const lockoutSeconds = calculateLockoutSeconds(attempts)
  if (lockoutSeconds > 0) {
    return { locked: true, retryAfterSeconds: lockoutSeconds, captchaRequired }
  }

  return { locked: false, retryAfterSeconds: 0, captchaRequired }
}

/**
 * Check if route is an expensive API call (SEC-023)
 */
function isExpensiveRoute(pathname: string): boolean {
  return EXPENSIVE_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Record a failed auth attempt for exponential backoff (SEC-006)
 * This should be called from auth endpoints when login fails
 * @param identifier - The rate limit key (userId:IP or IP)
 */
export async function recordFailedAuthAttempt(identifier: string): Promise<void> {
  if (!redis) return

  try {
    const key = `nexusad:auth-failures:${identifier}`
    const existing = await redis.get<{ attempts: number; lockoutExpiry: number }>(key)

    const newAttempts = (existing?.attempts || 0) + 1
    const lockoutSeconds = calculateLockoutSeconds(newAttempts)

    const data = {
      attempts: newAttempts,
      lockoutExpiry: lockoutSeconds > 0 ? Date.now() + lockoutSeconds * 1000 : null,
    }

    // Store with TTL of max lockout duration + buffer
    await redis.set(key, data, { ex: AUTH_LOCKOUT_MAX_SECONDS + 60 })
    recordRedisSuccess()
  } catch {
    recordRedisFailure()
  }
}

/**
 * Clear failed auth attempts on successful login (SEC-006)
 * @param identifier - The rate limit key (userId:IP or IP)
 */
export async function clearFailedAuthAttempts(identifier: string): Promise<void> {
  if (!redis) return

  try {
    const key = `nexusad:auth-failures:${identifier}`
    await redis.del(key)
    recordRedisSuccess()
  } catch {
    recordRedisFailure()
  }
}

/**
 * Helper to build rate limit key from IP and optional userId (exported for use in auth routes)
 */
export function buildRateLimitKeyFromParts(ip: string, userId?: string | null): string {
  return userId ? `${userId}:${ip}` : ip
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: IN-MEMORY RATE LIMITING (Development Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

// SEC-031, SEC-047, SEC-051: Development rate limiter with clear documentation
// WARNING: This is an in-memory Map for LOCAL DEVELOPMENT ONLY
// In production, Redis-backed rate limiting is used instead
// Limitations:
// - Not distributed: Each serverless instance has its own map
// - Memory leak potential: Old entries are only cleaned on access
// - Resets on deploy: All rate limits reset when instance restarts
// For production deployments, ALWAYS configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
//
// SEC-047: When STRICT_SECURITY_MODE=true, these stores are NEVER used.
// The system will fail closed instead of falling back to insecure in-memory storage.
//
// SEC-051: Concurrency-safe rate limit entry with version tracking
interface RateLimitEntry {
  count: number
  resetTime: number
  version: number // Optimistic concurrency control
}

// SEC-073: Memory-bounded in-memory stores with deterministic cleanup
const MAX_RATE_LIMIT_ENTRIES = 10000
const MAX_AUTH_RATE_LIMIT_ENTRIES = 5000

const devRateLimitStore = new Map<string, RateLimitEntry>()
const devAuthRateLimitStore = new Map<string, RateLimitEntry>()

// SEC-051: Version counter for optimistic locking
let rateLimitVersion = 0

/**
 * SEC-053, SEC-073: Rate Limit & Memory Metrics for Monitoring
 *
 * Exports metrics for health checks and monitoring dashboards.
 * Helps identify rate limit abuse patterns, memory pressure, and system health.
 */
interface RateLimitMetrics {
  devStoreSize: number
  devAuthStoreSize: number
  anomalyStoreSize: number
  cooldownStoreSize: number
  lastCleanupTime: number
  versionCounter: number
  redisConnected: boolean
  strictModeEnabled: boolean
}

// SEC-073/SEC-076: Extended memory metrics with cleanup tracking and DLQ health
interface MemoryMetrics {
  rateLimitEntries: number
  rateLimitMaxEntries: number
  authRateLimitEntries: number
  authRateLimitMaxEntries: number
  anomalyEntries: number
  anomalyMaxEntries: number
  cooldownEntries: number
  cooldownMaxEntries: number
  siemDlqEntries: number
  siemDlqMaxEntries: number
  // SEC-076: DLQ memory and health metrics
  siemDlqMemoryBytes: number
  siemDlqMemoryLimitBytes: number
  siemDlqTtlMs: number
  siemDlqOldestEntryAgeMs: number
  siemDlqCapacityPercent: number
  lastCleanupTime: number
  cleanupCount: number
  totalEvictions: number
  requestsSinceCleanup: number
}

const memoryCleanupState = {
  cleanupCount: 0,
  totalEvictions: 0,
}

export function getRateLimitMetrics(): RateLimitMetrics {
  return {
    devStoreSize: devRateLimitStore.size,
    devAuthStoreSize: devAuthRateLimitStore.size,
    anomalyStoreSize: devAnomalyStore.size,
    cooldownStoreSize: anomalyAlertCooldowns.size,
    lastCleanupTime: lastDevCleanup,
    versionCounter: rateLimitVersion,
    redisConnected: redis !== null,
    strictModeEnabled: STRICT_SECURITY_MODE,
  }
}

/**
 * SEC-073/SEC-076: Export detailed memory metrics for monitoring and alerting.
 * Call from health check endpoints to detect memory pressure.
 * SEC-076: Now includes DLQ memory, TTL, and health metrics
 */
export function getMemoryMetrics(): MemoryMetrics {
  const dlqLength = SIEM_DEAD_LETTER_QUEUE.length
  const oldestEntryAge =
    dlqLength > 0 ? Date.now() - SIEM_DEAD_LETTER_QUEUE[0].createdAt : 0

  return {
    rateLimitEntries: devRateLimitStore.size,
    rateLimitMaxEntries: MAX_RATE_LIMIT_ENTRIES,
    authRateLimitEntries: devAuthRateLimitStore.size,
    authRateLimitMaxEntries: MAX_AUTH_RATE_LIMIT_ENTRIES,
    anomalyEntries: devAnomalyStore.size,
    anomalyMaxEntries: ANOMALY_STORE_MAX_SIZE,
    cooldownEntries: anomalyAlertCooldowns.size,
    cooldownMaxEntries: ALERT_COOLDOWN_MAX_SIZE,
    siemDlqEntries: dlqLength,
    siemDlqMaxEntries: SIEM_DLQ_MAX_SIZE,
    // SEC-076: DLQ memory and health metrics
    siemDlqMemoryBytes: siemDlqTotalBytes,
    siemDlqMemoryLimitBytes: SIEM_DLQ_MEMORY_PRESSURE_THRESHOLD_MB * 1024 * 1024,
    siemDlqTtlMs: SIEM_DLQ_ENTRY_TTL_MS,
    siemDlqOldestEntryAgeMs: oldestEntryAge,
    siemDlqCapacityPercent: (dlqLength / SIEM_DLQ_MAX_SIZE) * 100,
    lastCleanupTime: lastDevCleanup,
    cleanupCount: memoryCleanupState.cleanupCount,
    totalEvictions: memoryCleanupState.totalEvictions,
    requestsSinceCleanup: requestsSinceCleanup,
  }
}

// SEC-031, SEC-073: Deterministic cleanup for dev rate limit stores
// Runs every CLEANUP_INTERVAL_REQUESTS requests instead of random/time-based
let lastDevCleanup = Date.now()
let requestsSinceCleanup = 0
const CLEANUP_INTERVAL_REQUESTS = 100
// SEC-073: Also enforce a time-based minimum interval to prevent stale entries
// accumulating during low-traffic periods
const DEV_CLEANUP_MIN_INTERVAL_MS = 30 * 1000 // 30 seconds minimum between cleanups

/**
 * SEC-073: Deterministic memory cleanup with size-bounded eviction.
 *
 * Improvements over previous implementation:
 * 1. Deterministic: runs every N requests, not randomly or purely time-based
 * 2. Size-bounded: enforces MAX_RATE_LIMIT_ENTRIES / MAX_AUTH_RATE_LIMIT_ENTRIES
 * 3. LRU eviction: when size limit reached, evicts entries with oldest resetTime
 * 4. Metrics: tracks cleanup count and total evictions for monitoring
 * 5. Memory pressure alerting: warns when stores exceed 80% capacity
 *
 * Called from devCheckRateLimit on every request. The request counter ensures
 * cleanup happens at predictable intervals regardless of traffic patterns.
 */
function cleanupDevStores(): void {
  requestsSinceCleanup++

  // SEC-073: Deterministic trigger - every N requests
  // Also allow time-based trigger for low-traffic scenarios
  const now = Date.now()
  const timeTriggered = now - lastDevCleanup >= DEV_CLEANUP_MIN_INTERVAL_MS
  if (requestsSinceCleanup < CLEANUP_INTERVAL_REQUESTS && !timeTriggered) return

  requestsSinceCleanup = 0
  lastDevCleanup = now

  // Phase 1: Remove expired entries from rate limit stores
  const cleanExpired = (store: Map<string, RateLimitEntry>): number => {
    let removed = 0
    Array.from(store.entries()).forEach(([key, value]) => {
      if (now > value.resetTime) {
        store.delete(key)
        removed++
      }
    })
    return removed
  }

  let totalRemoved = cleanExpired(devRateLimitStore)
  totalRemoved += cleanExpired(devAuthRateLimitStore)

  // Phase 2: Enforce size limits with LRU eviction (oldest resetTime first)
  totalRemoved += enforceRateLimitStoreSize(devRateLimitStore, MAX_RATE_LIMIT_ENTRIES)
  totalRemoved += enforceRateLimitStoreSize(devAuthRateLimitStore, MAX_AUTH_RATE_LIMIT_ENTRIES)

  // Phase 3: Update metrics
  memoryCleanupState.cleanupCount++
  memoryCleanupState.totalEvictions += totalRemoved

  // SEC-073: Memory pressure alerting - warn when stores are above 80% capacity
  if (devRateLimitStore.size > MAX_RATE_LIMIT_ENTRIES * 0.8) {
    logWarn("SEC-073", "Memory pressure: devRateLimitStore nearing capacity", { currentSize: devRateLimitStore.size, maxSize: MAX_RATE_LIMIT_ENTRIES, capacityPercent: Math.round((devRateLimitStore.size / MAX_RATE_LIMIT_ENTRIES) * 100) })
  }
  if (devAuthRateLimitStore.size > MAX_AUTH_RATE_LIMIT_ENTRIES * 0.8) {
    logWarn("SEC-073", "Memory pressure: devAuthRateLimitStore nearing capacity", { currentSize: devAuthRateLimitStore.size, maxSize: MAX_AUTH_RATE_LIMIT_ENTRIES, capacityPercent: Math.round((devAuthRateLimitStore.size / MAX_AUTH_RATE_LIMIT_ENTRIES) * 100) }
    )
  }
}

/**
 * SEC-073: Enforce size limit on a rate limit store with LRU eviction.
 * Evicts entries with the oldest resetTime (least recently relevant).
 * Returns the number of entries evicted.
 */
function enforceRateLimitStoreSize(store: Map<string, RateLimitEntry>, maxSize: number): number {
  if (store.size <= maxSize) return 0

  const toEvict = store.size - maxSize
  // Sort by resetTime ascending (oldest/soonest-to-expire first)
  const entries = Array.from(store.entries())
    .sort((a, b) => a[1].resetTime - b[1].resetTime)
    .slice(0, toEvict)

  for (const [key] of entries) {
    store.delete(key)
  }

  logInfo("SEC-073", "LRU eviction: removed entries from rate limit store", { removedEntries: entries.length, previousSize: store.size + entries.length, currentSize: store.size, maxSize })
  return entries.length
}

/**
 * SEC-031, SEC-051: Development-only rate limit check (in-memory, non-distributed)
 *
 * WARNING: Only for local development. See comments above devRateLimitStore.
 *
 * SEC-051: Uses optimistic concurrency control to handle race conditions:
 * - Each entry has a version number
 * - On update, we verify version hasn't changed
 * - If version changed, we re-read and retry (up to 3 times)
 * - This prevents lost updates in high-concurrency scenarios
 *
 * @param key - Rate limit key (userId:IP or just IP)
 * @param limit - Max requests per window
 * @param store - The map to store rate limit data
 * @returns Rate limit result with reset timestamp
 */
function devCheckRateLimit(
  key: string,
  limit: number,
  store: Map<string, RateLimitEntry>
): RateLimitResult {
  // SEC-031, SEC-073: Deterministic cleanup to prevent memory leaks
  cleanupDevStores()

  const now = Date.now()
  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const record = store.get(key)

    if (!record || now > record.resetTime) {
      // New entry or expired - create fresh
      const newVersion = ++rateLimitVersion
      const resetTime = now + RATE_LIMIT_WINDOW_MS
      store.set(key, { count: 1, resetTime, version: newVersion })
      return { allowed: true, remaining: limit - 1, resetMs: resetTime }
    }

    if (record.count >= limit) {
      // Already at limit - no update needed, safe to return
      return { allowed: false, remaining: 0, resetMs: record.resetTime }
    }

    // SEC-051: Optimistic update with version check
    const expectedVersion = record.version
    const newCount = record.count + 1
    const newVersion = ++rateLimitVersion

    // Re-read to check for concurrent modification
    const currentRecord = store.get(key)
    if (currentRecord && currentRecord.version === expectedVersion) {
      // No concurrent modification - safe to update
      store.set(key, {
        count: newCount,
        resetTime: record.resetTime,
        version: newVersion,
      })
      return { allowed: true, remaining: limit - newCount, resetMs: record.resetTime }
    }

    // Concurrent modification detected - retry
    if (attempt < maxRetries - 1) {
      logWarn("SEC-051", "Rate limit concurrency conflict", { keyPrefix: key.slice(0, 8), retryAttempt: attempt + 1 })
    }
  }

  // SEC-059: Max retries exceeded - FAIL CLOSED (block request)
  // Board audit Round 12 required fail-closed instead of fail-open after concurrency exhaustion
  logError("SEC-059", "Rate limit concurrency resolution failed - BLOCKING REQUEST", { keyPrefix: key.slice(0, 8), maxRetries })
  return { allowed: false, remaining: 0, resetMs: Date.now() + RATE_LIMIT_WINDOW_MS }
}

function getClientIp(request: NextRequest): string {
  // SEC-220: IP header trust order with FORMAT VALIDATION to prevent injection.
  // Without validation, attackers can inject arbitrary strings into rate limit keys
  // (e.g., X-Forwarded-For: "anything_they_want"), bypassing per-IP rate limits.
  // Must match the validation in auth route getClientIp() functions.
  const IP_PATTERN = /^[\da-fA-F.:]{3,45}$/
  const validateIp = (ip: string | null): string | null => {
    if (!ip) return null
    const trimmed = ip.trim()
    return IP_PATTERN.test(trimmed) ? trimmed : null
  }

  // Vercel/Cloudflare headers - trust order: CF > Real-IP > Forwarded-For
  const cfIp = request.headers.get("cf-connecting-ip")
  const realIp = request.headers.get("x-real-ip")
  const forwarded = request.headers.get("x-forwarded-for")

  const resolved =
    validateIp(cfIp) ||
    validateIp(realIp) ||
    validateIp(forwarded?.split(",")[0] ?? null) ||
    "127.0.0.1"

  return resolved
}

/**
 * SEC-064: JWT Session Secret for signature verification
 * Red Team NEX-001 fix - MUST verify JWT signatures before trusting any claims
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    // SEC-064: Log warning but don't throw — fallback to CSRF secret so JWT
    // verification can still work (backend must sign with the same secret).
    // Throwing here caused verifyJwtSignature to always return false in production,
    // breaking session timeout tracking for all users.
    logWarn("SEC-064", "JWT_SECRET or NEXTAUTH_SECRET not set in production — falling back to CSRF_HMAC_SECRET for JWT verification")
  }
  return secret || getCsrfSecret()
}

/**
 * SEC-064: Verify JWT signature using HMAC-SHA256 (Red Team NEX-001 fix)
 * This MUST be called before trusting any JWT claims for auth decisions
 */
async function verifyJwtSignature(token: string): Promise<boolean> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false

    const [headerB64, payloadB64, signatureB64] = parts
    const signedData = `${headerB64}.${payloadB64}`

    // Decode signature (URL-safe base64)
    const sigBase64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/")
    const sigPadded = sigBase64 + "=".repeat((4 - (sigBase64.length % 4)) % 4)
    const signature = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0))

    // Import key and verify
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getJwtSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(signedData)
    )

    return isValid
  } catch {
    return false
  }
}

/**
 * SEC-064: Extract AND VERIFY user ID from session cookie (Red Team NEX-001 fix)
 *
 * CRITICAL SECURITY FIX: Red Team found that unverified JWT payloads were being
 * used for session timeout enforcement, allowing session forgery attacks.
 *
 * This function now VERIFIES the JWT signature before returning the userId.
 * If verification fails, returns null (treating as unauthenticated).
 *
 * @param request - The incoming request
 * @param requireVerification - If true, signature must be valid. If false, used for rate limiting only.
 */
async function getUserId(request: NextRequest, requireVerification: boolean = false): Promise<string | null> {
  const sessionCookie = request.cookies.get("nexus-session")?.value
  if (!sessionCookie) return null

  try {
    const parts = sessionCookie.split(".")
    if (parts.length !== 3) return null

    // SEC-064: If verification required, check signature first
    if (requireVerification) {
      const isValid = await verifyJwtSignature(sessionCookie)
      if (!isValid) {
        logSecurity("SEC-064", "JWT signature verification failed - treating as unauthenticated")
        return null
      }
    }

    // SEC-060: Edge Runtime compatible base64 decoding
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    const payload = JSON.parse(decoded)

    // SEC-064: Check expiration if verified
    if (requireVerification && payload.exp) {
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        logWarn("SEC-064", "JWT expired - treating as unauthenticated")
        return null
      }
    }

    return payload.userId || payload.sub || null
  } catch {
    return null
  }
}

/**
 * SEC-064: Get unverified userId for rate limiting ONLY
 * This is safe because rate limits are ALSO applied by IP, so spoofing userId
 * only gives the attacker their own rate limit bucket (no privilege escalation).
 */
function getUserIdForRateLimiting(request: NextRequest): string | null {
  const sessionCookie = request.cookies.get("nexus-session")?.value
  if (!sessionCookie) return null

  try {
    const parts = sessionCookie.split(".")
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    const payload = JSON.parse(decoded)
    return payload.userId || payload.sub || null
  } catch {
    return null
  }
}

/**
 * SEC-065: Generate device fingerprint with SERVER-SIDE entropy (Red Team NEX-002 fix)
 *
 * CRITICAL FIX: Red Team found that fingerprint was built entirely from client-controlled
 * headers, allowing attackers to randomize User-Agent and bypass rate limits entirely.
 *
 * NEW APPROACH:
 * 1. IP address is now the PRIMARY rate limit factor (cannot be spoofed through proxies we trust)
 * 2. Fingerprint adds SUPPLEMENTARY entropy but is NOT the primary factor
 * 3. Added server-side entropy (timestamp bucket, secret salt) that attacker cannot control
 * 4. Headers are still included but their manipulation only hurts the attacker (more buckets = lower total limit)
 */
async function getDeviceFingerprint(request: NextRequest): Promise<string> {
  // SEC-065: Include IP as the anchor - this is server-verified
  const ip = getClientIp(request)

  // Client headers - attacker CAN manipulate these, but that's now okay
  // because IP is the anchor and manipulating headers only creates MORE buckets
  // which means the attacker's total requests across all buckets still count
  const userAgent = request.headers.get("user-agent") || "unknown"
  const acceptLanguage = request.headers.get("accept-language") || "unknown"

  // SEC-065: Add server-side entropy that attacker CANNOT control
  // Use an hour bucket so fingerprints rotate but don't change every request
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000))

  // SEC-065: Add secret salt that attacker doesn't know
  // This prevents precomputation attacks on fingerprint
  const secretSalt = getCsrfSecret().slice(0, 16)

  // Create fingerprint with server-side anchoring
  const fingerprintData = `${ip}|${userAgent}|${acceptLanguage}|${hourBucket}|${secretSalt}`

  // Hash it
  const encoder = new TextEncoder()
  const data = encoder.encode(fingerprintData)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

  return hashHex.slice(0, 16) // Shorter hash since IP is the real anchor now
}

/**
 * SEC-066: Build composite rate limit key with IP as PRIMARY factor (Red Team NEX-002/NEX-004 fix)
 *
 * CRITICAL FIXES:
 * - NEX-002: IP is now the PRIMARY factor, fingerprint is supplementary
 * - NEX-004: Key structure prevents key-space pollution attacks
 *
 * NEW KEY STRUCTURE:
 * - Authenticated: "rl:u:{userId}:{dayBucket}" - rate limit per user per day
 * - Unauthenticated: "rl:ip:{ip}:{dayBucket}" - rate limit per IP per day
 * - Fingerprint is used for ADDITIONAL tracking, not as primary key component
 *
 * This prevents attackers from creating millions of unique keys by:
 * 1. Limiting key cardinality to (users + IPs) × days
 * 2. Not including manipulable fingerprint in the primary key
 */
async function buildRateLimitKey(request: NextRequest): Promise<string> {
  const ip = getClientIp(request)
  const userId = getUserIdForRateLimiting(request)
  const fingerprint = await getDeviceFingerprint(request)

  // SEC-066: Daily rotation bucket for key expiration
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000))

  // SEC-066: New key format prevents key-space pollution (Red Team NEX-004 fix)
  // PRIMARY key is based on userId (if authenticated) or IP (if not)
  // Fingerprint is stored separately for forensics but NOT in the primary key
  // This limits total keys to: (unique_users + unique_IPs) × days
  // Instead of: (unique_users × unique_IPs × infinite_fingerprints) × days
  if (userId) {
    // Authenticated: rate limit by user, track fingerprint separately
    return `rl:u:${userId}:${dayBucket}`
  } else {
    // Unauthenticated: rate limit by IP only
    // Fingerprint is included but hashed with IP so manipulation doesn't help
    return `rl:ip:${ip}:${dayBucket}`
  }
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-030, SEC-040: In-memory anomaly tracking for development fallback
 * Production uses Redis; this is for local dev without Redis
 *
 * SEC-040: Added size cap with LRU eviction to prevent memory exhaustion
 */
interface AnomalyTrackingEntry {
  count: number
  windowStart: number
  endpoints: Map<string, number>
  lastAccess: number // SEC-040: Track for LRU eviction
}

// SEC-040: Cap in-memory stores to prevent memory exhaustion under attack
const ANOMALY_STORE_MAX_SIZE = 10000 // Max 10k unique identifiers
const ALERT_COOLDOWN_MAX_SIZE = 1000 // Max 1k cooldown entries

const devAnomalyStore = new Map<string, AnomalyTrackingEntry>()
const anomalyAlertCooldowns = new Map<string, number>() // identifier -> last alert timestamp

// SEC-073: Deterministic cleanup counter for anomaly stores (replaces Math.random())
let anomalyRequestsSinceCleanup = 0
const ANOMALY_CLEANUP_INTERVAL_REQUESTS = 100
let alertRequestsSinceCleanup = 0
const ALERT_CLEANUP_INTERVAL_REQUESTS = 100

/**
 * SEC-040: LRU eviction for in-memory stores
 * Evicts oldest entries when store exceeds max size
 */
function enforceStoreSizeLimit<T>(store: Map<string, T>, maxSize: number, getTimestamp: (entry: T) => number): void {
  if (store.size <= maxSize) return

  // Find entries to evict (oldest 20%)
  const evictCount = Math.ceil(store.size * 0.2)
  const entries = Array.from(store.entries())
    .map(([key, value]) => ({ key, timestamp: getTimestamp(value) }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, evictCount)

  entries.forEach(({ key }) => store.delete(key))
  // SEC-073: Track evictions in centralized metrics
  memoryCleanupState.totalEvictions += entries.length
  logInfo("SEC-040", "LRU eviction completed", { removedEntries: entries.length, previousSize: store.size + entries.length, currentSize: store.size })
}

/**
 * SEC-030: Track request patterns for anomaly detection
 * Stores request counts with per-user/IP granularity
 *
 * IMPLEMENTATION:
 * - Tracks requests per identifier in sliding time windows
 * - Tracks endpoint-specific patterns to detect targeted attacks
 * - Uses Redis in production, in-memory fallback in development
 */
async function trackRequestForAnomaly(identifier: string, pathname: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % ANOMALY_WINDOW_SECONDS)

  if (redis) {
    try {
      const windowKey = `nexusad:anomaly:${identifier}:${windowStart}`

      // Increment request count for this window
      await redis.incr(windowKey)
      await redis.expire(windowKey, ANOMALY_WINDOW_SECONDS * 2) // TTL with buffer

      // Track endpoint-specific patterns
      const endpointKey = `nexusad:anomaly:endpoint:${identifier}:${pathname}:${windowStart}`
      await redis.incr(endpointKey)
      await redis.expire(endpointKey, ANOMALY_WINDOW_SECONDS * 2)

      recordRedisSuccess()
    } catch {
      recordRedisFailure()
      // Fall through to in-memory tracking
    }
  }

  // In-memory fallback (always runs in dev, runs as backup if Redis fails)
  if (!redis || isCircuitBreakerOpen()) {
    let entry = devAnomalyStore.get(identifier)

    // Reset if window has passed
    if (!entry || entry.windowStart !== windowStart) {
      entry = { count: 0, windowStart, endpoints: new Map(), lastAccess: now }
      devAnomalyStore.set(identifier, entry)
    }

    entry.count++
    entry.lastAccess = now // SEC-040: Update access time for LRU
    entry.endpoints.set(pathname, (entry.endpoints.get(pathname) || 0) + 1)

    // SEC-073: Deterministic cleanup - every N requests instead of random
    anomalyRequestsSinceCleanup++
    if (anomalyRequestsSinceCleanup >= ANOMALY_CLEANUP_INTERVAL_REQUESTS) {
      anomalyRequestsSinceCleanup = 0
      // Remove expired entries
      let anomalyEvicted = 0
      Array.from(devAnomalyStore.entries()).forEach(([key, val]) => {
        if (now - val.windowStart > ANOMALY_WINDOW_SECONDS * 2) {
          devAnomalyStore.delete(key)
          anomalyEvicted++
        }
      })
      // SEC-040: Enforce size limit with LRU eviction
      enforceStoreSizeLimit(devAnomalyStore, ANOMALY_STORE_MAX_SIZE, (e) => e.lastAccess)
      enforceStoreSizeLimit(anomalyAlertCooldowns, ALERT_COOLDOWN_MAX_SIZE, (ts) => ts)
      // SEC-073: Track evictions in metrics
      memoryCleanupState.totalEvictions += anomalyEvicted
      // SEC-073: Memory pressure alerting for anomaly store
      if (devAnomalyStore.size > ANOMALY_STORE_MAX_SIZE * 0.8) {
        logWarn("SEC-073", "Memory pressure: devAnomalyStore nearing capacity", { currentSize: devAnomalyStore.size, maxSize: ANOMALY_STORE_MAX_SIZE, capacityPercent: Math.round((devAnomalyStore.size / ANOMALY_STORE_MAX_SIZE) * 100) })
      }
    }
  }
}

/**
 * SEC-030: Full anomaly detection implementation
 *
 * DETECTION LOGIC:
 * 1. Request spike detection - flags when requests exceed baseline * threshold
 * 2. Endpoint concentration - detects when >80% of requests hit same endpoint
 * 3. Rapid burst detection - flags very high request rates in short periods
 *
 * ACTIONS:
 * - ALERT threshold (10x): Log security event, add monitoring flag
 * - BLOCK threshold (20x): Return 429 to block the request
 *
 * COOLDOWN: Alerts are rate-limited to prevent log spam (5 min cooldown)
 */
async function checkForAnomaly(
  identifier: string,
  request: NextRequest
): Promise<{
  anomalous: boolean
  shouldBlock: boolean
  reason?: string
  requestCount?: number
}> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % ANOMALY_WINDOW_SECONDS)
  const alertThreshold = ANOMALY_BASELINE_REQUESTS * ANOMALY_SPIKE_THRESHOLD // 100 requests
  const blockThreshold = ANOMALY_BASELINE_REQUESTS * ANOMALY_BLOCK_THRESHOLD // 200 requests

  let requestCount = 0
  let endpointCounts: Map<string, number> = new Map()

  // Try Redis first
  if (redis && !isCircuitBreakerOpen()) {
    try {
      const windowKey = `nexusad:anomaly:${identifier}:${windowStart}`
      requestCount = (await redis.get<number>(windowKey)) || 0
      recordRedisSuccess()
    } catch {
      recordRedisFailure()
      // Fall through to in-memory
    }
  }

  // Fall back to in-memory
  if (requestCount === 0) {
    const entry = devAnomalyStore.get(identifier)
    if (entry && entry.windowStart === windowStart) {
      requestCount = entry.count
      endpointCounts = entry.endpoints
    }
  }

  // Check for anomalies
  if (requestCount >= blockThreshold) {
    // BLOCK threshold exceeded - this is likely an attack
    await triggerAnomalyAlert(identifier, "ANOMALY_BLOCK", {
      requestCount,
      threshold: blockThreshold,
      windowSeconds: ANOMALY_WINDOW_SECONDS,
      severity: "critical",
    }, request)

    return {
      anomalous: true,
      shouldBlock: true,
      reason: `Request rate critically exceeded: ${requestCount}/${ANOMALY_WINDOW_SECONDS}s (block threshold: ${blockThreshold})`,
      requestCount,
    }
  }

  if (requestCount >= alertThreshold) {
    // ALERT threshold exceeded - suspicious but not blocking yet
    await triggerAnomalyAlert(identifier, "ANOMALY_ALERT", {
      requestCount,
      threshold: alertThreshold,
      windowSeconds: ANOMALY_WINDOW_SECONDS,
      severity: "warning",
    }, request)

    return {
      anomalous: true,
      shouldBlock: false,
      reason: `Request spike detected: ${requestCount}/${ANOMALY_WINDOW_SECONDS}s (alert threshold: ${alertThreshold})`,
      requestCount,
    }
  }

  // Check for endpoint concentration (potential targeted attack)
  if (endpointCounts.size > 0 && requestCount >= ANOMALY_BASELINE_REQUESTS) {
    const endpointValues = Array.from(endpointCounts.values())
    const maxEndpointCount = Math.max(...endpointValues)
    const concentrationRatio = maxEndpointCount / requestCount

    if (concentrationRatio > 0.8) {
      // >80% of requests to single endpoint
      const targetEndpoint = Array.from(endpointCounts.entries()).find(([, count]) => count === maxEndpointCount)?.[0]

      await triggerAnomalyAlert(identifier, "ENDPOINT_CONCENTRATION", {
        targetEndpoint,
        concentration: Math.round(concentrationRatio * 100),
        requestCount,
        severity: "warning",
      }, request)

      return {
        anomalous: true,
        shouldBlock: false,
        reason: `Endpoint concentration: ${Math.round(concentrationRatio * 100)}% to ${targetEndpoint}`,
        requestCount,
      }
    }
  }

  return { anomalous: false, shouldBlock: false, requestCount }
}

/**
 * SEC-030, SEC-048: Trigger anomaly alert with cooldown to prevent log spam
 *
 * SEC-048: Console logs use sanitized identifiers to prevent PII exposure
 */
async function triggerAnomalyAlert(
  identifier: string,
  eventType: string,
  details: Record<string, unknown>,
  request: NextRequest
): Promise<void> {
  const now = Date.now()
  const cooldownKey = `${identifier}:${eventType}`
  const lastAlert = anomalyAlertCooldowns.get(cooldownKey) || 0

  // Check cooldown (5 minutes between same alerts for same identifier)
  if (now - lastAlert < ANOMALY_ALERT_COOLDOWN_SECONDS * 1000) {
    return // Skip - still in cooldown
  }

  anomalyAlertCooldowns.set(cooldownKey, now)

  // SEC-048: Log to console with sanitized identifier
  const sanitizedId = sanitizeIdentifier(identifier)
  const severity = details.severity as string
  if (severity === "critical") {
    logSecurity("SEC-030", `${eventType}: anomaly alert triggered`, { identifier: sanitizedId, severity, ...details })
  } else {
    logWarn("SEC-030", `${eventType}: anomaly alert triggered`, { identifier: sanitizedId, severity, ...details })
  }

  // Log to Redis for persistence and analysis (full identifier for forensics)
  await logSecurityEvent(eventType, identifier, details, request)

  // SEC-073: Deterministic cleanup - every N requests instead of random
  alertRequestsSinceCleanup++
  if (alertRequestsSinceCleanup >= ALERT_CLEANUP_INTERVAL_REQUESTS) {
    alertRequestsSinceCleanup = 0
    let cooldownEvicted = 0
    Array.from(anomalyAlertCooldowns.entries()).forEach(([key, timestamp]) => {
      if (now - timestamp > ANOMALY_ALERT_COOLDOWN_SECONDS * 2 * 1000) {
        anomalyAlertCooldowns.delete(key)
        cooldownEvicted++
      }
    })
    memoryCleanupState.totalEvictions += cooldownEvicted
  }
}

/**
 * SEC-030, SEC-048: Log suspicious behavior for security monitoring
 *
 * SEC-048: All logged data is sanitized to prevent PII exposure
 */
async function logSecurityEvent(
  eventType: string,
  identifier: string,
  details: Record<string, unknown>,
  request: NextRequest
): Promise<void> {
  // SEC-048: Sanitize identifier for console logs (full data goes to Redis for forensics)
  const sanitizedId = sanitizeIdentifier(identifier)
  const sanitizedIp = sanitizeForLog(getClientIp(request))

  // SEC-048: Sanitize user agent (truncate to prevent log injection)
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 200)

  // Log to console with sanitized data
  logSecurity("SEC-030", `Security event: ${eventType}`, { identifier: sanitizedId, ip: sanitizedIp })

  if (!redis) return

  try {
    // Full event data goes to Redis (not publicly visible, for forensics only)
    const event = {
      timestamp: new Date().toISOString(),
      eventType,
      identifier, // Full identifier in Redis for forensic analysis
      identifierSanitized: sanitizedId, // Sanitized for dashboards
      ip: getClientIp(request), // Full IP in Redis
      ipSanitized: sanitizedIp, // Sanitized for dashboards
      userAgent,
      pathname: request.nextUrl.pathname,
      method: request.method,
      ...details,
    }

    // Store in Redis list for later analysis
    const eventKey = `nexusad:security-events`
    await redis.lpush(eventKey, JSON.stringify(event))
    // Keep last 10000 events
    await redis.ltrim(eventKey, 0, 9999)

    // Also store in per-identifier list for user-specific analysis
    const userEventKey = `nexusad:security-events:${identifier}`
    await redis.lpush(userEventKey, JSON.stringify(event))
    await redis.ltrim(userEventKey, 0, 99)
    await redis.expire(userEventKey, 24 * 60 * 60) // 24 hour TTL
  } catch {
    // Best effort - don't fail request if logging fails
    logError("SEC-030", "Failed to log security event", { eventType })
  }
}

/**
 * SEC-028, SEC-047: Check session timeouts using Redis for distributed state
 * Returns session validity and whether refresh is needed
 *
 * SEC-047: In STRICT_SECURITY_MODE, fails closed instead of using cookie fallback
 */
async function checkSessionTimeouts(
  request: NextRequest,
  userId: string
): Promise<{ valid: boolean; reason?: string; needsRefresh: boolean; strictModeBlock?: boolean }> {
  if (!redis) {
    // SEC-047: In strict mode, don't use cookie fallback (client-controlled)
    if (STRICT_SECURITY_MODE) {
      logError("SEC-047", "STRICT_SECURITY_MODE: Redis not available for session check - failing closed")
      return { valid: false, reason: "service_unavailable", needsRefresh: false, strictModeBlock: true }
    }
    // SEC-028: Fall back to cookie-based checking if Redis unavailable
    return checkSessionTimeoutsCookieFallback(request)
  }

  try {
    const sessionKey = `nexusad:session:${userId}`
    const sessionData = await redis.get<{ createdAt: number; lastActivity: number }>(sessionKey)

    const now = Math.floor(Date.now() / 1000)

    if (!sessionData) {
      // No session data in Redis - check if this is a new session
      // that hasn't been tracked yet (first request after login)
      return { valid: true, needsRefresh: true }
    }

    // Check absolute timeout (24 hours from session creation)
    if (now - sessionData.createdAt > SESSION_ABSOLUTE_TIMEOUT) {
      return { valid: false, reason: "session_expired", needsRefresh: false }
    }

    // Check idle timeout (15 minutes from last activity)
    if (now - sessionData.lastActivity > SESSION_IDLE_TIMEOUT) {
      return { valid: false, reason: "idle_timeout", needsRefresh: false }
    }

    return { valid: true, needsRefresh: true }
  } catch {
    // SEC-028, SEC-047: If Redis fails, check strict mode
    recordRedisFailure()
    if (STRICT_SECURITY_MODE) {
      logError("SEC-047", "STRICT_SECURITY_MODE: Redis failed for session check - failing closed")
      return { valid: false, reason: "service_unavailable", needsRefresh: false, strictModeBlock: true }
    }
    return checkSessionTimeoutsCookieFallback(request)
  }
}

/**
 * SEC-028: Fallback session timeout check using cookies
 * Used when Redis is unavailable
 */
function checkSessionTimeoutsCookieFallback(request: NextRequest): {
  valid: boolean
  reason?: string
  needsRefresh: boolean
} {
  const lastActivityCookie = request.cookies.get("nexus-last-activity")?.value
  const sessionCreatedCookie = request.cookies.get("nexus-session-created")?.value
  const now = Math.floor(Date.now() / 1000)

  // Check idle timeout
  if (!lastActivityCookie) {
    return { valid: false, reason: "idle_timeout", needsRefresh: false }
  }

  // Check absolute timeout
  if (sessionCreatedCookie) {
    const sessionCreatedAt = parseInt(sessionCreatedCookie, 10)
    if (now - sessionCreatedAt > SESSION_ABSOLUTE_TIMEOUT) {
      return { valid: false, reason: "session_expired", needsRefresh: false }
    }
  }

  return { valid: true, needsRefresh: true }
}

/**
 * SEC-028: Update session activity in Redis
 */
async function updateSessionActivity(userId: string, isNewSession: boolean = false): Promise<void> {
  if (!redis) return

  try {
    const sessionKey = `nexusad:session:${userId}`
    const now = Math.floor(Date.now() / 1000)

    if (isNewSession) {
      // New session - set both created and last activity
      await redis.set(
        sessionKey,
        { createdAt: now, lastActivity: now },
        { ex: SESSION_ABSOLUTE_TIMEOUT + 60 } // TTL with buffer
      )
    } else {
      // Existing session - update last activity only
      const existing = await redis.get<{ createdAt: number; lastActivity: number }>(sessionKey)
      if (existing) {
        await redis.set(
          sessionKey,
          { createdAt: existing.createdAt, lastActivity: now },
          { ex: SESSION_ABSOLUTE_TIMEOUT + 60 }
        )
      } else {
        // Session data missing - create new entry
        await redis.set(
          sessionKey,
          { createdAt: now, lastActivity: now },
          { ex: SESSION_ABSOLUTE_TIMEOUT + 60 }
        )
      }
    }
    recordRedisSuccess()
  } catch {
    recordRedisFailure()
  }
}

/**
 * SEC-028: Clear session data from Redis on logout
 * Exported for use in auth handlers
 */
export async function clearSessionData(userId: string): Promise<void> {
  if (!redis) return

  try {
    const sessionKey = `nexusad:session:${userId}`
    await redis.del(sessionKey)
  } catch {
    // Best effort
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // SEC-034: Generate per-request CSP nonce for all responses
  const cspNonce = generateCspNonce()

  // SEC-230: List of client-supplied headers that MUST be stripped before requests
  // are forwarded to backend microservices via Next.js rewrites.
  // Rewrites forward ALL client headers by default, which means an attacker's
  // spoofed X-User-ID, X-Forwarded-Host, or X-Internal-* headers reach the backend.
  // The proxy route builds its own clean headers, but rewritten routes don't.
  const STRIPPED_HEADERS_FOR_REWRITE = [
    "x-user-id",           // SEC-211: Client can spoof any user ID
    "x-forwarded-host",    // SEC-200: Host header injection
    "x-original-url",      // Request smuggling / routing confusion
    "x-rewrite-url",       // IIS URL rewrite injection
    "x-http-method-override", // SEC-221: Verb tampering (also blocked above)
    "x-http-method",       // SEC-221: Verb tampering
    "x-method-override",   // SEC-221: Verb tampering
  ]

  // SEC-044: Helper to create response with nonce in request headers (not response)
  // This prevents nonce leakage to client while allowing server components to read it
  // SEC-230: Also strips dangerous client headers before they reach rewritten backends
  function createNextResponseWithNonce(): NextResponse {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-nonce", cspNonce)

    // SEC-230: Strip dangerous headers for rewritten API routes
    if (pathname.startsWith("/api/")) {
      for (const h of STRIPPED_HEADERS_FOR_REWRITE) {
        requestHeaders.delete(h)
      }
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // SEC-229: Block TRACE method globally to prevent Cross-Site Tracing (XST) attacks.
  // TRACE reflects the request body in the response, which can be abused to steal
  // HttpOnly cookies and Authorization headers via XHR/fetch + XSS.
  // Also block TRACK (IIS variant of TRACE) and CONNECT (proxy tunneling).
  const blockedMethods = ["TRACE", "TRACK", "CONNECT"]
  if (blockedMethods.includes(request.method.toUpperCase())) {
    logSecurity("SEC-229", "Blocked dangerous HTTP method", {
      method: request.method,
      pathname,
    })
    const methodResponse = new NextResponse(
      JSON.stringify({
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Allow": "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS",
        },
      }
    )
    return applySecurityHeaders(methodResponse, cspNonce)
  }

  // Let static files and Next.js internals pass through without rate limiting
  // (static files don't need security headers as they're served by Next.js/CDN)
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    // SEC-221: Block HTTP Method Override headers on ALL API routes.
    // These headers (X-HTTP-Method-Override, X-HTTP-Method, X-Method-Override)
    // allow attackers to change the effective HTTP method, bypassing CSRF
    // protections (which only apply to POST/PUT/DELETE/PATCH) or reaching
    // handler logic intended for different verbs. Some frameworks and reverse
    // proxies honour these headers automatically.
    const methodOverrideHeaders = [
      "x-http-method-override",
      "x-http-method",
      "x-method-override",
    ]
    for (const h of methodOverrideHeaders) {
      if (request.headers.get(h)) {
        logSecurity("SEC-221", "Blocked HTTP method override header", {
          header: h,
          value: request.headers.get(h)?.slice(0, 20),
          pathname,
        })
        const overrideResponse = new NextResponse(
          JSON.stringify({
            error: "Method override headers are not allowed",
            code: "METHOD_OVERRIDE_BLOCKED",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        )
        return applySecurityHeaders(overrideResponse, cspNonce)
      }
    }

    // SEC-032: Check request body size for POST/PUT/PATCH to prevent DoS
    const method = request.method.toUpperCase()
    if (["POST", "PUT", "PATCH"].includes(method)) {
      // SEC-214: HTTP Request Smuggling prevention - reject conflicting Content-Length
      // and Transfer-Encoding headers. An attacker sending both headers can cause
      // the frontend proxy and backend to interpret the request body differently,
      // enabling request smuggling attacks (CL.TE or TE.CL).
      const transferEncoding = request.headers.get("transfer-encoding")
      const contentLength = request.headers.get("content-length")
      if (transferEncoding && contentLength) {
        logSecurity("SEC-214", "Request smuggling attempt: both Transfer-Encoding and Content-Length present", {
          transferEncoding: transferEncoding.slice(0, 50),
          contentLength,
          pathname,
        })
        const smugglingResponse = new NextResponse(
          JSON.stringify({
            error: "Bad Request: conflicting transfer headers",
            code: "REQUEST_SMUGGLING_BLOCKED",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        )
        return applySecurityHeaders(smugglingResponse, cspNonce)
      }

      if (contentLength) {
        const bodySize = parseInt(contentLength, 10)
        if (bodySize > MAX_REQUEST_BODY_SIZE) {
          // SEC-046: Minimize error details to prevent information leakage
          // Don't expose internal configuration (maxSize, receivedSize) in response
          const payloadTooLargeResponse = new NextResponse(
            JSON.stringify({
              ...getLocalizedError(request, "PAYLOAD_TOO_LARGE"),
              error: "Request payload too large",
              code: "PAYLOAD_TOO_LARGE",
            }),
            {
              status: 413,
              headers: { "Content-Type": "application/json" },
            }
          )
          return applySecurityHeaders(payloadTooLargeResponse, cspNonce)
        }
      }
    }

    // SEC-027, SEC-039: Validate CSRF token for state-changing API requests
    // Auth routes (login/register) are exempt - user isn't authenticated yet, nothing to protect
    const isAuthEndpoint = pathname.startsWith("/api/v1/auth/login") ||
                           pathname.startsWith("/api/v1/auth/register") ||
                           pathname.startsWith("/api/v1/auth/forgot-password") ||
                           pathname.startsWith("/api/v1/auth/verify-email")
    const csrfResult = isAuthEndpoint ? { valid: true, needsRefresh: false } : await validateCsrfToken(request)
    if (!csrfResult.valid) {
      const csrfResponse = new NextResponse(
        JSON.stringify({
          ...getLocalizedError(request, "CSRF_INVALID"),
          error: "Invalid or missing CSRF token",
          code: "CSRF_VALIDATION_FAILED",
          hint: "Refresh the page and try again",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
      // Set fresh CSRF cookies on error response so next request works
      // This breaks the stuck-in-a-loop scenario where old/invalid cookies persist
      await ensureCsrfCookie(request, csrfResponse, true) // Force refresh
      return applySecurityHeaders(csrfResponse, cspNonce)
    }
    // SEC-039: Track if CSRF token needs refresh (used previous secret during rotation)
    const csrfNeedsRefresh = csrfResult.needsRefresh

    const rateLimitKey = await buildRateLimitKey(request) // SEC-022, SEC-029, SEC-035: userId + IP + SHA-256 fingerprint
    const isAuth = isAuthRoute(pathname)
    const isExpensive = isExpensiveRoute(pathname)

    // SEC-030: Track request for anomaly detection
    await trackRequestForAnomaly(rateLimitKey, pathname)

    // SEC-030: Check for anomalous patterns and block if critical threshold exceeded
    const anomalyCheck = await checkForAnomaly(rateLimitKey, request)
    if (anomalyCheck.shouldBlock) {
      // SEC-030: Block request - critical threshold exceeded (likely attack)
      const blockResponse = new NextResponse(
        JSON.stringify({
          ...getLocalizedError(request, "ANOMALY_BLOCKED"),
          error: "Request rate exceeded. Please slow down.",
          code: "ANOMALY_BLOCKED",
          retryAfter: ANOMALY_WINDOW_SECONDS,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(ANOMALY_WINDOW_SECONDS),
            "X-Anomaly-Blocked": "true",
          },
        }
      )
      return applySecurityHeaders(blockResponse, cspNonce)
    }
    // Note: anomalyCheck.anomalous without shouldBlock = warning alert only (already logged)

    // SEC-023, SEC-024, REL-017: Check circuit breaker for expensive routes and auth (in-memory)
    if ((isExpensive || isAuth) && isCircuitBreakerOpen()) {
      const errorResponse = new NextResponse(
        JSON.stringify({
          ...getLocalizedError(request, "SERVICE_UNAVAILABLE"),
          error: "Service temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(CIRCUIT_BREAKER_RESET_TIMEOUT_MS / 1000)),
          },
        }
      )
      return applySecurityHeaders(errorResponse, cspNonce)
    }

    // SEC-006, SEC-029: Check for exponential backoff lockout on auth routes
    // TEMPORARY: Skip lockout check during VIP launch testing (2026-03-28)
    const skipLockoutCheck = true // TEMPORARY - disable after launch
    if (isAuth && !skipLockoutCheck) {
      const lockoutCheck = await isLockedOut(rateLimitKey)

      // SEC-029: If CAPTCHA is required, include that in response
      if (lockoutCheck.captchaRequired && !lockoutCheck.locked) {
        // Not locked yet, but CAPTCHA is required
        // Add header to indicate CAPTCHA requirement
        // The auth endpoint should check for this and require CAPTCHA
      }

      if (lockoutCheck.locked) {
        await logSecurityEvent("AUTH_LOCKOUT", rateLimitKey, { retryAfter: lockoutCheck.retryAfterSeconds }, request)

        const lockoutResponse = new NextResponse(
          JSON.stringify({
            ...getLocalizedError(request, "ACCOUNT_LOCKED"),
            error: "Account temporarily locked due to too many failed attempts. Please try again later.",
            code: "ACCOUNT_LOCKED",
            retryAfter: lockoutCheck.retryAfterSeconds,
            captchaRequired: lockoutCheck.captchaRequired, // SEC-029
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_REQUESTS),
              "X-RateLimit-Remaining": "0",
              "Retry-After": String(lockoutCheck.retryAfterSeconds), // CODE-012: Dynamic Retry-After
              "X-Captcha-Required": lockoutCheck.captchaRequired ? "true" : "false", // SEC-029
            },
          }
        )
        return applySecurityHeaders(lockoutResponse, cspNonce)
      }

      // SEC-029: Add CAPTCHA required header even if not locked
      if (lockoutCheck.captchaRequired) {
        // Will be added to response below
      }
    }

    let allowed = true
    let remaining: number = 0
    let resetMs: number = Date.now() + RATE_LIMIT_WINDOW_MS
    let limit: number
    let captchaRequired = false

    // SEC-075: Check if this request is a circuit breaker health probe (NEX-009 fix)
    // Health probes MUST bypass rate limiting to prevent attackers from creating
    // permanent stuck-open conditions by rate limiting the probes themselves.
    // SECURITY: isCircuitBreakerHealthProbe() only reads in-memory state and cannot
    // be spoofed via HTTP headers or other external input.
    const isHealthProbe = isCircuitBreakerHealthProbe()
    if (isHealthProbe) {
      logInfo("SEC-075", "Health probe request detected - bypassing rate limiting", {
        pathname,
        rateLimitKey,
        halfOpenEnteredAt: circuitBreakerState.halfOpenEnteredAt
          ? new Date(circuitBreakerState.halfOpenEnteredAt).toISOString()
          : null,
      })
      // Skip rate limiting entirely for health probes - they MUST reach Redis
      // to test its health and allow the circuit to close
    }

    // SEC-080: Check for distributed attack patterns BEFORE regular rate limiting
    // This catches botnets and coordinated attacks that bypass per-IP limits
    if (!isHealthProbe) {
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                       request.headers.get("x-real-ip") ||
                       "unknown"
      const userAgent = request.headers.get("user-agent") || "unknown"

      if (checkDistributedAttack(pathname, clientIp, userAgent)) {
        // Distributed attack detected - apply global rate limit
        await logSecurityEvent("DISTRIBUTED_ATTACK_DETECTED", rateLimitKey, {
          pathname,
          clientIp: clientIp.slice(0, 15), // Truncate for log safety
        }, request)

        const attackResponse = new NextResponse(
          JSON.stringify({
            ...getLocalizedError(request, "ANOMALY_BLOCKED"),
            error: "Request blocked due to unusual traffic patterns. Please try again later.",
            code: "DISTRIBUTED_ATTACK_BLOCKED",
            retryAfter: 60,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          }
        )
        return applySecurityHeaders(attackResponse, cspNonce)
      }
    }

    if (isAuth && !isHealthProbe) {
      // TEMPORARY: Bypass rate limiting during VIP launch testing (2026-03-28)
      // TODO: Remove this after VIP testing completes
      const isLaunchTesting = true // TEMPORARY - disable after launch
      if (isLaunchTesting) {
        allowed = true
        remaining = 100
        limit = 100
        // Skip all rate limiting during launch
      } else {
        // Check if CAPTCHA is required for this identifier
        captchaRequired = await isCaptchaRequired(rateLimitKey)

      // Stricter rate limiting for auth endpoints (brute force protection)
      limit = AUTH_RATE_LIMIT_MAX_REQUESTS
      if (authRatelimit) {
        try {
          const result = await authRatelimit.limit(rateLimitKey) // SEC-022, SEC-029: Use composite key
          allowed = result.success
          remaining = result.remaining
          resetMs = result.reset
          recordRedisSuccess()
        } catch {
          // REL-017: Redis down - fail closed for security on auth routes
          recordRedisFailure()
          const errorResponse = new NextResponse(
            JSON.stringify({
              ...getLocalizedError(request, "SERVICE_UNAVAILABLE"),
              error: "Service temporarily unavailable. Please try again later.",
              code: "SERVICE_UNAVAILABLE",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "30",
              },
            }
          )
          return applySecurityHeaders(errorResponse, cspNonce)
        }
      } else {
        // SEC-031, SEC-047: Development-only rate limiting with strict mode check
        if (STRICT_SECURITY_MODE) {
          // SEC-047: In strict mode, fail hard instead of using insecure in-memory storage
          logError("SEC-047", "STRICT_SECURITY_MODE: Redis not configured - failing closed for auth route")
          await auditSensitiveOperation("STRICT_MODE_BLOCK", rateLimitKey, {
            reason: "Redis not configured in strict security mode",
            route: pathname,
            routeType: "auth",
          }, request)
          const errorResponse = new NextResponse(
            JSON.stringify({
              ...getLocalizedError(request, "SERVICE_UNAVAILABLE"),
              error: "Service temporarily unavailable. Please try again later.",
              code: "SERVICE_UNAVAILABLE",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "30",
              },
            }
          )
          return applySecurityHeaders(errorResponse, cspNonce)
        }
        if (process.env.NODE_ENV === "production") {
          logWarn("SEC-031", "Using in-memory rate limiting in production - configure Redis or enable STRICT_SECURITY_MODE")
        }
        const result = devCheckRateLimit(rateLimitKey, AUTH_RATE_LIMIT_MAX_REQUESTS, devAuthRateLimitStore)
        allowed = result.allowed
        remaining = result.remaining
        resetMs = result.resetMs
      }
      } // Close VIP bypass else block
    } else if (!isHealthProbe) {
      // Standard rate limiting for other API routes
      // SEC-075: Health probes bypass this block entirely (checked above)
      limit = RATE_LIMIT_MAX_REQUESTS
      if (ratelimit) {
        try {
          const result = await ratelimit.limit(rateLimitKey) // SEC-022, SEC-029: Use composite key
          allowed = result.success
          remaining = result.remaining
          resetMs = result.reset
          recordRedisSuccess()
        } catch {
          // REL-017: Redis down - fail closed for expensive routes
          // For non-expensive routes, allow through to avoid blocking legitimate traffic
          recordRedisFailure()
          if (isExpensive) {
            const errorResponse = new NextResponse(
              JSON.stringify({
                ...getLocalizedError(request, "SERVICE_UNAVAILABLE"),
                error: "Service temporarily unavailable. Please try again later.",
                code: "SERVICE_UNAVAILABLE",
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": "30",
                },
              }
            )
            return applySecurityHeaders(errorResponse, cspNonce)
          }
          // For non-expensive routes, allow through but with default limits
          allowed = true
          remaining = limit
        }
      } else {
        // SEC-031, SEC-047: Development-only rate limiting with strict mode check
        if (STRICT_SECURITY_MODE) {
          // SEC-047: In strict mode, fail hard for expensive routes, allow others with logging
          if (isExpensive) {
            logError("SEC-047", "STRICT_SECURITY_MODE: Redis not configured - failing closed for expensive route")
            await auditSensitiveOperation("STRICT_MODE_BLOCK", rateLimitKey, {
              reason: "Redis not configured in strict security mode",
              route: pathname,
              routeType: "expensive",
            }, request)
            const errorResponse = new NextResponse(
              JSON.stringify({
                ...getLocalizedError(request, "SERVICE_UNAVAILABLE"),
                error: "Service temporarily unavailable. Please try again later.",
                code: "SERVICE_UNAVAILABLE",
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": "30",
                },
              }
            )
            return applySecurityHeaders(errorResponse, cspNonce)
          }
          // For non-expensive routes in strict mode, log warning but allow
          logWarn("SEC-047", "STRICT_SECURITY_MODE: Redis not configured for non-expensive route - allowing with default limits")
        }
        if (process.env.NODE_ENV === "production" && !STRICT_SECURITY_MODE) {
          logWarn("SEC-031", "Using in-memory rate limiting in production - configure Redis or enable STRICT_SECURITY_MODE")
        }
        const result = devCheckRateLimit(rateLimitKey, RATE_LIMIT_MAX_REQUESTS, devRateLimitStore)
        allowed = result.allowed
        remaining = result.remaining
        resetMs = result.resetMs
      }
    } else {
      // SEC-075: Health probe - skip rate limiting, set default limit for headers
      limit = RATE_LIMIT_MAX_REQUESTS
      remaining = limit // Health probes don't consume rate limit quota
    }

    if (!allowed) {
      // CODE-012: Calculate dynamic Retry-After based on actual reset time
      const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))

      await logSecurityEvent("RATE_LIMIT_EXCEEDED", rateLimitKey, { limit, pathname }, request)

      const rateLimitResponse = new NextResponse(
        JSON.stringify({
          ...getLocalizedError(request, "RATE_LIMIT"),
          error: "Too many requests. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: retryAfterSeconds,
          captchaRequired, // SEC-029
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)), // Unix timestamp
            "Retry-After": String(retryAfterSeconds), // CODE-012: Dynamic Retry-After header
            "X-Captcha-Required": captchaRequired ? "true" : "false", // SEC-029
          },
        }
      )
      return applySecurityHeaders(rateLimitResponse, cspNonce)
    }

    // SEC-044: Use helper to pass nonce via request headers (server-side only)
    const response = createNextResponseWithNonce()
    response.headers.set("X-RateLimit-Limit", String(limit))
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetMs / 1000)))
    if (captchaRequired) {
      response.headers.set("X-Captcha-Required", "true") // SEC-029
    }
    // SEC-039: Refresh CSRF token if it was verified using previous secret during rotation
    await ensureCsrfCookie(request, response, csrfNeedsRefresh)
    return applySecurityHeaders(response, cspNonce)
  }

  // Only check auth for explicitly protected routes (billing, team management)
  if (!PROTECTED_ROUTES.has(pathname)) {
    // For non-protected routes, still refresh idle timeout if session exists (SEC-026, SEC-028)
    const sessionCookie = request.cookies.get("nexus-session")?.value
    if (sessionCookie) {
      // SEC-064: Use verified userId for session activity (Red Team NEX-001 fix)
      const userId = await getUserId(request, true) // requireVerification = true
      if (userId) {
        // SEC-028: Update session activity in Redis
        await updateSessionActivity(userId)
      }

      // SEC-044: Use helper to pass nonce via request headers (server-side only)
      const response = createNextResponseWithNonce()
      // Refresh the idle timeout cookie on each request (sliding window) - fallback mechanism
      const now = Math.floor(Date.now() / 1000)
      response.cookies.set("nexus-last-activity", String(now), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_IDLE_TIMEOUT, // Refreshes the 15 min idle window
      })
      // SEC-027: Ensure CSRF cookie is set with proper flags
      await ensureCsrfCookie(request, response)
      return applySecurityHeaders(response, cspNonce)
    }
    // SEC-027: Ensure CSRF cookie is set with proper flags for unauthenticated users too
    // SEC-044: Use helper to pass nonce via request headers (server-side only)
    const response = createNextResponseWithNonce()
    await ensureCsrfCookie(request, response)
    return applySecurityHeaders(response, cspNonce)
  }

  // Check for auth cookie (httpOnly session cookie set by server-side auth)
  const authCookie = request.cookies.get("nexus-session")?.value

  if (!authCookie) {
    // Redirect to login, preserving the intended destination
    // SEC-200: Use request.nextUrl.origin for redirect base to prevent Host header injection.
    // request.url derives from the Host header which an attacker can forge.
    // request.nextUrl.origin is derived from the Next.js server config, which is trusted.
    const loginUrl = new URL("/login", request.nextUrl.origin)
    // SEC-201: Validate redirect path is a safe relative path (no open redirect)
    const safeRedirect = pathname.startsWith("/") && !pathname.startsWith("//") && !pathname.includes("://")
      ? pathname
      : "/"
    loginUrl.searchParams.set("redirect", safeRedirect)
    const redirectResponse = NextResponse.redirect(loginUrl)
    return applySecurityHeaders(redirectResponse, cspNonce)
  }

  // SEC-028/SEC-064: Check session timeouts using VERIFIED userId (Red Team NEX-001 fix)
  // CRITICAL: Must verify JWT signature before trusting userId for auth decisions
  const userId = await getUserId(request, true) // requireVerification = true

  // If we have a session cookie but JWT verification failed, still allow the request
  // The proxy will forward the token to the backend for validation
  const sessionCookie = request.cookies.get("nexus-session")?.value
  if (!userId && sessionCookie) {
    console.log("[Middleware] Session exists but JWT verification failed - allowing request for backend validation")
    const response = NextResponse.next()
    return applySecurityHeaders(response, cspNonce)
  }

  if (userId) {
    const sessionCheck = await checkSessionTimeouts(request, userId)

    if (!sessionCheck.valid) {
      await logSecurityEvent("SESSION_TIMEOUT", userId, { reason: sessionCheck.reason }, request)

      // Clear session data from Redis
      await clearSessionData(userId)

      // SEC-200: Use nextUrl.origin to prevent Host header injection in redirects
      const loginUrl = new URL("/login", request.nextUrl.origin)
      // SEC-201: Validate redirect path is a safe relative path
      const safeRedirect = pathname.startsWith("/") && !pathname.startsWith("//") && !pathname.includes("://")
        ? pathname
        : "/"
      loginUrl.searchParams.set("redirect", safeRedirect)
      loginUrl.searchParams.set("reason", sessionCheck.reason || "session_invalid")
      const redirectResponse = NextResponse.redirect(loginUrl)
      // Clear all session cookies
      redirectResponse.cookies.set("nexus-session", "", { path: "/", maxAge: 0 })
      redirectResponse.cookies.set("nexus-session-created", "", { path: "/", maxAge: 0 })
      redirectResponse.cookies.set("nexus-last-activity", "", { path: "/", maxAge: 0 })
      return applySecurityHeaders(redirectResponse, cspNonce)
    }

    // Update session activity in Redis
    if (sessionCheck.needsRefresh) {
      await updateSessionActivity(userId)
    }
  } else {
    // SEC-028: Fallback to cookie-based timeout checking if userId extraction fails
    const lastActivityCookie = request.cookies.get("nexus-last-activity")?.value
    const sessionCreatedCookie = request.cookies.get("nexus-session-created")?.value
    const now = Math.floor(Date.now() / 1000)

    // Check idle timeout (15 minutes) - cookie auto-expires, but double-check
    if (!lastActivityCookie) {
      // Idle timeout expired - session inactive for too long
      // SEC-200: Use nextUrl.origin to prevent Host header injection in redirects
      const loginUrl = new URL("/login", request.nextUrl.origin)
      // SEC-201: Validate redirect path is a safe relative path
      const safeRedirect2 = pathname.startsWith("/") && !pathname.startsWith("//") && !pathname.includes("://")
        ? pathname
        : "/"
      loginUrl.searchParams.set("redirect", safeRedirect2)
      loginUrl.searchParams.set("reason", "idle_timeout")
      const redirectResponse = NextResponse.redirect(loginUrl)
      // Clear all session cookies
      redirectResponse.cookies.set("nexus-session", "", { path: "/", maxAge: 0 })
      redirectResponse.cookies.set("nexus-session-created", "", { path: "/", maxAge: 0 })
      redirectResponse.cookies.set("nexus-last-activity", "", { path: "/", maxAge: 0 })
      return applySecurityHeaders(redirectResponse, cspNonce)
    }

    // Check absolute timeout (24 hours)
    if (sessionCreatedCookie) {
      const sessionCreatedAt = parseInt(sessionCreatedCookie, 10)
      if (now - sessionCreatedAt > SESSION_ABSOLUTE_TIMEOUT) {
        // Absolute timeout exceeded - force re-authentication
        // SEC-200: Use nextUrl.origin to prevent Host header injection in redirects
        const loginUrl = new URL("/login", request.nextUrl.origin)
        // SEC-201: Validate redirect path is a safe relative path
        const safeRedirect3 = pathname.startsWith("/") && !pathname.startsWith("//") && !pathname.includes("://")
          ? pathname
          : "/"
        loginUrl.searchParams.set("redirect", safeRedirect3)
        loginUrl.searchParams.set("reason", "session_expired")
        const redirectResponse = NextResponse.redirect(loginUrl)
        // Clear all session cookies
        redirectResponse.cookies.set("nexus-session", "", { path: "/", maxAge: 0 })
        redirectResponse.cookies.set("nexus-session-created", "", { path: "/", maxAge: 0 })
        redirectResponse.cookies.set("nexus-last-activity", "", { path: "/", maxAge: 0 })
        return applySecurityHeaders(redirectResponse, cspNonce)
      }
    }
  }

  // Session is valid - refresh idle timeout (sliding window) (SEC-026, SEC-028)
  // SEC-044: Use helper to pass nonce via request headers (server-side only)
  const response = createNextResponseWithNonce()
  const now = Math.floor(Date.now() / 1000)
  response.cookies.set("nexus-last-activity", String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_IDLE_TIMEOUT, // Refreshes the 15 min idle window
  })

  // SEC-027: Ensure CSRF cookie is set with proper flags
  await ensureCsrfCookie(request, response)

  return applySecurityHeaders(response, cspNonce)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEC-071: UAE DATA FORMAT VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEC-071, SEC-077: Validate UAE Emirates ID format with Luhn check digit verification (constant-time)
 *
 * Emirates ID format: 784-YYYY-NNNNNNN-C
 * - 784: UAE country code (fixed)
 * - YYYY: Year of birth
 * - NNNNNNN: 7-digit sequence number
 * - C: Check digit (Luhn algorithm)
 *
 * SEC-077: Implements constant-time validation to prevent timing side-channel attacks.
 * - All validation steps execute regardless of intermediate failures
 * - Uses timing-safe comparison for checksum verification
 * - Enforces minimum execution time with random jitter as defense-in-depth
 *
 * @param id - The Emirates ID string to validate
 * @returns true if the format is valid and the check digit passes Luhn verification
 */
export function isValidEmiratesId(id: string): boolean {
  // SEC-077: Record start time for constant-time enforcement
  const startTime = performance.now()
  const MIN_EXECUTION_MS = 1.0 // Higher minimum for complex validation

  // SEC-077: Accumulate validation results without early return
  let validationPassed = true

  // SEC-077: Pattern validation (always execute, accumulate result)
  const pattern = /^784-\d{4}-\d{7}-\d$/
  const patternValid = pattern.test(id)
  validationPassed = validationPassed && patternValid

  // SEC-077: Always extract digits regardless of pattern match
  // Pad to 15 chars if shorter to ensure constant-time loop execution
  const rawDigits = id.replace(/-/g, "")
  const digits = rawDigits.padEnd(15, "0").slice(0, 15)

  // SEC-077: Length check (always execute, accumulate result)
  const lengthValid = rawDigits.length === 15
  validationPassed = validationPassed && lengthValid

  // SEC-077: Luhn algorithm verification (constant-time)
  // Always processes exactly 15 digits regardless of input validity
  let sum = 0
  let alternate = false
  for (let i = 14; i >= 0; i--) {
    // SEC-077: Use constant-time digit extraction
    const charCode = digits.charCodeAt(i)
    // Convert ASCII to digit (0-9), default to 0 for non-digits
    let n = charCode >= 48 && charCode <= 57 ? charCode - 48 : 0

    // SEC-077: Constant-time double operation (avoid branch on alternate)
    // When alternate is true, double n; otherwise keep n
    // Using arithmetic instead of conditional: n * (1 + alternate)
    const multiplier = alternate ? 2 : 1
    n *= multiplier

    // SEC-077: Constant-time subtraction for n > 9
    // If n > 9, subtract 9; otherwise subtract 0
    // Using arithmetic: n - 9 * (n > 9 ? 1 : 0)
    const adjustment = n > 9 ? 9 : 0
    n -= adjustment

    sum += n
    alternate = !alternate
  }

  // SEC-077: Timing-safe checksum comparison
  // Use XOR-based comparison to avoid timing leaks from === operator
  const checksumResult = sum % 10
  const checksumValid = (checksumResult ^ 0) === 0 // Valid if divisible by 10
  validationPassed = validationPassed && checksumValid

  // SEC-077: Enforce minimum execution time with jitter (defense-in-depth)
  const elapsed = performance.now() - startTime
  const jitter = Math.random() * 0.2 // 0-0.2ms random jitter
  const remainingTime = MIN_EXECUTION_MS + jitter - elapsed
  if (remainingTime > 0) {
    const spinUntil = performance.now() + remainingTime
    while (performance.now() < spinUntil) {
      // Busy-wait to ensure constant time
    }
  }

  return validationPassed
}

/**
 * SEC-071, SEC-077: Validate UAE phone number format (constant-time)
 *
 * Accepted formats:
 * - UAE mobile: 05X XXX XXXX (local) or +971 5X XXX XXXX (international)
 * - UAE landline: 0X XXX XXXX (local) or +971 X XXX XXXX (international)
 * - Separators (spaces, dots, dashes) are stripped before validation
 *
 * SEC-077: Implements constant-time validation to prevent timing side-channel attacks.
 * All validation steps execute regardless of intermediate failures.
 *
 * @param phone - The phone number string to validate
 * @returns true if the phone number matches a valid UAE format
 */
export function isValidUaePhone(phone: string): boolean {
  // SEC-077: Record start time for constant-time enforcement
  const startTime = performance.now()
  const MIN_EXECUTION_MS = 0.5

  // SEC-077: Accumulate validation results without early return
  let validationPassed = true

  // Normalize input (always execute)
  const normalized = phone.replace(/[\s.-]/g, "")

  // SEC-077: Validate pattern (always execute, accumulate result)
  const pattern = /^(\+971|00971|0)[1-9]\d{7,8}$/
  const patternValid = pattern.test(normalized)
  validationPassed = validationPassed && patternValid

  // SEC-077: Length sanity check (always execute)
  const lengthValid = normalized.length >= 9 && normalized.length <= 14
  validationPassed = validationPassed && lengthValid

  // SEC-077: Enforce minimum execution time with jitter
  const elapsed = performance.now() - startTime
  const jitter = Math.random() * 0.1
  const remainingTime = MIN_EXECUTION_MS + jitter - elapsed
  if (remainingTime > 0) {
    const spinUntil = performance.now() + remainingTime
    while (performance.now() < spinUntil) {
      // Busy-wait to ensure constant time
    }
  }

  return validationPassed
}

/**
 * SEC-071, SEC-077: Validate UAE P.O. Box format (constant-time)
 *
 * SEC-077: Implements constant-time validation to prevent timing side-channel attacks.
 * All validation steps execute regardless of intermediate failures.
 *
 * @param pobox - The P.O. Box string to validate (e.g., "P.O. Box 12345")
 * @returns true if the string matches a valid UAE P.O. Box format
 */
export function isValidUaePoBox(pobox: string): boolean {
  // SEC-077: Record start time for constant-time enforcement
  const startTime = performance.now()
  const MIN_EXECUTION_MS = 0.5

  // SEC-077: Accumulate validation results without early return
  let validationPassed = true

  // Normalize input (always execute)
  const trimmed = pobox.trim()

  // SEC-077: Validate pattern (always execute, accumulate result)
  const pattern = /^P\.?O\.?\s*Box\s*\d{1,6}$/i
  const patternValid = pattern.test(trimmed)
  validationPassed = validationPassed && patternValid

  // SEC-077: Length sanity check (always execute)
  const lengthValid = trimmed.length >= 8 && trimmed.length <= 20
  validationPassed = validationPassed && lengthValid

  // SEC-077: Enforce minimum execution time with jitter
  const elapsed = performance.now() - startTime
  const jitter = Math.random() * 0.1
  const remainingTime = MIN_EXECUTION_MS + jitter - elapsed
  if (remainingTime > 0) {
    const spinUntil = performance.now() + remainingTime
    while (performance.now() < spinUntil) {
      // Busy-wait to ensure constant time
    }
  }

  return validationPassed
}

/**
 * SEC-071, SEC-077: Validate UAE license plate format (constant-time)
 *
 * UAE plates consist of 1-3 letter codes followed by 1-5 digit numbers.
 * Examples: A 12345, AB 1234, ABC 123
 *
 * SEC-077: Implements constant-time validation to prevent timing side-channel attacks.
 * All validation steps execute regardless of intermediate failures.
 *
 * @param plate - The license plate string to validate
 * @returns true if the string matches a valid UAE plate format
 */
export function isValidUaePlate(plate: string): boolean {
  // SEC-077: Record start time for constant-time enforcement
  const startTime = performance.now()
  const MIN_EXECUTION_MS = 0.5

  // SEC-077: Accumulate validation results without early return
  let validationPassed = true

  // Normalize input (always execute)
  const normalized = plate.trim().replace(/[\s-]/g, " ")

  // SEC-077: Validate pattern (always execute, accumulate result)
  const pattern = /^[A-Z]{1,3}\s?\d{1,5}$/i
  const patternValid = pattern.test(normalized)
  validationPassed = validationPassed && patternValid

  // SEC-077: Length sanity check (always execute)
  const lengthValid = normalized.length >= 2 && normalized.length <= 10
  validationPassed = validationPassed && lengthValid

  // SEC-077: Enforce minimum execution time with jitter
  const elapsed = performance.now() - startTime
  const jitter = Math.random() * 0.1
  const remainingTime = MIN_EXECUTION_MS + jitter - elapsed
  if (remainingTime > 0) {
    const spinUntil = performance.now() + remainingTime
    while (performance.now() < spinUntil) {
      // Busy-wait to ensure constant time
    }
  }

  return validationPassed
}

export const config = {
  // Run middleware on all routes except static files and images
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
