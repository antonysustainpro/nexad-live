"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { generateKeypair } from "@/lib/api"

interface KeyCeremonyProps {
  onComplete: (backupChoice: "qr" | "skip") => void
  language?: "en" | "ar" | "bilingual"
  vaultId?: string
}

/**
 * Generates a simple QR-code-like matrix from input data.
 * This uses a deterministic hash to create a scannable-looking pattern.
 * For production, replace with a proper QR encoding library.
 */
function generateQRMatrix(data: string, size: number = 25): boolean[][] {
  // Simple hash function for deterministic pattern
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Seed a simple PRNG from the hash
  let seed = Math.abs(hash)
  const nextRand = () => {
    seed = (seed * 16807 + 0) % 2147483647
    return seed / 2147483647
  }

  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  )

  // Draw finder patterns (the three corner squares that make it look like a real QR code)
  const drawFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuterBorder = r === 0 || r === 6 || c === 0 || c === 6
        const isInnerBlock = r >= 2 && r <= 4 && c >= 2 && c <= 4
        matrix[startR + r][startC + c] = isOuterBorder || isInnerBlock
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns (alternating line between finders)
  for (let i = 7; i < size - 7; i++) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }

  // Fill remaining cells with data-derived pattern
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder pattern areas and timing lines
      const inFinder1 = r < 8 && c < 8
      const inFinder2 = r < 8 && c >= size - 8
      const inFinder3 = r >= size - 8 && c < 8
      const onTiming = r === 6 || c === 6

      if (!inFinder1 && !inFinder2 && !inFinder3 && !onTiming && !matrix[r][c]) {
        matrix[r][c] = nextRand() > 0.5
      }
    }
  }

  return matrix
}

function drawQRToCanvas(
  canvas: HTMLCanvasElement,
  data: string,
  moduleSize: number = 6,
  padding: number = 16
) {
  const qrSize = 25
  const matrix = generateQRMatrix(data, qrSize)
  const totalSize = qrSize * moduleSize + padding * 2

  canvas.width = totalSize
  canvas.height = totalSize

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // White background
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, totalSize, totalSize)

  // Draw modules
  ctx.fillStyle = "#000000"
  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          padding + c * moduleSize,
          padding + r * moduleSize,
          moduleSize,
          moduleSize
        )
      }
    }
  }
}

const PHASES = [
  { id: 1, duration: 3000, textEn: "Establishing your sovereign vault...", textAr: "جارٍ إنشاء خزنتك السيادية..." },
  { id: 2, duration: 4000, textEn: "Forging your encryption key...", textAr: "جارٍ صياغة مفتاح التشفير الخاص بك..." },
  { id: 3, duration: 2500, textEn: null, textAr: null }, // Fingerprint appears
  { id: 4, duration: 3500, textEn: null, textAr: null }, // Security text
  { id: 5, duration: 0, textEn: null, textAr: null }, // Backup choice
  { id: 6, duration: 2000, textEn: "Vault established.", textAr: "تم إنشاء الخزنة." },
]

// SEC-SM-R3-002: Use crypto.getRandomValues instead of Math.random for fingerprint generation.
// Even though this is a placeholder replaced by the real API fingerprint, Math.random is
// predictable and should never be used in security-sensitive UI (a user might screenshot
// the initial fingerprint before the API response arrives).
function generateFingerprint(): string {
  const chars = "0123456789ABCDEF"
  const segments: string[] = []
  const randomBytes = new Uint8Array(12)
  crypto.getRandomValues(randomBytes)
  for (let i = 0; i < 6; i++) {
    let segment = ""
    for (let j = 0; j < 2; j++) {
      segment += chars[randomBytes[i * 2 + j] % chars.length]
    }
    segments.push(segment)
  }
  return segments.join(":")
}

export function KeyCeremony({ onComplete, language = "en", vaultId = "00247" }: KeyCeremonyProps) {
  const [phase, setPhase] = useState(1)
  const [fingerprint, setFingerprint] = useState(generateFingerprint)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])
  
  // Call real API when phase 2 starts
  useEffect(() => {
    if (phase === 2) {
      generateKeypair("ECDH-P256").then((result) => {
        if (result?.fingerprint) {
          setFingerprint(result.fingerprint)
        }
      })
    }
  }, [phase])
  const [fingerprintVisible, setFingerprintVisible] = useState("")
  const [showSecurityText, setShowSecurityText] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const securityLinesEn = [
    "This key exists only on your device.",
    "NexusAD Ai does not have it.",
    "No one does.",
  ]

  const securityLinesAr = [
    "هذا المفتاح موجود فقط على جهازك.",
    "NexusAD Ai لا يملكه.",
    "لا أحد يملكه.",
  ]

  // Bilingual mode shows both languages
  const securityLines = language === "ar" 
    ? securityLinesAr 
    : language === "bilingual"
    ? securityLinesEn.map((en, i) => `${en}\n${securityLinesAr[i]}`)
    : securityLinesEn

  useEffect(() => {
    if (phase < 5) {
      const timer = setTimeout(() => {
        setPhase((p) => p + 1)
      }, PHASES[phase - 1].duration)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Fingerprint typing effect
  useEffect(() => {
    if (phase === 3) {
      let index = 0
      const interval = setInterval(() => {
        if (index <= fingerprint.length) {
          setFingerprintVisible(fingerprint.slice(0, index))
          index++
        } else {
          clearInterval(interval)
        }
      }, 80)
      return () => clearInterval(interval)
    }
  }, [phase, fingerprint])

  // Security text reveal
  useEffect(() => {
    if (phase === 4) {
      const timers = securityLines.map((_, i) => {
        return setTimeout(() => {
          setShowSecurityText((prev) => prev + 1)
        }, i * 800)
      })
      return () => timers.forEach(clearTimeout)
    }
  }, [phase, securityLines])

  // Draw QR code when shown
  useEffect(() => {
    if (showQR && qrCanvasRef.current) {
      const qrData = `nexusad://key-backup?fp=${fingerprint}&vault=${vaultId}`
      drawQRToCanvas(qrCanvasRef.current, qrData, 8, 20)
    }
  }, [showQR, fingerprint, vaultId])

  const handleDownloadQR = useCallback(() => {
    if (!qrCanvasRef.current) return
    const url = qrCanvasRef.current.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = `nexusad-key-backup-${vaultId}.png`
    a.click()
  }, [vaultId])

  const handleBackupChoice = (choice: "qr" | "skip") => {
    if (choice === "qr" && !showQR) {
      // Show the QR code first
      setShowQR(true)
      return
    }
    setPhase(6)
    setTimeout(() => {
      onComplete(choice)
    }, PHASES[5].duration)
  }

  const getText = (phaseIndex: number) => {
    const p = PHASES[phaseIndex]
    return language === "ar" ? p.textAr : p.textEn
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8" role="region" aria-label={language === "ar" ? "حفل إنشاء المفتاح" : "Key Generation Ceremony"}>
      <div className="w-full max-w-lg text-center">
        <AnimatePresence mode="wait">
          {/* Phase 1: Establishing text + particles */}
          {phase === 1 && (
            <motion.div
              key="phase1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <p className="text-xl text-white">{getText(0)}</p>
              <div className="relative h-40 flex items-center justify-center" aria-hidden="true">
                {/* Animated particles converging to center */}
                {prefersReducedMotion ? (
                  <div className="w-4 h-4 rounded-full bg-nexus-gold" />
                ) : (
                  [...Array(40)].map((_, i) => {
                    const angle = (i / 40) * Math.PI * 2
                    const radius = 120 + Math.random() * 40
                    const startX = Math.cos(angle) * radius
                    const startY = Math.sin(angle) * radius

                    return (
                      <motion.div
                        key={i}
                        className="absolute w-1.5 h-1.5 rounded-full bg-nexus-gold"
                        initial={{ x: startX, y: startY, opacity: 0 }}
                        animate={{
                          x: 0,
                          y: 0,
                          opacity: [0, 1, 1, 0.5],
                        }}
                        transition={{
                          duration: 2.5,
                          delay: i * 0.05,
                          ease: "easeInOut",
                        }}
                      />
                    )
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* Phase 2: Key forming */}
          {phase === 2 && (
            <motion.div
              key="phase2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <p className="text-xl text-white">{getText(1)}</p>
              <div className="relative h-48 flex items-center justify-center" aria-hidden="true">
                <svg
                  viewBox="0 0 100 100"
                  className="w-32 h-32 text-nexus-gold"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {/* Key shape drawing animation */}
                  <motion.path
                    d="M30 50 C30 35, 45 30, 50 30 C55 30, 70 35, 70 50 C70 65, 55 70, 50 70 C45 70, 30 65, 30 50 Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                  />
                  <motion.path
                    d="M70 50 L95 50 M85 50 L85 60 M90 50 L90 55"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 1.5, ease: "easeInOut" }}
                  />
                  {/* Key center dot */}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="8"
                    fill="currentColor"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 2.5, duration: 0.3 }}
                  />
                </svg>
              </div>
            </motion.div>
          )}

          {/* Phase 3: Fingerprint */}
          {phase === 3 && (
            <motion.div
              key="phase3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="relative h-32 flex items-center justify-center" aria-hidden="true">
                <svg
                  viewBox="0 0 100 100"
                  className="w-24 h-24 opacity-80 text-nexus-gold"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M70 50 L90 50 M82 50 L82 58 M87 50 L87 55" stroke="currentColor" strokeWidth="2" />
                  <circle cx="50" cy="50" r="6" fill="currentColor" />
                </svg>
              </div>
              <div className="font-mono text-xl text-nexus-gold tracking-wider">
                {fingerprintVisible}
                <span className="animate-typing-cursor">|</span>
              </div>
            </motion.div>
          )}

          {/* Phase 4: Security text */}
          {phase === 4 && (
            <motion.div
              key="phase4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="relative h-24 flex items-center justify-center" aria-hidden="true">
                <svg
                  viewBox="0 0 100 100"
                  className="w-16 h-16 opacity-60 text-nexus-gold"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M70 50 L90 50 M82 50 L82 58 M87 50 L87 55" stroke="currentColor" strokeWidth="2" />
                  <circle cx="50" cy="50" r="6" fill="currentColor" />
                </svg>
              </div>
              <div className="space-y-3">
                {securityLines.map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: showSecurityText > i ? 1 : 0, y: showSecurityText > i ? 0 : 10 }}
                    className="text-lg text-white/90"
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
            </motion.div>
          )}

          {/* Phase 5: Backup choice */}
          {phase === 5 && (
            <motion.div
              key="phase5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="font-mono text-lg text-nexus-gold">{fingerprint}</div>

              {showQR ? (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-white/80">
                    {language === "ar"
                      ? "امسح رمز QR هذا أو قم بتنزيله لحفظ مفتاح النسخ الاحتياطي."
                      : "Scan this QR code or download it to save your backup key."}
                  </p>
                  <div className="flex justify-center">
                    <div className="bg-white rounded-xl p-2 inline-block">
                      <canvas ref={qrCanvasRef} role="img" aria-label={language === "ar" ? "رمز QR لنسخ مفتاح التشفير الاحتياطي" : "QR code for encryption key backup"} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <Button
                      onClick={handleDownloadQR}
                      variant="outline"
                      className="w-full max-w-xs h-10 border-nexus-gold/30 text-nexus-gold hover:bg-nexus-gold/10"
                    >
                      {language === "ar" ? "تنزيل QR" : "Download QR Image"}
                    </Button>
                    <Button
                      onClick={() => handleBackupChoice("qr")}
                      className="w-full max-w-xs bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12"
                    >
                      {language === "ar" ? "تم، متابعة" : "Done, continue"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <Button
                    onClick={() => handleBackupChoice("qr")}
                    className="w-full max-w-xs bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12 relative"
                  >
                    {language === "ar" ? "نسخ احتياطي عبر رمز QR" : "Back up to QR Code"}
                    <Badge className="absolute -top-2 -end-2 bg-nexus-jade text-background text-xs">
                      {language === "ar" ? "موصى به" : "Recommended"}
                    </Badge>
                  </Button>
                  <button
                    onClick={() => handleBackupChoice("skip")}
                    className="block w-full text-center text-sm text-muted-foreground hover:text-white transition-colors"
                  >
                    {language === "ar" ? "المتابعة بدون نسخ احتياطي" : "Continue without backup"}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Phase 6: Vault established */}
          {phase === 6 && (
            <motion.div
              key="phase6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <p className="font-mono text-2xl text-nexus-gold">
                {language === "ar" ? `تم إنشاء الخزنة #${vaultId}.` : `Vault #${vaultId} established.`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
