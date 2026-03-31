"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getSession, type Session } from "@/lib/api"

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
      } else {
        setUser(null)
        setSession(null)
      }
    } catch (error) {
      console.error("Failed to load session:", error)
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
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