"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import { getSession, type Session } from "@/lib/api"
import { scrubSessionStoragePii } from "@/lib/utils"
import { auditSession, setAuditUserId } from "@/lib/audit-logger"

interface User {
  id: string
  email?: string
  name?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // AUD-005: Track whether a session was already started to avoid duplicate events
  const sessionStartedRef = useRef(false)

  const loadSession = async () => {
    try {
      const sessionData = await getSession()
      if (sessionData && sessionData.user) {
        setSession(sessionData)
        setUser({
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
        })
        // AUD-005: Register user ID for all subsequent audit events (hashed/opaque ID only)
        setAuditUserId(sessionData.user.id)
        // AUD-005: Log session start once per mount
        if (!sessionStartedRef.current) {
          sessionStartedRef.current = true
          auditSession("start")
        } else {
          auditSession("refresh")
        }
      } else {
        if (sessionStartedRef.current) {
          auditSession("end")
          sessionStartedRef.current = false
        }
        setAuditUserId(null)
        setUser(null)
        setSession(null)
      }
    } catch (error) {
      console.error("Failed to load session:", error)
      setAuditUserId(null)
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
    // SEC-PII-STORAGE-001: Scrub any PII that may have accumulated in sessionStorage
    // from transient form state (e.g. billing tier selection that could contain user input).
    // Run once on mount so the scan covers the full page lifecycle.
    scrubSessionStoragePii()
    // AUD-005: Log session end when the component unmounts (tab/window closed)
    return () => {
      if (sessionStartedRef.current) {
        auditSession("end")
        sessionStartedRef.current = false
        setAuditUserId(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshSession = async () => {
    setLoading(true)
    await loadSession()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}