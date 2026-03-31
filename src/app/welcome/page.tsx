"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Mic, ArrowLeft, Upload, Check } from "lucide-react"
import { NexusLogo } from "@/components/nexus-logo"
import { KeyCeremony } from "@/components/key-ceremony"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Language = "ar" | "en" | "bilingual"
type Personality = "professional" | "friendly" | "direct" | "adaptive"

const personalities = [
  { id: "professional", labelEn: "Professional", labelAr: "مهني" },
  { id: "friendly", labelEn: "Friendly", labelAr: "ودود" },
  { id: "direct", labelEn: "Direct", labelAr: "مباشر" },
  { id: "adaptive", labelEn: "Adaptive", labelAr: "متكيف" },
] as const

// SEC-RAND-007: Use crypto.getRandomValues for vault ID generation instead of Math.random().
// Even cosmetic IDs should not be predictable to avoid user confusion or enumeration.
function generateVaultId(): string {
  if (typeof window !== "undefined" && window.crypto) {
    const arr = new Uint32Array(1)
    window.crypto.getRandomValues(arr)
    return String(arr[0] % 100000).padStart(5, "0")
  }
  return "00000"
}

export default function WelcomePage() {
  const router = useRouter()
  const { setLanguage, updatePreferences, preferences } = useNexus()
  const [step, setStep] = useState(1)
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en")
  const [selectedPersonality, setSelectedPersonality] = useState<Personality>("professional")
  const [formalCasual, setFormalCasual] = useState(70)
  const [conciseDetailed, setConciseDetailed] = useState(50)
  const [languageBalance, setLanguageBalance] = useState(50)
  const [isRecording, setIsRecording] = useState(false)
  const [vaultId] = useState(generateVaultId)
  const [userName, setUserName] = useState("")

  // Check if already onboarded
  useEffect(() => {
    if (preferences.hasCompletedOnboarding) {
      router.replace("/")
    }
  }, [preferences.hasCompletedOnboarding, router])

  const handleLanguageSelect = (lang: Language) => {
    setSelectedLanguage(lang)
    setLanguage(lang)
  }

  const handleBegin = () => {
    setStep(2)
  }

  const handleKeyComplete = (backupChoice: "qr" | "skip") => {
    // In production, would handle QR backup
    setStep(3)
  }

  const handleVoiceRecord = () => {
    setIsRecording(true)
    // Simulate recording
    setTimeout(() => {
      setIsRecording(false)
    }, 10000)
  }

  const handleVoiceComplete = () => {
    updatePreferences({
      personality: selectedPersonality,
      formalCasual,
      conciseDetailed,
      languageBalance,
    })
    setStep(4)
  }

  const handleFinish = () => {
    updatePreferences({
      hasCompletedOnboarding: true,
      vaultId: `#${vaultId}`,
      name: userName,
    })
    router.push("/")
  }

  const getPreviewResponse = () => {
    const formality = formalCasual >= 70 ? "formal" : formalCasual >= 40 ? "balanced" : "casual"
    const detail = conciseDetailed >= 60 ? "detailed" : "concise"
    
    const responses = {
      professional: {
        formal: {
          detailed: {
            en: "Based on my analysis of your financial portfolio, I recommend diversifying your holdings across multiple asset classes. The current market conditions suggest...",
            ar: "بناءً على تحليلي لمحفظتك المالية، أوصي بتنويع ممتلكاتك عبر فئات أصول متعددة. تشير ظروف السوق الحالية إلى..."
          },
          concise: {
            en: "I recommend portfolio diversification. Current conditions favor defensive positions.",
            ar: "أوصي بتنويع المحفظة. الظروف الحالية تفضل المراكز الدفاعية."
          },
        },
        balanced: {
          detailed: {
            en: "Looking at your portfolio, I see some opportunities for diversification that could help balance your risk profile while maintaining growth potential...",
            ar: "عند النظر إلى محفظتك، أرى بعض فرص التنويع التي يمكن أن تساعد في توازن ملف المخاطر مع الحفاظ على إمكانية النمو..."
          },
          concise: {
            en: "Your portfolio could benefit from more diversification to balance risk and growth.",
            ar: "يمكن أن تستفيد محفظتك من مزيد من التنويع لتوازن المخاطر والنمو."
          },
        },
        casual: {
          detailed: {
            en: "So I've been looking at your investments, and there's definitely room to spread things out a bit more. Let me walk you through what I'm seeing...",
            ar: "لقد كنت أبحث في استثماراتك، وهناك بالتأكيد مجال للتنويع أكثر. دعني أوضح لك ما أراه..."
          },
          concise: {
            en: "Your investments could use some spreading out. Want me to show you the options?",
            ar: "استثماراتك تحتاج إلى بعض التنويع. هل تريد أن أريك الخيارات؟"
          },
        },
      },
      friendly: {
        formal: {
          detailed: {
            en: "I'm happy to help you understand your financial situation! Based on what I'm seeing, there are some exciting opportunities to consider...",
            ar: "يسعدني مساعدتك في فهم وضعك المالي! بناءً على ما أراه، هناك بعض الفرص المثيرة للاهتمام..."
          },
          concise: {
            en: "Great news - I found some opportunities that might interest you!",
            ar: "أخبار رائعة - وجدت بعض الفرص التي قد تهمك!"
          },
        },
        balanced: {
          detailed: {
            en: "Hey! I've been looking at your finances and found some really interesting things. Let me share what stood out to me...",
            ar: "مرحباً! لقد كنت أبحث في مالياتك ووجدت بعض الأشياء المثيرة للاهتمام. دعني أشارك ما لفت انتباهي..."
          },
          concise: {
            en: "Found some interesting opportunities for you to consider!",
            ar: "وجدت بعض الفرص المثيرة للاهتمام لتفكر فيها!"
          },
        },
        casual: {
          detailed: {
            en: "So I checked out your stuff and honestly, there's some pretty cool options we could explore together. Here's what I'm thinking...",
            ar: "لقد راجعت أمورك وصراحة، هناك بعض الخيارات الرائعة التي يمكننا استكشافها معًا. إليك ما أفكر فيه..."
          },
          concise: {
            en: "Checked your stuff - found some cool options to explore!",
            ar: "راجعت أمورك - وجدت بعض الخيارات الرائعة للاستكشاف!"
          },
        },
      },
      direct: {
        formal: {
          detailed: {
            en: "Your portfolio requires rebalancing. Current allocation: 60% equities, 30% bonds, 10% alternatives. Recommended changes: reduce equities to 50%, increase alternatives to 20%.",
            ar: "محفظتك تحتاج إلى إعادة توازن. التوزيع الحالي: 60% أسهم، 30% سندات، 10% بدائل. التغييرات الموصى بها: خفض الأسهم إلى 50%، زيادة البدائل إلى 20%."
          },
          concise: {
            en: "Rebalance needed: 60/30/10 → 50/30/20 allocation.",
            ar: "مطلوب إعادة توازن: توزيع 60/30/10 ← 50/30/20."
          },
        },
        balanced: {
          detailed: {
            en: "You need to rebalance. Here's the breakdown and what to change...",
            ar: "تحتاج إلى إعادة التوازن. إليك التفاصيل وما يجب تغييره..."
          },
          concise: {
            en: "Time to rebalance. Here's what to change.",
            ar: "حان وقت إعادة التوازن. إليك ما يجب تغييره."
          },
        },
        casual: {
          detailed: {
            en: "Look, you gotta shift things around. Here's exactly what needs to happen...",
            ar: "اسمع، عليك تغيير بعض الأشياء. إليك بالضبط ما يجب أن يحدث..."
          },
          concise: {
            en: "Shift things around. Here's the move.",
            ar: "غيّر بعض الأشياء. إليك الخطوة."
          },
        },
      },
      adaptive: {
        formal: {
          detailed: {
            en: "I've adapted my response style based on our previous interactions. Given your preference for thorough analysis, here's a comprehensive overview...",
            ar: "لقد كيّفت أسلوب ردي بناءً على تفاعلاتنا السابقة. نظرًا لتفضيلك للتحليل الشامل، إليك نظرة عامة شاملة..."
          },
          concise: {
            en: "Adapting to your style: brief yet thorough update follows.",
            ar: "أتكيف مع أسلوبك: تحديث موجز وشامل يتبع."
          },
        },
        balanced: {
          detailed: {
            en: "Based on how we've been communicating, I think you'd appreciate a balanced overview of the situation...",
            ar: "بناءً على كيفية تواصلنا، أعتقد أنك ستقدر نظرة عامة متوازنة على الوضع..."
          },
          concise: {
            en: "Here's what you need to know, your way.",
            ar: "إليك ما تحتاج معرفته، بأسلوبك."
          },
        },
        casual: {
          detailed: {
            en: "I've noticed you like things a certain way, so I'll keep it real while giving you all the details...",
            ar: "لاحظت أنك تحب الأشياء بطريقة معينة، لذا سأكون صريحًا مع إعطائك كل التفاصيل..."
          },
          concise: {
            en: "Keeping it real, your style. Here's the deal.",
            ar: "بصراحة، بأسلوبك. إليك الأمر."
          },
        },
      },
    }
    
    const response = responses[selectedPersonality][formality][detail]
    return selectedLanguage === "ar" ? response.ar : response.en
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <AnimatePresence mode="wait">
        {/* Step 1: Welcome + Language */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            <div className="text-center space-y-6 max-w-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <NexusLogo size="xl" showShimmer />
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <h1 className="text-title-1 text-white">Your Sovereign Intelligence</h1>
                <p className="text-title-2 text-white/80">ذكاؤك السيادي</p>
              </motion.div>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-callout text-muted-foreground"
              >
                {selectedLanguage === "ar"
                  ? "لقد تم منحك حق الوصول إلى NexusAD Ai."
                  : "You have been granted access to NexusAD Ai."}
              </motion.p>

              {/* Name Input */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-2"
              >
                <label htmlFor="welcome-name" className="text-sm text-muted-foreground">
                  {selectedLanguage === "ar" ? "اسمك" : "Your name"}
                </label>
                <input
                  id="welcome-name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={selectedLanguage === "ar" ? "مثال: أحمد" : "e.g., Ahmed"}
                  className="w-full max-w-xs mx-auto px-4 py-3 bg-secondary/50 border border-border rounded-xl text-center text-lg text-white focus:outline-none focus:border-nexus-jade"
                />
              </motion.div>

              {/* Language Selector */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="flex items-center justify-center gap-1 bg-secondary/50 p-1 rounded-xl"
              >
                {[
                  { value: "ar" as Language, label: "العربية" },
                  { value: "en" as Language, label: "English" },
                  { value: "bilingual" as Language, label: "Bilingual" },
                ].map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageSelect(lang.value)}
                    aria-pressed={selectedLanguage === lang.value}
                    className={cn(
                      "px-6 py-2 rounded-lg text-sm font-medium transition-all",
                      selectedLanguage === lang.value
                        ? "bg-nexus-jade text-background"
                        : "text-muted-foreground hover:text-white"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                <Button
                  onClick={handleBegin}
                  className="bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12 px-8"
                >
                  {selectedLanguage === "ar" ? "ابدأ" : "Begin"}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Key Ceremony */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              onClick={() => setStep(1)}
              className="absolute top-6 start-6 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <KeyCeremony onComplete={handleKeyComplete} language={selectedLanguage} vaultId={vaultId} />
          </motion.div>
        )}

        {/* Step 3: Voice + Personality */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            <button
              onClick={() => setStep(2)}
              className="absolute top-6 start-6 p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="w-full max-w-2xl space-y-8">
              <div className="text-center">
                <h2 className="text-title-1 mb-2">
                  {selectedLanguage === "ar" ? "إعداد الصوت والشخصية" : "Voice & Personality Setup"}
                </h2>
                <p className="text-muted-foreground">
                  {selectedLanguage === "ar" 
                    ? "خصص كيف يتحدث NexusAD Ai معك"
                    : "Customize how NexusAD Ai speaks with you"}
                </p>
              </div>

              {/* Voice Recording */}
              <Card className="bg-card/50 border-border">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <button
                      onClick={handleVoiceRecord}
                      disabled={isRecording}
                      aria-label={isRecording
                        ? (selectedLanguage === "ar" ? "جاري التسجيل" : "Recording in progress")
                        : (selectedLanguage === "ar" ? "اضغط لتسجيل صوتك" : "Tap to record your voice")}
                      className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all mx-auto",
                        isRecording
                          ? "bg-nexus-jade motion-safe:animate-pulse-sovereignty"
                          : "bg-nexus-jade hover:bg-nexus-jade-hover"
                      )}
                    >
                      <Mic className="h-8 w-8 text-background" aria-hidden="true" />
                    </button>
                    <p className="text-sm text-muted-foreground">
                      {isRecording
                        ? selectedLanguage === "ar" ? "جاري التسجيل..." : "Recording..."
                        : selectedLanguage === "ar" ? "اضغط لتسجيل 10 ثوانٍ" : "Tap to record 10 seconds"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Personality Selection */}
              <Card className="bg-card/50 border-border">
                <CardContent className="p-6 space-y-6">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {selectedLanguage === "ar" ? "الشخصية" : "Personality"}
                    </Label>
                    <RadioGroup
                      value={selectedPersonality}
                      onValueChange={(v) => setSelectedPersonality(v as Personality)}
                      className="grid grid-cols-2 gap-3"
                    >
                      {personalities.map((p) => (
                        <Label
                          key={p.id}
                          htmlFor={p.id}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                            selectedPersonality === p.id
                              ? "border-nexus-jade bg-nexus-jade/10"
                              : "border-border hover:border-muted-foreground"
                          )}
                        >
                          <RadioGroupItem value={p.id} id={p.id} />
                          <span>{selectedLanguage === "ar" ? p.labelAr : p.labelEn}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Sliders */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          {selectedLanguage === "ar" ? "رسمي" : "Formal"}
                        </span>
                        <span className="text-foreground font-medium">{formalCasual}%</span>
                        <span className="text-muted-foreground">
                          {selectedLanguage === "ar" ? "ودي" : "Casual"}
                        </span>
                      </div>
                      <Slider
                        aria-label={selectedLanguage === "ar" ? "الرسمي مقابل العادي" : "Formal vs Casual"}
                        value={[formalCasual]}
                        onValueChange={([v]) => setFormalCasual(v)}
                        max={100}
                        step={10}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          {selectedLanguage === "ar" ? "موجز" : "Concise"}
                        </span>
                        <span className="text-foreground font-medium">{conciseDetailed}%</span>
                        <span className="text-muted-foreground">
                          {selectedLanguage === "ar" ? "مفصل" : "Detailed"}
                        </span>
                      </div>
                      <Slider
                        aria-label={selectedLanguage === "ar" ? "المختصر مقابل المفصل" : "Concise vs Detailed"}
                        value={[conciseDetailed]}
                        onValueChange={([v]) => setConciseDetailed(v)}
                        max={100}
                        step={10}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">العربية</span>
                        <span className="text-foreground font-medium">{languageBalance}%</span>
                        <span className="text-muted-foreground">English</span>
                      </div>
                      <Slider
                        aria-label={selectedLanguage === "ar" ? "توازن اللغة" : "Language Balance"}
                        value={[languageBalance]}
                        onValueChange={([v]) => setLanguageBalance(v)}
                        max={100}
                        step={10}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Preview */}
              <Card className="bg-card/50 border-border">
                <CardContent className="p-6">
                  <Label className="text-sm font-medium mb-3 block text-foreground">
                    {selectedLanguage === "ar" ? "معاينة مباشرة" : "Live Preview"}
                  </Label>
                  <p className="text-body leading-relaxed">{getPreviewResponse()}</p>
                </CardContent>
              </Card>

              <Button
                onClick={handleVoiceComplete}
                className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12"
              >
                {selectedLanguage === "ar" ? "متابعة" : "Continue"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Ready */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            <div className="text-center space-y-6 max-w-md">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-16 h-16 rounded-full bg-nexus-gold/20 flex items-center justify-center mx-auto"
              >
                <Check className="h-8 w-8 text-nexus-gold" aria-hidden="true" />
              </motion.div>

              <h1 className="text-title-1">
                {selectedLanguage === "ar" 
                  ? "تم إنشاء خزنتك السيادية."
                  : "Your sovereign vault has been established."}
              </h1>
              
              <p className="text-body text-muted-foreground">
                {selectedLanguage === "ar"
                  ? "يشرفنا أن نرحب بك."
                  : "It is our privilege to welcome you."}
              </p>

              <p className="font-mono text-xl text-nexus-gold">
                {selectedLanguage === "ar" ? `الخزنة #${vaultId}` : `Vault #${vaultId}`}
              </p>

              <Card className="bg-card/50 border-border">
                <CardContent className="p-6 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground mb-4">
                    {selectedLanguage === "ar"
                      ? "قم برفع أول مستند إلى خزنتك"
                      : "Upload your first document to your vault"}
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-nexus-jade/30 hover:bg-nexus-jade/10 hover:border-nexus-jade"
                    onClick={() => {
                      // FIX 12: Navigate to vault for uploading
                      handleFinish()
                      setTimeout(() => router.push("/vault"), 100)
                    }}
                  >
                    <Upload className="h-4 w-4 me-2" aria-hidden="true" />
                    {selectedLanguage === "ar" ? "رفع مستند" : "Upload Document"}
                  </Button>
                </CardContent>
              </Card>

              <Button
                onClick={handleFinish}
                className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12"
              >
                {selectedLanguage === "ar" ? "الذهاب إلى لوحة التحكم" : "Go to Dashboard"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
