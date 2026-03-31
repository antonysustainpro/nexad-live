"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Shield, Lock, X, ChevronDown, ChevronUp,
  User, Briefcase, Target, FileText, Trash2
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn, sanitizeParsedJson } from "@/lib/utils"

// ============================================================================
// AES-256-GCM ENCRYPTION UTILITIES (Web Crypto API)
// ============================================================================

const STORAGE_KEY = "nexusad-client-profile"
const VAULT_KEY_IDENTIFIER = "nexusad-vault-key-v1"

/**
 * Gets or generates a persistent encryption key identifier.
 * This is stored separately and used to derive the encryption key.
 */
function getVaultKeyMaterial(): string {
  if (typeof window === "undefined") return ""

  let keyMaterial = localStorage.getItem(VAULT_KEY_IDENTIFIER)
  if (!keyMaterial) {
    // Generate a random 32-byte key material (stored as base64)
    const randomBytes = crypto.getRandomValues(new Uint8Array(32))
    keyMaterial = btoa(String.fromCharCode(...randomBytes))
    localStorage.setItem(VAULT_KEY_IDENTIFIER, keyMaterial)
  }
  return keyMaterial
}

/**
 * Encrypts data using AES-256-GCM with PBKDF2 key derivation.
 * Format: base64(salt[16] + iv[12] + ciphertext)
 */
async function encryptVaultData(data: string, password: string): Promise<string> {
  const enc = new TextEncoder()

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  // Derive AES-256-GCM key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  )

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  )

  // Combine salt + iv + ciphertext into single array
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)

  // Return as base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts data encrypted with encryptVaultData.
 * Extracts salt and IV from the combined payload.
 */
async function decryptVaultData(encryptedBase64: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const dec = new TextDecoder()

  // Decode base64 to bytes
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

  // Extract salt (first 16 bytes), IV (next 12 bytes), and ciphertext (rest)
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  // Derive the same key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  )

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )

  return dec.decode(decrypted)
}

/**
 * Checks if stored data is in the old unencrypted format.
 * Unencrypted data starts with '{' (JSON object).
 */
function isUnencryptedData(data: string): boolean {
  try {
    // If it parses as JSON and looks like our profile, it's unencrypted
    const parsed = JSON.parse(data)
    return typeof parsed === "object" && parsed !== null && "entityName" in parsed
  } catch {
    // If it doesn't parse as JSON, it might be encrypted base64
    return false
  }
}

// ============================================================================

interface ClientProfile {
  // About You
  entityName: string
  entityType: "individual" | "family_office" | "corporate" | "fund" | "holding_company" | ""
  jurisdictions: string[]
  teamSize: number
  primaryLanguage: "english" | "arabic" | "bilingual"
  // Investment Profile
  riskAppetite: number
  assetFocus: string[]
  annualBudget: string
  timeHorizon: string
  // Strategic Context
  currentGoals: string
  keyCompetitors: string
  openMatters: string
  // Report Preferences
  reportStyle: "concise" | "comprehensive" | "quantitative"
  favoriteSections: string[]
  autoIncludeTax: boolean
  autoIncludeBenchmark: boolean
  autoIncludeTimeline: boolean
  lastUpdated: string | null
}

const defaultProfile: ClientProfile = {
  entityName: "",
  entityType: "",
  jurisdictions: [],
  teamSize: 0,
  primaryLanguage: "english",
  riskAppetite: 5,
  assetFocus: [],
  annualBudget: "",
  timeHorizon: "",
  currentGoals: "",
  keyCompetitors: "",
  openMatters: "",
  reportStyle: "comprehensive",
  favoriteSections: [],
  autoIncludeTax: true,
  autoIncludeBenchmark: false,
  autoIncludeTimeline: true,
  lastUpdated: null,
}

interface ClientVaultPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ClientVaultPanel({ isOpen, onClose }: ClientVaultPanelProps) {
  const { language, isRTL } = useNexus()
  const [profile, setProfile] = useState<ClientProfile>(defaultProfile)
  const [expandedSections, setExpandedSections] = useState<string[]>(["about"])
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [encryptionReady, setEncryptionReady] = useState(false)

  // Load and decrypt profile from localStorage
  useEffect(() => {
    async function loadProfile() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) {
          setIsLoading(false)
          setEncryptionReady(true)
          return
        }

        const keyMaterial = getVaultKeyMaterial()

        // Check if data is in old unencrypted format (migration support)
        if (isUnencryptedData(saved)) {
          // Migrate: load unencrypted, then re-save encrypted
          const parsed = sanitizeParsedJson(JSON.parse(saved))
          setProfile(parsed)

          // Re-encrypt and save
          const encrypted = await encryptVaultData(JSON.stringify(parsed), keyMaterial)
          localStorage.setItem(STORAGE_KEY, encrypted)

          setEncryptionReady(true)
          setIsLoading(false)
          return
        }

        // Decrypt the data
        const decrypted = await decryptVaultData(saved, keyMaterial)
        // SEC-UI-109: Sanitize parsed profile to prevent prototype pollution
        setProfile(sanitizeParsedJson(JSON.parse(decrypted)))
        setEncryptionReady(true)
      } catch {
        // Decryption failed - could be corrupted or wrong key
        // Reset to defaults to prevent data exposure
        setProfile(defaultProfile)
        setEncryptionReady(true)
      }
      setIsLoading(false)
    }

    loadProfile()
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const updateProfile = (updates: Partial<ClientProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  const toggleArrayItem = (field: keyof ClientProfile, item: string) => {
    const currentArray = profile[field] as string[]
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item]
    updateProfile({ [field]: newArray })
  }

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    const updatedProfile = { ...profile, lastUpdated: new Date().toISOString() }
    try {
      const keyMaterial = getVaultKeyMaterial()
      // Encrypt profile data with AES-256-GCM before storing
      const encrypted = await encryptVaultData(JSON.stringify(updatedProfile), keyMaterial)
      localStorage.setItem(STORAGE_KEY, encrypted)
      setProfile(updatedProfile)
    } catch {
      // Handle encryption/storage error silently
    }
    setIsSaving(false)
  }, [profile])

  const handleClear = useCallback(() => {
    setProfile(defaultProfile)
    try {
      localStorage.removeItem(STORAGE_KEY)
      // Also remove the encryption key - fresh start
      localStorage.removeItem(VAULT_KEY_IDENTIFIER)
    } catch {
      // Handle error silently
    }
    setShowClearConfirm(false)
  }, [])

  const isProfileIncomplete = !profile.entityName || !profile.entityType

  const jurisdictionOptions = [
    "UAE Mainland", "DIFC", "ADGM", "JAFZA", "DMCC", "DAFZA", "Other"
  ]

  const assetOptions = [
    "Real Estate", "Equities", "Fixed Income", "Crypto/Digital", 
    "Private Equity", "Commodities", "Cash"
  ]

  const sectionOptions = [
    "Financial Analysis", "Legal/Regulatory", "Market Research", 
    "Risk Assessment", "Implementation Plan"
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: isRTL ? -480 : 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRTL ? -480 : 480, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed top-0 h-full w-[480px] max-w-[90vw] z-50 overflow-hidden",
              "flex flex-col",
              isRTL ? "left-0" : "right-0"
            )}
            style={{
              background: "rgba(15, 29, 50, 0.95)",
              backdropFilter: "blur(12px)",
              borderLeft: isRTL ? "none" : "1px solid rgba(255,255,255,0.08)",
              borderRight: isRTL ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            {/* Header */}
            <div className="p-6 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1628] flex items-center justify-center border border-[rgba(255,255,255,0.08)]">
                    <Lock className="h-5 w-5 text-[#D4A574]" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {language === "ar" ? "خزنتك السيادية" : "Your Sovereign Vault"}
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      {language === "ar" 
                        ? "سياقك يبقى مشفراً. فقط الذكاء الاصطناعي السيادي يمكنه الوصول إليه."
                        : "Your context stays encrypted. Only the sovereign AI can access it."
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                  aria-label={language === "ar" ? "إغلاق" : "Close"}
                >
                  <X className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
                </button>
              </div>
              
              {/* Privacy Badge */}
              <div className="flex items-center gap-2 mt-4">
                <Badge 
                  variant="outline" 
                  className="border-[#10B981]/30 text-[#10B981] text-[10px]"
                >
                  <Shield className="h-3 w-3 me-1" aria-hidden="true" />
                  AES-256-GCM {language === "ar" ? "مشفر" : "Encrypted"}
                </Badge>
                <Badge 
                  variant="outline" 
                  className="border-[#10B981]/30 text-[#10B981] text-[10px]"
                >
                  {language === "ar" ? "لا وصول خارجي" : "Zero External Access"}
                </Badge>
                {isProfileIncomplete && (
                  <Badge className="bg-[#FF006E] text-white text-[10px]">
                    {language === "ar" ? "غير مكتمل" : "Incomplete"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#94A3B8]">
                    {language === "ar" ? "جاري فك التشفير..." : "Decrypting vault..."}
                  </p>
                </div>
              )}

              {/* Section 1: About You */}
              {!isLoading && (
              <>
              <AccordionSection
                title={language === "ar" ? "عنك" : "About You"}
                icon={<User className="h-4 w-4" />}
                isExpanded={expandedSections.includes("about")}
                onToggle={() => toggleSection("about")}
                language={language}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "اسم الكيان" : "Entity Name"}
                    </label>
                    <Input
                      value={profile.entityName}
                      onChange={(e) => updateProfile({ entityName: e.target.value })}
                      placeholder={language === "ar" ? "مثال: مجموعة الخليج للاستثمار" : "e.g., Gulf Investment Group"}
                      className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "نوع الكيان" : "Entity Type"}
                    </label>
                    <Select 
                      value={profile.entityType} 
                      onValueChange={(v) => updateProfile({ entityType: v as ClientProfile["entityType"] })}
                    >
                      <SelectTrigger className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]">
                        <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select type"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">{language === "ar" ? "فرد" : "Individual"}</SelectItem>
                        <SelectItem value="family_office">{language === "ar" ? "مكتب عائلي" : "Family Office"}</SelectItem>
                        <SelectItem value="corporate">{language === "ar" ? "شركة" : "Corporate"}</SelectItem>
                        <SelectItem value="fund">{language === "ar" ? "صندوق" : "Fund"}</SelectItem>
                        <SelectItem value="holding_company">{language === "ar" ? "شركة قابضة" : "Holding Company"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "الولايات القضائية" : "Jurisdictions"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {jurisdictionOptions.map(j => (
                        <ChipToggle
                          key={j}
                          label={j}
                          isSelected={profile.jurisdictions.includes(j)}
                          onClick={() => toggleArrayItem("jurisdictions", j)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "حجم الفريق" : "Team Size"}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100000}
                      value={profile.teamSize || ""}
                      onChange={(e) => updateProfile({ teamSize: Math.max(0, Math.min(100000, parseInt(e.target.value) || 0)) })}
                      placeholder="0"
                      className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] w-24"
                    />
                  </div>
                </div>
              </AccordionSection>

              {/* Section 2: Investment Profile */}
              <AccordionSection
                title={language === "ar" ? "الملف الاستثماري" : "Investment Profile"}
                icon={<Briefcase className="h-4 w-4" />}
                isExpanded={expandedSections.includes("investment")}
                onToggle={() => toggleSection("investment")}
                language={language}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "شهية المخاطرة" : "Risk Appetite"} ({profile.riskAppetite}/10)
                    </label>
                    <div className="relative">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={profile.riskAppetite}
                        onChange={(e) => updateProfile({ riskAppetite: parseInt(e.target.value) })}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #10B981 0%, #F59E0B 50%, #EF4444 100%)`
                        }}
                      />
                      <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1">
                        <span>{language === "ar" ? "محافظ جداً" : "Ultra Conservative"}</span>
                        <span>{language === "ar" ? "متوازن" : "Balanced"}</span>
                        <span>{language === "ar" ? "عدواني" : "Aggressive"}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "تركيز الأصول" : "Asset Focus"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {assetOptions.map(a => (
                        <ChipToggle
                          key={a}
                          label={a}
                          isSelected={profile.assetFocus.includes(a)}
                          onClick={() => toggleArrayItem("assetFocus", a)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "الميزانية السنوية" : "Annual Investment Budget"}
                    </label>
                    <Select 
                      value={profile.annualBudget} 
                      onValueChange={(v) => updateProfile({ annualBudget: v })}
                    >
                      <SelectTrigger className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]">
                        <SelectValue placeholder={language === "ar" ? "اختر النطاق" : "Select range"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<1M">{"< AED 1M"}</SelectItem>
                        <SelectItem value="1-10M">AED 1-10M</SelectItem>
                        <SelectItem value="10-50M">AED 10-50M</SelectItem>
                        <SelectItem value="50-200M">AED 50-200M</SelectItem>
                        <SelectItem value="200M+">AED 200M+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "الأفق الزمني" : "Time Horizon"}
                    </label>
                    <Select 
                      value={profile.timeHorizon} 
                      onValueChange={(v) => updateProfile({ timeHorizon: v })}
                    >
                      <SelectTrigger className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]">
                        <SelectValue placeholder={language === "ar" ? "اختر المدة" : "Select duration"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<1">{"< 1 year"}</SelectItem>
                        <SelectItem value="1-3">1-3 years</SelectItem>
                        <SelectItem value="3-7">3-7 years</SelectItem>
                        <SelectItem value="7+">7+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionSection>

              {/* Section 3: Strategic Context */}
              <AccordionSection
                title={language === "ar" ? "السياق الاستراتيجي" : "Strategic Context"}
                icon={<Target className="h-4 w-4" />}
                isExpanded={expandedSections.includes("strategy")}
                onToggle={() => toggleSection("strategy")}
                language={language}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "الأهداف الحالية" : "Current Goals"}
                    </label>
                    <Textarea
                      value={profile.currentGoals}
                      onChange={(e) => updateProfile({ currentGoals: e.target.value })}
                      placeholder={language === "ar" 
                        ? "مثال: توسيع محفظة العقارات في دبي مارينا، استكشاف ترخيص VARA"
                        : "e.g., Expanding real estate portfolio in Dubai Marina, exploring VARA licensing for crypto fund"
                      }
                      className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] min-h-[80px]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "المنافسون الرئيسيون" : "Key Competitors"}
                    </label>
                    <Textarea
                      value={profile.keyCompetitors}
                      onChange={(e) => updateProfile({ keyCompetitors: e.target.value })}
                      placeholder={language === "ar" 
                        ? "مثال: أسماء الشركات التي تريد أن يقارن NexusAD معها"
                        : "e.g., Company names you want NexusAD to benchmark against"
                      }
                      className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] min-h-[60px]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "الأمور المفتوحة" : "Open Matters"}
                    </label>
                    <Textarea
                      value={profile.openMatters}
                      onChange={(e) => updateProfile({ openMatters: e.target.value })}
                      placeholder={language === "ar" 
                        ? "مثال: طلب التأشيرة الذهبية قيد التنفيذ، تجديد رخصة DED مستحق في الربع الثاني"
                        : "e.g., Golden Visa application in progress, DED trade license renewal due Q2"
                      }
                      className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] min-h-[60px]"
                    />
                  </div>
                </div>
              </AccordionSection>

              {/* Section 4: Report Preferences */}
              <AccordionSection
                title={language === "ar" ? "تفضيلات التقرير" : "Report Preferences"}
                icon={<FileText className="h-4 w-4" />}
                isExpanded={expandedSections.includes("reports")}
                onToggle={() => toggleSection("reports")}
                language={language}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-2 block">
                      {language === "ar" ? "نمط التقرير" : "Report Style"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["concise", "comprehensive", "quantitative"] as const).map(style => (
                        <button
                          key={style}
                          onClick={() => updateProfile({ reportStyle: style })}
                          className={cn(
                            "p-3 rounded-lg text-xs text-center transition-all",
                            "border",
                            profile.reportStyle === style
                              ? "bg-[#2563EB]/20 border-[#2563EB] text-white"
                              : "bg-[#0A1628] border-[rgba(255,255,255,0.08)] text-[#94A3B8] hover:border-[#2563EB]/50"
                          )}
                        >
                          {style === "concise" && (language === "ar" ? "موجز تنفيذي" : "Concise Executive")}
                          {style === "comprehensive" && (language === "ar" ? "شامل ومفصل" : "Comprehensive Detail")}
                          {style === "quantitative" && (language === "ar" ? "بيانات كمية" : "Data-Heavy")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">
                      {language === "ar" ? "الأقسام المفضلة" : "Favorite Sections"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sectionOptions.map(s => (
                        <ChipToggle
                          key={s}
                          label={s}
                          isSelected={profile.favoriteSections.includes(s)}
                          onClick={() => toggleArrayItem("favoriteSections", s)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-xs text-[#94A3B8] block">
                      {language === "ar" ? "تضمين تلقائي في التقارير" : "Auto-include in reports"}
                    </label>
                    <ToggleRow
                      label={language === "ar" ? "تأثير الضرائب الإماراتية" : "UAE Tax Impact"}
                      checked={profile.autoIncludeTax}
                      onChange={(v) => updateProfile({ autoIncludeTax: v })}
                    />
                    <ToggleRow
                      label={language === "ar" ? "المقارنة المعيارية التنافسية" : "Competitive Benchmarking"}
                      checked={profile.autoIncludeBenchmark}
                      onChange={(v) => updateProfile({ autoIncludeBenchmark: v })}
                    />
                    <ToggleRow
                      label={language === "ar" ? "الجدول الزمني/المعالم" : "Timeline/Milestones"}
                      checked={profile.autoIncludeTimeline}
                      onChange={(v) => updateProfile({ autoIncludeTimeline: v })}
                    />
                  </div>
                </div>
              </AccordionSection>
              </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[rgba(255,255,255,0.08)] space-y-3">
              {profile.lastUpdated && (
                <p className="text-[10px] text-[#94A3B8]">
                  {language === "ar" ? "آخر تحديث:" : "Last updated:"} {new Date(profile.lastUpdated).toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              )}
              
              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white"
                >
                  {isSaving 
                    ? (language === "ar" ? "جاري الحفظ..." : "Saving...")
                    : (language === "ar" ? "حفظ الملف" : "Save Profile")
                  }
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              
              <p className="text-[10px] text-[#94A3B8] text-center">
                {language === "ar"
                  ? "ملفك الشخصي مخزن محلياً في متصفحك. لا يمكن لأي نموذج ذكاء اصطناعي خارجي الوصول إلى هذه البيانات."
                  : "Your profile is stored locally in your browser. No external AI model can access this data."
                }
              </p>
            </div>

            {/* Clear Confirmation Dialog */}
            <AnimatePresence>
              {showClearConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="bg-[#0F1D32] rounded-xl p-6 max-w-sm"
                  >
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {language === "ar" ? "مسح جميع البيانات؟" : "Clear All Data?"}
                    </h3>
                    <p className="text-sm text-[#94A3B8] mb-4">
                      {language === "ar" 
                        ? "سيؤدي هذا إلى حذف جميع معلومات ملفك الشخصي نهائياً. لا يمكن التراجع عن هذا الإجراء."
                        : "This will permanently delete all your profile information. This action cannot be undone."
                      }
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1"
                      >
                        {language === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button
                        onClick={handleClear}
                        className="flex-1 bg-[#EF4444] hover:bg-[#EF4444]/90 text-white"
                      >
                        {language === "ar" ? "مسح الكل" : "Clear All"}
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function AccordionSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  language,
}: {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  language: string
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full p-4 flex items-center justify-between bg-[#0A1628] hover:bg-[#0A1628]/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#2563EB]" aria-hidden="true">{icon}</span>
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-[rgba(15,29,50,0.5)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChipToggle({
  label,
  isSelected,
  onClick,
}: {
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs transition-all",
        isSelected
          ? "bg-[#2563EB] text-white"
          : "bg-[#0A1628] text-[#94A3B8] border border-[rgba(255,255,255,0.08)] hover:border-[#2563EB]/50"
      )}
    >
      {label}
    </button>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}

// Header button trigger for the vault panel
export function ClientVaultTrigger({ 
  onClick, 
  isIncomplete 
}: { 
  onClick: () => void
  isIncomplete?: boolean 
}) {
  const { language } = useNexus()
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-lg transition-all",
        "bg-[#0A1628] border border-[rgba(255,255,255,0.08)]",
        "hover:border-[#2563EB]/50 hover:bg-[#0A1628]/80"
      )}
      aria-label={language === "ar" ? "فتح الخزنة" : "Open Vault"}
    >
      <Shield className="h-5 w-5 text-[#D4A574]" aria-hidden="true" />
      {isIncomplete && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FF006E] motion-safe:animate-pulse" />
      )}
    </button>
  )
}
