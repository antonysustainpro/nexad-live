"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Shield, Share2, X, Plus, Eye, MessageSquare, 
  RefreshCw, Lock, Download, Check, Copy
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ReportSection {
  id: string
  nameEn: string
  nameAr: string
  enabled: boolean
}

interface Recipient {
  email: string
  role: "read_only" | "can_comment" | "can_request_refinement"
}

interface SecureShareModalProps {
  isOpen: boolean
  onClose: () => void
  onShare?: (data: {
    sections: string[]
    recipients: Recipient[]
    settings: {
      expiresIn: string
      requireVerification: boolean
      addWatermark: boolean
      allowDownload: boolean
    }
  }) => void
  reportTitle?: string
  sections?: ReportSection[]
}

const defaultSections: ReportSection[] = [
  { id: "executive", nameEn: "Executive Summary", nameAr: "الملخص التنفيذي", enabled: true },
  { id: "market", nameEn: "Market Analysis", nameAr: "تحليل السوق", enabled: true },
  { id: "financial", nameEn: "Financial Model", nameAr: "النموذج المالي", enabled: true },
  { id: "legal", nameEn: "Legal & Regulatory", nameAr: "القانوني والتنظيمي", enabled: false },
  { id: "risk", nameEn: "Risk Assessment", nameAr: "تقييم المخاطر", enabled: true },
  { id: "implementation", nameEn: "Implementation Plan", nameAr: "خطة التنفيذ", enabled: false },
  { id: "recommendations", nameEn: "Recommendations", nameAr: "التوصيات", enabled: true },
]

export function SecureShareModal({
  isOpen,
  onClose,
  onShare,
  reportTitle = "Real Estate Investment Analysis",
  sections = defaultSections,
}: SecureShareModalProps) {
  const { language, isRTL } = useNexus()
  const [sectionStates, setSectionStates] = useState(sections)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [expiresIn, setExpiresIn] = useState("7d")
  const [requireVerification, setRequireVerification] = useState(true)
  const [addWatermark, setAddWatermark] = useState(true)
  const [allowDownload, setAllowDownload] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareComplete, setShareComplete] = useState(false)
  const [shareLink, setShareLink] = useState("")

  const toggleSection = (id: string) => {
    setSectionStates(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ))
  }

  const selectAll = () => {
    setSectionStates(prev => prev.map(s => ({ ...s, enabled: true })))
  }

  const deselectAll = () => {
    setSectionStates(prev => prev.map(s => ({ ...s, enabled: false })))
  }

  // SEC-INPUT-009: Validate email format properly to prevent injection via crafted addresses.
  // A bare "@" check allows payloads like `"><script>alert(1)</script>@x` through.
  // SEC-BL-018: Enforce max 50 recipients to prevent abuse
  const MAX_RECIPIENTS = 50
  const addRecipient = () => {
    const trimmedEmail = newEmail.trim()
    if (recipients.length >= MAX_RECIPIENTS) return
    if (trimmedEmail && /^[^\s@<>'"]+@[^\s@<>'"]+\.[^\s@<>'"]+$/.test(trimmedEmail) && trimmedEmail.length <= 254) {
      // Prevent duplicate recipients
      if (!recipients.some(r => r.email === trimmedEmail)) {
        setRecipients(prev => [...prev, { email: trimmedEmail, role: "read_only" }])
      }
      setNewEmail("")
    }
  }

  const removeRecipient = (email: string) => {
    setRecipients(prev => prev.filter(r => r.email !== email))
  }

  const updateRecipientRole = (email: string, role: Recipient["role"]) => {
    setRecipients(prev => prev.map(r => 
      r.email === email ? { ...r, role } : r
    ))
  }

  const handleShare = async () => {
    // SEC-BL-017: Prevent sharing with no sections selected — nothing to share
    const enabledSections = sectionStates.filter(s => s.enabled)
    if (enabledSections.length === 0) return

    setIsSharing(true)

    // Simulate share API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // SECURITY: Use crypto.getRandomValues() instead of Math.random() for unpredictable share link IDs
    const randomBytes = new Uint8Array(8)
    crypto.getRandomValues(randomBytes)
    const shareId = Array.from(randomBytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 12)
    const link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://nexusad.ai'}/share/${shareId}`
    setShareLink(link)
    setShareComplete(true)
    setIsSharing(false)
    
    onShare?.({
      sections: sectionStates.filter(s => s.enabled).map(s => s.id),
      recipients,
      settings: {
        expiresIn,
        requireVerification,
        addWatermark,
        allowDownload,
      },
    })
  }

  // SEC-SM-001: Clipboard API requires user gesture + secure context permission.
  // Unhandled rejection crashes the UI if permission is denied or unavailable.
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {
      // Clipboard API denied — silently fail (link is already visible in the input)
    }
  }

  const handleClose = () => {
    setShareComplete(false)
    setShareLink("")
    setRecipients([])
    setNewEmail("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)" }}
        role="dialog"
        aria-modal="true"
        aria-label={language === "ar" ? "مشاركة التقرير بأمان" : "Share Report Securely"}
        onClick={(e) => e.target === e.currentTarget && handleClose()}
        onKeyDown={(e) => { if (e.key === "Escape") handleClose() }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-xl"
          style={{
            background: "rgba(15, 29, 50, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Share Complete State */}
          {shareComplete ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-[#10B981]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                {language === "ar" ? "تمت المشاركة بنجاح!" : "Shared Successfully!"}
              </h2>
              <p className="text-sm text-[#94A3B8] mb-6">
                {recipients.length > 0 
                  ? (language === "ar" 
                    ? `سيتلقى ${recipients.length} مستلم(ين) رابطاً آمناً عبر البريد الإلكتروني.`
                    : `${recipients.length} recipient(s) will receive a secure link via email.`)
                  : (language === "ar" ? "تم إنشاء رابط المشاركة الآمن." : "Secure share link generated.")
                }
              </p>
              
              {/* Share Link */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0A1628] mb-6">
                <label htmlFor="share-link-url" className="sr-only">
                  {language === "ar" ? "رابط المشاركة" : "Share link URL"}
                </label>
                <input
                  id="share-link-url"
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-white outline-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="text-[#2563EB]"
                  aria-label={language === "ar" ? "نسخ الرابط" : "Copy link"}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={handleClose}
                className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90"
              >
                {language === "ar" ? "تم" : "Done"}
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2563EB]/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {language === "ar" ? "مشاركة التقرير بأمان" : "Share Report Securely"}
                      </h2>
                      <p className="text-xs text-[#94A3B8]">
                        {language === "ar" 
                          ? "تحكم في ما يراه الآخرون بدقة. جميع المشاركات مشفرة ومتتبعة."
                          : "Control exactly what others see. All shares are encrypted and tracked."
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                    aria-label={language === "ar" ? "إغلاق" : "Close"}
                  >
                    <X className="h-5 w-5 text-[#94A3B8]" />
                  </button>
                </div>
              </div>

              {/* Section Selection */}
              <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">
                    {language === "ar" ? "اختر الأقسام للمشاركة" : "Select sections to share"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-[#2563EB] hover:underline"
                    >
                      {language === "ar" ? "تحديد الكل" : "Select All"}
                    </button>
                    <span className="text-[#94A3B8]">|</span>
                    <button
                      onClick={deselectAll}
                      className="text-xs text-[#2563EB] hover:underline"
                    >
                      {language === "ar" ? "إلغاء الكل" : "Deselect All"}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {sectionStates.map(section => (
                    <button
                      key={section.id}
                      onClick={() => toggleSection(section.id)}
                      aria-pressed={section.enabled}
                      aria-label={`${language === "ar" ? section.nameAr : section.nameEn}: ${section.enabled ? (language === "ar" ? "مُحدد" : "selected") : (language === "ar" ? "غير محدد" : "deselected")}`}
                      className={cn(
                        "w-full p-3 rounded-lg flex items-center justify-between transition-all",
                        "border",
                        section.enabled
                          ? "bg-[#2563EB]/10 border-[#2563EB]/50"
                          : "bg-[#0A1628] border-[rgba(255,255,255,0.08)]"
                      )}
                    >
                      <span className={cn(
                        "text-sm",
                        section.enabled ? "text-white" : "text-[#94A3B8]"
                      )} aria-hidden="true">
                        {section.enabled ? "☑" : "☐"} {language === "ar" ? section.nameAr : section.nameEn}
                      </span>
                      {!section.enabled && (
                        <Badge className="bg-[#EF4444]/20 text-[#EF4444] text-[10px]">
                          {language === "ar" ? "سيتم حجبه" : "Will be redacted"}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
                <span className="text-sm font-medium text-white block mb-3">
                  {language === "ar" ? "مشاركة مع" : "Share with"}
                </span>
                
                <div className="flex gap-2 mb-3">
                  <label htmlFor="share-recipient-email" className="sr-only">
                    {language === "ar" ? "البريد الإلكتروني للمستلم" : "Recipient email address"}
                  </label>
                  <Input
                    id="share-recipient-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={language === "ar" ? "البريد الإلكتروني" : "Email address"}
                    className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]"
                    onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                    maxLength={254}
                  />
                  <Button
                    onClick={addRecipient}
                    className="bg-[#2563EB] hover:bg-[#2563EB]/90"
                    aria-label={language === "ar" ? "إضافة مستلم" : "Add recipient"}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {recipients.length > 0 && (
                  <div className="space-y-2">
                    {recipients.map(recipient => (
                      <div
                        key={recipient.email}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#0A1628]"
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeRecipient(recipient.email)}
                            className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
                            aria-label={language === "ar" ? `إزالة ${recipient.email}` : `Remove ${recipient.email}`}
                          >
                            <X className="h-3 w-3 text-[#94A3B8]" />
                          </button>
                          <span className="text-sm text-white">{recipient.email}</span>
                        </div>
                        <Select
                          value={recipient.role}
                          onValueChange={(v) => updateRecipientRole(recipient.email, v as Recipient["role"])}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs bg-transparent border-[rgba(255,255,255,0.08)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read_only">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {language === "ar" ? "قراءة فقط" : "Read Only"}
                              </span>
                            </SelectItem>
                            <SelectItem value="can_comment">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {language === "ar" ? "يمكنه التعليق" : "Can Comment"}
                              </span>
                            </SelectItem>
                            <SelectItem value="can_request_refinement">
                              <span className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {language === "ar" ? "يمكنه طلب التحسين" : "Can Request Refinement"}
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Security Settings */}
              <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
                <span className="text-sm font-medium text-white block mb-3">
                  {language === "ar" ? "إعدادات الأمان" : "Security Settings"}
                </span>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#94A3B8]">
                      {language === "ar" ? "ينتهي الرابط في" : "Link expires in"}
                    </span>
                    <Select value={expiresIn} onValueChange={setExpiresIn}>
                      <SelectTrigger className="w-[120px] h-8 text-xs bg-[#0A1628] border-[rgba(255,255,255,0.08)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">{language === "ar" ? "24 ساعة" : "24 hours"}</SelectItem>
                        <SelectItem value="7d">{language === "ar" ? "7 أيام" : "7 days"}</SelectItem>
                        <SelectItem value="30d">{language === "ar" ? "30 يوم" : "30 days"}</SelectItem>
                        <SelectItem value="never">{language === "ar" ? "أبداً" : "Never"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label htmlFor="require-verification" className="text-sm text-[#94A3B8] cursor-pointer">
                      {language === "ar" ? "يتطلب التحقق من البريد" : "Require email verification"}
                    </label>
                    <Switch
                      id="require-verification"
                      checked={requireVerification}
                      onCheckedChange={setRequireVerification}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="add-watermark" className="text-sm text-[#94A3B8] cursor-pointer">
                      {language === "ar" ? "إضافة علامة مائية باسم المستلم" : "Add watermark with recipient name"}
                    </label>
                    <Switch
                      id="add-watermark"
                      checked={addWatermark}
                      onCheckedChange={setAddWatermark}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="allow-download" className="text-sm text-[#94A3B8] cursor-pointer">
                      {language === "ar" ? "السماح بتحميل PDF" : "Allow PDF download"}
                    </label>
                    <Switch
                      id="allow-download"
                      checked={allowDownload}
                      onCheckedChange={setAllowDownload}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
                <span className="text-sm font-medium text-white block mb-3">
                  {language === "ar" ? "معاينة المستلم" : "Recipient Preview"}
                </span>
                
                <div className="p-3 rounded-lg bg-[#0A1628] border border-[rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                    <span className="text-xs text-[#10B981]">
                      {language === "ar" ? "موثق وسيادي" : "Verified & Sovereign"}
                    </span>
                  </div>
                  <p className="text-sm text-white mb-1">{reportTitle}</p>
                  {addWatermark && recipients[0] && (
                    <p className="text-[10px] text-[#94A3B8] italic">
                      {language === "ar" 
                        ? `تمت المشاركة مع ${recipients[0].email} عبر NexusAD AI`
                        : `Shared with ${recipients[0].email} via NexusAD AI`
                      }
                    </p>
                  )}
                  <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.08)]">
                    <span className="text-[10px] text-[#94A3B8]">
                      {sectionStates.filter(s => !s.enabled).length > 0 && (
                        <span className="text-[#F59E0B]">
                          [{sectionStates.filter(s => !s.enabled).length} {language === "ar" ? "أقسام محجوبة" : "sections redacted"}]
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4">
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button
                    onClick={handleShare}
                    disabled={isSharing || sectionStates.filter(s => s.enabled).length === 0}
                    className="flex-1 bg-[#2563EB] hover:bg-[#2563EB]/90"
                  >
                    {isSharing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {language === "ar" ? "جاري المشاركة..." : "Sharing..."}
                      </span>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 me-2" />
                        {language === "ar" ? "مشاركة" : "Share"}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-[#94A3B8] text-center mt-3">
                  {language === "ar" 
                    ? "سيتلقى المستلمون رابطاً آمناً عبر البريد الإلكتروني. يتم تسجيل جميع المشاهدات في لوحة الامتثال الخاصة بك."
                    : "Recipients will receive a secure link via email. All views are logged in your Compliance Dashboard."
                  }
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Trigger button for use in Pro reports
export function SecureShareTrigger({ onClick }: { onClick: () => void }) {
  const { language } = useNexus()
  
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/10"
    >
      <Shield className="h-4 w-4 me-2" />
      {language === "ar" ? "مشاركة آمنة" : "Share Securely"}
    </Button>
  )
}
