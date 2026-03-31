"use client"

import { useState } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { HelpFAQSection } from "@/components/help-faq-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { HelpCircle, Search, Mail, Clock, ExternalLink, CheckCircle2 } from "lucide-react"
import Link from "next/link"

const faqSections = [
  {
    title: "Getting Started",
    titleAr: "البدء",
    items: [
      {
        questionEn: "How do I create my sovereign key?",
        questionAr: "كيف أنشئ مفتاحي السيادي؟",
        answerEn: "When you first sign up, you'll go through a Key Ceremony that generates your unique encryption key. This key is generated locally on your device and never leaves it.",
        answerAr: "عند التسجيل لأول مرة، ستمر بمراسم المفتاح التي تنشئ مفتاح التشفير الفريد الخاص بك. يتم إنشاء هذا المفتاح محلياً على جهازك ولا يغادره أبداً.",
      },
      {
        questionEn: "What domains can I add?",
        questionAr: "ما المجالات التي يمكنني إضافتها؟",
        answerEn: "You can add Financial, Legal, UAE Government, Health, Technical, Creative, Business, and Real Estate domains. Each domain enables specialized AI assistance.",
        answerAr: "يمكنك إضافة مجالات المالية، القانونية، حكومة الإمارات، الصحة، التقنية، الإبداع، الأعمال، والعقارات. كل مجال يتيح مساعدة ذكاء اصطناعي متخصصة.",
      },
    ],
  },
  {
    title: "Billing",
    titleAr: "الفواتير",
    items: [
      {
        questionEn: "What payment methods do you accept?",
        questionAr: "ما طرق الدفع المقبولة؟",
        answerEn: "We accept all major credit cards (Visa, Mastercard, Amex) and bank transfers for enterprise accounts. All payments are processed securely.",
        answerAr: "نقبل جميع بطاقات الائتمان الرئيسية (فيزا، ماستركارد، أمريكان إكسبريس) والتحويلات البنكية للحسابات المؤسسية. تتم معالجة جميع المدفوعات بشكل آمن.",
      },
      {
        questionEn: "Can I cancel my subscription?",
        questionAr: "هل يمكنني إلغاء اشتراكي؟",
        answerEn: "Yes, you can cancel anytime from the Billing page. Your access continues until the end of your current billing period.",
        answerAr: "نعم، يمكنك الإلغاء في أي وقت من صفحة الفواتير. يستمر وصولك حتى نهاية فترة الفوترة الحالية.",
      },
    ],
  },
  {
    title: "Privacy & Security",
    titleAr: "الخصوصية والأمان",
    items: [
      {
        questionEn: "Is my data encrypted?",
        questionAr: "هل بياناتي مشفرة؟",
        answerEn: "Yes, all data is encrypted using AES-256-GCM with your sovereign key. Data is sharded across multiple encrypted secure nodes for additional security.",
        answerAr: "نعم، يتم تشفير جميع البيانات باستخدام AES-256-GCM مع مفتاحك السيادي. يتم تجزئة البيانات عبر عقد آمنة ومشفرة متعددة لمزيد من الأمان.",
      },
      {
        questionEn: "Who can access my data?",
        questionAr: "من يمكنه الوصول لبياناتي؟",
        answerEn: "Only you can access your data. Not even NexusAD staff can read your encrypted content. Your sovereign key is the only way to decrypt your data.",
        answerAr: "أنت فقط من يمكنه الوصول لبياناتك. حتى موظفو NexusAD لا يمكنهم قراءة محتواك المشفر. مفتاحك السيادي هو الطريقة الوحيدة لفك تشفير بياناتك.",
      },
    ],
  },
  {
    title: "Voice Counsel",
    titleAr: "الاستشارة الصوتية",
    items: [
      {
        questionEn: "How does voice input work?",
        questionAr: "كيف يعمل الإدخال الصوتي؟",
        answerEn: "Voice Counsel uses advanced speech recognition to transcribe your voice, then processes it through our AI. Audio is processed locally when possible for maximum privacy.",
        answerAr: "يستخدم الاستشارة الصوتية التعرف المتقدم على الكلام لنسخ صوتك، ثم معالجته عبر ذكائنا الاصطناعي. تتم معالجة الصوت محلياً عندما يكون ذلك ممكناً لأقصى خصوصية.",
      },
    ],
  },
  {
    title: "Butler",
    titleAr: "الخادم",
    items: [
      {
        questionEn: "How does Butler learn my preferences?",
        questionAr: "كيف يتعلم الخادم تفضيلاتي؟",
        answerEn: "During onboarding, you select your persona and categories. Butler uses this to curate personalized cards. Your interactions further refine its understanding.",
        answerAr: "أثناء الإعداد، تختار شخصيتك وفئاتك. يستخدم الخادم هذا لتنظيم بطاقات مخصصة. تفاعلاتك تحسّن فهمه بشكل أكبر.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    titleAr: "استكشاف الأخطاء",
    items: [
      {
        questionEn: "I lost my sovereign key, what do I do?",
        questionAr: "فقدت مفتاحي السيادي، ماذا أفعل؟",
        answerEn: "If you created a backup QR code, you can restore your key from it. If not, unfortunately your encrypted data cannot be recovered. This is by design for maximum security.",
        answerAr: "إذا أنشأت رمز QR احتياطياً، يمكنك استعادة مفتاحك منه. إذا لم تفعل، للأسف لا يمكن استرداد بياناتك المشفرة. هذا بالتصميم لأقصى أمان.",
      },
      {
        questionEn: "The app is running slowly, how can I fix it?",
        questionAr: "التطبيق بطيء، كيف أصلحه؟",
        answerEn: "Try refreshing the page, clearing your browser cache, or switching to a different browser. If issues persist, contact support.",
        answerAr: "حاول تحديث الصفحة، مسح ذاكرة التخزين المؤقت للمتصفح، أو التبديل لمتصفح مختلف. إذا استمرت المشاكل، تواصل مع الدعم.",
      },
    ],
  },
]

export default function HelpPage() {
  const { language, isRTL } = useNexus()
  const [searchQuery, setSearchQuery] = useState("")

  // Simple search filter
  const filteredSections = faqSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const query = searchQuery.toLowerCase()
      if (!query) return true
      const text = language === "ar"
        ? `${item.questionAr} ${item.answerAr}`
        : `${item.questionEn} ${item.answerEn}`
      return text.toLowerCase().includes(query)
    }),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="container max-w-3xl mx-auto px-4 pt-2 pb-40 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
        <HelpCircle className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">
          {language === "ar" ? "المساعدة والدعم" : "Help & Support"}
        </h1>
      </div>

      {/* Search */}
      <div className={cn("relative mb-8", isRTL && "text-right")}>
        <label htmlFor="faq-search" className="sr-only">
          {language === "ar" ? "ابحث في الأسئلة الشائعة" : "Search FAQs"}
        </label>
        <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} aria-hidden="true" />
        <Input
          id="faq-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === "ar" ? "ابحث في الأسئلة الشائعة..." : "Search FAQs..."}
          className={cn("h-12", isRTL ? "pr-10 text-right" : "pl-10")}
          dir={isRTL ? "rtl" : "ltr"}
        />
      </div>

      {/* System Status */}
      <Card className="mb-8">
        <CardContent className="pt-4">
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <span className="relative flex h-3 w-3" aria-hidden="true">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span>
            </span>
            <span className="text-sm font-medium text-[#10B981]">
              {language === "ar" ? "جميع الأنظمة تعمل" : "All systems operational"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Sections */}
      <div className="space-y-8">
        {filteredSections.length === 0 ? (
          <p className={cn("text-muted-foreground text-center py-8")}>
            {language === "ar" ? "لا توجد نتائج" : "No results found"}
          </p>
        ) : (
          filteredSections.map((section, index) => (
            <HelpFAQSection
              key={index}
              title={section.title}
              titleAr={section.titleAr}
              items={section.items}
            />
          ))
        )}
      </div>

      {/* Contact Support */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Mail className="h-5 w-5 text-nexus-jade" aria-hidden="true" />
            {language === "ar" ? "تواصل مع الدعم" : "Contact Support"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>
            {language === "ar"
              ? "لم تجد ما تبحث عنه؟ فريق الدعم لدينا هنا للمساعدة."
              : "Couldn't find what you're looking for? Our support team is here to help."}
          </p>
          <div className={cn("flex items-center gap-4 flex-wrap", isRTL && "flex-row-reverse")}>
            <a
              href="mailto:support@nexusad.ai"
              className="text-nexus-jade hover:underline text-sm flex items-center gap-1"
            >
              support@nexusad.ai
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
              <Clock className="h-3 w-3" aria-hidden="true" />
              {language === "ar" ? "الرد خلال 24 ساعة" : "Response within 24 hours"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Links */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className={isRTL ? "text-right" : undefined}>
            {language === "ar" ? "الوثائق" : "Documentation"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("grid gap-3", isRTL && "text-right")}>
            {[
              { labelEn: "API Reference", labelAr: "مرجع API", href: "/docs/api" },
              { labelEn: "Integration Guide", labelAr: "دليل التكامل", href: "/docs/integration" },
              { labelEn: "Security Whitepaper", labelAr: "ورقة الأمان البيضاء", href: "/docs/security" },
            ].map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors",
                  isRTL && "flex-row-reverse"
                )}
              >
                <span className="text-sm font-medium">
                  {language === "ar" ? link.labelAr : link.labelEn}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
