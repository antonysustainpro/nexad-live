"use client"

import { useState, useEffect, useCallback } from "react"
import { User, Mic, Sliders, MessageSquare, RefreshCw, Loader2 } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { getPersona, updatePersona, type PersonaPayload } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Personality = "professional" | "friendly" | "direct" | "adaptive"

const personalities = [
  { 
    id: "professional", 
    labelEn: "Professional", 
    labelAr: "مهني",
    descEn: "Formal, thorough, business-focused",
    descAr: "رسمي ومفصل وموجه للأعمال"
  },
  { 
    id: "friendly", 
    labelEn: "Friendly", 
    labelAr: "ودود",
    descEn: "Warm, approachable, conversational",
    descAr: "دافئ وسهل التعامل ومحادثاتي"
  },
  { 
    id: "direct", 
    labelEn: "Direct", 
    labelAr: "مباشر",
    descEn: "Concise, to-the-point, efficient",
    descAr: "موجز ومباشر وفعال"
  },
  { 
    id: "adaptive", 
    labelEn: "Adaptive", 
    labelAr: "متكيف",
    descEn: "Adjusts based on context and mood",
    descAr: "يتكيف بناءً على السياق والحالة"
  },
] as const

export default function PersonaPage() {
  const { language, preferences, updatePreferences } = useNexus()
  const [personality, setPersonality] = useState<Personality>(preferences.personality || "professional")
  const [formalCasual, setFormalCasual] = useState(preferences.formalCasual || 70)
  const [conciseDetailed, setConciseDetailed] = useState(preferences.conciseDetailed || 50)
  const [languageBalance, setLanguageBalance] = useState(preferences.languageBalance || 50)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load persona from backend on mount
  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
    let userId: string | null = null
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
      userId = storedUser ? JSON.parse(storedUser).id : null
    } catch {
      // Corrupted localStorage
    }
    if (!userId) {
      setLoading(false)
      return
    }
    getPersona(userId, abortController.signal).then((remote) => {
      if (!isMounted) return
      if (remote) {
        setPersonality(remote.personality || "professional")
        setFormalCasual(remote.formalCasual ?? 70)
        setConciseDetailed(remote.conciseDetailed ?? 50)
        setLanguageBalance(remote.languageBalance ?? 50)
      }
      setLoading(false)
      setError(null)
    }).catch((err) => {
      if (isMounted) {
        setLoading(false)
        setError(err instanceof Error ? err.message : "Failed to load persona")
      }
    })

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    // Update local context
    updatePreferences({
      personality,
      formalCasual,
      conciseDetailed,
      languageBalance,
    })
    // Persist to backend
    try {
      const payload: PersonaPayload = {
        personality,
        formalCasual,
        conciseDetailed,
        languageBalance,
      }
      // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
      let userId: string | null = null
      try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
        userId = storedUser ? JSON.parse(storedUser).id : null
      } catch {
        // Corrupted localStorage
      }
      if (!userId) {
        toast.success(language === "ar" ? "تم الحفظ محلياً" : "Saved locally")
        setSaving(false)
        return
      }
      const result = await updatePersona(userId, payload)
      if (result) {
        toast.success(language === "ar" ? "تم حفظ الشخصية" : "Persona saved")
      } else {
        toast.success(language === "ar" ? "تم الحفظ محلياً" : "Saved locally")
      }
    } catch {
      toast.success(language === "ar" ? "تم الحفظ محلياً" : "Saved locally")
    } finally {
      setSaving(false)
    }
  }

  const getPreviewResponse = () => {
    const formality = formalCasual >= 70 ? "formal" : formalCasual >= 40 ? "balanced" : "casual"
    const detail = conciseDetailed >= 60 ? "detailed" : "concise"
    
    const responses = {
      professional: {
        formal: {
          detailed: language === "ar" 
            ? "بناءً على تحليلي لمحفظتك المالية، أوصي بالتنويع عبر فئات أصول متعددة. تشير ظروف السوق الحالية..."
            : "Based on my analysis of your financial portfolio, I recommend diversifying your holdings across multiple asset classes. The current market conditions suggest...",
          concise: language === "ar"
            ? "أوصي بتنويع المحفظة. الظروف الحالية تفضل المراكز الدفاعية."
            : "I recommend portfolio diversification. Current conditions favor defensive positions.",
        },
        balanced: {
          detailed: language === "ar"
            ? "بالنظر إلى محفظتك، أرى بعض الفرص للتنويع التي قد تساعد في توازن ملف المخاطر الخاص بك..."
            : "Looking at your portfolio, I see some opportunities for diversification that could help balance your risk profile...",
          concise: language === "ar"
            ? "محفظتك قد تستفيد من مزيد من التنويع لتوازن المخاطر والنمو."
            : "Your portfolio could benefit from more diversification to balance risk and growth.",
        },
        casual: {
          detailed: language === "ar"
            ? "لقد كنت أنظر في استثماراتك، وهناك بالتأكيد مجال للتوسع قليلاً. دعني أشرح لك ما أراه..."
            : "So I've been looking at your investments, and there's definitely room to spread things out a bit more. Let me walk you through what I'm seeing...",
          concise: language === "ar"
            ? "استثماراتك تحتاج بعض التوزيع. هل تريد أن أريك الخيارات؟"
            : "Your investments could use some spreading out. Want me to show you the options?",
        },
      },
      friendly: {
        formal: {
          detailed: language === "ar"
            ? "يسعدني مساعدتك في فهم وضعك المالي! بناءً على ما أراه، هناك بعض الفرص المثيرة للاهتمام..."
            : "I'm happy to help you understand your financial situation! Based on what I'm seeing, there are some exciting opportunities to consider...",
          concise: language === "ar"
            ? "أخبار رائعة - وجدت بعض الفرص التي قد تهمك!"
            : "Great news - I found some opportunities that might interest you!",
        },
        balanced: {
          detailed: language === "ar"
            ? "مرحباً! لقد كنت أنظر في أموالك ووجدت بعض الأشياء المثيرة للاهتمام. دعني أشاركك ما لفت انتباهي..."
            : "Hey! I've been looking at your finances and found some really interesting things. Let me share what stood out to me...",
          concise: language === "ar"
            ? "وجدت بعض الفرص المثيرة للاهتمام لتفكر فيها!"
            : "Found some interesting opportunities for you to consider!",
        },
        casual: {
          detailed: language === "ar"
            ? "لقد تحققت من أمورك وبصراحة، هناك بعض الخيارات الرائعة التي يمكننا استكشافها معاً..."
            : "So I checked out your stuff and honestly, there's some pretty cool options we could explore together...",
          concise: language === "ar"
            ? "تحققت من أمورك - وجدت بعض الخيارات الرائعة للاستكشاف!"
            : "Checked your stuff - found some cool options to explore!",
        },
      },
      direct: {
        formal: {
          detailed: language === "ar"
            ? "محفظتك تحتاج إعادة توازن. التخصيص الحالي: 60% أسهم، 30% سندات، 10% بدائل. التغييرات الموصى بها: خفض الأسهم إلى 50%، زيادة البدائل إلى 20%."
            : "Your portfolio requires rebalancing. Current allocation: 60% equities, 30% bonds, 10% alternatives. Recommended changes: reduce equities to 50%, increase alternatives to 20%.",
          concise: language === "ar"
            ? "إعادة توازن مطلوبة: 60/30/10 ← 50/30/20 تخصيص."
            : "Rebalance needed: 60/30/10 → 50/30/20 allocation.",
        },
        balanced: {
          detailed: language === "ar"
            ? "تحتاج إلى إعادة التوازن. إليك التفاصيل وما يجب تغييره..."
            : "You need to rebalance. Here's the breakdown and what to change...",
          concise: language === "ar"
            ? "وقت إعادة التوازن. إليك ما يجب تغييره."
            : "Time to rebalance. Here's what to change.",
        },
        casual: {
          detailed: language === "ar"
            ? "انظر، عليك تغيير الأمور. إليك بالضبط ما يجب أن يحدث..."
            : "Look, you gotta shift things around. Here's exactly what needs to happen...",
          concise: language === "ar"
            ? "غير الأمور. إليك الخطوة."
            : "Shift things around. Here's the move.",
        },
      },
      adaptive: {
        formal: {
          detailed: language === "ar"
            ? "لقد قمت بتكييف أسلوب ردي بناءً على تفاعلاتنا السابقة. نظراً لتفضيلك للتحليل الشامل، إليك نظرة عامة شاملة..."
            : "I've adapted my response style based on our previous interactions. Given your preference for thorough analysis, here's a comprehensive overview...",
          concise: language === "ar"
            ? "أتكيف مع أسلوبك: تحديث موجز ولكن شامل يتبع."
            : "Adapting to your style: brief yet thorough update follows.",
        },
        balanced: {
          detailed: language === "ar"
            ? "بناءً على كيفية تواصلنا، أعتقد أنك ستقدر نظرة عامة متوازنة على الوضع..."
            : "Based on how we've been communicating, I think you'd appreciate a balanced overview of the situation...",
          concise: language === "ar"
            ? "إليك ما تحتاج معرفته، بطريقتك."
            : "Here's what you need to know, your way.",
        },
        casual: {
          detailed: language === "ar"
            ? "لقد لاحظت أنك تحب الأمور بطريقة معينة، لذا سأكون صريحاً مع إعطائك كل التفاصيل..."
            : "I've noticed you like things a certain way, so I'll keep it real while giving you all the details...",
          concise: language === "ar"
            ? "سأبقى صادقاً، بأسلوبك. إليك الأمر."
            : "Keeping it real, your style. Here's the deal.",
        },
      },
    }
    
    return responses[personality][formality][detail]
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
          <User className="h-5 w-5 text-destructive flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-destructive font-medium">
              {language === "ar" ? "خطأ في تحميل الشخصية" : "Error Loading Persona"}
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-title-1 flex items-center gap-2">
          <User className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          {language === "ar" ? "الشخصية" : "Persona"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar"
            ? "خصص كيف يتحدث NexusAD Ai معك"
            : "Customize how NexusAD Ai speaks with you"}
        </p>
      </div>

      {/* Personality Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "نوع الشخصية" : "Personality Type"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "اختر النمط الأساسي للتواصل"
              : "Choose the base communication style"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={personality}
            onValueChange={(v) => setPersonality(v as Personality)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {personalities.map((p) => (
              <Label
                key={p.id}
                htmlFor={p.id}
                className={cn(
                  "flex flex-col gap-1 p-4 rounded-xl border cursor-pointer transition-all",
                  personality === p.id
                    ? "border-nexus-jade bg-nexus-jade/10"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={p.id} id={p.id} />
                  <span className="font-medium">{language === "ar" ? p.labelAr : p.labelEn}</span>
                </div>
                <p className="text-sm text-muted-foreground ms-7">
                  {language === "ar" ? p.descAr : p.descEn}
                </p>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Sliders className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "إعدادات الأسلوب" : "Style Settings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Formal/Casual */}
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-muted-foreground">
                {language === "ar" ? "رسمي" : "Formal"}
              </span>
              <span className="text-foreground font-medium">{formalCasual}%</span>
              <span className="text-muted-foreground">
                {language === "ar" ? "ودي" : "Casual"}
              </span>
            </div>
            <Slider
              aria-label={language === "ar" ? "الرسمي مقابل العادي" : "Formal vs Casual"}
              value={[formalCasual]}
              onValueChange={([v]) => setFormalCasual(v)}
              max={100}
              step={10}
            />
          </div>

          {/* Concise/Detailed */}
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-muted-foreground">
                {language === "ar" ? "موجز" : "Concise"}
              </span>
              <span className="text-foreground font-medium">{conciseDetailed}%</span>
              <span className="text-muted-foreground">
                {language === "ar" ? "مفصل" : "Detailed"}
              </span>
            </div>
            <Slider
              aria-label={language === "ar" ? "المختصر مقابل المفصل" : "Concise vs Detailed"}
              value={[conciseDetailed]}
              onValueChange={([v]) => setConciseDetailed(v)}
              max={100}
              step={10}
            />
          </div>

          {/* Language Balance */}
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-muted-foreground">العربية</span>
              <span className="text-foreground font-medium">{languageBalance}%</span>
              <span className="text-muted-foreground">English</span>
            </div>
            <Slider
              aria-label={language === "ar" ? "توازن اللغة" : "Language Balance"}
              value={[languageBalance]}
              onValueChange={([v]) => setLanguageBalance(v)}
              max={100}
              step={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-headline">
            {language === "ar" ? "معاينة مباشرة" : "Live Preview"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "كيف سيبدو رد NexusAD Ai بهذه الإعدادات"
              : "How NexusAD Ai will respond with these settings"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-body leading-relaxed">{getPreviewResponse()}</p>
        </CardContent>
      </Card>

      {/* Voice Sample */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <Mic className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "عينة الصوت" : "Voice Sample"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "سجل صوتك لتخصيص نطق NexusAD Ai"
              : "Record your voice to personalize NexusAD Ai's speech"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline"
              onClick={() => window.location.href = "/voice"}
            >
              <Mic className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "تسجيل عينة جديدة" : "Record New Sample"}
            </Button>
            <Button 
              variant="ghost"
              onClick={() => {
                setFormalCasual(50)
                setConciseDetailed(50)
                setLanguageBalance(50)
                setPersonality("professional")
              }}
            >
              <RefreshCw className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "إعادة ضبط" : "Reset to Default"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 me-2 motion-safe:animate-spin" aria-hidden="true" />
            {language === "ar" ? "جاري الحفظ..." : "Saving..."}
          </>
        ) : (
          language === "ar" ? "حفظ التغييرات" : "Save Changes"
        )}
      </Button>
    </div>
  )
}
