"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Compass,
  DollarSign,
  Scale,
  Landmark,
  Heart,
  Code,
  Building,
  GraduationCap,
  ShoppingBag,
  Plane,
  ChevronRight,
  Lock,
  TrendingUp,
  Loader2,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { getDomainsMastery, type DomainMastery } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Domain definitions - mastery/documents/conversations are loaded from API
const domains = [
  {
    id: "financial",
    nameEn: "Financial",
    nameAr: "المالية",
    descriptionEn: "Markets, investments, banking, crypto",
    descriptionAr: "الأسواق والاستثمارات والبنوك والعملات المشفرة",
    icon: DollarSign,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-600/10 dark:bg-amber-400/10",
  },
  {
    id: "legal",
    nameEn: "Legal",
    nameAr: "القانونية",
    descriptionEn: "UAE law, DIFC regulations, contracts",
    descriptionAr: "قانون الإمارات ولوائح مركز دبي المالي والعقود",
    icon: Scale,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-nexus-jade",
    bgColor: "bg-nexus-jade/10",
  },
  {
    id: "uae-government",
    nameEn: "UAE Government",
    nameAr: "حكومة الإمارات",
    descriptionEn: "Visas, licenses, government services",
    descriptionAr: "التأشيرات والرخص والخدمات الحكومية",
    icon: Landmark,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-red-600",
    bgColor: "bg-red-600/10",
  },
  {
    id: "health",
    nameEn: "Health",
    nameAr: "الصحة",
    descriptionEn: "Medical records, insurance, wellness",
    descriptionAr: "السجلات الطبية والتأمين والصحة",
    icon: Heart,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
  },
  {
    id: "technical",
    nameEn: "Technical",
    nameAr: "التقنية",
    descriptionEn: "Code, architecture, DevOps, AI",
    descriptionAr: "البرمجة والهندسة المعمارية وDevOps والذكاء الاصطناعي",
    icon: Code,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "real-estate",
    nameEn: "Real Estate",
    nameAr: "العقارات",
    descriptionEn: "Property, rentals, investments",
    descriptionAr: "العقارات والإيجارات والاستثمارات",
    icon: Building,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-amber-600",
    bgColor: "bg-amber-600/10",
  },
  {
    id: "education",
    nameEn: "Education",
    nameAr: "التعليم",
    descriptionEn: "Schools, universities, courses",
    descriptionAr: "المدارس والجامعات والدورات",
    icon: GraduationCap,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  {
    id: "shopping",
    nameEn: "Shopping",
    nameAr: "التسوق",
    descriptionEn: "Retail, e-commerce, reviews",
    descriptionAr: "التجزئة والتجارة الإلكترونية والمراجعات",
    icon: ShoppingBag,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-fuchsia-500",
    bgColor: "bg-fuchsia-500/10",
  },
  {
    id: "travel",
    nameEn: "Travel",
    nameAr: "السفر",
    descriptionEn: "Flights, hotels, destinations",
    descriptionAr: "الرحلات والفنادق والوجهات",
    icon: Plane,
    mastery: 0,
    documents: 0,
    conversations: 0,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
]

export default function DomainsPage() {
  const { language } = useNexus()
  const [domainData, setDomainData] = useState(domains)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDomains = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
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
      const masteryData = await getDomainsMastery(userId, signal)
      if (masteryData && masteryData.length > 0) {
        // Merge backend mastery data with local domain definitions (icons, colors, labels)
        setDomainData((prev) =>
          prev.map((d) => {
            const remote = masteryData.find((m: DomainMastery) => m.id === d.id)
            if (remote) {
              return {
                ...d,
                mastery: remote.mastery,
                documents: remote.documents,
                conversations: remote.conversations,
              }
            }
            return d
          })
        )
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Failed to load domain data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    loadDomains(abortController.signal)
    return () => abortController.abort()
  }, [loadDomains])

  const topDomains = [...domainData].sort((a, b) => b.mastery - a.mastery).slice(0, 3)

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Compass className="h-12 w-12 text-destructive/30 mb-4" aria-hidden="true" />
          <h3 className="font-medium text-destructive mb-1">
            {language === "ar" ? "خطأ في تحميل المجالات" : "Error Loading Domains"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => loadDomains()}>
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-title-1 flex items-center gap-2">
          <Compass className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          {language === "ar" ? "المجالات" : "Domains"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar"
            ? "استكشف مجالات المعرفة التي أتقنها NexusAD Ai من أجلك"
            : "Explore the knowledge domains NexusAD Ai has mastered for you"}
        </p>
      </div>

      {/* Top Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "أعلى المجالات إتقاناً" : "Top Mastered Domains"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topDomains.map((domain, index) => {
              const Icon = domain.icon
              return (
                <Link
                  key={domain.id}
                  href={`/domains/${domain.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary transition-colors"
                >
                  <div className={cn("p-3 rounded-xl", domain.bgColor)}>
                    <Icon className={cn("h-6 w-6", domain.color)} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {language === "ar" ? domain.nameAr : domain.nameEn}
                      </p>
                      {index === 0 && (
                        <Badge className={cn("bg-secondary", domain.color, "text-xs")}>
                          #{index + 1}
                        </Badge>
                      )}
                    </div>
                    <p className={cn("text-2xl font-bold", domain.color)}>{domain.mastery}%</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {domainData.map((domain) => {
          const Icon = domain.icon
          return (
            <Link key={domain.id} href={`/domains/${domain.id}`}>
              <Card className="h-full hover:border-nexus-jade/30 transition-colors group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("p-3 rounded-xl", domain.bgColor)}>
                      <Icon className={cn("h-6 w-6", domain.color)} aria-hidden="true" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-1">
                    {language === "ar" ? domain.nameAr : domain.nameEn}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {language === "ar" ? domain.descriptionAr : domain.descriptionEn}
                  </p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">
                          {language === "ar" ? "الإتقان" : "Mastery"}
                        </span>
                        <span className={cn("font-medium", domain.color)}>{domain.mastery}%</span>
                      </div>
                      <Progress value={domain.mastery} className="h-1.5" />
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-nexus-gold" aria-hidden="true" />
                        {domain.documents} {language === "ar" ? "مستند" : "docs"}
                      </span>
                      <span>
                        {domain.conversations} {language === "ar" ? "محادثة" : "chats"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
