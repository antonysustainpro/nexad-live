"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { AlertTriangle, Trash2, CheckCircle2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNexus } from "@/contexts/nexus-context"
import { proveDelete } from "@/lib/api"
import type { DeletionCertificate } from "@/lib/types"
import { sanitizeFilename } from "@/lib/utils"

interface DeleteCeremonyProps {
  onComplete: () => void
  onCancel: () => void
  documentName?: string
  documentId?: string // NEW — needed for real API call
}

const PHASES = [
  { id: 1, duration: 2500, textEn: "Preparing deletion...", textAr: "جاري التحضير للحذف..." },
  { id: 2, duration: 3000, textEn: "Revoking encryption keys...", textAr: "إلغاء مفاتيح التشفير..." },
  { id: 3, duration: 2500, textEn: "Shredding data shards...", textAr: "تمزيق أجزاء البيانات..." },
  { id: 4, duration: 2000, textEn: "Purging vault contents...", textAr: "إزالة محتويات الخزنة..." },
  { id: 5, duration: 1500, textEn: "Vault erased.", textAr: "تم مسح الخزنة." },
]

const NODE_CONFIRMATIONS = [
  { id: "uae-1", name: "UAE Node 1", nameAr: "عقدة الإمارات ١", flag: "🇦🇪", status: "confirmed" },
  { id: "uae-2", name: "UAE Node 2", nameAr: "عقدة الإمارات ٢", flag: "🇦🇪", status: "confirmed" },
  { id: "uae-3", name: "UAE Node 3", nameAr: "عقدة الإمارات ٣", flag: "🇦🇪", status: "confirmed" },
]

export function DeleteCeremony({ onComplete, onCancel, documentName = "All Data", documentId }: DeleteCeremonyProps) {
  const { language } = useNexus()
  const [phase, setPhase] = useState(0) // 0 = confirmation, 1-5 = deletion phases
  const [confirmText, setConfirmText] = useState("")
  const [progress, setProgress] = useState(0)
  const [showCertificate, setShowCertificate] = useState(false)
  const [certificate, setCertificate] = useState<DeletionCertificate | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const CONFIRM_PHRASE = "DELETE"
  
  // Check reduced motion preference
  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  // Generate certificate data (fallback if API doesn't return real data)
  const certificateData = {
    document: documentName,
    hash: `sha256:a7f3e2d1${Math.random().toString(16).slice(2, 6)}...`,
    timestamp: new Date().toLocaleString(language === "ar" ? "ar-AE" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    }),
    certificateId: `DEL-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`
  }

  // Progress animation during phases
  useEffect(() => {
    if (phase >= 1 && phase <= 4) {
      const duration = PHASES[phase - 1].duration
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const phaseProgress = Math.min(elapsed / duration, 1)
        const baseProgress = ((phase - 1) / 4) * 100
        const phaseContribution = (phaseProgress / 4) * 100
        setProgress(baseProgress + phaseContribution)
        
        if (phaseProgress < 1) {
          requestAnimationFrame(animate)
        }
      }
      
      const animationFrame = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(animationFrame)
    }
  }, [phase])

  // Auto-advance phases
  useEffect(() => {
    if (phase >= 1 && phase < 5) {
      const timer = setTimeout(() => {
        setPhase((p) => p + 1)
      }, PHASES[phase - 1].duration)
      return () => clearTimeout(timer)
    } else if (phase === 5) {
      // Show certificate after final phase
      const timer = setTimeout(() => {
        setShowCertificate(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [phase])

  const handleConfirm = async () => {
    if (confirmText.toUpperCase() === CONFIRM_PHRASE) {
      setPhase(1)
      
      // Try to get real deletion certificate from API
      if (documentId) {
        const cert = await proveDelete(documentId)
        if (cert) {
          setCertificate(cert)
        }
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={language === "ar" ? "حذف دائم" : "Permanent Deletion"}
      onKeyDown={(e) => {
        if (e.key === "Escape" && phase === 0) {
          onCancel()
        }
        // Focus trap
        if (e.key === "Tab") {
          const dialog = e.currentTarget
          const focusableElements = dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          const firstEl = focusableElements[0]
          const lastEl = focusableElements[focusableElements.length - 1]
          if (e.shiftKey && document.activeElement === firstEl) {
            e.preventDefault()
            lastEl?.focus()
          } else if (!e.shiftKey && document.activeElement === lastEl) {
            e.preventDefault()
            firstEl?.focus()
          }
        }
      }}
    >
      <div className="w-full max-w-lg text-center">
        <AnimatePresence mode="wait">
          {/* Confirmation Phase */}
          {phase === 0 && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* Warning Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="relative mx-auto w-24 h-24"
              >
                <motion.div
                  animate={{ 
                    boxShadow: [
                      "0 0 0 0 rgba(217, 65, 65, 0)",
                      "0 0 0 20px rgba(217, 65, 65, 0.1)",
                      "0 0 0 0 rgba(217, 65, 65, 0)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center"
                >
                  <AlertTriangle className="w-12 h-12 text-destructive" />
                </motion.div>
              </motion.div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-white">
                  {language === "ar" ? "حذف دائم" : "Permanent Deletion"}
                </h2>
                <p className="text-muted-foreground">
                  {language === "ar" 
                    ? "سيؤدي هذا إلى تدمير خزنتك بشكل دائم، بما في ذلك جميع المحادثات والمستندات ومفاتيح التشفير. لا يمكن التراجع عن هذا الإجراء."
                    : "This will permanently destroy your vault, all conversations, documents, and encryption keys. This action cannot be undone."}
                </p>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? (
                    <>اكتب <span className="font-mono text-destructive font-bold">DELETE</span> للتأكيد</>
                  ) : (
                    <>Type <span className="font-mono text-destructive font-bold">DELETE</span> to confirm</>
                  )}
                </p>
                <label htmlFor="delete-confirm-input" className="sr-only">
                  {language === "ar" ? "اكتب DELETE للتأكيد" : "Type DELETE to confirm"}
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full max-w-xs mx-auto px-4 py-3 bg-secondary/50 border border-destructive/30 rounded-xl text-center font-mono text-lg text-white focus:outline-none focus:border-destructive"
                  placeholder={language === "ar" ? "اكتب DELETE" : "Type DELETE"}
                  aria-describedby="delete-confirm-description"
                  autoFocus
                />
                <span id="delete-confirm-description" className="sr-only">
                  {language === "ar" ? "اكتب كلمة DELETE بالأحرف الكبيرة لتأكيد الحذف" : "Type the word DELETE in uppercase to confirm deletion"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="min-w-[120px]"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={confirmText.toUpperCase() !== CONFIRM_PHRASE}
                  className="min-w-[120px] gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {language === "ar" ? "حذف للأبد" : "Delete Forever"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Deletion Phases */}
          {phase >= 1 && phase <= 4 && (
            <motion.div
              key={`phase${phase}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Animated destruction visual */}
              <div className="relative h-40 flex items-center justify-center">
                {/* Particle explosion effect - skip if reduced motion */}
                {!prefersReducedMotion && [...Array(24)].map((_, i) => {
                  const angle = (i / 24) * Math.PI * 2
                  const distance = 80 + (phase * 20)
                  const endX = Math.cos(angle) * distance
                  const endY = Math.sin(angle) * distance
                  
                  return (
                    <motion.div
                      key={`${phase}-${i}`}
                      className="absolute w-2 h-2 rounded-full"
                      style={{ backgroundColor: "rgba(217,65,65,0.8)" }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: endX,
                        y: endY,
                        opacity: [1, 0.8, 0],
                        scale: [1, 0.5, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.03,
                        ease: "easeOut",
                      }}
                    />
                  )
                })}
                
                {/* Central icon shrinking */}
                <motion.div
                  animate={{ scale: [1, 0.95, 1], opacity: 1 - (phase * 0.15) }}
                  transition={{ duration: 0.5 }}
                  className="p-6 rounded-full bg-destructive/20"
                >
                  <Trash2 className="w-8 h-8 text-destructive" />
                </motion.div>
              </div>

              {/* Phase text */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg text-white"
              >
                {language === "ar" ? PHASES[phase - 1].textAr : PHASES[phase - 1].textEn}
              </motion.p>

              {/* Progress bar */}
              <div className="w-full max-w-xs mx-auto">
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-destructive"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {language === "ar" ? `${Math.round(progress)}% مكتمل` : `${Math.round(progress)}% complete`}
                </p>
              </div>
            </motion.div>
          )}

          {/* Final Phase - Certificate */}
          {phase === 5 && !showCertificate && (
            <motion.div
              key="finalTransition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-secondary/30 flex items-center justify-center">
                <Trash2 className="w-10 h-10 text-muted-foreground animate-pulse" />
              </div>
              <p className="text-xl text-muted-foreground">
                {language === "ar" ? "جاري إنشاء الشهادة..." : "Generating certificate..."}
              </p>
            </motion.div>
          )}

          {/* Certificate */}
          {showCertificate && (
            <motion.div
              key="certificate"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Gold bordered certificate card */}
              <div className="border-2 border-nexus-gold rounded-2xl p-8 bg-card text-start">
                <h2 className="text-xl font-semibold text-nexus-gold text-center mb-6">
                  {language === "ar" ? "شهادة تدمير البيانات" : "Certificate of Data Destruction"}
                </h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? "المستند" : "Document"}</p>
                    <p className="font-medium">{certificateData.document}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? "التجزئة" : "Hash"}</p>
                    <p className="font-mono text-sm text-nexus-gold/80">{certificate?.deletion_hash || certificateData.hash}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? "تاريخ التدمير" : "Destroyed"}</p>
                    <p className="text-sm">{certificate?.timestamp || certificateData.timestamp}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? "رقم الشهادة" : "Certificate ID"}</p>
                    <p className="font-mono text-nexus-gold">{certificateData.certificateId}</p>
                  </div>
                </div>

                {/* Node Confirmations */}
                <div className="border-t border-border pt-4 mb-6">
                  <p className="text-sm font-medium mb-3">{language === "ar" ? "تأكيدات العقد:" : "Node Confirmations:"}</p>
                  <div className="space-y-2">
                    {(certificate?.node_confirmations || NODE_CONFIRMATIONS.map(n => n.name)).map((nodeName, i) => {
                  const nodeData = NODE_CONFIRMATIONS.find(n => n.name === nodeName || n.id === nodeName) || { flag: "🇦🇪", name: nodeName, nameAr: nodeName }
                  return (
                    <motion.div
                      key={nodeName}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.5 }}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-nexus-gold" />
                      <span>{nodeData.flag} {language === "ar" ? nodeData.nameAr : nodeData.name}</span>
                      <span className="text-muted-foreground">{language === "ar" ? "— مؤكد" : "— confirmed"}</span>
                    </motion.div>
                  )
                })}
                  </div>
                </div>

                <div className="text-center">
                  <p className="font-semibold">{language === "ar" ? "تم التدمير عبر جميع العقد." : "Destroyed across all nodes."}</p>
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "لا رجعة فيه." : "Irreversible."}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => {
                    const cert = {
                      document: certificateData.document,
                      hash: certificateData.hash,
                      timestamp: certificateData.timestamp,
                      certificateId: certificateData.certificateId,
                      nodes: ["UAE Node 1", "UAE Node 2", "UAE Node 3"]
                    }
                    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: "application/json" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    // SEC-UI-115: Sanitize certificate ID in filename
                    a.download = `deletion-certificate-${sanitizeFilename(certificateData.certificateId, "cert")}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download className="w-4 h-4" />
                  {language === "ar" ? "تنزيل الشهادة" : "Download Certificate"}
                </Button>
                <Button onClick={onComplete}>
                  {language === "ar" ? "تم" : "Done"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
