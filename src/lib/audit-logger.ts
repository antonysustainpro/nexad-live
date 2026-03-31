/**
 * AUDIT TRAIL SYSTEM — NexusAD Sovereign AI
 *
 * Provides structured, correlation-ID-enriched, PII-scrubbed audit logging
 * for every user action, security event, and API call across the platform.
 *
 * Architecture:
 *   - All events are emitted via the single `auditLog()` function
 *   - Events are batched in-memory and flushed on: batch full | time interval | page unload
 *   - In development: console output only
 *   - In production: POST to /api/v1/audit/ingest (backend stores + ships to Axiom/Datadog)
 *   - Every event carries: correlationId, sessionId, userId, requestId, timestamp
 *   - PII is scrubbed before any event leaves the browser
 *
 * Event categories:
 *   USER_ACTION   — button clicks, form submits, navigation
 *   API_CALL      — every fetch, with method/endpoint/status/latency
 *   SESSION       — start, end, refresh, idle timeout
 *   SECURITY      — CSRF violations, rate limits, suspicious patterns
 *   AUTH          — login, logout, failed auth, MFA
 *   VAULT         — document access, upload, delete
 *   PII           — PII detection/scrubbing events
 */

import { redactPII } from "@/lib/logger"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditEventCategory =
  | "USER_ACTION"
  | "API_CALL"
  | "SESSION"
  | "SECURITY"
  | "AUTH"
  | "VAULT"
  | "PII"
  | "SYSTEM"

export type AuditEventSeverity = "info" | "warn" | "error" | "critical"

export interface AuditEvent {
  /** Unique event ID */
  eventId: string
  /** Wall-clock ISO timestamp (UTC) */
  timestamp: string
  /** Category of event */
  category: AuditEventCategory
  /** Severity level */
  severity: AuditEventSeverity
  /** Human-readable event name e.g. "vault.document.viewed" */
  action: string
  /** Hashed user ID (never raw PII) */
  userId?: string
  /** Session identifier (opaque) */
  sessionId: string
  /** Correlation ID that links events across a single user flow */
  correlationId: string
  /** Optional request ID from backend response header */
  requestId?: string
  /** Extra structured data (PII-scrubbed) */
  metadata?: Record<string, unknown>
  /** Source page/component */
  source?: string
  /** Browser fingerprint (non-PII) */
  userAgent?: string
  /** Approximate geo region (not precise location) */
  geoRegion?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ID generation (Edge/browser compatible — no Node crypto module required)
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: manual random UUID v4
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Session & Correlation context
// ─────────────────────────────────────────────────────────────────────────────

let _sessionId: string | null = null
let _correlationId: string | null = null
let _userId: string | null = null

/** Get or create a stable session ID for the browser tab */
export function getSessionId(): string {
  if (_sessionId) return _sessionId

  // Try to reuse from sessionStorage (survives page refreshes but not new tabs)
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem("nexus-audit-sid")
    if (stored) {
      _sessionId = stored
      return _sessionId
    }
  }

  _sessionId = generateId()

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("nexus-audit-sid", _sessionId)
  }

  return _sessionId
}

/** Get the active correlation ID (scoped to current user flow) */
export function getCorrelationId(): string {
  if (!_correlationId) {
    _correlationId = generateId()
  }
  return _correlationId
}

/** Start a new correlation scope (call at navigation or significant action boundaries) */
export function newCorrelationId(): string {
  _correlationId = generateId()
  return _correlationId
}

/** Register the current user ID for all subsequent events */
export function setAuditUserId(hashedId: string | null): void {
  _userId = hashedId
}

/** Get the registered user ID */
export function getAuditUserId(): string | null {
  return _userId
}

// ─────────────────────────────────────────────────────────────────────────────
// PII scrubbing for metadata
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_META_KEYS = new Set([
  "password", "passwd", "pwd", "secret", "token", "accessToken", "access_token",
  "refreshToken", "refresh_token", "apiKey", "api_key", "authorization", "auth",
  "bearer", "jwt", "sessionId", "session_id", "cookie", "email", "emailAddress",
  "email_address", "phone", "phoneNumber", "emiratesId", "emirates_id", "passport",
  "passportNumber", "iban", "bankAccount", "accountNumber", "creditCard", "cardNumber",
  "ssn", "dateOfBirth", "dob",
])

/** Deep-scrub PII from a metadata object before logging */
function scrubMetadata(meta: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return { _truncated: "[MAX_DEPTH]" }

  const scrubbed: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(meta)) {
    const lowerKey = k.toLowerCase()

    // Redact by key name
    if (
      SENSITIVE_META_KEYS.has(k) ||
      SENSITIVE_META_KEYS.has(lowerKey) ||
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("key") && (lowerKey.includes("api") || lowerKey.includes("private")) ||
      lowerKey.includes("auth") ||
      lowerKey.includes("credential")
    ) {
      scrubbed[k] = "[REDACTED]"
      continue
    }

    if (typeof v === "string") {
      // Redact PII patterns from string values
      const redacted = redactPII(v)
      // Truncate long strings
      scrubbed[k] = redacted.length > 200 ? redacted.slice(0, 200) + "…" : redacted
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      scrubbed[k] = scrubMetadata(v as Record<string, unknown>, depth + 1)
    } else if (Array.isArray(v)) {
      scrubbed[k] = v.slice(0, 20).map((item) =>
        typeof item === "string"
          ? redactPII(item).slice(0, 100)
          : typeof item === "object" && item !== null
          ? scrubMetadata(item as Record<string, unknown>, depth + 1)
          : item
      )
    } else {
      scrubbed[k] = v
    }
  }

  return scrubbed
}

// ─────────────────────────────────────────────────────────────────────────────
// Event queue & flush
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_QUEUE: AuditEvent[] = []
const BATCH_SIZE = 20
const FLUSH_INTERVAL_MS = 5000
let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _flushPending = false

/** Build a complete AuditEvent from partial input */
function buildEvent(
  params: Omit<AuditEvent, "eventId" | "timestamp" | "sessionId" | "correlationId" | "userId" | "userAgent">
): AuditEvent {
  return {
    eventId: generateId(),
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    correlationId: getCorrelationId(),
    userId: _userId ?? undefined,
    userAgent:
      typeof navigator !== "undefined"
        ? navigator.userAgent.slice(0, 120)
        : undefined,
    ...params,
    metadata: params.metadata ? scrubMetadata(params.metadata) : undefined,
  }
}

/** Flush all queued events to the ingest endpoint */
async function flushEvents(): Promise<void> {
  if (_flushPending || EVENT_QUEUE.length === 0) return

  _flushPending = true
  const batch = EVENT_QUEUE.splice(0, BATCH_SIZE)

  try {
    if (process.env.NODE_ENV === "production") {
      await fetch("/api/proxy/api/v1/audit/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ events: batch }),
        // Use keepalive so events ship even on page unload
        keepalive: true,
      })
    } else {
      // Development: structured console output
      batch.forEach((ev) => {
        const prefix = `[AUDIT][${ev.category}][${ev.severity.toUpperCase()}]`
        console.log(`${prefix} ${ev.action}`, {
          eventId: ev.eventId,
          sessionId: ev.sessionId,
          correlationId: ev.correlationId,
          userId: ev.userId,
          metadata: ev.metadata,
        })
      })
    }
  } catch {
    // Re-queue on failure (best-effort; drop after 2 retries to avoid unbounded growth)
    if (batch[0] && (batch[0] as AuditEvent & { _retries?: number })._retries !== 2) {
      batch.forEach((ev) => {
        (ev as AuditEvent & { _retries?: number })._retries =
          ((ev as AuditEvent & { _retries?: number })._retries ?? 0) + 1
      })
      EVENT_QUEUE.unshift(...batch)
    }
  } finally {
    _flushPending = false
  }
}

function scheduleFlush(): void {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    flushEvents()
  }, FLUSH_INTERVAL_MS)
}

// Flush on page unload (best-effort)
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushEvents()
    }
  })
  window.addEventListener("beforeunload", () => {
    flushEvents()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Core emit function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit an audit event.
 * Safe to call from anywhere — client components, server actions, hooks.
 * All events are PII-scrubbed and batched before sending.
 */
export function auditLog(
  params: Omit<AuditEvent, "eventId" | "timestamp" | "sessionId" | "correlationId" | "userId" | "userAgent">
): void {
  try {
    const event = buildEvent(params)
    EVENT_QUEUE.push(event)

    // Flush immediately on high severity
    if (event.severity === "critical" || event.severity === "error") {
      flushEvents()
    } else if (EVENT_QUEUE.length >= BATCH_SIZE) {
      flushEvents()
    } else {
      scheduleFlush()
    }
  } catch {
    // Audit logging must NEVER throw or interrupt user flows
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed helpers for each event category
// ─────────────────────────────────────────────────────────────────────────────

/** Log a user UI action (button click, modal open, form submit, etc.) */
export function auditUserAction(
  action: string,
  metadata?: Record<string, unknown>,
  source?: string
): void {
  auditLog({
    category: "USER_ACTION",
    severity: "info",
    action,
    metadata,
    source,
  })
}

/** Log an API call with method, endpoint, status code, and latency */
export function auditApiCall(params: {
  method: string
  endpoint: string
  statusCode?: number
  latencyMs?: number
  requestId?: string
  error?: string
  metadata?: Record<string, unknown>
}): void {
  const severity: AuditEventSeverity =
    params.statusCode && params.statusCode >= 500
      ? "error"
      : params.statusCode && params.statusCode >= 400
      ? "warn"
      : "info"

  auditLog({
    category: "API_CALL",
    severity,
    action: `api.${params.method.toLowerCase()}.${params.endpoint.replace(/\//g, ".").replace(/^\./, "")}`,
    requestId: params.requestId,
    metadata: {
      method: params.method,
      endpoint: params.endpoint,
      statusCode: params.statusCode,
      latencyMs: params.latencyMs,
      ...(params.error ? { error: params.error } : {}),
      ...params.metadata,
    },
  })
}

/** Log a session lifecycle event */
export function auditSession(
  event: "start" | "end" | "refresh" | "idle_timeout" | "absolute_timeout",
  metadata?: Record<string, unknown>
): void {
  auditLog({
    category: "SESSION",
    severity: event.includes("timeout") ? "warn" : "info",
    action: `session.${event}`,
    metadata,
  })
}

/** Log an auth event */
export function auditAuth(
  event:
    | "login.success"
    | "login.failed"
    | "login.google"
    | "logout"
    | "register.success"
    | "register.failed"
    | "password.reset"
    | "mfa.success"
    | "mfa.failed",
  metadata?: Record<string, unknown>
): void {
  const severity: AuditEventSeverity =
    event.includes("failed") ? "warn" : "info"

  auditLog({
    category: "AUTH",
    severity,
    action: `auth.${event}`,
    metadata,
  })
}

/** Log a security event */
export function auditSecurity(
  event: string,
  severity: AuditEventSeverity = "warn",
  metadata?: Record<string, unknown>
): void {
  auditLog({
    category: "SECURITY",
    severity,
    action: `security.${event}`,
    metadata,
  })
}

/** Log a vault access event */
export function auditVault(
  event:
    | "document.viewed"
    | "document.uploaded"
    | "document.deleted"
    | "document.shared"
    | "document.downloaded"
    | "search.executed"
    | "key.generated"
    | "key.rotated"
    | "proof.generated",
  documentId?: string,
  metadata?: Record<string, unknown>
): void {
  auditLog({
    category: "VAULT",
    severity: "info",
    action: `vault.${event}`,
    metadata: {
      ...(documentId ? { documentId } : {}),
      ...metadata,
    },
  })
}

/** Log a PII detection/scrubbing event */
export function auditPiiEvent(
  event: "detected" | "scrubbed" | "bypass_attempt",
  context?: string,
  metadata?: Record<string, unknown>
): void {
  auditLog({
    category: "PII",
    severity: event === "bypass_attempt" ? "error" : "warn",
    action: `pii.${event}`,
    source: context,
    metadata,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// API call instrumentation wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a fetch call with automatic audit logging.
 *
 * Usage:
 *   const res = await auditedFetch("/api/proxy/api/v1/chat", { method: "POST", body: ... })
 */
export async function auditedFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase()
  const startMs = Date.now()

  // Strip query params from endpoint for logging (may contain PII)
  let endpoint = url
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://x")
    endpoint = parsed.pathname
  } catch {
    endpoint = url.split("?")[0]
  }

  // Inject correlation ID header
  const headers = new Headers(init.headers)
  headers.set("X-Correlation-Id", getCorrelationId())
  headers.set("X-Session-Id", getSessionId())

  try {
    const response = await fetch(url, { ...init, headers })

    const latencyMs = Date.now() - startMs
    const requestId = response.headers.get("x-request-id") ?? undefined

    auditApiCall({
      method,
      endpoint,
      statusCode: response.status,
      latencyMs,
      requestId,
    })

    return response
  } catch (err) {
    const latencyMs = Date.now() - startMs

    auditApiCall({
      method,
      endpoint,
      latencyMs,
      error: err instanceof Error ? err.message : "fetch_failed",
    })

    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit event helper (called from rate-limiter integration)
// ─────────────────────────────────────────────────────────────────────────────

export function auditRateLimitHit(group: string, endpoint: string): void {
  auditSecurity("rate_limit_hit", "warn", { group, endpoint })
}

// ─────────────────────────────────────────────────────────────────────────────
// Export flush for testing / forced flush
// ─────────────────────────────────────────────────────────────────────────────

export { flushEvents as flushAuditEvents }
