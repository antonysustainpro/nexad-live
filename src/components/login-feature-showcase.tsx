"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Shield, Target, Mic, BarChart3, Lock } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Shield,
    titleEn: "End-to-end sovereignty",
    titleAr: "سيادة شاملة",
    descEn: "Your data is encrypted, sharded, and stored only in UAE nodes",
    descAr: "بياناتك مشفرة ومجزأة ومخزنة فقط في خوادم الإمارات",
  },
  {
    icon: Target,
    titleEn: "15 AI domains",
    titleAr: "١٥ مجال ذكاء",
    descEn: "Finance, legal, real estate, lifestyle — one butler for everything",
    descAr: "المالية، القانون، العقارات، نمط الحياة — خادم واحد لكل شيء",
  },
  {
    icon: Mic,
    titleEn: "Voice counsel",
    titleAr: "مستشار صوتي",
    descEn: "Talk naturally in Arabic or English with emotion-aware responses",
    descAr: "تحدث بشكل طبيعي بالعربية أو الإنجليزية مع استجابات واعية للمشاعر",
  },
  {
    icon: BarChart3,
    titleEn: "Real-time intelligence",
    titleAr: "ذكاء فوري",
    descEn: "Market data, regulatory updates, and news — curated for you",
    descAr: "بيانات السوق، التحديثات التنظيمية، والأخبار — منسقة لك",
  },
  {
    icon: Lock,
    titleEn: "Zero-knowledge architecture",
    titleAr: "بنية صفر معرفة",
    descEn: "We can't read your data even if we wanted to",
    descAr: "لا يمكننا قراءة بياناتك حتى لو أردنا ذلك",
  },
]

export function LoginFeatureShowcase() {
  const { language } = useNexus()
  const isRTL = language === "ar"
  const [currentIndex, setCurrentIndex] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % features.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [prefersReducedMotion])

  // If reduced motion, show all as static list
  if (prefersReducedMotion) {
    return (
      <div className={cn("space-y-4", isRTL && "text-right")}>
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <div
              key={feature.titleEn}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border",
                isRTL && "flex-row-reverse"
              )}
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-nexus-jade/10">
                <Icon className="h-5 w-5 text-nexus-jade" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {language === "ar" ? feature.titleAr : feature.titleEn}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === "ar" ? feature.descAr : feature.descEn}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const currentFeature = features[currentIndex]
  const Icon = currentFeature.icon

  return (
    <div className="relative min-h-[160px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "flex items-start gap-4 p-6 rounded-2xl bg-secondary/50 border border-border",
            isRTL && "flex-row-reverse text-right"
          )}
        >
          <div className="flex-shrink-0 p-3 rounded-xl bg-nexus-jade/10">
            <Icon className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {language === "ar" ? currentFeature.titleAr : currentFeature.titleEn}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {language === "ar" ? currentFeature.descAr : currentFeature.descEn}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className={cn("flex gap-2 mt-4", isRTL ? "justify-end" : "justify-start")}>
        {features.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              index === currentIndex ? "w-6 bg-nexus-jade" : "bg-muted-foreground/30"
            )}
            aria-label={`${language === "ar" ? "الميزة" : "Feature"} ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
