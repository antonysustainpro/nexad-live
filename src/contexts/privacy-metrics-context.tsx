"use client"

import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react"

/**
 * Privacy Metrics Context
 *
 * Tracks REAL privacy actions taken during a user session:
 * - PII items scrubbed from chat messages (from actual API metadata)
 * - Anonymous requests made (count of API calls routed through privacy proxy)
 * - Blocked trackers (if we intercept any tracking attempts)
 * - Fetch log of actual API requests with timestamps
 *
 * This replaces the fake/hardcoded metrics with real session data.
 */

export interface FetchLogEntry {
  url: string
  timestamp: string
  proxyRegion: string
  status: string
  piiScrubbed?: number
}

export interface PrivacyMetrics {
  // Cumulative counts for current session
  piiItemsScrubbed: number
  anonymousRequests: number
  trackersBlocked: number

  // Session start time for countdown calculation
  sessionStartTime: number

  // Recent fetch log (last 10 entries)
  fetchLog: FetchLogEntry[]
}

type PrivacyAction =
  | { type: "ADD_PII_SCRUBBED"; count: number }
  | { type: "ADD_ANONYMOUS_REQUEST"; entry?: FetchLogEntry }
  | { type: "ADD_TRACKER_BLOCKED"; count?: number }
  | { type: "RESET_SESSION" }

const initialState: PrivacyMetrics = {
  piiItemsScrubbed: 0,
  anonymousRequests: 0,
  trackersBlocked: 0,
  sessionStartTime: Date.now(),
  fetchLog: [],
}

function privacyReducer(state: PrivacyMetrics, action: PrivacyAction): PrivacyMetrics {
  switch (action.type) {
    case "ADD_PII_SCRUBBED":
      return {
        ...state,
        piiItemsScrubbed: state.piiItemsScrubbed + action.count,
      }
    case "ADD_ANONYMOUS_REQUEST": {
      const newLog = action.entry
        ? [action.entry, ...state.fetchLog].slice(0, 10) // Keep last 10 entries
        : state.fetchLog
      return {
        ...state,
        anonymousRequests: state.anonymousRequests + 1,
        fetchLog: newLog,
      }
    }
    case "ADD_TRACKER_BLOCKED":
      return {
        ...state,
        trackersBlocked: state.trackersBlocked + (action.count || 1),
      }
    case "RESET_SESSION":
      return {
        ...initialState,
        sessionStartTime: Date.now(),
      }
    default:
      return state
  }
}

interface PrivacyMetricsContextType {
  metrics: PrivacyMetrics
  // Track PII scrubbing from chat API responses
  recordPiiScrubbed: (count: number) => void
  // Track an anonymous request (API call through privacy proxy)
  recordAnonymousRequest: (entry?: FetchLogEntry) => void
  // Track blocked trackers (if applicable)
  recordTrackerBlocked: (count?: number) => void
  // Reset session metrics
  resetSession: () => void
  // Calculate data auto-delete countdown (24h from session start)
  getAutoDeleteCountdown: () => string
}

const PrivacyMetricsContext = createContext<PrivacyMetricsContextType | undefined>(undefined)

export function PrivacyMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, dispatch] = useReducer(privacyReducer, initialState)

  const recordPiiScrubbed = useCallback((count: number) => {
    if (count > 0) {
      dispatch({ type: "ADD_PII_SCRUBBED", count })
    }
  }, [])

  const recordAnonymousRequest = useCallback((entry?: FetchLogEntry) => {
    dispatch({ type: "ADD_ANONYMOUS_REQUEST", entry })
  }, [])

  const recordTrackerBlocked = useCallback((count?: number) => {
    dispatch({ type: "ADD_TRACKER_BLOCKED", count })
  }, [])

  const resetSession = useCallback(() => {
    dispatch({ type: "RESET_SESSION" })
  }, [])

  const getAutoDeleteCountdown = useCallback(() => {
    // Data auto-deletes 24 hours after session start
    const autoDeleteTime = metrics.sessionStartTime + (24 * 60 * 60 * 1000)
    const now = Date.now()
    const remainingMs = autoDeleteTime - now

    if (remainingMs <= 0) {
      return "0:00"
    }

    const hours = Math.floor(remainingMs / (60 * 60 * 1000))
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
    return `${hours}:${minutes.toString().padStart(2, "0")}`
  }, [metrics.sessionStartTime])

  return (
    <PrivacyMetricsContext.Provider
      value={{
        metrics,
        recordPiiScrubbed,
        recordAnonymousRequest,
        recordTrackerBlocked,
        resetSession,
        getAutoDeleteCountdown,
      }}
    >
      {children}
    </PrivacyMetricsContext.Provider>
  )
}

export function usePrivacyMetrics() {
  const context = useContext(PrivacyMetricsContext)
  if (!context) {
    throw new Error("usePrivacyMetrics must be used within a PrivacyMetricsProvider")
  }
  return context
}
