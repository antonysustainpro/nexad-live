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
  Languages,
  Eye,
  Briefcase,
  MessageSquare,
  Database,
  Activity,
  Heart,
  Lightbulb
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
import { Badge } from "@/components/ui/badge"
import { MemoryIndicator } from "@/components/memory-indicator"
import { EpisodicMemory } from "@/components/memory/episodic-memory"
import { MetaCognitiveMemory } from "@/components/memory/meta-cognitive-memory"
import { toast } from "sonner"
import { ErrorRetry } from "@/components/error-retry"

export default function MemoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { language } = useNexus()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
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
      toast.error(language === "ar" ? "تعذّر تحميل ملفك الشخصي. يرجى المحاولة مرة أخرى." : "We couldn't load your profile. Please try again.")
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
        throw new Error("We couldn't save your profile. Please try again.")
      }
    } catch (error) {
      console.error("Failed to save profile:", error)
      toast.error(language === "ar" ? "تعذّر حفظ ملفك الشخصي. يرجى المحاولة مرة أخرى." : "We couldn't save your profile. Please try again.")
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

  if (loadError) {
    return (
      <ErrorRetry
        onRetry={() => {
          setLoadError(false)
          loadProfile()
        }}
        message={language === "ar"
          ? "تعذّر تحميل الذاكرة. يرجى المحاولة مجدداً."
          : "We couldn't load your memory. Please try again."}
        networkError
        variant="page"
      />
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

      {/* Memory Layers */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="overview" className="text-xs">
            <Brain className="h-3 w-3 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="layer0" className="text-xs">
            <Eye className="h-3 w-3 mr-1" />
            L0
          </TabsTrigger>
          <TabsTrigger value="layer1" className="text-xs">
            <Briefcase className="h-3 w-3 mr-1" />
            L1
          </TabsTrigger>
          <TabsTrigger value="layer2" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            L2
          </TabsTrigger>
          <TabsTrigger value="layer3" className="text-xs">
            <Database className="h-3 w-3 mr-1" />
            L3
          </TabsTrigger>
          <TabsTrigger value="layer4" className="text-xs">
            <Activity className="h-3 w-3 mr-1" />
            L4
          </TabsTrigger>
          <TabsTrigger value="layer5" className="text-xs">
            <Heart className="h-3 w-3 mr-1" />
            L5
          </TabsTrigger>
          <TabsTrigger value="layer6" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />
            L6
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>7-Layer Memory System</CardTitle>
              <CardDescription>
                Your sovereign AI uses a sophisticated 7-layer memory architecture to provide personalized, context-aware assistance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 0, name: "Sensory Memory", icon: Eye, desc: "Real-time conversation context", active: true },
                  { id: 1, name: "Working Memory", icon: Briefcase, desc: "Active session state", active: true },
                  { id: 2, name: "Episodic Memory", icon: MessageSquare, desc: "Conversation history", active: false },
                  { id: 3, name: "Semantic Memory", icon: Database, desc: "Knowledge base & documents", active: profile !== null },
                  { id: 4, name: "Procedural Memory", icon: Activity, desc: "Behavioral patterns & preferences", active: profile !== null },
                  { id: 5, name: "Emotional Memory", icon: Heart, desc: "Emotional context & empathy", active: false },
                  { id: 6, name: "Meta-Cognitive Memory", icon: Lightbulb, desc: "Self-reflection & optimization", active: false },
                ].map((layer) => (
                  <Card key={layer.id} className={`p-4 ${layer.active ? 'border-green-500' : 'border-gray-300'}`}>
                    <div className="flex items-start gap-3">
                      <layer.icon className={`h-5 w-5 ${layer.active ? 'text-green-500' : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <h4 className="font-medium">Layer {layer.id}: {layer.name}</h4>
                        <p className="text-sm text-muted-foreground">{layer.desc}</p>
                        <div className="mt-2">
                          <Badge variant={layer.active ? "default" : "secondary"}>
                            {layer.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 0: Sensory Memory */}
        <TabsContent value="layer0" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Layer 0: Sensory Memory
              </CardTitle>
              <CardDescription>
                Real-time conversation context and immediate state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This layer is automatically active during conversations. It processes your messages in real-time and maintains context throughout the chat session.
                </AlertDescription>
              </Alert>
              <div className="mt-4 space-y-2">
                <div className="text-sm text-muted-foreground">Features:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Maintains conversation context</li>
                  <li>Tracks topic changes</li>
                  <li>Remembers recent references</li>
                  <li>Processes multi-turn dialogue</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 1: Working Memory */}
        <TabsContent value="layer1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Layer 1: Working Memory
              </CardTitle>
              <CardDescription>
                Active session state and temporary preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This layer maintains your session state for up to 24 hours, storing temporary preferences and context.
                </AlertDescription>
              </Alert>
              <div className="mt-4 space-y-2">
                <div className="text-sm text-muted-foreground">Session Duration:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Idle timeout: 15 minutes</li>
                  <li>Maximum duration: 24 hours</li>
                  <li>Auto-saves progress</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 2: Episodic Memory */}
        <TabsContent value="layer2" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Layer 2: Episodic Memory
              </CardTitle>
              <CardDescription>
                Your conversation history and past interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {user?.id ? (
                <EpisodicMemory userId={user.id} />
              ) : (
                <div className="p-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please sign in to access your conversation history.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 3: Semantic Memory - Profile */}
        <TabsContent value="layer3" className="space-y-4">

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Layer 3: Semantic Memory
              </CardTitle>
              <CardDescription>
                Knowledge base, documents, and user profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entity_name">Name</Label>
                <Input
                  id="entity_name"
                  value={formData.entity_name}
                  onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                  placeholder="Your name or organization name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_type">Entity Type</Label>
                <Select
                  value={formData.entity_type}
                  onValueChange={(value) => setFormData({ ...formData, entity_type: value })}
                >
                  <SelectTrigger id="entity_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="family_office">Family Office</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="fund">Fund</SelectItem>
                    <SelectItem value="holding">Holding Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Team Size</Label>
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

              <div className="space-y-2">
                <Label htmlFor="current_goals">Current Goals</Label>
                <Textarea
                  id="current_goals"
                  value={formData.current_goals}
                  onChange={(e) => setFormData({ ...formData, current_goals: e.target.value })}
                  placeholder="What are your current strategic goals?"
                  rows={4}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !formData.entity_name}
                className="w-full"
              >
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 4: Procedural Memory */}
        <TabsContent value="layer4" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Layer 4: Procedural Memory
              </CardTitle>
              <CardDescription>
                Behavioral patterns and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Risk Appetite ({formData.risk_appetite}/10)</Label>
                <Slider
                  value={[formData.risk_appetite]}
                  onValueChange={(values) => setFormData({ ...formData, risk_appetite: values[0] })}
                  min={1}
                  max={10}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Ultra-Conservative</span>
                  <span>Aggressive</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget Range</Label>
                <Input
                  id="budget"
                  value={formData.investment_budget_range}
                  onChange={(e) => setFormData({ ...formData, investment_budget_range: e.target.value })}
                  placeholder="e.g., $1M-$5M"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report_style">Report Style</Label>
                <Select
                  value={formData.report_style}
                  onValueChange={(value) => setFormData({ ...formData, report_style: value })}
                >
                  <SelectTrigger id="report_style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive</SelectItem>
                    <SelectItem value="quantitative">Quantitative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language_preference">Language Preference</Label>
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
                    <SelectItem value="bilingual">Bilingual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !formData.entity_name}
                className="w-full"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 5: Emotional Memory */}
        <TabsContent value="layer5" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Layer 5: Emotional Memory
              </CardTitle>
              <CardDescription>
                Emotional context and empathy tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Emotional memory tracking is being enhanced. This layer will analyze conversation sentiment and adapt responses based on emotional context.
                </AlertDescription>
              </Alert>
              <div className="mt-4 space-y-2">
                <div className="text-sm text-muted-foreground">Coming features:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Sentiment analysis per conversation</li>
                  <li>Mood pattern recognition</li>
                  <li>Empathetic response adaptation</li>
                  <li>Emotional state tracking</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layer 6: Meta-Cognitive Memory */}
        <TabsContent value="layer6" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Layer 6: Meta-Cognitive Memory
              </CardTitle>
              <CardDescription>
                System self-reflection and performance optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {user?.id ? (
                <MetaCognitiveMemory userId={user.id} />
              ) : (
                <div className="p-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please sign in to access system performance metrics.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}