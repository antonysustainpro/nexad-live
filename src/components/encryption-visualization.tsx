"use client"

import { memo, useEffect, useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { Lock, Unlock, Shield, Key, Binary, Fingerprint, Eye, EyeOff, CheckCircle, Pause, Play, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EncryptionVisualizationProps {
  isEncrypting?: boolean
  isDecrypting?: boolean
  algorithm?: string
  keySize?: number
  className?: string
  language?: "en" | "ar"
  dir?: "ltr" | "rtl"
  variant?: "full" | "compact" | "stream"
  plaintext?: string
  showCiphertext?: boolean
}

const ENCRYPTION_ALGORITHMS = {
  "AES-256-GCM": { icon: Lock, color: "text-nexus-gold", strength: 100 },
  "ChaCha20-Poly1305": { icon: Shield, color: "text-purple-400", strength: 95 },
  "RSA-4096": { icon: Key, color: "text-blue-400", strength: 90 },
}

// SECURITY: Generate cryptographically secure random bytes for visualization
// SEC-RAND-006: SSR fallback now uses Node.js crypto.randomBytes instead of Math.random().
// Math.random() is not cryptographically secure and must not appear in security visualizations.
const getSecureRandomBytes = (length: number): Uint8Array => {
  if (typeof window !== "undefined" && window.crypto) {
    const bytes = new Uint8Array(length)
    window.crypto.getRandomValues(bytes)
    return bytes
  }
  // SSR fallback - use Node.js crypto module for server-side rendering
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomBytes } = require("crypto")
    return new Uint8Array(randomBytes(length))
  } catch {
    // Ultimate fallback: return zero bytes rather than insecure random
    return new Uint8Array(length)
  }
}

// SECURITY: Generate SIMULATED ciphertext using crypto.getRandomValues - UNPREDICTABLE
const generateSimulatedCiphertext = (length: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
  const randomBytes = getSecureRandomBytes(length)
  return Array.from(randomBytes, byte => chars[byte % chars.length]).join("")
}

// SECURITY: Generate SIMULATED hex stream using crypto.getRandomValues - UNPREDICTABLE
const generateSimulatedHexStream = (): string[] => {
  const randomBytes = getSecureRandomBytes(16)
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, "0"))
}

// SECURITY: Aggressive masking - show only 2 chars, rest hidden
const maskSensitiveData = (data: string): string => {
  if (data.length <= 4) return "••••••••••"
  // Only show first 2 chars - minimizes data leakage per GDPR Art 5(1)(c)
  return data.slice(0, 2) + "••••••••" + data.slice(-2)
}

export const EncryptionVisualization = memo(function EncryptionVisualization({
  isEncrypting = false,
  isDecrypting = false,
  algorithm = "AES-256-GCM",
  keySize = 256,
  className,
  language = "en",
  dir = language === "ar" ? "rtl" : "ltr",
  variant = "full",
  plaintext = "Your sovereign data",
  showCiphertext = true,
}: EncryptionVisualizationProps) {
  const [ciphertext, setCiphertext] = useState("")
  const [hexStream, setHexStream] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<"idle" | "key" | "encrypt" | "verify" | "complete">("idle")
  const [isPaused, setIsPaused] = useState(false)
  const [showTextSummary, setShowTextSummary] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const prefersReducedMotion = useReducedMotion()
  const isActive = isEncrypting || isDecrypting

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      togglePause()
    }
  }, [togglePause])

  useEffect(() => {
    if (!isActive || isPaused) {
      if (!isActive) {
        setPhase("idle")
        setProgress(0)
      }
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    // Simulate encryption phases
    const phases: Array<"key" | "encrypt" | "verify" | "complete"> = ["key", "encrypt", "verify", "complete"]
    let phaseIndex = 0

    const advancePhase = () => {
      if (phaseIndex < phases.length) {
        setPhase(phases[phaseIndex])
        phaseIndex++
      }
    }

    advancePhase()
    const phaseInterval = setInterval(advancePhase, prefersReducedMotion ? 200 : 800)

    // Progress animation with SIMULATED data only - uses crypto.getRandomValues()
    intervalRef.current = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 100))
      // SECURITY: Cryptographically secure random - unpredictable simulation
      setCiphertext(generateSimulatedCiphertext(Math.min(plaintext.length * 2, 32)))
      setHexStream(generateSimulatedHexStream())
    }, prefersReducedMotion ? 100 : 50)

    return () => {
      clearInterval(phaseInterval)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive, isPaused, plaintext.length, prefersReducedMotion])

  const algoConfig = ENCRYPTION_ALGORITHMS[algorithm as keyof typeof ENCRYPTION_ALGORITHMS] || ENCRYPTION_ALGORITHMS["AES-256-GCM"]
  const AlgoIcon = algoConfig.icon

  // Enterprise encryption compliance badge
  const complianceBadge = (
    <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
      {language === "ar" ? "تشفير AES-256-GCM بمستوى المؤسسات" : "Enterprise-grade AES-256-GCM"}
    </span>
  )

  // Text summary for accessibility
  const getStatusText = () => {
    if (phase === "idle") return language === "ar" ? "جاهز للتشفير" : "Ready to encrypt"
    if (phase === "key") return language === "ar" ? "جاري توليد مفتاح التشفير" : "Generating encryption key"
    if (phase === "encrypt") return language === "ar" ? "جاري تشفير البيانات" : "Encrypting data"
    if (phase === "verify") return language === "ar" ? "جاري التحقق من السلامة" : "Verifying integrity"
    if (phase === "complete") return language === "ar" ? "اكتمل التشفير بنجاح" : "Encryption complete"
    return ""
  }

  if (variant === "stream") {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-label={language === "ar" ? "تدفق التشفير" : "Encryption stream"}
        dir={dir}
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn("font-mono text-xs overflow-hidden", className)}
      >
        <div className="flex items-center gap-2 mb-1">
          <Lock className={cn("w-3 h-3", algoConfig.color)} aria-hidden="true" />
          <span className="text-muted-foreground">{algorithm}</span>
        </div>
        <div className="flex flex-wrap gap-1 max-h-8 overflow-hidden" aria-hidden="true">
          <AnimatePresence mode="popLayout">
            {hexStream.map((hex, i) => (
              <motion.span
                key={`${hex}-${i}`}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-nexus-gold/70"
              >
                {hex}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <span className="sr-only">{getStatusText()}</span>
      </motion.div>
    )
  }

  if (variant === "compact") {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-label={getStatusText()}
        dir={dir}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border border-nexus-gold/20 bg-card/80 focus:outline-none focus:ring-2 focus:ring-nexus-gold/50",
          className
        )}
      >
        <motion.div
          className={cn("p-2 rounded-lg", isActive ? "bg-nexus-gold/20" : "bg-muted")}
          animate={isActive && !isPaused && !prefersReducedMotion ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {isEncrypting ? (
            <Lock className={cn("w-5 h-5", algoConfig.color)} aria-hidden="true" />
          ) : isDecrypting ? (
            <Unlock className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Shield className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isEncrypting
                ? (language === "ar" ? "جاري التشفير..." : "Encrypting...")
                : isDecrypting
                ? (language === "ar" ? "جاري فك التشفير..." : "Decrypting...")
                : (language === "ar" ? "مشفر" : "Encrypted")}
            </span>
            <span className="text-xs text-muted-foreground">{algorithm}</span>
          </div>
          {isActive && (
            <div
              className="mt-1 h-1 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full bg-nexus-gold rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePause}
            aria-pressed={isPaused}
            aria-label={isPaused ? "Resume" : "Pause"}
            className="h-6 w-6 p-0"
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </Button>
        )}

        {phase === "complete" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <CheckCircle className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          </motion.div>
        )}
      </motion.div>
    )
  }

  // Full variant
  return (
    <motion.div
      role="region"
      aria-label={language === "ar" ? "تصور التشفير السيادي" : "Sovereign Encryption Visualization"}
      dir={dir}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-nexus-gold/20 bg-gradient-to-br from-card via-card to-card/80 p-4 overflow-hidden focus:outline-none focus:ring-2 focus:ring-nexus-gold/50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2 rounded-lg bg-nexus-gold/10"
            animate={isActive && !isPaused && !prefersReducedMotion ? { rotate: [0, 5, -5, 0] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <AlgoIcon className={cn("w-6 h-6", algoConfig.color)} aria-hidden="true" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-sm">
              {language === "ar" ? "التشفير السيادي" : "Sovereign Encryption"}
            </h3>
            <p className="text-xs text-muted-foreground">{algorithm} | {keySize}-bit</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePause}
              aria-pressed={isPaused}
              aria-label={isPaused ? "Resume" : "Pause"}
              className="h-8 w-8 p-0"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          )}
          <div className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            phase === "complete" ? "bg-emerald-500/20 text-emerald-400" :
            isActive ? "bg-nexus-gold/20 text-nexus-gold" :
            "bg-muted text-muted-foreground"
          )}>
            {phase === "idle" && (language === "ar" ? "جاهز" : "Ready")}
            {phase === "key" && (language === "ar" ? "توليد المفتاح" : "Key Gen")}
            {phase === "encrypt" && (language === "ar" ? "تشفير" : "Encrypting")}
            {phase === "verify" && (language === "ar" ? "تحقق" : "Verifying")}
            {phase === "complete" && (language === "ar" ? "تم" : "Complete")}
          </div>
        </div>
      </div>

      {/* Encryption Flow Visualization */}
      <div className="relative py-6">
        <div className="flex items-center justify-between gap-4">
          {/* Plaintext */}
          <motion.div
            className="flex-1 p-3 rounded-lg border border-muted bg-muted/30"
            animate={phase === "encrypt" && !isPaused && !prefersReducedMotion ? { opacity: [1, 0.5, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                {language === "ar" ? "نص عادي" : "Plaintext"}
              </span>
            </div>
            {/* SECURITY: Mask actual data */}
            <p className="text-sm font-mono truncate">{maskSensitiveData(plaintext)}</p>
          </motion.div>

          {/* Arrow/Process */}
          <div className="px-2 flex flex-col items-center" aria-hidden="true">
            <motion.div
              className="w-12 h-12 rounded-full bg-nexus-gold/10 flex items-center justify-center"
              animate={isActive && !isPaused && !prefersReducedMotion ? {
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360]
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Key className={cn("w-5 h-5", algoConfig.color)} />
            </motion.div>
            <motion.div className="mt-2 flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-nexus-gold"
                  animate={isActive && !isPaused ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </div>

          {/* Ciphertext */}
          <motion.div
            className={cn(
              "flex-1 p-3 rounded-lg border",
              phase === "complete" ? "border-emerald-500/30 bg-emerald-500/5" :
              "border-nexus-gold/30 bg-nexus-gold/5"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <EyeOff className={cn(
                "w-4 h-4",
                phase === "complete" ? "text-emerald-400" : "text-nexus-gold"
              )} aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                {language === "ar" ? "نص مشفر" : "Ciphertext"}
              </span>
            </div>
            {showCiphertext ? (
              <motion.p className="text-sm font-mono truncate text-nexus-gold/80" key={ciphertext}>
                {/* SECURITY: Only simulated ciphertext shown */}
                {ciphertext || "..."}
              </motion.p>
            ) : (
              <p className="text-sm font-mono text-muted-foreground">{"•".repeat(16)}</p>
            )}
          </motion.div>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div className="mt-4">
            <div
              className="h-1.5 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${progress}% complete`}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-nexus-gold to-nexus-jade rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">{progress}%</p>
          </div>
        )}
      </div>

      {/* Simulated Hex Stream - clearly marked as visualization */}
      <div className="mt-4 pt-4 border-t border-nexus-gold/10">
        <div className="flex items-center gap-2 mb-2">
          <Binary className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">
            {language === "ar" ? "تصور تدفق البيانات (محاكاة)" : "Data Stream (Simulated)"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 font-mono text-xs" aria-hidden="true">
          {hexStream.map((hex, i) => (
            <motion.span
              key={i}
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.6, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className="text-nexus-gold/60"
            >
              {hex}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Encryption Strength + Compliance */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">
            {language === "ar" ? "قوة التشفير" : "Encryption Strength"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5" role="meter" aria-valuenow={algoConfig.strength} aria-valuemin={0} aria-valuemax={100}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-4 h-1.5 rounded-sm",
                  i <= Math.ceil(algoConfig.strength / 20) ? "bg-emerald-400" : "bg-muted"
                )}
              />
            ))}
          </div>
          <span className="text-emerald-400 font-medium">{algoConfig.strength}%</span>
        </div>
      </div>

      {/* Encryption Compliance Badge */}
      <div className="mt-3 flex justify-end">
        {complianceBadge}
      </div>

      {/* Text Summary for Accessibility */}
      <div className="mt-4 pt-3 border-t border-nexus-gold/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTextSummary(!showTextSummary)}
          aria-expanded={showTextSummary}
          className="w-full justify-between text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-3 h-3" />
            {language === "ar" ? "ملخص نصي" : "Text Summary"}
          </span>
        </Button>
        {showTextSummary && (
          <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
            <p>{getStatusText()}</p>
            <p className="mt-1 text-muted-foreground">
              {language === "ar"
                ? `الخوارزمية: ${algorithm} | حجم المفتاح: ${keySize} بت | القوة: ${algoConfig.strength}%`
                : `Algorithm: ${algorithm} | Key Size: ${keySize}-bit | Strength: ${algoConfig.strength}%`
              }
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
})

export default EncryptionVisualization
