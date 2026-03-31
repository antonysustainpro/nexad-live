"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { ButlerPersona, ButlerCategory } from "@/lib/types"
import { sanitizeParsedJson } from "@/lib/utils"

type Language = "ar" | "en" | "bilingual"
type Theme = "dark" | "light" | "system"

interface UserPreferences {
  name: string
  avatarUrl: string | null
  voice: string
  personality: "professional" | "friendly" | "direct" | "adaptive"
  formalCasual: number
  conciseDetailed: number
  languageBalance: number
  hasCompletedOnboarding: boolean
  vaultId: string | null
  keyFingerprint: string | null
  // Sound settings
  sendSound: boolean
  arriveSound: boolean
  successSound: boolean
  masterVolume: number
  // Privacy settings
  localProcessingOnly: boolean
  biometricLock: boolean
  autoLockTimeout: string
  pushNotifications: boolean
  // Appearance settings
  fontSize: "small" | "medium" | "large"
  // Butler preferences
  butlerPersona: ButlerPersona | null
  butlerOnboarded: boolean
  butlerCategories: ButlerCategory[]
  butlerTone: "formal" | "casual" | "brief"
}

interface NexusContextType {
  language: Language
  setLanguage: (lang: Language) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  isRTL: boolean
  preferences: UserPreferences
  updatePreferences: (prefs: Partial<UserPreferences>) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

const defaultPreferences: UserPreferences = {
  name: "",
  avatarUrl: null,
  voice: "default",
  personality: "professional",
  formalCasual: 70,
  conciseDetailed: 50,
  languageBalance: 50,
  hasCompletedOnboarding: false,
  vaultId: null,
  keyFingerprint: null,
  // Sound settings
  sendSound: false,
  arriveSound: false,
  successSound: false,
  masterVolume: 15,
  // Privacy settings
  localProcessingOnly: false,
  biometricLock: true,
  autoLockTimeout: "5",
  pushNotifications: true,
  // Appearance settings
  fontSize: "medium",
  // Butler preferences
  butlerPersona: null,
  butlerOnboarded: false,
  butlerCategories: [],
  butlerTone: "casual",
}

// SEC-SM-R3-003: Validate individual preference fields from localStorage.
// Tampered localStorage can inject arbitrary types/values. This function validates
// each field against its expected type, allowed values, and range before merging
// over defaults. Unknown or invalid fields are silently dropped.
function validatePreferences(raw: Record<string, unknown>): UserPreferences {
  const prefs = { ...defaultPreferences }

  // String fields with allowed values
  const VALID_PERSONALITIES = ["professional", "friendly", "direct", "adaptive"] as const
  const VALID_FONT_SIZES = ["small", "medium", "large"] as const
  const VALID_BUTLER_TONES = ["formal", "casual", "brief"] as const
  const VALID_AUTO_LOCK = ["1", "5", "15", "30", "60", "never"] as const

  // Validate string with maxlength
  if (typeof raw.name === "string") prefs.name = raw.name.slice(0, 200)
  if (typeof raw.voice === "string") prefs.voice = raw.voice.slice(0, 100)

  // Validate avatarUrl (string or null)
  if (raw.avatarUrl === null) prefs.avatarUrl = null
  else if (typeof raw.avatarUrl === "string") prefs.avatarUrl = raw.avatarUrl.slice(0, 2048)

  // Validate enum fields
  if (typeof raw.personality === "string" && (VALID_PERSONALITIES as readonly string[]).includes(raw.personality)) {
    prefs.personality = raw.personality as typeof prefs.personality
  }
  if (typeof raw.fontSize === "string" && (VALID_FONT_SIZES as readonly string[]).includes(raw.fontSize)) {
    prefs.fontSize = raw.fontSize as typeof prefs.fontSize
  }
  if (typeof raw.butlerTone === "string" && (VALID_BUTLER_TONES as readonly string[]).includes(raw.butlerTone)) {
    prefs.butlerTone = raw.butlerTone as typeof prefs.butlerTone
  }
  if (typeof raw.autoLockTimeout === "string" && (VALID_AUTO_LOCK as readonly string[]).includes(raw.autoLockTimeout)) {
    prefs.autoLockTimeout = raw.autoLockTimeout
  }

  // Validate numeric fields (clamp to valid range)
  if (typeof raw.formalCasual === "number" && Number.isFinite(raw.formalCasual)) {
    prefs.formalCasual = Math.max(0, Math.min(100, raw.formalCasual))
  }
  if (typeof raw.conciseDetailed === "number" && Number.isFinite(raw.conciseDetailed)) {
    prefs.conciseDetailed = Math.max(0, Math.min(100, raw.conciseDetailed))
  }
  if (typeof raw.languageBalance === "number" && Number.isFinite(raw.languageBalance)) {
    prefs.languageBalance = Math.max(0, Math.min(100, raw.languageBalance))
  }
  if (typeof raw.masterVolume === "number" && Number.isFinite(raw.masterVolume)) {
    prefs.masterVolume = Math.max(0, Math.min(100, raw.masterVolume))
  }

  // Validate boolean fields
  const booleanFields = [
    "hasCompletedOnboarding", "sendSound", "arriveSound", "successSound",
    "localProcessingOnly", "biometricLock", "pushNotifications", "butlerOnboarded"
  ] as const
  for (const field of booleanFields) {
    if (typeof raw[field] === "boolean") {
      (prefs as Record<string, unknown>)[field] = raw[field]
    }
  }

  // Validate butlerPersona (object or null) - only accept if it's an object with expected shape
  if (raw.butlerPersona === null) {
    prefs.butlerPersona = null
  } else if (raw.butlerPersona && typeof raw.butlerPersona === "object" && !Array.isArray(raw.butlerPersona)) {
    prefs.butlerPersona = raw.butlerPersona as unknown as ButlerPersona
  }

  // Validate butlerCategories (array of strings only)
  if (Array.isArray(raw.butlerCategories)) {
    prefs.butlerCategories = raw.butlerCategories
      .filter((c): c is ButlerCategory => typeof c === "string")
      .slice(0, 50) // Reasonable upper limit
  }

  return prefs
}

const NexusContext = createContext<NexusContextType | undefined>(undefined)

export function NexusProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")
  const [theme, setThemeState] = useState<Theme>("dark")
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // FIX 13: Hydrate from localStorage with try/catch for Safari private mode
    let savedLanguage: Language | null = null
    let savedTheme: Theme | null = null
    let savedPreferences: string | null = null
    let savedSidebarCollapsed: string | null = null
    
    try {
      savedLanguage = localStorage.getItem("nexus-language") as Language | null
      savedTheme = localStorage.getItem("nexus-theme") as Theme | null
      savedPreferences = localStorage.getItem("nexus-preferences")
      savedSidebarCollapsed = localStorage.getItem("nexus-sidebar-collapsed")
    } catch {
      // Safari private mode - use defaults
    }

    // SEC-SM-005: Validate localStorage values before trusting them — tampered values
    // could cause unexpected behavior or be injected into cookies/DOM attributes.
    const VALID_LANGUAGES: Language[] = ["ar", "en", "bilingual"]
    const VALID_THEMES: Theme[] = ["dark", "light", "system"]
    if (savedLanguage && VALID_LANGUAGES.includes(savedLanguage)) setLanguageState(savedLanguage)
    if (savedTheme && VALID_THEMES.includes(savedTheme)) setThemeState(savedTheme)
    if (savedPreferences) {
      try {
        // SEC-UI-108: Sanitize parsed preferences to prevent prototype pollution
        const parsed = sanitizeParsedJson(JSON.parse(savedPreferences))
        // SEC-SM-006: Never restore vaultId/keyFingerprint from localStorage.
        // These are security-sensitive and must be fetched fresh from server.
        if (parsed && typeof parsed === "object") {
          delete (parsed as Record<string, unknown>).vaultId
          delete (parsed as Record<string, unknown>).keyFingerprint
        }
        // SEC-SM-R3-003: Validate each preference field type/range before accepting.
        // A tampered localStorage could inject unexpected types (e.g., personality="<script>")
        // or out-of-range values (masterVolume=99999). Merge only validated fields over defaults.
        const validated = validatePreferences(parsed as Record<string, unknown>)
        setPreferences(validated)
      } catch {
        // Invalid JSON, use defaults
      }
    }
    if (savedSidebarCollapsed) setSidebarCollapsed(savedSidebarCollapsed === "true")
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Apply theme
    const root = document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }

    try {
      localStorage.setItem("nexus-theme", theme)
    } catch {
      // Safari private mode or quota exceeded
    }
  }, [theme, mounted])

  useEffect(() => {
    if (!mounted) return

    // Apply RTL
    const root = document.documentElement
    if (language === "ar") {
      root.setAttribute("dir", "rtl")
      root.setAttribute("lang", "ar")
      document.body.style.fontFamily = "var(--font-arabic)"
    } else {
      root.setAttribute("dir", "ltr")
      root.setAttribute("lang", language === "bilingual" ? "ar-en" : "en")
      document.body.style.fontFamily = ""
    }

    try {
      localStorage.setItem("nexus-language", language)
    } catch {
      // Safari private mode or quota exceeded
    }

    // SEC-SM-005: Validate language value before writing to cookie to prevent cookie injection.
    // Only allow known language codes — if someone tampers with state, reject the write.
    const VALID_LANGUAGES = ["ar", "en", "bilingual"]
    if (VALID_LANGUAGES.includes(language)) {
      document.cookie = `nexus-language=${language};path=/;max-age=${60 * 60 * 24 * 365};Secure;SameSite=Lax`
    }
  }, [language, mounted])

  // FIX 9: Restore font size on page load
  useEffect(() => {
    if (!mounted || !preferences.fontSize) return
    const fontSizeMap: Record<string, string> = {
      small: "14px",
      medium: "16px",
      large: "18px"
    }
    document.documentElement.style.fontSize = fontSizeMap[preferences.fontSize] || "16px"
  }, [mounted, preferences.fontSize])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const updatePreferences = (prefs: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev, ...prefs }
      if (mounted) {
        try {
          // SEC-SM-006: Strip sensitive cryptographic identifiers before persisting to localStorage.
          // vaultId and keyFingerprint are security-sensitive values that should only live in
          // React state (memory), not in plaintext localStorage where XSS or physical access
          // can harvest them. They are re-fetched from the server on each session.
          const { vaultId: _v, keyFingerprint: _k, ...safePrefs } = newPrefs
          localStorage.setItem("nexus-preferences", JSON.stringify(safePrefs))
        } catch {
          // Safari private mode or quota exceeded
        }
      }
      return newPrefs
    })
  }

  const isRTL = language === "ar"

  return (
    <NexusContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        isRTL,
        preferences,
        updatePreferences,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </NexusContext.Provider>
  )
}

export function useNexus() {
  const context = useContext(NexusContext)
  if (!context) {
    throw new Error("useNexus must be used within a NexusProvider")
  }
  return context
}
