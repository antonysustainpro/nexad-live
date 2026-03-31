/**
 * useAudit — React hook for client-side audit logging
 *
 * Provides a stable API for logging user actions, API calls, and security
 * events from any component. All calls are forwarded to the audit-logger
 * which handles batching, PII scrubbing, and shipping.
 *
 * Usage:
 *   const { logAction, logVault, logSecurity } = useAudit()
 *   <button onClick={() => logAction("chat.message.sent", { model: tier })}>Send</button>
 */

"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  auditUserAction,
  auditVault,
  auditSecurity,
  auditSession,
  auditAuth,
  auditApiCall,
  newCorrelationId,
  type AuditEventSeverity,
} from "@/lib/audit-logger"

export interface UseAuditReturn {
  /** Log a generic user UI action */
  logAction: (action: string, metadata?: Record<string, unknown>) => void
  /** Log a vault access event */
  logVault: (
    event: Parameters<typeof auditVault>[0],
    documentId?: string,
    metadata?: Record<string, unknown>
  ) => void
  /** Log a security event */
  logSecurity: (
    event: string,
    severity?: AuditEventSeverity,
    metadata?: Record<string, unknown>
  ) => void
  /** Log an auth event */
  logAuth: (event: Parameters<typeof auditAuth>[0], metadata?: Record<string, unknown>) => void
  /** Log an API call result */
  logApiCall: (params: Parameters<typeof auditApiCall>[0]) => void
  /** Start a new correlation scope */
  startCorrelation: () => string
}

export function useAudit(): UseAuditReturn {
  const pathname = usePathname()
  const source = pathname ?? "unknown"

  const logAction = useCallback(
    (action: string, metadata?: Record<string, unknown>) => {
      auditUserAction(action, metadata, source)
    },
    [source]
  )

  const logVault = useCallback(
    (
      event: Parameters<typeof auditVault>[0],
      documentId?: string,
      metadata?: Record<string, unknown>
    ) => {
      auditVault(event, documentId, { ...metadata, source })
    },
    [source]
  )

  const logSecurity = useCallback(
    (
      event: string,
      severity: AuditEventSeverity = "warn",
      metadata?: Record<string, unknown>
    ) => {
      auditSecurity(event, severity, { ...metadata, source })
    },
    [source]
  )

  const logAuth = useCallback(
    (event: Parameters<typeof auditAuth>[0], metadata?: Record<string, unknown>) => {
      auditAuth(event, { ...metadata, source })
    },
    [source]
  )

  const logApiCall = useCallback((params: Parameters<typeof auditApiCall>[0]) => {
    auditApiCall(params)
  }, [])

  const startCorrelation = useCallback(() => {
    return newCorrelationId()
  }, [])

  return { logAction, logVault, logSecurity, logAuth, logApiCall, startCorrelation }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-level navigation audit hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Automatically logs page views and starts a new correlation ID on navigation.
 * Mount once in the root layout or app shell.
 */
export function usePageAudit(): void {
  const pathname = usePathname()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    if (pathname === prevPath.current) return
    prevPath.current = pathname

    // Start fresh correlation scope on every page navigation
    newCorrelationId()

    auditUserAction("page.view", { path: pathname }, pathname)
  }, [pathname])
}

// ─────────────────────────────────────────────────────────────────────────────
// Session audit hook — log session lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logs session start on mount and session end on unmount.
 * Mount in AuthProvider.
 */
export function useSessionAudit(isAuthenticated: boolean): void {
  const sessionStarted = useRef(false)

  useEffect(() => {
    if (isAuthenticated && !sessionStarted.current) {
      sessionStarted.current = true
      auditSession("start")
    }
  }, [isAuthenticated])

  useEffect(() => {
    return () => {
      if (sessionStarted.current) {
        auditSession("end")
        sessionStarted.current = false
      }
    }
  }, [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Idle timeout audit hook
// ─────────────────────────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Detects user idle (no interaction for 15 min) and logs idle_timeout event.
 */
export function useIdleAudit(): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        auditSession("idle_timeout")
      }, IDLE_TIMEOUT_MS)
    }

    const events = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"]
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [])
}
