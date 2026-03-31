"use client"

import { useState, useEffect } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { UserProfile } from "@/lib/types"
import { getUserProfile, updateUserProfile } from "@/lib/api"
import { ProfileAvatarUpload } from "@/components/profile-avatar-upload"
import { ProfileDangerZone } from "@/components/profile-danger-zone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CircleUser, Copy, Eye, EyeOff, Crown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

// Default empty profile used as fallback when API returns null
const defaultProfile: UserProfile = {
  id: "",
  fullName: "",
  email: "",
  company: "",
  phone: "",
  role: "",
  avatarUrl: null,
  apiKey: "",
  tier: "FREE",
  memberSince: new Date().toISOString(),
}

export default function ProfilePage() {
  const { language, isRTL, preferences, updatePreferences } = useNexus()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      setIsLoading(true)
      try {
        // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
        let userId: string | null = null
        try {
          const storedUser = typeof window !== "undefined"
            ? localStorage.getItem("nexus-user-display")
            : null
          userId = storedUser ? JSON.parse(storedUser).id : null
        } catch {
          // Corrupted localStorage
        }
        if (!userId) {
          setProfile(null)
          return
        }
        const data = await getUserProfile(userId)
        setProfile(data)
      } catch {
        setProfile(null)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    if (!profile) return
    setIsSaving(true)
    try {
      // Get user ID from profile state (already loaded)
      const userId = profile.id
      if (!userId) {
        throw new Error("No user ID")
      }
      const result = await updateUserProfile(userId, profile)
      if (!result) {
        throw new Error("API unavailable")
      }
      updatePreferences({ name: profile.fullName, avatarUrl: profile.avatarUrl })
      toast.success(language === "ar" ? "تم حفظ التغييرات" : "Changes saved")
    } catch {
      toast.error(language === "ar" ? "فشل حفظ التغييرات" : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyApiKey = async () => {
    if (!profile) return
    try {
      await navigator.clipboard.writeText(profile.apiKey)
      toast.success(language === "ar" ? "تم نسخ مفتاح API" : "API key copied")
    } catch {
      toast.error(language === "ar" ? "فشل النسخ" : "Failed to copy")
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 pb-24 md:pb-8">
        <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
          <CircleUser className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">
            {language === "ar" ? "الملف الشخصي" : "Profile"}
          </h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 motion-safe:animate-spin text-nexus-jade" aria-hidden="true" />
          <span className="ml-3 text-muted-foreground">
            {language === "ar" ? "جارٍ تحميل الملف الشخصي..." : "Loading profile..."}
          </span>
        </div>
      </div>
    )
  }

  // No profile exists - show setup message
  if (!profile) {
    return (
      <div className="container max-w-2xl mx-auto px-4 pb-24 md:pb-8">
        <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
          <CircleUser className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">
            {language === "ar" ? "الملف الشخصي" : "Profile"}
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CircleUser className="h-16 w-16 text-muted-foreground/40 mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">
              {language === "ar" ? "أنشئ ملفك الشخصي" : "Set up your profile"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {language === "ar"
                ? "لم يتم العثور على ملف شخصي. أنشئ ملفك الشخصي للبدء."
                : "No profile found. Create your profile to get started."}
            </p>
            <Button
              onClick={() => setProfile({ ...defaultProfile })}
              className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
            >
              {language === "ar" ? "إنشاء ملف شخصي" : "Create Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const maskedApiKey = profile.apiKey
    ? profile.apiKey.slice(0, 8) + "••••••••••••••••••••"
    : "••••••••••••••••••••••••••••"
  const memberSinceFormatted = new Date(profile.memberSince).toLocaleDateString(
    language === "ar" ? "ar-AE" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  )

  const tierLabels = {
    FREE: { en: "Free", ar: "مجاني" },
    PRO: { en: "Pro", ar: "احترافي" },
    ENTERPRISE: { en: "Enterprise", ar: "مؤسسي" },
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
        <CircleUser className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">
          {language === "ar" ? "الملف الشخصي" : "Profile"}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardContent className="pt-6">
            <ProfileAvatarUpload
              currentAvatarUrl={profile.avatarUrl}
              onAvatarChange={(url) => setProfile((p) => p ? { ...p, avatarUrl: url } : p)}
              userId={profile.id}
            />
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className={isRTL ? "text-right" : undefined}>
              {language === "ar" ? "المعلومات الشخصية" : "Personal Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName" className={isRTL ? "text-right block" : undefined}>
                  {language === "ar" ? "الاسم الكامل" : "Full Name"}
                </Label>
                <Input
                  id="fullName"
                  value={profile.fullName}
                  onChange={(e) => setProfile((p) => p ? { ...p, fullName: e.target.value } : p)}
                  className={isRTL ? "text-right" : undefined}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className={isRTL ? "text-right block" : undefined}>
                  {language === "ar" ? "البريد الإلكتروني" : "Email"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => p ? { ...p, email: e.target.value } : p)}
                  className={isRTL ? "text-right" : undefined}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company" className={isRTL ? "text-right block" : undefined}>
                  {language === "ar" ? "الشركة" : "Company"}
                </Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => setProfile((p) => p ? { ...p, company: e.target.value } : p)}
                  className={isRTL ? "text-right" : undefined}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className={isRTL ? "text-right block" : undefined}>
                  {language === "ar" ? "الهاتف" : "Phone"}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => p ? { ...p, phone: e.target.value } : p)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="role" className={isRTL ? "text-right block" : undefined}>
                  {language === "ar" ? "المسمى الوظيفي" : "Role / Title"}
                </Label>
                <Input
                  id="role"
                  value={profile.role}
                  onChange={(e) => setProfile((p) => p ? { ...p, role: e.target.value } : p)}
                  className={isRTL ? "text-right" : undefined}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription & API Key */}
        <Card>
          <CardHeader>
            <CardTitle className={isRTL ? "text-right" : undefined}>
              {language === "ar" ? "الاشتراك والوصول" : "Subscription & Access"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tier Badge */}
            <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Crown className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
                <span className="font-medium">
                  {language === "ar" ? "الخطة الحالية" : "Current Plan"}
                </span>
              </div>
              <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                <span className="px-3 py-1 text-sm font-medium bg-nexus-jade/20 text-nexus-jade rounded-full">
                  {language === "ar" ? tierLabels[profile.tier].ar : tierLabels[profile.tier].en}
                </span>
                <Link href="/billing/pricing">
                  <Button variant="outline" size="sm">
                    {language === "ar" ? "ترقية" : "Upgrade"}
                  </Button>
                </Link>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label className={isRTL ? "text-right block" : undefined}>
                {language === "ar" ? "مفتاح API" : "API Key"}
              </Label>
              <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                <Input
                  value={showApiKey ? profile.apiKey : maskedApiKey}
                  readOnly
                  autoComplete="off"
                  className="font-mono text-sm"
                  dir="ltr"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? (language === "ar" ? "إخفاء" : "Hide") : (language === "ar" ? "إظهار" : "Show")}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyApiKey}
                  aria-label={language === "ar" ? "نسخ مفتاح API" : "Copy API key"}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Member Since */}
            <div className={cn("flex items-center justify-between text-sm", isRTL && "flex-row-reverse")}>
              <span className="text-muted-foreground">
                {language === "ar" ? "عضو منذ" : "Member since"}
              </span>
              <span className="font-medium">{memberSinceFormatted}</span>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 me-2 motion-safe:animate-spin" aria-hidden="true" />
              {language === "ar" ? "جارٍ الحفظ..." : "Saving..."}
            </>
          ) : (
            language === "ar" ? "حفظ التغييرات" : "Save Changes"
          )}
        </Button>

        {/* Danger Zone */}
        <ProfileDangerZone />
      </div>
    </div>
  )
}
