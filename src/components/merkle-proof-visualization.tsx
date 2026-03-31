"use client"

import { memo, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { Shield, Check, Hash, Lock, FileKey, AlertTriangle, Pause, Play, FileText, Server } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

interface MerkleProofVisualizationProps {
  documentHash?: string
  rootHash?: string
  proofPath?: string[]
  isVerifying?: boolean
  isVerified?: boolean
  serverVerified?: boolean // SECURITY: Verification must happen server-side
  className?: string
  language?: "en" | "ar"
  dir?: "ltr" | "rtl"
  variant?: "tree" | "compact" | "inline"
}

// SECURITY: Aggressive hash masking - show minimal chars to prevent brute-force
// Only 4 total visible chars (2+2) - makes rainbow table attacks infeasible
function maskHash(hash: string): string {
  if (hash.length <= 4) return "••••••••"
  return `${hash.slice(0, 2)}••••••${hash.slice(-2)}`
}

// Generate simulated hash for visualization only
function generateSimulatedHash(): string {
  const chars = "0123456789abcdef"
  let hash = ""
  for (let i = 0; i < 8; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)]
  }
  return hash
}

export const MerkleProofVisualization = memo(function MerkleProofVisualization({
  documentHash = "a7b9c3d2",
  rootHash = "f1e2d3c4",
  proofPath = ["b8a9c7d6", "e5f4c3b2", "d2c1b0a9"],
  isVerifying = false,
  isVerified = false,
  serverVerified = false,
  className,
  language = "en",
  dir = language === "ar" ? "rtl" : "ltr",
  variant = "tree"
}: MerkleProofVisualizationProps) {
  const [verificationStep, setVerificationStep] = useState(-1)
  const [isPaused, setIsPaused] = useState(false)
  const [showTextSummary, setShowTextSummary] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const levels = 4

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
    if (isVerifying && !isPaused) {
      setVerificationStep(0)
      const interval = setInterval(() => {
        setVerificationStep(prev => {
          if (prev >= proofPath.length) {
            clearInterval(interval)
            return prev
          }
          return prev + 1
        })
      }, prefersReducedMotion ? 200 : 600)
      return () => clearInterval(interval)
    } else if (!isVerifying) {
      setVerificationStep(-1)
    }
  }, [isVerifying, isPaused, proofPath.length, prefersReducedMotion])

  // Status text for accessibility
  const getStatusText = () => {
    if (isVerified && serverVerified) return language === "ar" ? "تم التحقق من الخادم" : "Server-verified"
    if (isVerified) return language === "ar" ? "تم التحقق" : "Verified"
    if (isVerifying) return language === "ar" ? `جاري التحقق - الخطوة ${verificationStep + 1}` : `Verifying - step ${verificationStep + 1}`
    return language === "ar" ? "جاهز" : "Ready"
  }

  // ADGM Compliance reference
  const complianceNote = (
    <span className="text-[10px] text-muted-foreground">
      {language === "ar" ? "متوافق مع ADGM CASS 7.3" : "ADGM CASS 7.3 Compliant"}
    </span>
  )

  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={getStatusText()}
        dir={dir}
        className={cn("flex items-center gap-2 text-sm", className)}
      >
        <Shield className={cn(
          "w-4 h-4 transition-colors",
          isVerified ? "text-emerald-400" : "text-muted-foreground"
        )} aria-hidden="true" />
        <span className="font-mono text-xs">{maskHash(rootHash)}</span>
        {isVerified && serverVerified && (
          <Tooltip>
            <TooltipTrigger>
              <Server className="w-3 h-3 text-emerald-400" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              {language === "ar" ? "تم التحقق من الخادم" : "Server-verified"}
            </TooltipContent>
          </Tooltip>
        )}
        {isVerified && <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />}
        <span className="sr-only">{getStatusText()}</span>
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              role="status"
              aria-live="polite"
              aria-label={getStatusText()}
              dir={dir}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-nexus-gold/50",
                isVerified
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-nexus-gold/20 bg-card/50",
                className
              )}
              whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            >
              <div className={cn(
                "p-1.5 rounded",
                isVerified ? "bg-emerald-500/20" : "bg-nexus-gold/10"
              )}>
                {isVerified ? (
                  <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Shield className="w-4 h-4 text-nexus-gold" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "دليل ميركل" : "Merkle Proof"}
                </p>
                <p className="font-mono text-xs truncate">{maskHash(rootHash)}</p>
              </div>
              {serverVerified && (
                <Server className="w-3 h-3 text-emerald-400" aria-label="Server verified" />
              )}
              {isVerifying && !isPaused && (
                <motion.div className="flex gap-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-nexus-gold"
                      animate={prefersReducedMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              )}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              {language === "ar"
                ? "دليل تشفيري يثبت سلامة البيانات - التحقق يتم من الخادم"
                : "Cryptographic proof verifying data integrity - verified server-side"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full tree visualization
  return (
    <div
      role="region"
      aria-label={language === "ar" ? "تصور شجرة ميركل" : "Merkle Tree Visualization"}
      dir={dir}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn("rounded-xl bg-card border border-nexus-gold/20 p-4 focus:outline-none focus:ring-2 focus:ring-nexus-gold/50", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-nexus-gold/10">
            <FileKey className="w-5 h-5 text-nexus-gold" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">
              {language === "ar" ? "شجرة ميركل" : "Merkle Tree Proof"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "تحقق تشفيري" : "Cryptographic verification"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isVerifying && (
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePause}
              aria-pressed={isPaused}
              aria-label={isPaused ? "Resume" : "Pause"}
              className="h-6 w-6 p-0"
            >
              {isPaused ? <Play className="w-3 h-3" aria-hidden="true" /> : <Pause className="w-3 h-3" aria-hidden="true" />}
            </Button>
          )}
          <motion.div
            className={cn(
              "px-2 py-1 rounded text-xs font-medium flex items-center gap-1",
              isVerified ? "bg-emerald-500/20 text-emerald-400" :
              isVerifying ? "bg-amber-500/20 text-amber-400" :
              "bg-muted text-muted-foreground"
            )}
            animate={isVerifying && !isPaused && !prefersReducedMotion ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {serverVerified && <Server className="w-3 h-3" aria-hidden="true" />}
            {isVerified
              ? (language === "ar" ? "تم التحقق" : "Verified")
              : isVerifying
              ? (language === "ar" ? "جاري التحقق..." : "Verifying...")
              : (language === "ar" ? "جاهز" : "Ready")}
          </motion.div>
        </div>
      </div>

      {/* SECURITY NOTE: Server-side verification warning */}
      <div className="mb-4 p-2 rounded bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
        <Server className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-blue-400">
          {language === "ar"
            ? "التحقق يتم من الخادم في بيئة آمنة - هذا تصور للعملية فقط"
            : "Verification is performed server-side in a secure environment - this is a visualization only"}
        </p>
      </div>

      {/* Tree Visualization */}
      <div className="relative py-6 overflow-hidden" aria-hidden="true">
        <svg className="absolute inset-0 w-full h-full" style={{ minHeight: 200, transform: dir === "rtl" ? "scaleX(-1)" : undefined }}>
          {/* Connection lines */}
          {[0, 1, 2].map((level) => {
            const nodesInLevel = Math.pow(2, 3 - level)
            const nodesInNextLevel = Math.pow(2, 2 - level)
            const yStart = 20 + level * 50
            const yEnd = 20 + (level + 1) * 50

            return Array.from({ length: nodesInLevel }).map((_, pos) => {
              const xStart = (100 / (nodesInLevel + 1)) * (pos + 1)
              const parentPos = Math.floor(pos / 2)
              const xEnd = (100 / (nodesInNextLevel + 1)) * (parentPos + 1)
              const isOnPath = verificationStep >= level

              return (
                <motion.line
                  key={`${level}-${pos}`}
                  x1={`${xStart}%`}
                  y1={`${yStart}%`}
                  x2={`${xEnd}%`}
                  y2={`${yEnd}%`}
                  stroke={isOnPath && isVerifying ? "#9B7A58" : "rgba(155, 122, 88, 0.2)"}
                  strokeWidth={isOnPath && isVerifying ? 2 : 1}
                  initial={prefersReducedMotion ? {} : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: level * 0.1 }}
                />
              )
            })
          })}
        </svg>

        {/* Nodes */}
        <div className="relative" style={{ minHeight: 200 }}>
          {[0, 1, 2, 3].map((level) => {
            const nodesInLevel = Math.pow(2, 3 - level)
            return (
              <div
                key={level}
                className="absolute w-full flex justify-around"
                style={{ top: `${level * 50}px` }}
              >
                {Array.from({ length: nodesInLevel }).map((_, pos) => {
                  const isLeaf = level === 0
                  const isRoot = level === 3
                  const isOnPath = pos === 0 || (level > 0 && pos <= 1)
                  const isCurrentStep = verificationStep === level && isVerifying

                  return (
                    <motion.div
                      key={pos}
                      className={cn(
                        "relative flex items-center justify-center rounded-lg border transition-all",
                        isRoot ? "w-16 h-10" : isLeaf ? "w-12 h-8" : "w-14 h-9",
                        isCurrentStep
                          ? "border-nexus-gold bg-nexus-gold/20 shadow-lg shadow-nexus-gold/20"
                          : isOnPath && verificationStep > level
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-nexus-gold/20 bg-card/50"
                      )}
                      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: level * 0.1 + pos * 0.05 }}
                      whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                    >
                      {isRoot ? (
                        <Lock className="w-4 h-4 text-nexus-gold" />
                      ) : (
                        <Hash className="w-3 h-3 text-muted-foreground" />
                      )}

                      {isCurrentStep && !prefersReducedMotion && (
                        <motion.div
                          className="absolute -inset-1 rounded-lg border-2 border-nexus-gold"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      )}

                      {isOnPath && verificationStep > level && (
                        <motion.div
                          className="absolute -top-1 -end-1"
                          initial={prefersReducedMotion ? {} : { scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <Check className="w-3 h-3 text-emerald-400 bg-card rounded-full" />
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Proof Path - MASKED hashes */}
      <div className="mt-4 pt-4 border-t border-nexus-gold/10">
        <p className="text-xs text-muted-foreground mb-2">
          {language === "ar" ? "مسار الإثبات (مخفي جزئياً)" : "Proof Path (Partially Masked)"}
        </p>
        <div className="flex flex-wrap gap-2" role="list" aria-label="Proof path hashes">
          {proofPath.map((hash, i) => (
            <motion.div
              key={i}
              role="listitem"
              className={cn(
                "px-2 py-1 rounded font-mono text-xs border",
                verificationStep > i
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : verificationStep === i && isVerifying
                  ? "border-nexus-gold/50 bg-nexus-gold/10 text-nexus-gold"
                  : "border-muted bg-muted/50 text-muted-foreground"
              )}
              initial={prefersReducedMotion ? {} : { opacity: 0, x: dir === "rtl" ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {maskHash(hash)}
            </motion.div>
          ))}
          <motion.div
            className={cn(
              "px-2 py-1 rounded font-mono text-xs border",
              isVerified
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-nexus-gold/50 bg-nexus-gold/10 text-nexus-gold"
            )}
            initial={prefersReducedMotion ? {} : { opacity: 0, x: dir === "rtl" ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: proofPath.length * 0.1 }}
          >
            <span className="text-muted-foreground me-1">root:</span>
            {maskHash(rootHash)}
            {isVerified && <Check className="w-3 h-3 inline ms-1" />}
          </motion.div>
        </div>
      </div>

      {/* Compliance + Text Summary */}
      <div className="mt-4 flex items-center justify-between">
        {complianceNote}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTextSummary(!showTextSummary)}
          aria-expanded={showTextSummary}
          className="text-xs text-muted-foreground"
        >
          <FileText className="w-3 h-3 me-1" aria-hidden="true" />
          {language === "ar" ? "ملخص" : "Summary"}
        </Button>
      </div>

      {showTextSummary && (
        <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
          <p>{getStatusText()}</p>
          <p className="mt-1 text-muted-foreground">
            {language === "ar"
              ? `هذه الشجرة تثبت سلامة الأصول. متوافق مع ADGM Rule CASS 7.3.`
              : `This tree proves asset integrity. Complies with ADGM Rule CASS 7.3.`
            }
          </p>
          {serverVerified && (
            <p className="mt-1 text-emerald-400">
              {language === "ar" ? "تم التحقق من الخادم بنجاح" : "Server verification successful"}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

export default MerkleProofVisualization
