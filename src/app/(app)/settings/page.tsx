"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Settings,
  Bell,
  Moon,
  Sun,
  Globe,
  Volume2,
  Palette,
  Keyboard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Trash2,
  CreditCard,
  Crown,
  Loader2,
  Download,
  Cookie,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { getSettings, updateSettings, logout, clearAllUserData, recordConsentServer, type SettingsPayload } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function SettingsPage() {
  const { language, setLanguage, preferences, updatePreferences, theme, setTheme } = useNexus()
  const [fontSize, setFontSize] = useState(preferences.fontSize || "medium")
  const [loaded, setLoaded] = useState(false)
  const [isClearingData, setIsClearingData] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load settings from backend on mount (merge with local)
  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    // SEC-SM-003: Safe JSON.parse with try/catch — localStorage can be corrupted/tampered
    let userId: string | null = null
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
      userId = storedUser ? JSON.parse(storedUser).id : null
    } catch {
      // Corrupted localStorage — treat as no user
    }
    if (!userId) {
      setLoaded(true)
      return
    }
    getSettings(userId, abortController.signal).then((remote) => {
      if (!isMounted) return
      if (remote) {
        const merged: Record<string, unknown> = {}
        if (remote.fontSize) merged.fontSize = remote.fontSize
        if (remote.sendSound !== undefined) merged.sendSound = remote.sendSound
        if (remote.arriveSound !== undefined) merged.arriveSound = remote.arriveSound
        if (remote.successSound !== undefined) merged.successSound = remote.successSound
        if (remote.masterVolume !== undefined) merged.masterVolume = remote.masterVolume
        if (remote.localProcessingOnly !== undefined) merged.localProcessingOnly = remote.localProcessingOnly
        if (remote.biometricLock !== undefined) merged.biometricLock = remote.biometricLock
        if (remote.autoLockTimeout) merged.autoLockTimeout = remote.autoLockTimeout
        if (remote.pushNotifications !== undefined) merged.pushNotifications = remote.pushNotifications
        if (Object.keys(merged).length > 0) {
          updatePreferences(merged as Partial<typeof preferences>)
        }
        if (remote.theme) setTheme(remote.theme as "light" | "dark" | "system")
        if (remote.language) setLanguage(remote.language as "en" | "ar" | "bilingual")
        if (remote.fontSize) setFontSize(remote.fontSize as "small" | "medium" | "large")
      }
      setLoaded(true)
    }).catch(() => {
      if (isMounted) setLoaded(true)
    })

    return () => {
      isMounted = false
      abortController.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced save to backend whenever preferences change
  const persistSettings = useCallback((payload: SettingsPayload) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
      let userId: string | null = null
      try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
        userId = storedUser ? JSON.parse(storedUser).id : null
      } catch {
        // Corrupted localStorage
      }
      if (!userId) return
      const result = await updateSettings(userId, payload)
      if (result) {
        toast.success(language === "ar" ? "تم حفظ الإعدادات" : "Settings saved")
      }
    }, 800)
  }, [language])

  // Wrap updatePreferences to also persist to backend
  const handleUpdatePreferences = useCallback((prefs: Partial<typeof preferences>) => {
    updatePreferences(prefs)
    persistSettings(prefs as SettingsPayload)
  }, [updatePreferences, persistSettings])

  const handleThemeChange = (v: string) => {
    const newTheme = v as "light" | "dark" | "system"
    setTheme(newTheme)
    persistSettings({ theme: newTheme })
  }

  const handleLanguageChange = (v: string) => {
    const newLang = v as "en" | "ar" | "bilingual"
    setLanguage(newLang)
    persistSettings({ language: newLang })
  }

  // FIX 4: Apply font size when it changes
  const handleFontSizeChange = (size: string) => {
    const validSize = size as "small" | "medium" | "large"
    setFontSize(validSize)
    handleUpdatePreferences({ fontSize: validSize })
    const fontSizeMap: Record<string, string> = { small: "14px", medium: "16px", large: "18px" }
    document.documentElement.style.fontSize = fontSizeMap[size] || "16px"
  }

  // FIX 6: Sound preview function with proper AudioContext cleanup
  const playPreviewSound = (type: "send" | "arrive" | "success") => {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = (preferences.masterVolume ?? 15) / 100

    if (type === "send") { osc.frequency.value = 220; osc.type = "sine" }
    if (type === "arrive") { osc.frequency.value = 440; osc.type = "sine" }
    if (type === "success") { osc.frequency.value = 660; osc.type = "triangle" }

    osc.start()
    osc.stop(ctx.currentTime + 0.15)

    // Clean up AudioContext after the sound finishes
    // Add small buffer to ensure the sound completes
    setTimeout(() => {
      ctx.close()
    }, 200)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-title-1 flex items-center gap-2">
          <Settings className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          {language === "ar" ? "الإعدادات" : "Settings"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar"
            ? "تخصيص تجربة NexusAD Ai الخاصة بك"
            : "Customize your NexusAD Ai experience"}
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "المظهر" : "Appearance"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <Label>{language === "ar" ? "السمة" : "Theme"}</Label>
            <RadioGroup
              value={theme}
              onValueChange={handleThemeChange}
              className="grid grid-cols-3 gap-3"
            >
              {[
                { value: "light", labelEn: "Light", labelAr: "فاتح", icon: Sun },
                { value: "dark", labelEn: "Dark", labelAr: "داكن", icon: Moon },
                { value: "system", labelEn: "System", labelAr: "النظام", icon: Settings },
              ].map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                    theme === option.value
                      ? "border-nexus-jade bg-nexus-jade/10"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <option.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{language === "ar" ? option.labelAr : option.labelEn}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <Label>{language === "ar" ? "حجم الخط" : "Font Size"}</Label>
            <Select value={fontSize} onValueChange={handleFontSizeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{language === "ar" ? "صغير" : "Small"}</SelectItem>
                <SelectItem value="medium">{language === "ar" ? "متوسط" : "Medium"}</SelectItem>
                <SelectItem value="large">{language === "ar" ? "كبير" : "Large"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "اللغة" : "Language"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={language}
            onValueChange={handleLanguageChange}
            className="space-y-3"
          >
            {[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
              { value: "bilingual", label: "Bilingual / ثنائي اللغة" },
            ].map((option) => (
              <Label
                key={option.value}
                htmlFor={`lang-${option.value}`}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                  language === option.value
                    ? "border-nexus-jade bg-nexus-jade/10"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <RadioGroupItem value={option.value} id={`lang-${option.value}`} />
                <span>{option.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Sound Design */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "تصميم الصوت" : "Sound Design"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "ثلاثة أصوات خفيفة. اختيارية. 30% حد أقصى."
              : "Three subtle sounds. Opt-in. 30% volume max."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Send Sound */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="send-sound" className="font-medium cursor-pointer">{language === "ar" ? "إرسال" : "Send"}</Label>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "نقرة خفيفة عند إرسال الرسالة" : "Soft thump when message sent"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => playPreviewSound("send")} aria-label={language === "ar" ? "معاينة صوت الإرسال" : "Preview send sound"}>
                {language === "ar" ? "معاينة" : "Preview"}
              </Button>
              <Switch
                id="send-sound"
                checked={preferences.sendSound ?? false}
                onCheckedChange={(checked) => handleUpdatePreferences({ sendSound: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* Arrive Sound */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="arrive-sound" className="font-medium cursor-pointer">{language === "ar" ? "وصول" : "Arrive"}</Label>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "رنين بلوري عند استلام الرد" : "Crystalline chime when response received"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => playPreviewSound("arrive")} aria-label={language === "ar" ? "معاينة صوت الوصول" : "Preview arrive sound"}>
                {language === "ar" ? "معاينة" : "Preview"}
              </Button>
              <Switch
                id="arrive-sound"
                checked={preferences.arriveSound ?? false}
                onCheckedChange={(checked) => handleUpdatePreferences({ arriveSound: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* Success Sound */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="success-sound" className="font-medium cursor-pointer">{language === "ar" ? "نجاح" : "Success"}</Label>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "رنين متناغم عند الاكتمال" : "Harmonic resonance on completion"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => playPreviewSound("success")} aria-label={language === "ar" ? "معاينة صوت النجاح" : "Preview success sound"}>
                {language === "ar" ? "معاينة" : "Preview"}
              </Button>
              <Switch
                id="success-sound"
                checked={preferences.successSound ?? false}
                onCheckedChange={(checked) => handleUpdatePreferences({ successSound: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* Master Volume */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "مستوى الصوت الرئيسي" : "Master Volume"}</Label>
              <span className="text-sm text-muted-foreground">{preferences.masterVolume ?? 15}%</span>
            </div>
            <Slider
              aria-label={language === "ar" ? "مستوى الصوت الرئيسي" : "Master Volume"}
              value={[preferences.masterVolume ?? 15]}
              onValueChange={([v]) => handleUpdatePreferences({ masterVolume: v })}
              min={0}
              max={30}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>30%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "الخصوصية والأمان" : "Privacy & Security"}
          </CardTitle>
          <CardDescription>
            {language === "ar" 
              ? "إعدادات السيادة وحماية البيانات"
              : "Sovereignty and data protection settings"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Local Processing Only */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="local-processing" className="font-medium cursor-pointer">
                {language === "ar" ? "المعالجة المحلية فقط" : "Local Processing Only"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "معالجة البيانات على الجهاز فقط (أبطأ)"
                  : "Process data on-device only (slower)"}
              </p>
            </div>
            <Switch
              id="local-processing"
              checked={preferences.localProcessingOnly ?? false}
              onCheckedChange={(checked) => handleUpdatePreferences({ localProcessingOnly: checked })}
            />
          </div>

          <Separator />

          {/* Biometric Lock */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="biometric-lock" className="font-medium cursor-pointer">
                {language === "ar" ? "القفل البيومتري" : "Biometric Lock"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "استخدام Face ID / Touch ID للوصول"
                  : "Use Face ID / Touch ID to access"}
              </p>
            </div>
            <Switch
              id="biometric-lock"
              checked={preferences.biometricLock ?? true}
              onCheckedChange={(checked) => handleUpdatePreferences({ biometricLock: checked })}
            />
          </div>

          <Separator />

          {/* Auto Lock Timeout */}
          <div className="space-y-3">
            <Label>{language === "ar" ? "مهلة القفل التلقائي" : "Auto-Lock Timeout"}</Label>
            <Select 
              value={preferences.autoLockTimeout ?? "5"} 
              onValueChange={(v) => handleUpdatePreferences({ autoLockTimeout: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{language === "ar" ? "دقيقة واحدة" : "1 minute"}</SelectItem>
                <SelectItem value="5">{language === "ar" ? "5 دقائق" : "5 minutes"}</SelectItem>
                <SelectItem value="15">{language === "ar" ? "15 دقيقة" : "15 minutes"}</SelectItem>
                <SelectItem value="30">{language === "ar" ? "30 دقيقة" : "30 minutes"}</SelectItem>
                <SelectItem value="never">{language === "ar" ? "أبدًا" : "Never"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Clear All Data */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {language === "ar" ? "مسح جميع البيانات" : "Clear All Data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "حذف جميع المحادثات والمستندات"
                  : "Delete all conversations and documents"}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isClearingData}>
                  {language === "ar" ? "مسح" : "Clear"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === "ar"
                      ? "هل أنت متأكد؟ سيتم حذف جميع المحادثات ومستندات الخزنة من الخادم والبيانات المحلية نهائياً. لا يمكن التراجع عن هذا الإجراء."
                      : "Are you sure? All conversations and vault documents will be permanently deleted from the server and locally. This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isClearingData}
                    onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                      // Prevent the dialog from closing immediately so we can show loading state
                      e.preventDefault()
                      setIsClearingData(true)
                      try {
                        const result = await clearAllUserData()
                        if (result.errors.length > 0) {
                          // Partial failure — warn but still clear localStorage and redirect
                          toast.warning(
                            language === "ar"
                              ? `تم المسح جزئياً: ${result.errors.join(", ")}`
                              : `Partially cleared: ${result.errors.join(", ")}`
                          )
                        } else {
                          toast.success(
                            language === "ar" ? "تم مسح جميع البيانات" : "All data cleared"
                          )
                        }
                      } catch {
                        toast.error(
                          language === "ar"
                            ? "فشل مسح البيانات من الخادم"
                            : "Failed to clear backend data"
                        )
                      } finally {
                        // Always clear localStorage and redirect regardless of backend result
                        try { localStorage.clear() } catch {}
                        window.location.href = "/welcome"
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isClearingData ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                        {language === "ar" ? "جارٍ المسح..." : "Clearing..."}
                      </span>
                    ) : (
                      language === "ar" ? "مسح الكل" : "Clear All"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Separator />

          {/* GDPR: Data Export Link */}
          <Link href="/settings/data-export" className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Download className="h-4 w-4 text-nexus-jade" aria-hidden="true" />
              <div>
                <p className="font-medium group-hover:text-nexus-jade transition-colors">
                  {language === "ar" ? "تصدير بياناتك" : "Export Your Data"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar"
                    ? "تنزيل جميع بياناتك بتنسيق JSON أو CSV"
                    : "Download all your data in JSON or CSV format"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Link>

          <Separator />

          {/* GDPR: Cookie Consent Management */}
          <button
            className="flex items-center justify-between w-full group"
            onClick={() => {
              // GDPR Art.7(3): Record consent withdrawal server-side before clearing localStorage
              void recordConsentServer({
                preferences: { essential: true, analytics: false, functional: false },
                method: "reject-all",
                version: "1.0",
              })
              try { localStorage.removeItem("nexusad-cookie-consent") } catch {}
              window.location.reload()
            }}
          >
            <div className="flex items-center gap-3">
              <Cookie className="h-4 w-4 text-nexus-gold" aria-hidden="true" />
              <div className="text-start">
                <p className="font-medium group-hover:text-nexus-gold transition-colors">
                  {language === "ar" ? "إدارة ملفات تعريف الارتباط" : "Manage Cookie Preferences"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar"
                    ? "تعديل موافقتك على ملفات تعريف الارتباط"
                    : "Change your cookie consent preferences"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </button>

          <Separator />

          {/* GDPR: Privacy Policy Link */}
          <Link href="/privacy-policy" className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium group-hover:text-foreground transition-colors">
                  {language === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar"
                    ? "قراءة سياسة الخصوصية الكاملة"
                    : "Read our full privacy policy"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "الإشعارات" : "Notifications"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push-notifications" className="font-medium cursor-pointer">
                {language === "ar" ? "إشعارات الدفع" : "Push Notifications"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "تلقي إشعارات للرسائل الجديدة"
                  : "Receive notifications for new messages"}
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences.pushNotifications ?? true}
              onCheckedChange={(checked) => handleUpdatePreferences({ pushNotifications: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "اختصارات لوحة المفاتيح" : "Keyboard Shortcuts"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { keys: "⌘ K", action: language === "ar" ? "بحث" : "Search" },
              { keys: "⌘ N", action: language === "ar" ? "محادثة جديدة" : "New Chat" },
              { keys: "⌘ .", action: language === "ar" ? "الوضع الصوتي" : "Voice Mode" },
              { keys: "⌘ ,", action: language === "ar" ? "الإعدادات" : "Settings" },
            ].map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">{shortcut.action}</span>
                <kbd className="px-2 py-1 rounded bg-secondary text-sm font-mono">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing & Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "الفواتير والاشتراك" : "Billing & Subscription"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Link 
            href="/billing"
            className="flex items-center justify-between w-full p-4 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
              <div>
                <span className="font-medium block">
                  {language === "ar" ? "إدارة الخطة" : "Manage Plan"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "عرض الاستخدام والترقية" : "View usage and upgrade"}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardContent className="p-0">
          <button 
            className="flex items-center justify-between w-full p-4 hover:bg-secondary/50 transition-colors"
            onClick={() => window.open("mailto:support@nexusad.com", "_blank", "noopener,noreferrer")}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">
                {language === "ar" ? "المساعدة والدعم" : "Help & Support"}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </button>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        onClick={async () => {
          try {
            await logout()
          } catch {
            // Logout API call failed - still clear local state
          }
          try {
            // SEC: Clear ALL user-related localStorage keys to prevent data leaking across sessions
            localStorage.removeItem("nexus-onboarded")
            localStorage.removeItem("nexus-preferences")
            localStorage.removeItem("nexus-user-display")
            localStorage.removeItem("nexus-conversations")
            localStorage.removeItem("nexus-user-id")
            localStorage.removeItem("nexus-referral-code")
            localStorage.removeItem("nexus-sidebar-collapsed")
            localStorage.removeItem("nexusad-client-profile")
            localStorage.removeItem("nexusad-billing-tier")
            localStorage.removeItem("nexusad-onboarding-checklist")
          } catch {}
          window.location.href = "/welcome"
        }}
      >
        <LogOut className="h-4 w-4 me-2" aria-hidden="true" />
        {language === "ar" ? "تسجيل الخروج" : "Sign Out"}
      </Button>

      {/* Version */}
      <p className="text-center text-sm text-muted-foreground">
        NexusAD Ai v1.0.0 (Build 2026.03.22)
      </p>
    </div>
  )
}
