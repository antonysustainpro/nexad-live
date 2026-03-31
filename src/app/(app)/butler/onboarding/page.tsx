"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  ArrowLeft, 
  ArrowRight, 
  Heart, 
  Briefcase, 
  TrendingUp, 
  Users, 
  Crown,
  Check,
  Minus,
  Plus,
  GraduationCap,
  Rocket,
  Stethoscope,
  Palette,
  Dumbbell,
  Armchair,
  Cpu,
  Globe,
  UtensilsCrossed,
  Plane,
  PenLine
} from "lucide-react"
import { cn } from "@/lib/utils"
import { butlerOnboard } from "@/lib/api"
import type { ButlerPersona, ButlerCategory, ButlerOnboardingData } from "@/lib/types"

const TOTAL_STEPS = 5

// Persona data - 16 personas per spec
const personas: Array<{
  id: ButlerPersona
  labelEn: string
  labelAr: string
  descEn: string
  descAr: string
  icon: typeof Heart
  defaultCategories: ButlerCategory[]
}> = [
  { 
    id: "parent", 
    labelEn: "Parent / Family Buyer", 
    labelAr: "والد / مشتري عائلي",
    descEn: "Deals, school, health, family activities",
    descAr: "عروض، مدرسة، صحة، أنشطة عائلية",
    icon: Heart,
    defaultCategories: ["deal", "health", "education", "event", "entertainment"]
  },
  { 
    id: "advisor", 
    labelEn: "Financial Advisor", 
    labelAr: "مستشار مالي",
    descEn: "Markets, regulation, compliance, portfolio",
    descAr: "أسواق، تنظيم، امتثال، محفظة",
    icon: Briefcase,
    defaultCategories: ["market", "regulatory", "investment", "news"]
  },
  { 
    id: "trader", 
    labelEn: "Active Trader", 
    labelAr: "متداول نشط",
    descEn: "Crypto, stocks, alerts, technical analysis",
    descAr: "عملات رقمية، أسهم، تنبيهات، تحليل فني",
    icon: TrendingUp,
    defaultCategories: ["crypto", "market", "investment", "tech", "news"]
  },
  { 
    id: "family", 
    labelEn: "Family Household", 
    labelAr: "أسرة",
    descEn: "Events, education, health, entertainment",
    descAr: "فعاليات، تعليم، صحة، ترفيه",
    icon: Users,
    defaultCategories: ["event", "education", "health", "entertainment", "deal"]
  },
  { 
    id: "hnwi", 
    labelEn: "High Net-Worth", 
    labelAr: "ثروة عالية",
    descEn: "Markets, luxury, travel, real estate",
    descAr: "أسواق، فاخر، سفر، عقارات",
    icon: Crown,
    defaultCategories: ["market", "real estate", "travel", "investment", "deal"]
  },
  { 
    id: "student", 
    labelEn: "Student", 
    labelAr: "طالب",
    descEn: "Scholarships, campus, deals, study resources",
    descAr: "منح دراسية، حرم جامعي، عروض، موارد دراسية",
    icon: GraduationCap,
    defaultCategories: ["education", "deal", "event", "tech", "entertainment"]
  },
  { 
    id: "entrepreneur", 
    labelEn: "Entrepreneur", 
    labelAr: "رائد أعمال",
    descEn: "Startups, funding, free zones, networking",
    descAr: "شركات ناشئة، تمويل، مناطق حرة، تواصل",
    icon: Rocket,
    defaultCategories: ["news", "investment", "regulatory", "tech", "event"]
  },
  { 
    id: "healthcare", 
    labelEn: "Healthcare Pro", 
    labelAr: "متخصص صحي",
    descEn: "Medical news, conferences, wellness, research",
    descAr: "أخبار طبية، مؤتمرات، عافية، بحث",
    icon: Stethoscope,
    defaultCategories: ["health", "news", "education", "event", "regulatory"]
  },
  { 
    id: "creative", 
    labelEn: "Creative", 
    labelAr: "مبدع",
    descEn: "Art, design, exhibitions, workshops, fashion",
    descAr: "فن، تصميم، معارض، ورش عمل، أزياء",
    icon: Palette,
    defaultCategories: ["art", "fashion", "event", "entertainment", "deal"]
  },
  { 
    id: "fitness", 
    labelEn: "Fitness & Wellness", 
    labelAr: "لياقة وعافية",
    descEn: "Gym, nutrition, sports, outdoor activities",
    descAr: "صالة رياضية، تغذية، رياضة، أنشطة خارجية",
    icon: Dumbbell,
    defaultCategories: ["fitness", "health", "sports", "deal", "entertainment"]
  },
  { 
    id: "retiree", 
    labelEn: "Retiree", 
    labelAr: "متقاعد",
    descEn: "Health, travel, community, investment income",
    descAr: "صحة، سفر، مجتمع، دخل استثماري",
    icon: Armchair,
    defaultCategories: ["health", "travel", "investment", "event", "deal"]
  },
  { 
    id: "tech", 
    labelEn: "Tech Professional", 
    labelAr: "متخصص تقني",
    descEn: "Gadgets, AI, programming, tech news",
    descAr: "أجهزة، ذكاء اصطناعي، برمجة، أخبار تقنية",
    icon: Cpu,
    defaultCategories: ["tech", "news", "deal", "education", "crypto"]
  },
  { 
    id: "expat", 
    labelEn: "New to UAE / Expat", 
    labelAr: "جديد في الإمارات / مغترب",
    descEn: "Visa, housing, schools, cultural tips",
    descAr: "تأشيرة، سكن، مدارس، نصائح ثقافية",
    icon: Globe,
    defaultCategories: ["news", "real estate", "education", "regulatory", "event"]
  },
  { 
    id: "foodlover", 
    labelEn: "Food Lover", 
    labelAr: "عاشق الطعام",
    descEn: "Restaurants, recipes, food festivals, reviews",
    descAr: "مطاعم، وصفات، مهرجانات طعام، تقييمات",
    icon: UtensilsCrossed,
    defaultCategories: ["restaurants", "deal", "event", "entertainment", "health"]
  },
  { 
    id: "traveler", 
    labelEn: "Frequent Traveler", 
    labelAr: "مسافر متكرر",
    descEn: "Flights, hotels, travel deals, destinations",
    descAr: "رحلات، فنادق، عروض سفر، وجهات",
    icon: Plane,
    defaultCategories: ["travel", "deal", "event", "entertainment", "news"]
  },
  { 
    id: "other", 
    labelEn: "Other", 
    labelAr: "أخرى",
    descEn: "Tell us in your own words",
    descAr: "أخبرنا بكلماتك",
    icon: PenLine,
    defaultCategories: []
  },
]

// All 24 categories per spec
const allCategories: Array<{ id: ButlerCategory; labelEn: string; labelAr: string }> = [
  { id: "deal", labelEn: "Deals", labelAr: "عروض" },
  { id: "market", labelEn: "Markets", labelAr: "أسواق" },
  { id: "crypto", labelEn: "Crypto", labelAr: "عملات رقمية" },
  { id: "news", labelEn: "News", labelAr: "أخبار" },
  { id: "health", labelEn: "Health", labelAr: "صحة" },
  { id: "education", labelEn: "Education", labelAr: "تعليم" },
  { id: "event", labelEn: "Events", labelAr: "فعاليات" },
  { id: "restaurants", labelEn: "Restaurants", labelAr: "مطاعم" },
  { id: "travel", labelEn: "Travel", labelAr: "سفر" },
  { id: "fitness", labelEn: "Fitness", labelAr: "لياقة" },
  { id: "tech", labelEn: "Tech", labelAr: "تقنية" },
  { id: "fashion", labelEn: "Fashion", labelAr: "أزياء" },
  { id: "real estate", labelEn: "Real Estate", labelAr: "عقارات" },
  { id: "art", labelEn: "Art", labelAr: "فن" },
  { id: "sports", labelEn: "Sports", labelAr: "رياضة" },
  { id: "automotive", labelEn: "Automotive", labelAr: "سيارات" },
  { id: "gaming", labelEn: "Gaming", labelAr: "ألعاب" },
  { id: "pets", labelEn: "Pets", labelAr: "حيوانات أليفة" },
  { id: "gardening", labelEn: "Gardening", labelAr: "حدائق" },
  { id: "home", labelEn: "Home", labelAr: "منزل" },
  { id: "beauty", labelEn: "Beauty", labelAr: "جمال" },
  { id: "entertainment", labelEn: "Entertainment", labelAr: "ترفيه" },
  { id: "regulatory", labelEn: "Regulatory", labelAr: "تنظيمي" },
  { id: "investment", labelEn: "Investment", labelAr: "استثمار" },
]

// Locations
const locations = [
  { id: "dubai-marina", labelEn: "Dubai Marina", labelAr: "دبي مارينا", descEn: "Waterfront living", descAr: "حياة على الواجهة البحرية" },
  { id: "difc", labelEn: "DIFC", labelAr: "مركز دبي المالي", descEn: "Financial hub", descAr: "المركز المالي" },
  { id: "downtown", labelEn: "Downtown Dubai", labelAr: "وسط دبي", descEn: "Burj Khalifa area", descAr: "منطقة برج خليفة" },
  { id: "jbr", labelEn: "JBR", labelAr: "جي بي آر", descEn: "Beach lifestyle", descAr: "نمط حياة الشاطئ" },
  { id: "business-bay", labelEn: "Business Bay", labelAr: "الخليج التجاري", descEn: "Commercial district", descAr: "المنطقة التجارية" },
  { id: "abu-dhabi", labelEn: "Abu Dhabi", labelAr: "أبوظبي", descEn: "Capital city", descAr: "العاصمة" },
  { id: "sharjah", labelEn: "Sharjah", labelAr: "الشارقة", descEn: "Cultural emirate", descAr: "الإمارة الثقافية" },
  { id: "other", labelEn: "Other UAE", labelAr: "أخرى في الإمارات", descEn: "Other locations", descAr: "مواقع أخرى" },
]

// Children age groups
const childrenAgeGroups = [
  { id: "0-2", labelEn: "0-2 years", labelAr: "0-2 سنة" },
  { id: "3-5", labelEn: "3-5 years", labelAr: "3-5 سنوات" },
  { id: "6-12", labelEn: "6-12 years", labelAr: "6-12 سنة" },
  { id: "13-17", labelEn: "13-17 years", labelAr: "13-17 سنة" },
  { id: "none", labelEn: "No children", labelAr: "لا يوجد أطفال" },
]

// Dietary preferences
const dietaryOptions = [
  { id: "halal", labelEn: "Halal", labelAr: "حلال" },
  { id: "vegetarian", labelEn: "Vegetarian", labelAr: "نباتي" },
  { id: "vegan", labelEn: "Vegan", labelAr: "نباتي صرف" },
  { id: "none", labelEn: "No restrictions", labelAr: "لا قيود" },
]

export default function ButlerOnboardingPage() {
  const router = useRouter()
  const { language, isRTL, updatePreferences } = useNexus()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [selectedPersona, setSelectedPersona] = useState<ButlerPersona | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<ButlerCategory[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [familySize, setFamilySize] = useState(2)
  const [childrenAges, setChildrenAges] = useState<string[]>([])
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([])
  const [freeText, setFreeText] = useState("")

  // Handle persona selection
  const handlePersonaSelect = (persona: ButlerPersona) => {
    setSelectedPersona(persona)
    const personaData = personas.find((p) => p.id === persona)
    if (personaData) {
      setSelectedCategories(personaData.defaultCategories)
    }
  }

  // Toggle category
  const toggleCategory = (category: ButlerCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedPersona) return

    setIsSubmitting(true)

    const data: ButlerOnboardingData = {
      persona: selectedPersona,
      categories: selectedCategories,
      location: selectedLocation || "other",
      familyInfo: {
        familySize,
        childrenAges,
        dietaryPreferences,
      },
      freeText: freeText || undefined,
    }

    try {
      await butlerOnboard(data)
    } catch {
      // Graceful degradation - continue even if API fails
    }

    // Update local preferences
    updatePreferences({
      butlerOnboarded: true,
      butlerPersona: selectedPersona,
      butlerCategories: selectedCategories,
    })

    router.push("/butler")
  }

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 1: return selectedPersona !== null
      case 2: return selectedCategories.length > 0
      case 3: return selectedLocation !== null
      case 4: return true // Optional step
      case 5: return true
      default: return false
    }
  }

  const nextStep = () => {
    if (step < TOTAL_STEPS && canProceed()) {
      setStep(step + 1)
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className={cn("flex items-center justify-between mb-2", isRTL && "flex-row-reverse")}>
            <button
              onClick={prevStep}
              disabled={step === 1}
              className={cn(
                "flex items-center gap-1 text-sm text-muted-foreground transition-colors",
                step === 1 ? "opacity-50 cursor-not-allowed" : "hover:text-foreground"
              )}
            >
              <ArrowLeft className={cn("h-4 w-4", isRTL && "rotate-180")} aria-hidden="true" />
              {language === "ar" ? "رجوع" : "Back"}
            </button>
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? `الخطوة ${step} من ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
            </span>
          </div>
          <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={language === "ar" ? `الخطوة ${step} من ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}>
            {[...Array(TOTAL_STEPS)].map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={cn(
                  "flex-1 h-1.5 rounded-full transition-colors",
                  i < step ? "bg-nexus-jade" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <AnimatePresence mode="wait" custom={1}>
          {/* Step 1: Persona Selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className={cn(isRTL && "text-right")}>
                <h2 className="text-2xl font-bold text-foreground">
                  {language === "ar" ? "من أنت؟" : "Who are you?"}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {language === "ar" 
                    ? "اختر الشخصية التي تمثلك أفضل"
                    : "Choose the persona that best represents you"
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {personas.map((persona) => {
                  const Icon = persona.icon
                  const isSelected = selectedPersona === persona.id
                  return (
                    <motion.button
                      key={persona.id}
                      onClick={() => handlePersonaSelect(persona.id)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative p-4 rounded-xl border min-h-[120px] transition-all text-start",
                        isSelected
                          ? "border-nexus-jade ring-1 ring-nexus-jade/50 bg-nexus-jade/5"
                          : "border-[rgba(255,255,255,0.08)] bg-[#1C1C1E] hover:border-[rgba(255,255,255,0.16)]"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-3 end-3">
                          <Check className="h-4 w-4 text-nexus-jade" aria-hidden="true" />
                        </div>
                      )}
                      <div className="mb-3">
                        <Icon className={cn(
                          "h-6 w-6",
                          isSelected ? "text-nexus-jade" : "text-[#8E8E93]"
                        )} aria-hidden="true" />
                      </div>
                      <h3 className="text-sm font-semibold text-[#F5F5F7]">
                        {language === "ar" ? persona.labelAr : persona.labelEn}
                      </h3>
                      <p className="text-xs text-[#8E8E93] mt-1 line-clamp-2">
                        {language === "ar" ? persona.descAr : persona.descEn}
                      </p>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Interest Categories */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className={cn(isRTL && "text-right")}>
                <h2 className="text-2xl font-bold text-foreground">
                  {language === "ar" ? "ما الذي يهمك؟" : "What matters to you?"}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {language === "ar" 
                    ? "اختر الفئات التي تريد متابعتها"
                    : "Select the categories you want to follow"
                  }
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {allCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id)
                  return (
                    <motion.button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      aria-pressed={isSelected}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                        isSelected
                          ? "bg-nexus-jade/20 border-nexus-jade text-[#F5F5F7]"
                          : "bg-[#1C1C1E] border-[rgba(255,255,255,0.08)] text-[#8E8E93] hover:border-[rgba(255,255,255,0.16)]"
                      )}
                    >
                      {language === "ar" ? category.labelAr : category.labelEn}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className={cn(isRTL && "text-right")}>
                <h2 className="text-2xl font-bold text-foreground">
                  {language === "ar" ? "أين تقيم؟" : "Where are you based?"}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {language === "ar" 
                    ? "اختر موقعك للحصول على محتوى محلي"
                    : "Select your location for local content"
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {locations.map((location) => {
                  const isSelected = selectedLocation === location.id
                  return (
                    <button
                      key={location.id}
                      onClick={() => setSelectedLocation(location.id)}
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all text-start",
                        isSelected
                          ? "border-nexus-jade bg-nexus-jade/10"
                          : "border-border bg-card/50 hover:border-muted-foreground/50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-3 end-3">
                          <Check className="h-4 w-4 text-nexus-jade" aria-hidden="true" />
                        </div>
                      )}
                      <h3 className="font-medium text-foreground">
                        {language === "ar" ? location.labelAr : location.labelEn}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {language === "ar" ? location.descAr : location.descEn}
                      </p>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 4: Family Info (Optional) */}
          {step === 4 && (
            <motion.div
              key="step4"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className={cn(isRTL && "text-right")}>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">
                    {language === "ar" ? "أخبرنا عن عائلتك" : "Tell us about your household"}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {language === "ar" ? "اختياري" : "Optional"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  {language === "ar" 
                    ? "ساعدنا في تخصيص المحتوى لعائلتك"
                    : "Help us personalize content for your family"
                  }
                </p>
              </div>

              {/* Family Size */}
              <div className="space-y-3">
                <label className={cn("text-sm font-medium text-foreground", isRTL && "block text-right")}>
                  {language === "ar" ? "حجم العائلة" : "Family size"}
                </label>
                <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFamilySize(Math.max(1, familySize - 1))}
                    aria-label={language === "ar" ? "تقليل حجم العائلة" : "Decrease family size"}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <span className="text-2xl font-bold w-8 text-center" aria-live="polite">{familySize}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFamilySize(Math.min(10, familySize + 1))}
                    aria-label={language === "ar" ? "زيادة حجم العائلة" : "Increase family size"}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Children Ages */}
              <div className="space-y-3">
                <label className={cn("text-sm font-medium text-foreground", isRTL && "block text-right")}>
                  {language === "ar" ? "أعمار الأطفال" : "Children ages"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {childrenAgeGroups.map((age) => {
                    const isSelected = childrenAges.includes(age.id)
                    return (
                      <button
                        key={age.id}
                        onClick={() => {
                          if (age.id === "none") {
                            setChildrenAges(isSelected ? [] : ["none"])
                          } else {
                            setChildrenAges((prev) =>
                              prev.includes(age.id)
                                ? prev.filter((a) => a !== age.id)
                                : [...prev.filter((a) => a !== "none"), age.id]
                            )
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm transition-all",
                          isSelected
                            ? "bg-nexus-jade text-black"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {language === "ar" ? age.labelAr : age.labelEn}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Dietary Preferences */}
              <div className="space-y-3">
                <label className={cn("text-sm font-medium text-foreground", isRTL && "block text-right")}>
                  {language === "ar" ? "تفضيلات غذائية" : "Dietary preferences"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map((option) => {
                    const isSelected = dietaryPreferences.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          if (option.id === "none") {
                            setDietaryPreferences(isSelected ? [] : ["none"])
                          } else {
                            setDietaryPreferences((prev) =>
                              prev.includes(option.id)
                                ? prev.filter((d) => d !== option.id)
                                : [...prev.filter((d) => d !== "none"), option.id]
                            )
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm transition-all",
                          isSelected
                            ? "bg-nexus-jade text-black"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {language === "ar" ? option.labelAr : option.labelEn}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Free Text */}
          {step === 5 && (
            <motion.div
              key="step5"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className={cn(isRTL && "text-right")}>
                <h2 className="text-2xl font-bold text-foreground">
                  {language === "ar" 
                    ? "هل هناك شيء آخر يجب أن يعرفه خادمك؟"
                    : "Anything else your Butler should know?"
                  }
                </h2>
                <p className="text-muted-foreground mt-1">
                  {language === "ar" 
                    ? "أخبرنا عن اهتماماتك وأهدافك"
                    : "Tell us about your interests and goals"
                  }
                </p>
              </div>

              <label htmlFor="butler-freetext" className="sr-only">
                {language === "ar" ? "أخبرنا عن اهتماماتك" : "Tell us about your interests"}
              </label>
              <Textarea
                id="butler-freetext"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
                placeholder={
                  language === "ar"
                    ? "أنا مهتم بالعقارات على الخارطة في دبي مارينا، ابنتي تبدأ المدرسة في سبتمبر..."
                    : "I'm interested in off-plan properties in Dubai Marina, my daughter starts school in September..."
                }
                className="min-h-[120px] resize-none"
                dir={isRTL ? "rtl" : "ltr"}
              />
              <div className={cn("text-xs text-muted-foreground", isRTL && "text-right")}>
                {freeText.length}/500
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
            {step === 4 && (
              <Button
                variant="ghost"
                onClick={nextStep}
                className="flex-1"
              >
                {language === "ar" ? "تخطي" : "Skip"}
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className={cn(
                  "flex-1 bg-nexus-jade hover:bg-nexus-jade/90 text-black",
                  step === 4 && "flex-1"
                )}
              >
                {language === "ar" ? "التالي" : "Next"}
                <ArrowRight className={cn("h-4 w-4 ms-2", isRTL && "rotate-180")} aria-hidden="true" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-nexus-jade hover:bg-nexus-jade/90 text-black"
              >
                {isSubmitting 
                  ? (language === "ar" ? "جاري التحميل..." : "Loading...")
                  : (language === "ar" ? "ابدأ خادمي" : "Start My Butler")
                }
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
