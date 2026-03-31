"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  Brain,
  Save,
  AlertCircle,
  User,
  Building,
  Globe,
  Target,
  Clock,
  FileText,
  Languages
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useNexus } from "@/contexts/nexus-context"
import { getVaultProfile, updateVaultProfile, createVaultProfile, getActiveMemoryLayers, type VaultProfile, type MemoryLayerStatus } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MemoryIndicator } from "@/components/memory-indicator"
import { toast } from "sonner"

export default function MemoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { language } = useNexus()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<VaultProfile | null>(null)
  const [memoryLayers, setMemoryLayers] = useState<MemoryLayerStatus[]>([])
  const [formData, setFormData] = useState({
    entity_name: "",
    entity_type: "individual",
    jurisdictions: [] as string[],
    team_size: 1,
    risk_appetite: 5,
    asset_focus: [] as string[],
    investment_budget_range: "",
    time_horizon: "",
    current_goals: "",
    key_competitors: "",
    open_matters: "",
    report_style: "comprehensive",
    language_preference: "en",
  })

  useEffect(() => {
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      const existingProfile = await getVaultProfile(user.id)
      if (existingProfile) {
        setProfile(existingProfile)
        setFormData({
          entity_name: existingProfile.entity_name || "",
          entity_type: existingProfile.entity_type || "individual",
          jurisdictions: existingProfile.jurisdictions || [],
          team_size: existingProfile.team_size || 1,
          risk_appetite: existingProfile.risk_appetite || 5,
          asset_focus: existingProfile.asset_focus || [],
          investment_budget_range: existingProfile.investment_budget_range || "",
          time_horizon: existingProfile.time_horizon || "",
          current_goals: existingProfile.current_goals || "",
          key_competitors: existingProfile.key_competitors || "",
          open_matters: existingProfile.open_matters || "",
          report_style: existingProfile.report_style || "comprehensive",
          language_preference: existingProfile.language_preference || "en",
        })
      }
      const layers = getActiveMemoryLayers(existingProfile)
      setMemoryLayers(layers)
    } catch (error) {
      console.error("Failed to load profile:", error)
      toast.error(language === "ar" ? "فشل تحميل الملف الشخصي" : "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user?.id) return

    setSaving(true)
    try {
      const profileData = {
        ...formData,
        user_id: user.id,
      }

      let updatedProfile: VaultProfile | null
      if (profile) {
        updatedProfile = await updateVaultProfile(user.id, profileData)
      } else {
        updatedProfile = await createVaultProfile(profileData)
      }

      if (updatedProfile) {
        setProfile(updatedProfile)
        const layers = getActiveMemoryLayers(updatedProfile)
        setMemoryLayers(layers)
        toast.success(language === "ar" ? "تم حفظ الملف الشخصي" : "Profile saved successfully")
      } else {
        throw new Error("Failed to save profile")
      }
    } catch (error) {
      console.error("Failed to save profile:", error)
      toast.error(language === "ar" ? "فشل حفظ الملف الشخصي" : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-muted-foreground animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "ar" ? "جاري تحميل ذاكرتك..." : "Loading your memory..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-nexus-jade" />
            {language === "ar" ? "نظام الذاكرة" : "Memory System"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === "ar"
              ? "قم بتخصيص كيفية تذكر النظام لتفضيلاتك وسياقك"
              : "Customize how the system remembers your preferences and context"}
          </p>
        </div>
        <MemoryIndicator layers={memoryLayers} showLabels />
      </div>

      {/* Memory Status Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {language === "ar"
            ? `${memoryLayers.filter(l => l.active).length} من 7 طبقات ذاكرة نشطة. قم بإكمال ملفك الشخصي لتفعيل المزيد من الطبقات.`
            : `${memoryLayers.filter(l => l.active).length} of 7 memory layers active. Complete your profile to activate more layers.`}
        </AlertDescription>
      </Alert>

      {/* Profile Form */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">
            {language === "ar" ? "معلومات أساسية" : "Basic Info"}
          </TabsTrigger>
          <TabsTrigger value="preferences">
            {language === "ar" ? "التفضيلات" : "Preferences"}
          </TabsTrigger>
          <TabsTrigger value="context">
            {language === "ar" ? "السياق" : "Context"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {language === "ar" ? "معلومات الكيان" : "Entity Information"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "المعلومات الأساسية عن شخصك أو مؤسستك"
                  : "Basic information about yourself or your organization"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entity_name">
                  {language === "ar" ? "الاسم" : "Name"}
                </Label>
                <Input
                  id="entity_name"
                  value={formData.entity_name}
                  onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                  placeholder={language === "ar" ? "اسمك أو اسم مؤسستك" : "Your name or organization name"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_type">
                  {language === "ar" ? "نوع الكيان" : "Entity Type"}
                </Label>
                <Select
                  value={formData.entity_type}
                  onValueChange={(value) => setFormData({ ...formData, entity_type: value })}
                >
                  <SelectTrigger id="entity_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">
                      {language === "ar" ? "فرد" : "Individual"}
                    </SelectItem>
                    <SelectItem value="family_office">
                      {language === "ar" ? "مكتب عائلي" : "Family Office"}
                    </SelectItem>
                    <SelectItem value="corporate">
                      {language === "ar" ? "شركة" : "Corporate"}
                    </SelectItem>
                    <SelectItem value="fund">
                      {language === "ar" ? "صندوق" : "Fund"}
                    </SelectItem>
                    <SelectItem value="holding">
                      {language === "ar" ? "شركة قابضة" : "Holding Company"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {language === "ar" ? "حجم الفريق" : "Team Size"}
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[formData.team_size]}
                    onValueChange={(values) => setFormData({ ...formData, team_size: values[0] })}
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-medium">{formData.team_size}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {language === "ar" ? "تفضيلات الاستثمار" : "Investment Preferences"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "حدد مستوى المخاطرة والتركيز الاستثماري"
                  : "Define your risk appetite and investment focus"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {language === "ar" ? "مستوى المخاطرة" : "Risk Appetite"} ({formData.risk_appetite}/10)
                </Label>
                <Slider
                  value={[formData.risk_appetite]}
                  onValueChange={(values) => setFormData({ ...formData, risk_appetite: values[0] })}
                  min={1}
                  max={10}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{language === "ar" ? "محافظ جداً" : "Ultra-Conservative"}</span>
                  <span>{language === "ar" ? "عدواني" : "Aggressive"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">
                  {language === "ar" ? "نطاق الميزانية" : "Budget Range"}
                </Label>
                <Input
                  id="budget"
                  value={formData.investment_budget_range}
                  onChange={(e) => setFormData({ ...formData, investment_budget_range: e.target.value })}
                  placeholder={language === "ar" ? "مثال: $1M-$5M" : "e.g., $1M-$5M"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_horizon">
                  {language === "ar" ? "الأفق الزمني" : "Time Horizon"}
                </Label>
                <Input
                  id="time_horizon"
                  value={formData.time_horizon}
                  onChange={(e) => setFormData({ ...formData, time_horizon: e.target.value })}
                  placeholder={language === "ar" ? "مثال: 3-5 سنوات" : "e.g., 3-5 years"}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                {language === "ar" ? "تفضيلات التقارير" : "Report Preferences"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report_style">
                  {language === "ar" ? "نمط التقرير" : "Report Style"}
                </Label>
                <Select
                  value={formData.report_style}
                  onValueChange={(value) => setFormData({ ...formData, report_style: value })}
                >
                  <SelectTrigger id="report_style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">
                      {language === "ar" ? "مختصر" : "Concise"}
                    </SelectItem>
                    <SelectItem value="comprehensive">
                      {language === "ar" ? "شامل" : "Comprehensive"}
                    </SelectItem>
                    <SelectItem value="quantitative">
                      {language === "ar" ? "كمي" : "Quantitative"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language_preference">
                  {language === "ar" ? "تفضيل اللغة" : "Language Preference"}
                </Label>
                <Select
                  value={formData.language_preference}
                  onValueChange={(value) => setFormData({ ...formData, language_preference: value })}
                >
                  <SelectTrigger id="language_preference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="bilingual">
                      {language === "ar" ? "ثنائي اللغة" : "Bilingual"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {language === "ar" ? "السياق الاستراتيجي" : "Strategic Context"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "ساعد النظام على فهم أهدافك وسياقك"
                  : "Help the system understand your goals and context"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_goals">
                  {language === "ar" ? "الأهداف الحالية" : "Current Goals"}
                </Label>
                <Textarea
                  id="current_goals"
                  value={formData.current_goals}
                  onChange={(e) => setFormData({ ...formData, current_goals: e.target.value })}
                  placeholder={language === "ar"
                    ? "ما هي أهدافك الاستراتيجية الحالية؟"
                    : "What are your current strategic goals?"}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key_competitors">
                  {language === "ar" ? "المنافسون الرئيسيون" : "Key Competitors"}
                </Label>
                <Textarea
                  id="key_competitors"
                  value={formData.key_competitors}
                  onChange={(e) => setFormData({ ...formData, key_competitors: e.target.value })}
                  placeholder={language === "ar"
                    ? "من هم منافسوك الرئيسيون؟"
                    : "Who are your key competitors?"}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="open_matters">
                  {language === "ar" ? "المسائل المفتوحة" : "Open Matters"}
                </Label>
                <Textarea
                  id="open_matters"
                  value={formData.open_matters}
                  onChange={(e) => setFormData({ ...formData, open_matters: e.target.value })}
                  placeholder={language === "ar"
                    ? "أي صفقات أو مسائل نشطة؟"
                    : "Any active deals or open matters?"}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !formData.entity_name}
          size="lg"
        >
          {saving ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mr-2"
              >
                <Brain className="h-5 w-5" />
              </motion.div>
              {language === "ar" ? "جاري الحفظ..." : "Saving..."}
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              {language === "ar" ? "حفظ الملف الشخصي" : "Save Profile"}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}