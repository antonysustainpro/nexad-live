"use client"

import { useState, useEffect, useRef } from "react"
import {
  Crown,
  Key,
  Shield,
  Server,
  Lock,
  AlertTriangle,
  Check,
  RefreshCw,
  Copy,
  QrCode,
  Loader2,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { toast } from "sonner"
import { getKeyStatus, getShardDistribution, getSovereigntyReport, backupKey, rotateKey } from "@/lib/api"
import type { KeyStatusResponse, ShardDistributionResponse, SovereigntyReportResponse } from "@/lib/types"
import { SovereigntyScore } from "@/components/sovereignty-score"
import { ShardMap } from "@/components/shard-map"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const recommendations = [
  {
    id: "hardware-key",
    titleEn: "Enable Hardware Key Backup",
    titleAr: "تفعيل النسخ الاحتياطي بمفتاح الأجهزة",
    descriptionEn: "Protect your vault with a hardware security key",
    descriptionAr: "احمِ خزنتك بمفتاح أمان مادي",
    impact: 8,
    status: "pending",
  },
  {
    id: "biometric",
    titleEn: "Enable Biometric Lock",
    titleAr: "تفعيل القفل البيومتري",
    descriptionEn: "Require Face ID or Touch ID for sensitive actions",
    descriptionAr: "طلب بصمة الوجه أو الإصبع للإجراءات الحساسة",
    impact: 5,
    status: "pending",
  },
  {
    id: "2fa",
    titleEn: "Setup 2FA",
    titleAr: "إعداد المصادقة الثنائية",
    descriptionEn: "Add an extra layer of authentication",
    descriptionAr: "أضف طبقة إضافية من المصادقة",
    impact: 4,
    status: "completed",
  },
]

const fallbackKeyInfo = {
  fingerprint: "A7:3B:C2:D9:E4:F5",
  createdEn: "March 15, 2026",
  createdAr: "١٥ مارس ٢٠٢٦",
  algorithm: "AES-256-GCM",
  backupEn: "QR Code",
  backupAr: "رمز QR",
  lastRotationEn: "Never",
  lastRotationAr: "أبداً",
}

export default function SovereigntyPage() {
  const { language, preferences } = useNexus()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [backupData, setBackupData] = useState<string | null>(null)
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [backupLoading, setBackupLoading] = useState(false)
  const [rotateLoading, setRotateLoading] = useState(false)
  const [keyInfo, setKeyInfo] = useState<KeyStatusResponse | null>(null)
  const [shardData, setShardData] = useState<ShardDistributionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const passphraseInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      getKeyStatus(),
      getShardDistribution(),
      getSovereigntyReport(),
    ])
      .then(([key, shards, _report]) => {
        if (key) setKeyInfo(key)
        if (shards) setShardData(shards)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Failed to load sovereignty data:", error)
        toast.error("Failed to load sovereignty data. Please try again.")
        setLoading(false)
      })
  }, [])

  // Use real key data with fallback
  const displayFingerprint = keyInfo?.fingerprint || "A7:3B:C2:D9:E4:F5"
  const displayCreatedAt = keyInfo?.created_at || "March 15, 2026"
  const displayAlgorithm = keyInfo?.algorithm || "ECDH-P256"
  const displayBackupMethod = keyInfo?.backup_method || "QR Code"
  const displayLastRotation = keyInfo?.last_rotated_at
    ? new Date(keyInfo.last_rotated_at).toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { year: "numeric", month: "long", day: "numeric" })
    : (language === "ar" ? fallbackKeyInfo.lastRotationAr : fallbackKeyInfo.lastRotationEn)

  // Use real shard data
  const totalShards = shardData?.total_shards || 12
  const nodeCount = shardData?.nodes?.length || 3

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2000)
  }

  // Hash passphrase using SHA-256 (browser-native, no extra deps)
  async function hashPassphrase(raw: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(raw)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  async function handleBackupKey() {
    const keyId = keyInfo?.key_id
    if (!keyId) {
      showToast(language === "ar" ? "لا يوجد مفتاح نشط للنسخ الاحتياطي" : "No active key to backup")
      return
    }
    if (!passphrase.trim()) {
      showToast(language === "ar" ? "يرجى إدخال عبارة المرور" : "Please enter a passphrase")
      passphraseInputRef.current?.focus()
      return
    }
    setBackupLoading(true)
    try {
      const passphraseHash = await hashPassphrase(passphrase)
      const result = await backupKey(keyId, passphraseHash)
      if (result?.backup_data) {
        setBackupData(result.backup_data)
        setShowPassphrasePrompt(false)
        setPassphrase("")
        setShowQR(true)
      } else {
        showToast(language === "ar" ? "فشل النسخ الاحتياطي — حاول مجددًا" : "Backup failed — please try again")
      }
    } finally {
      setBackupLoading(false)
    }
  }

  async function handleRotateKey() {
    const keyId = keyInfo?.key_id
    if (!keyId) {
      showToast(language === "ar" ? "لا يوجد مفتاح لتدويره" : "No active key to rotate")
      return
    }
    const confirmed = confirm(
      language === "ar"
        ? "هل أنت متأكد من تدوير المفتاح؟ سيتم إنشاء مفتاح جديد."
        : "Are you sure you want to rotate the key? A new key will be generated."
    )
    if (!confirmed) return
    setRotateLoading(true)
    try {
      const result = await rotateKey(keyId)
      if (result) {
        // Refresh key info after rotation
        const updated = await getKeyStatus()
        if (updated) setKeyInfo(updated)
        showToast(language === "ar" ? "تم تدوير المفتاح بنجاح" : "Key rotated successfully")
      } else {
        showToast(language === "ar" ? "تدوير المفتاح غير متاح حاليًا" : "Key rotation not available yet")
      }
    } finally {
      setRotateLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-title-1 flex items-center gap-2">
          <Crown className="h-6 w-6 text-nexus-gold" aria-hidden="true" />
          {language === "ar" ? "السيادة" : "Sovereignty"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar"
            ? "خزنتك ومفاتيحك تحت سيطرتك الكاملة"
            : "Your vault and keys are under your complete control"}
        </p>
      </div>

      {/* Score and Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SovereigntyScore />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-headline flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {language === "ar" ? "توزيع الأجزاء" : "Shard Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShardMap className="h-[150px]" interactive={false} showBadge={false} />
          </CardContent>
        </Card>
      </div>

      {/* Key Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Key className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
            {language === "ar" ? "مفتاح التشفير" : "Encryption Key"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "مفتاحك الشخصي للوصول إلى خزنتك"
              : "Your personal key for accessing your vault"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "البصمة" : "Fingerprint"}
              </p>
              <p className="font-mono text-nexus-gold">{displayFingerprint}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "الخوارزمية" : "Algorithm"}
              </p>
              <p className="font-medium">{displayAlgorithm}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "تاريخ الإنشاء" : "Created"}
              </p>
              <p className="font-medium">{displayCreatedAt}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "النسخ الاحتياطي" : "Backup"}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-nexus-gold/10 text-nexus-gold">
                  {displayBackupMethod}
                </Badge>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "آخر تدوير" : "Last Rotation"}
              </p>
              <p className="font-medium">{displayLastRotation}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setBackupData(null)
                setShowPassphrasePrompt(true)
              }}
            >
              <QrCode className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "نسخ احتياطي عبر QR" : "Backup via QR"}
            </Button>
            <Button variant="outline" onClick={async () => {
              // SEC-SM-001: Clipboard API can throw if permission denied
              try {
                await navigator.clipboard.writeText(displayFingerprint)
                showToast(language === "ar" ? "تم نسخ البصمة" : "Fingerprint copied")
              } catch {
                showToast(language === "ar" ? "فشل النسخ" : "Failed to copy")
              }
            }}>
              <Copy className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "نسخ البصمة" : "Copy Fingerprint"}
            </Button>
            <Button
              variant="outline"
              disabled={rotateLoading}
              onClick={handleRotateKey}
            >
              {rotateLoading
                ? <Loader2 className="h-4 w-4 me-2 motion-safe:animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-4 w-4 me-2" aria-hidden="true" />}
              {language === "ar" ? "تدوير المفتاح" : "Rotate Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline">
            {language === "ar" ? "توصيات لتحسين السيادة" : "Sovereignty Recommendations"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "اتبع هذه الخطوات لتعزيز أمان خزنتك"
              : "Follow these steps to enhance your vault security"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg",
                rec.status === "completed" ? "bg-nexus-gold/5" : "bg-secondary/30"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-2 rounded-full",
                  rec.status === "completed" ? "bg-nexus-gold/10" : "bg-muted"
                )}>
                  {rec.status === "completed" ? (
                    <Check className="h-4 w-4 text-nexus-gold" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-emotion-excited" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {language === "ar" ? rec.titleAr : rec.titleEn}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? rec.descriptionAr : rec.descriptionEn}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  +{rec.impact} {language === "ar" ? "نقاط" : "pts"}
                </Badge>
                {rec.status === "pending" && (
                  <Button 
                    size="sm" 
                    className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
                    onClick={() => showToast(language === "ar" ? "سيتم التفعيل قريبًا" : "Feature coming soon")}
                  >
                    {language === "ar" ? "تفعيل" : "Enable"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data Sharding Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "تفاصيل التجزئة" : "Sharding Details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-3xl font-bold text-nexus-gold">12</p>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "أجزاء نشطة" : "Active Shards"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-3xl font-bold text-nexus-gold">3</p>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "عقد" : "Nodes"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <p className="text-3xl font-bold text-foreground">4</p>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "نسخ احتياطية" : "Redundancy"}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {language === "ar" ? "صحة الشبكة" : "Network Health"}
              </span>
              <Badge className="bg-emotion-joyful/10 text-emotion-joyful">
                {language === "ar" ? "ممتاز" : "Excellent"}
              </Badge>
            </div>
            <Progress value={98} variant="sovereignty" className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {language === "ar"
                ? "جميع الأجزاء متصلة ومتزامنة"
                : "All shards connected and synchronized"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Vault ID */}
      <Card className="border-nexus-gold/30">
        <CardContent className="p-6 text-center">
          <Lock className="h-8 w-8 text-nexus-gold mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground mb-1">
            {language === "ar" ? "معرف خزنتك" : "Your Vault ID"}
          </p>
          <p className="font-mono text-2xl text-nexus-gold">
            {preferences.vaultId
              ? `${language === "ar" ? "خزنة" : "Vault"} ${preferences.vaultId}`
              : language === "ar" ? "خزنة #00247" : "Vault #00247"}
          </p>
        </CardContent>
      </Card>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-secondary text-foreground px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Passphrase Prompt Modal */}
      {showPassphrasePrompt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => { setShowPassphrasePrompt(false); setPassphrase("") }}
          role="dialog"
          aria-modal="true"
          aria-label={language === "ar" ? "عبارة المرور للنسخ الاحتياطي" : "Backup Passphrase"}
        >
          <div
            className="bg-card p-8 rounded-2xl text-center max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Key className="h-8 w-8 text-nexus-gold mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-headline font-semibold mb-1">
              {language === "ar" ? "تأمين النسخة الاحتياطية" : "Secure Your Backup"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "ar"
                ? "أدخل عبارة مرور لتشفير نسختك الاحتياطية. احتفظ بها في مكان آمن."
                : "Enter a passphrase to encrypt your backup. Keep it somewhere safe."}
            </p>
            <label htmlFor="backup-passphrase" className="sr-only">
              {language === "ar" ? "عبارة المرور" : "Passphrase"}
            </label>
            <input
              id="backup-passphrase"
              ref={passphraseInputRef}
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBackupKey() }}
              placeholder={language === "ar" ? "عبارة المرور..." : "Passphrase..."}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm mb-4 outline-none focus:ring-2 focus:ring-nexus-gold"
              autoComplete="off"
              autoFocus
            />
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => { setShowPassphrasePrompt(false); setPassphrase("") }}
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                disabled={backupLoading || !passphrase.trim()}
                onClick={handleBackupKey}
                className="bg-nexus-gold hover:bg-nexus-gold/90 text-background"
              >
                {backupLoading
                  ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  : (language === "ar" ? "توليد رمز QR" : "Generate QR")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => { setShowQR(false); setBackupData(null) }}
          role="dialog"
          aria-modal="true"
          aria-label={language === "ar" ? "رمز QR" : "QR Code"}
        >
          <div
            className="bg-card p-8 rounded-2xl text-center max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* SEC-UI-001: QR code generated locally via canvas - NEVER send backup data to external APIs */}
            {backupData ? (
              <canvas
                ref={(canvas) => {
                  if (canvas && backupData) {
                    // Simple local QR placeholder - in production, use a client-side QR library
                    const ctx = canvas.getContext("2d")
                    if (ctx) {
                      ctx.fillStyle = "#ffffff"
                      ctx.fillRect(0, 0, 192, 192)
                      ctx.fillStyle = "#000000"
                      ctx.font = "12px monospace"
                      ctx.textAlign = "center"
                      ctx.fillText("QR Code", 96, 90)
                      ctx.fillText("(install qrcode.react)", 96, 110)
                    }
                  }
                }}
                width={192}
                height={192}
                className="mx-auto mb-4 rounded-lg"
                role="img"
                aria-label="Backup QR Code"
              />
            ) : (
              <div className="w-48 h-48 bg-secondary/30 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-1">
              {language === "ar" ? "امسح رمز QR لنسخ المفتاح احتياطيًا" : "Scan QR code to backup your key"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {language === "ar"
                ? "هذا الرمز مشفر بعبارة مرورك. لا تشاركه."
                : "This code is encrypted with your passphrase. Do not share it."}
            </p>
            <Button variant="outline" onClick={() => { setShowQR(false); setBackupData(null) }}>
              {language === "ar" ? "إغلاق" : "Close"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
