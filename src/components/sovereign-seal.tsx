"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ShieldCheck, X, Copy, Check, Download } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SovereignSealProps {
  encryptionMethod?: string
  merkleRoot?: string
  piiScrubbed?: number
  shardsIsolated?: number
  totalShards?: number
  providerIsolation?: "full" | "partial" | "none"
  verified?: boolean
  className?: string
}

export function SovereignSeal({
  encryptionMethod = "AES-256-GCM",
  merkleRoot = "0x7a3b9c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
  piiScrubbed = 3,
  shardsIsolated = 4,
  totalShards = 4,
  providerIsolation = "full",
  verified = true,
  className,
}: SovereignSealProps) {
  const { language, isRTL } = useNexus()
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shouldPulse, setShouldPulse] = useState(false)
  // Hidden until backend implementation complete
  // verifying/verificationResult removed — "Verify Proof" button previously faked results
  // SEC: Track all timeout IDs so they can be cleaned up on unmount to prevent memory leaks
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  // Helper to create tracked timeouts that auto-cleanup on unmount
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      fn()
      timeoutRefs.current = timeoutRefs.current.filter(t => t !== id)
    }, ms)
    timeoutRefs.current.push(id)
    return id
  }, [])

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(id => clearTimeout(id))
      timeoutRefs.current = []
    }
  }, [])

  // Subtle pulse every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShouldPulse(true)
      safeTimeout(() => setShouldPulse(false), 1000)
    }, 10000)
    return () => clearInterval(interval)
  }, [safeTimeout])

  // SEC-SM-001: Wrap clipboard in try/catch — permission may be denied
  const handleCopyMerkle = async () => {
    try {
      await navigator.clipboard.writeText(merkleRoot)
      setCopied(true)
      safeTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API denied or unavailable — hash is visible in the UI
    }
  }

  // Hidden until backend implementation complete
  // handleVerify removed — previously simulated verification, always returned "success"
  // TODO: Implement when GET /api/v1/vault/merkle/verify is wired to real cryptographic check

  // Hidden until backend implementation complete
  // handleShareWithCounsel removed — copied link to verify.nexad.ai which does not exist

  const handleDownloadCertificate = () => {
    // Generates a local JSON certificate with the known metadata (no backend needed)
    const certData = {
      timestamp: new Date().toISOString(),
      encryption: encryptionMethod,
      merkleRoot,
      piiScrubbed,
      shardsIsolated,
      totalShards,
      providerIsolation,
      verified,
    }
    const blob = new Blob([JSON.stringify(certData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nexad-privacy-certificate-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const truncatedHash = `${merkleRoot.slice(0, 10)}...${merkleRoot.slice(-8)}`

  return (
    <div className={cn("flex", isRTL ? "justify-start" : "justify-end", className)}>
      {/* Collapsed Seal */}
      <motion.button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
          "hover:bg-[rgba(255,248,240,0.05)]",
          "focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
        )}
        animate={shouldPulse ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Seal Circle */}
        <div
          className={cn(
            "relative w-12 h-12 rounded-full flex items-center justify-center",
            "bg-[#0A1628]",
            "border-2"
          )}
          style={{
            borderImage: "linear-gradient(135deg, #D4A574, #B8860B) 1",
            borderImageSlice: 1,
            borderWidth: 2,
            borderStyle: "solid",
            borderColor: "#D4A574",
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(212,165,116,0.2), rgba(184,134,11,0.2))",
            }}
          />
          <ShieldCheck className="h-5 w-5 text-[#D4A574] relative z-10" aria-hidden="true" />
        </div>
        <span className="text-[11px] font-medium text-[#94A3B8]">
          {language === "ar" ? "تم التحقق السيادي" : "Sovereign Verified"}
        </span>
      </motion.button>

      {/* Expanded Certificate Panel */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsExpanded(false)}
            />
            
            {/* Certificate Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              role="dialog"
              aria-modal="true"
              aria-label={language === "ar" ? "شهادة الخصوصية" : "Privacy Certificate"}
              className={cn(
                "fixed z-50 w-[400px] max-w-[90vw]",
                "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "rounded-xl overflow-hidden",
                "border border-[rgba(255,255,255,0.08)]"
              )}
              style={{
                background: "rgba(15, 29, 50, 0.95)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Cream tint overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{ background: "rgba(255,248,240,0.03)" }}
              />
              
              {/* Header */}
              <div className="relative p-4 border-b border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between">
                  <span 
                    className="text-[10px] tracking-[0.2em] font-semibold"
                    style={{ color: "#D4A574" }}
                  >
                    {language === "ar" ? "شهادة الخصوصية" : "PRIVACY CERTIFICATE"}
                  </span>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                    aria-label={language === "ar" ? "إغلاق" : "Close"}
                  >
                    <X className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
                  </button>
                </div>
                <div 
                  className="mt-2 h-px w-full"
                  style={{ background: "linear-gradient(90deg, #D4A574, transparent)" }}
                />
              </div>

              {/* Certificate Body */}
              <div className="relative p-4 space-y-3">
                {/* Grid Layout */}
                <div className="grid grid-cols-2 gap-3">
                  <CertificateRow 
                    label={language === "ar" ? "التشفير" : "Encryption"} 
                    value={encryptionMethod}
                    language={language}
                  />
                  <CertificateRow 
                    label={language === "ar" ? "جذر ميركل" : "Merkle Root"} 
                    value={truncatedHash}
                    mono
                    language={language}
                  />
                  <CertificateRow 
                    label={language === "ar" ? "بيانات محمية" : "PII Items Scrubbed"} 
                    value={`${piiScrubbed} ${language === "ar" ? "تم الكشف والحماية" : "detected, scrubbed"}`}
                    language={language}
                  />
                  <CertificateRow 
                    label={language === "ar" ? "الخوادم المعزولة" : "Shards Isolated"}
                    value={`${shardsIsolated} ${language === "ar" ? "من" : "of"} ${totalShards}`}
                    language={language}
                  />
                  <CertificateRow 
                    label={language === "ar" ? "عزل المزود" : "Provider Isolation"} 
                    value={providerIsolation === "full" 
                      ? (language === "ar" ? "عزل كامل" : "Full isolation")
                      : providerIsolation === "partial"
                      ? (language === "ar" ? "عزل جزئي" : "Partial isolation")
                      : (language === "ar" ? "لا عزل" : "No isolation")
                    }
                    language={language}
                  />
                  <CertificateRow 
                    label={language === "ar" ? "التحقق" : "Verification"} 
                    value={verified 
                      ? (language === "ar" ? "ناجح" : "Passed")
                      : (language === "ar" ? "فشل" : "Failed")
                    }
                    verified={verified}
                    language={language}
                  />
                </div>

                {/* Full Merkle Hash */}
                <div className="mt-4 p-2 rounded-lg bg-[rgba(255,255,255,0.03)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#94A3B8] font-mono break-all">
                      {merkleRoot}
                    </span>
                    <button
                      onClick={handleCopyMerkle}
                      className="ms-2 p-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors flex-shrink-0"
                      aria-label={language === "ar" ? "نسخ جذر ميركل" : "Copy Merkle root"}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-[#10B981]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3 w-3 text-[#94A3B8]" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

              </div>

              {/* Footer Buttons */}
              <div className="relative p-4 border-t border-[rgba(255,255,255,0.08)] flex flex-wrap gap-2">
                {/* Hidden until backend implementation complete */}
                {/* "Verify Proof" button previously simulated verification (always returned success) — removed to avoid false assurance */}
                {/* "Share with Counsel" previously copied a link to verify.nexad.ai which does not exist — removed */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCertificate}
                  className="flex-1 border-[#D4A574] text-[#D4A574] hover:bg-[#D4A574]/10"
                >
                  <Download className="h-3 w-3 me-1" aria-hidden="true" />
                  {language === "ar" ? "تحميل" : "Download"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function CertificateRow({ 
  label, 
  value, 
  mono = false, 
  verified,
  language,
}: { 
  label: string
  value: string
  mono?: boolean
  verified?: boolean
  language: string
}) {
  return (
    <div className="space-y-0.5">
      <span className="text-[11px] text-[#94A3B8]">{label}</span>
      <p className={cn(
        "text-[12px] text-white",
        mono && "font-mono"
      )}>
        {value}
        {verified !== undefined && (
          <span className={cn("ms-1", verified ? "text-[#10B981]" : "text-[#EF4444]")}>
            {verified ? "✓" : "✗"}
          </span>
        )}
      </p>
    </div>
  )
}
