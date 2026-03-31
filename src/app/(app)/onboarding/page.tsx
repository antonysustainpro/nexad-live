"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  FolderKanban,
  Sparkles,
  Rocket,
  ArrowRight,
  Check,
  MapPin,
  Loader2,
  Globe
} from "lucide-react"
import { cn } from "@/lib/utils"
import { butlerOnboard, sendChatMessage } from "@/lib/api"
import type { ButlerOnboardingData, ButlerCategory } from "@/lib/types"

// 4 Goal-oriented choices (all AI providers agreed)
const goals = [
  {
    id: "chat",
    iconEn: "Chat & Create",
    iconAr: "محادثة وإبداع",
    descEn: "AI assistant for conversations, writing, ideas",
    descAr: "مساعد ذكي للمحادثات والكتابة والأفكار",
    icon: MessageSquare,
    color: "from-blue-500 to-cyan-500",
    categories: ["tech", "news", "education", "entertainment"] as ButlerCategory[],
    demoPrompt: "Help me write a professional email",
    demoPromptAr: "ساعدني في كتابة بريد إلكتروني احترافي"
  },
  {
    id: "organize",
    iconEn: "Organize & Assist",
    iconAr: "تنظيم ومساعدة",
    descEn: "Butler tasks, reminders, document vault",
    descAr: "مهام المساعد، تذكيرات، خزنة المستندات",
    icon: FolderKanban,
    color: "from-emerald-500 to-teal-500",
    categories: ["deal", "event", "health", "real estate"] as ButlerCategory[],
    demoPrompt: "Remind me to call the dentist tomorrow at 10am",
    demoPromptAr: "ذكرني بالاتصال بطبيب الأسنان غدًا الساعة 10 صباحًا"
  },
  {
    id: "power",
    iconEn: "Explore Everything",
    iconAr: "استكشف كل شيء",
    descEn: "Full access to all features",
    descAr: "وصول كامل لجميع الميزات",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    categories: ["tech", "crypto", "market", "investment", "news"] as ButlerCategory[],
    demoPrompt: "What can you help me with?",
    demoPromptAr: "بماذا يمكنك مساعدتي؟"
  },
  {
    id: "skip",
    iconEn: "Just Let Me Try",
    iconAr: "دعني أجرب فقط",
    descEn: "Skip setup and explore freely",
    descAr: "تخطي الإعداد واستكشف بحرية",
    icon: Rocket,
    color: "from-gray-500 to-slate-500",
    categories: [] as ButlerCategory[],
    demoPrompt: "",
    demoPromptAr: ""
  }
]

// Simplified locations
const locations = [
  { id: "dubai", labelEn: "Dubai", labelAr: "دبي" },
  { id: "abu-dhabi", labelEn: "Abu Dhabi", labelAr: "أبوظبي" },
  { id: "sharjah", labelEn: "Sharjah", labelAr: "الشارقة" },
  { id: "other-uae", labelEn: "Other UAE", labelAr: "إمارات أخرى" },
  { id: "international", labelEn: "International", labelAr: "دولي" },
]

// Broad interest categories (reduced from 24 to 8)
const broadInterests: Array<{ id: ButlerCategory; labelEn: string; labelAr: string }> = [
  { id: "tech", labelEn: "Tech & AI", labelAr: "تقنية وذكاء اصطناعي" },
  { id: "deal", labelEn: "Deals & Shopping", labelAr: "عروض وتسوق" },
  { id: "health", labelEn: "Health & Fitness", labelAr: "صحة ولياقة" },
  { id: "travel", labelEn: "Travel", labelAr: "سفر" },
  { id: "news", labelEn: "News & Business", labelAr: "أخبار وأعمال" },
  { id: "entertainment", labelEn: "Entertainment", labelAr: "ترفيه" },
  { id: "investment", labelEn: "Finance & Crypto", labelAr: "مالية وعملات" },
  { id: "education", labelEn: "Learning", labelAr: "تعلم" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { language, isRTL, updatePreferences } = useNexus()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedInterests, setSelectedInterests] = useState<ButlerCategory[]>([])

  // Demo state
  const [demoMessage, setDemoMessage] = useState("")
  const [demoResponse, setDemoResponse] = useState("")
  const [isDemoTyping, setIsDemoTyping] = useState(false)

  // Handle goal selection -> instant demo
  const handleGoalSelect = async (goalId: string) => {
    setSelectedGoal(goalId)

    // Skip user goes straight to app
    if (goalId === "skip") {
      await completeOnboarding([])
      return
    }

    const goal = goals.find(g => g.id === goalId)
    if (goal) {
      setSelectedInterests(goal.categories)
      // Trigger demo
      const prompt = language === "ar" ? goal.demoPromptAr : goal.demoPrompt
      setDemoMessage(prompt)
      setIsDemoTyping(true)
      setStep(2) // Move to demo step immediately

      // Call real AI API for demo response
      try {
        const result = await sendChatMessage(
          [{ role: "user", content: prompt }],
          { max_tokens: 150 }
        )
        setDemoResponse(result.content)
      } catch {
        setDemoResponse(language === "ar" ? "تعذر الاتصال. يرجى المحاولة مرة أخرى." : "Unable to connect. Please try again.")
      } finally {
        setIsDemoTyping(false)
      }
    }
  }

  // Move to personalization step
  const proceedToPersonalize = () => {
    setStep(3)
  }

  // Toggle interest
  const toggleInterest = (id: ButlerCategory) => {
    setSelectedInterests(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  // Complete onboarding
  const completeOnboarding = async (categories: ButlerCategory[]) => {
    setIsSubmitting(true)

    const data: ButlerOnboardingData = {
      persona: selectedGoal === "chat" ? "tech" :
               selectedGoal === "organize" ? "parent" :
               selectedGoal === "power" ? "entrepreneur" : "other",
      categories: categories.length > 0 ? categories : ["news", "deal", "tech"],
      location: selectedLocation || "dubai",
      familyInfo: { familySize: 1, childrenAges: [], dietaryPreferences: [] },
    }

    try {
      await butlerOnboard(data)
    } catch {
      // Graceful degradation
    }

    updatePreferences({
      butlerOnboarded: true,
      butlerPersona: data.persona,
      butlerCategories: categories,
    })

    router.push("/")
  }

  // Animation variants
  const fadeSlide = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0B] via-[#111113] to-[#0A0A0B] flex flex-col">
      {/* Progress dots */}
      <div className="pt-8 pb-4 px-4">
        <div className="max-w-md mx-auto flex justify-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={language === "ar" ? `الخطوة ${step} من 3` : `Step ${step} of 3`}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              aria-hidden="true"
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                s === step ? "w-8 bg-nexus-jade" :
                s < step ? "w-2 bg-nexus-jade/60" : "w-2 bg-white/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <AnimatePresence mode="wait">

          {/* Step 1: Goal Selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              {...fadeSlide}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg space-y-8"
            >
              {/* Welcome header */}
              <div className={cn("text-center space-y-3", isRTL && "text-right")}>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl md:text-4xl font-bold text-white"
                >
                  {language === "ar" ? "أهلاً وسهلاً!" : "Welcome!"}
                </motion.h1>
                <p className="text-lg text-[#8E8E93]">
                  {language === "ar"
                    ? "ما الذي تريد مساعدتك فيه؟"
                    : "What would you like help with?"}
                </p>
              </div>

              {/* Goal cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {goals.map((goal, idx) => {
                  const Icon = goal.icon
                  const isSelected = selectedGoal === goal.id
                  return (
                    <motion.button
                      key={goal.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => handleGoalSelect(goal.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative p-6 rounded-2xl border transition-all text-start group",
                        goal.id === "skip" ? "sm:col-span-2" : "",
                        isSelected
                          ? "border-nexus-jade ring-2 ring-nexus-jade/30 bg-nexus-jade/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br",
                        goal.color
                      )}>
                        <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {language === "ar" ? goal.iconAr : goal.iconEn}
                      </h3>
                      <p className="text-sm text-[#8E8E93]">
                        {language === "ar" ? goal.descAr : goal.descEn}
                      </p>
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <Check className="h-5 w-5 text-nexus-jade" aria-hidden="true" />
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Instant Demo */}
          {step === 2 && (
            <motion.div
              key="step2"
              {...fadeSlide}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg space-y-6"
            >
              <div className={cn("text-center space-y-2", isRTL && "text-right")}>
                <h2 className="text-2xl font-bold text-white">
                  {language === "ar" ? "شاهد كيف يعمل" : "See how it works"}
                </h2>
                <p className="text-[#8E8E93]">
                  {language === "ar"
                    ? "هذه معاينة سريعة لما يمكنني فعله"
                    : "Here's a quick preview of what I can do"}
                </p>
              </div>

              {/* Demo chat bubble */}
              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                {/* User message */}
                <div className="p-4 border-b border-white/10">
                  <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
                    <div className="w-8 h-8 rounded-full bg-nexus-jade/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">You</span>
                    </div>
                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                      <p className="text-white text-sm">{demoMessage}</p>
                    </div>
                  </div>
                </div>

                {/* AI response */}
                <div className="p-4">
                  <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-jade to-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="bg-nexus-jade/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                      {isDemoTyping ? (
                        <div className="flex gap-1" role="status" aria-label={language === "ar" ? "جاري الكتابة" : "Typing"}>
                          <span className="w-2 h-2 bg-nexus-jade rounded-full motion-safe:animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-nexus-jade rounded-full motion-safe:animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-nexus-jade rounded-full motion-safe:animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : (
                        <p className="text-white text-sm">{demoResponse}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              {!isDemoTyping && demoResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <p className="text-center text-nexus-jade font-medium">
                    {language === "ar" ? "أعجبك؟ لنخصص تجربتك" : "Impressed? Let's personalize your experience"}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/20 hover:bg-white/10"
                      onClick={() => completeOnboarding(selectedInterests)}
                    >
                      {language === "ar" ? "تخطي" : "Skip for Now"}
                    </Button>
                    <Button
                      className="flex-1 bg-nexus-jade hover:bg-nexus-jade/90 text-black"
                      onClick={proceedToPersonalize}
                    >
                      {language === "ar" ? "خصص" : "Personalize"}
                      <ArrowRight className={cn("h-4 w-4 ms-2", isRTL && "rotate-180")} aria-hidden="true" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3: Quick Personalize */}
          {step === 3 && (
            <motion.div
              key="step3"
              {...fadeSlide}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg space-y-8"
            >
              <div className={cn("text-center space-y-2", isRTL && "text-right")}>
                <h2 className="text-2xl font-bold text-white">
                  {language === "ar" ? "خصص تجربتك" : "Personalize your experience"}
                </h2>
                <p className="text-[#8E8E93] text-sm">
                  {language === "ar"
                    ? "10 ثوانٍ فقط للحصول على اقتراحات أفضل"
                    : "Just 10 seconds for better suggestions"}
                </p>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <MapPin className="h-4 w-4 text-nexus-jade" aria-hidden="true" />
                  {language === "ar" ? "موقعك" : "Your location"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedLocation(loc.id)}
                      aria-pressed={selectedLocation === loc.id}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm transition-all border",
                        selectedLocation === loc.id
                          ? "bg-nexus-jade/20 border-nexus-jade text-white"
                          : "bg-white/5 border-white/10 text-[#8E8E93] hover:border-white/20"
                      )}
                    >
                      {language === "ar" ? loc.labelAr : loc.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <Globe className="h-4 w-4 text-nexus-jade" aria-hidden="true" />
                  {language === "ar" ? "اهتماماتك" : "Your interests"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {broadInterests.map((interest) => (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      aria-pressed={selectedInterests.includes(interest.id)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm transition-all border",
                        selectedInterests.includes(interest.id)
                          ? "bg-nexus-jade/20 border-nexus-jade text-white"
                          : "bg-white/5 border-white/10 text-[#8E8E93] hover:border-white/20"
                      )}
                    >
                      {language === "ar" ? interest.labelAr : interest.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 hover:bg-white/10"
                  onClick={() => completeOnboarding([])}
                  disabled={isSubmitting}
                >
                  {language === "ar" ? "تخطي" : "Skip"}
                </Button>
                <Button
                  className="flex-1 bg-nexus-jade hover:bg-nexus-jade/90 text-black"
                  onClick={() => completeOnboarding(selectedInterests)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      {language === "ar" ? "ابدأ" : "Get Started"}
                      <ArrowRight className={cn("h-4 w-4 ms-2", isRTL && "rotate-180")} aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  )
}
