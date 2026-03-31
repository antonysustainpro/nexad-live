"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import {
  ChevronLeft,
  DollarSign,
  Scale,
  Landmark,
  Heart,
  Code,
  Globe,
  BookOpen,
  Palette,
  MessageCircle,
  FileText,
  ArrowRight,
  TrendingUp
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNexus } from "@/contexts/nexus-context"

// Domain detail page
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DollarSign,
  Scale,
  Landmark,
  Heart,
  Code,
  Globe,
  BookOpen,
  Palette
}

const domainColors: Record<string, string> = {
  financial: "text-amber-600 dark:text-amber-400",
  legal: "text-muted-foreground",
  uae_knowledge: "text-muted-foreground",
  health: "text-muted-foreground",
  technical: "text-muted-foreground",
  creative: "text-muted-foreground",
  emotional: "text-muted-foreground",
  research: "text-muted-foreground",
  general: "text-muted-foreground"
}

// Domain data - conversations and documents loaded from API, no fake data
const domainsData: Record<string, {
  name: string
  nameAr: string
  icon: string
  mastery: number
  description: string
  descriptionAr: string
  capabilities: string[]
  capabilitiesAr: string[]
  prompts: { text: string; textAr: string }[]
  conversations: { id: string; title: string; date: string }[]
  documents: { id: string; name: string; type: string }[]
  sparklineData: number[]
}> = {
  financial: {
    name: "Financial Intelligence",
    nameAr: "الذكاء المالي",
    icon: "DollarSign",
    mastery: 0,
    description: "Advanced financial analysis, investment strategies, tax planning, and market research capabilities tailored to UAE and GCC markets.",
    descriptionAr: "تحليل مالي متقدم واستراتيجيات استثمار وتخطيط ضريبي وقدرات بحث سوقي مصممة خصيصًا لأسواق الإمارات ودول مجلس التعاون.",
    capabilities: [
      "Portfolio analysis and rebalancing recommendations",
      "Tax optimization strategies for UAE residents",
      "Market trend analysis with GCC focus",
      "Investment risk assessment",
      "Financial document parsing and summarization",
      "Real-time market data interpretation"
    ],
    capabilitiesAr: [
      "تحليل المحفظة وتوصيات إعادة التوازن",
      "استراتيجيات تحسين الضرائب للمقيمين في الإمارات",
      "تحليل اتجاهات السوق مع التركيز على دول مجلس التعاون",
      "تقييم مخاطر الاستثمار",
      "تحليل وتلخيص المستندات المالية",
      "تفسير بيانات السوق في الوقت الفعلي"
    ],
    prompts: [
      { text: "Analyze my portfolio performance", textAr: "حلل أداء محفظتي" },
      { text: "What are the best investment options in UAE?", textAr: "ما هي أفضل خيارات الاستثمار في الإمارات؟" },
      { text: "Compare investment opportunities", textAr: "قارن بين فرص الاستثمار" },
      { text: "Explain UAE corporate tax implications", textAr: "اشرح تأثيرات ضريبة الشركات في الإمارات" },
      { text: "Create a diversified investment strategy", textAr: "أنشئ استراتيجية استثمار متنوعة" }
    ],
    conversations: [],
    documents: [],
    sparklineData: [0]
  },
  legal: {
    name: "Legal & Compliance",
    nameAr: "القانون والامتثال",
    icon: "Scale",
    mastery: 0,
    description: "UAE legal frameworks, contract analysis, regulatory compliance, and business law expertise.",
    descriptionAr: "الأطر القانونية الإماراتية وتحليل العقود والامتثال التنظيمي وخبرة قانون الأعمال.",
    capabilities: [
      "UAE corporate law interpretation",
      "Contract review and risk identification",
      "DIFC and ADGM regulatory guidance",
      "Employment law compliance",
      "Intellectual property protection",
      "Dispute resolution strategies"
    ],
    capabilitiesAr: [
      "تفسير قانون الشركات الإماراتي",
      "مراجعة العقود وتحديد المخاطر",
      "إرشادات تنظيمية لمركز دبي المالي وسوق أبوظبي العالمي",
      "الامتثال لقانون العمل",
      "حماية الملكية الفكرية",
      "استراتيجيات حل النزاعات"
    ],
    prompts: [
      { text: "Review this employment contract for UAE compliance", textAr: "راجع عقد العمل هذا للامتثال لقوانين الإمارات" },
      { text: "What are the DIFC license renewal requirements?", textAr: "ما هي متطلبات تجديد رخصة مركز دبي المالي؟" },
      { text: "Explain UAE golden visa eligibility", textAr: "اشرح أهلية الإقامة الذهبية في الإمارات" },
      { text: "Compare DIFC vs mainland company setup", textAr: "قارن بين تأسيس شركة في مركز دبي المالي والبر الرئيسي" }
    ],
    conversations: [],
    documents: [],
    sparklineData: [0]
  }
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const height = 40
  const width = 100

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Mastery trend">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export default function DomainDetailPage() {
  const { language } = useNexus()
  const params = useParams()
  const rawDomainId = params.id as string
  // SEC-UI-116: Validate domainId from URL to prevent prototype pollution via __proto__/constructor keys.
  // Only allow alphanumeric and hyphens; reject any key that could pollute Object prototype.
  const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]
  const domainId = /^[a-zA-Z0-9-]+$/.test(rawDomainId) && !FORBIDDEN_KEYS.includes(rawDomainId)
    ? rawDomainId
    : "financial"

  const domain = useMemo(() => {
    return Object.prototype.hasOwnProperty.call(domainsData, domainId) ? domainsData[domainId] : domainsData.financial
  }, [domainId])

  const Icon = iconMap[domain.icon] || DollarSign
  const colorClass = domainColors[domainId] || "text-muted-foreground"

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/domains"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
          {language === "ar" ? "العودة للمجالات" : "Back to Domains"}
        </Link>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-xl bg-secondary ${colorClass}`}>
              <Icon className="h-12 w-12" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {language === "ar" ? domain.nameAr : domain.name}
              </h1>
              <p className="text-muted-foreground">
                {language === "ar" ? domain.name : domain.nameAr}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Mastery Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === "ar" ? "مستوى الإتقان" : "Mastery Level"}
                  </p>
                  <p className={cn("text-4xl font-bold", colorClass)}>{domain.mastery}%</p>
                </div>
                <div className="flex items-center gap-3">
                  <TrendingUp className={cn("h-4 w-4", colorClass)} aria-hidden="true" />
                  <Sparkline data={domain.sparklineData} className={cn("w-24 h-10", colorClass)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-12"
        >
          <p className="text-lg text-muted-foreground leading-relaxed">
            {language === "ar" ? domain.descriptionAr : domain.description}
          </p>
        </motion.div>

        {/* Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-xl font-semibold mb-4">
            {language === "ar" ? "القدرات" : "Capabilities"}
          </h2>
          <ul className="space-y-3">
            {(language === "ar" ? domain.capabilitiesAr : domain.capabilities).map((cap, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", colorClass.replace("text-", "bg-"))} />
                <span className="text-muted-foreground">{cap}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Try These Prompts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-12"
        >
          <h2 className="text-xl font-semibold mb-4">
            {language === "ar" ? "جرب هذه الاستفسارات" : "Try These Prompts"}
          </h2>
          <div className="flex flex-wrap gap-3">
            {domain.prompts.map((prompt, i) => (
              <Link
                key={i}
                href={`/chat?prompt=${encodeURIComponent(prompt.text)}`}
                className="rounded-full bg-secondary hover:bg-nexus-jade/10 transition-colors px-4 py-3 text-sm"
              >
                {language === "ar" ? prompt.textAr : prompt.text}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Conversations */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {language === "ar" ? "المحادثات الأخيرة" : "Recent Conversations"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {domain.conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">{conv.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{conv.date}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Related Documents */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {language === "ar" ? "المستندات ذات الصلة" : "Related Vault Documents"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {domain.documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/vault/${doc.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground uppercase">{doc.type}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
