"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  TrendingUp,
  Clock,
  Brain,
  MessageCircle,
  Mic,
  Upload,
  BarChart3,
  Lock,
  Search,
  DollarSign,
  Scale,
  Landmark,
  Heart,
  Code,
  ChevronRight,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { SovereigntyScore } from "@/components/sovereignty-score"
import { ShardMap } from "@/components/shard-map"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Fallback data when API is unavailable - shows empty/onboarding state
const briefingItems = [
  {
    id: 1,
    icon: Brain,
    titleEn: "Welcome to NexusAD",
    titleAr: "مرحباً بك في NexusAD",
    summaryEn: "Start a conversation to build your intelligence",
    summaryAr: "ابدأ محادثة لبناء ذكائك",
  },
  {
    id: 2,
    icon: Upload,
    titleEn: "Build Your Vault",
    titleAr: "ابنِ خزنتك",
    summaryEn: "Upload documents to unlock domain mastery",
    summaryAr: "ارفع المستندات لفتح إتقان المجالات",
  },
  {
    id: 3,
    icon: TrendingUp,
    titleEn: "Personalized Briefings",
    titleAr: "إحاطات مخصصة",
    summaryEn: "Your daily insights will appear here",
    summaryAr: "ستظهر رؤاك اليومية هنا",
  },
]

// Empty state - conversations loaded from API
const getRecentConversations = (lang: "en" | "ar" | "bilingual"): { id: string; title: string; domain: string; timestamp: string }[] => []

// Domain categories - mastery values loaded from API
const topDomains = [
  { id: "financial", nameEn: "Financial", nameAr: "المالية", icon: DollarSign, mastery: 0 },
  { id: "legal", nameEn: "Legal", nameAr: "القانونية", icon: Scale, mastery: 0 },
  { id: "uae", nameEn: "UAE Government", nameAr: "حكومة الإمارات", icon: Landmark, mastery: 0 },
  { id: "health", nameEn: "Health", nameAr: "الصحة", icon: Heart, mastery: 0 },
  { id: "technical", nameEn: "Technical", nameAr: "التقنية", icon: Code, mastery: 0 },
]

function getGreeting(lang: "en" | "ar" | "bilingual"): { greeting: string; date: string } {
  const now = new Date()
  const hour = now.getHours()
  const month = now.getMonth() // 0-indexed
  const day = now.getDate()
  const dayOfWeek = now.getDay()
  
  let greeting: string

  // Check for Ramadan 2026: approx Feb 18 - Mar 19
  if ((month === 1 && day >= 18) || (month === 2 && day <= 19)) {
    greeting = lang === "ar" ? "رمضان كريم" : "Ramadan Kareem"
  }
  // Check for Eid al-Fitr 2026: approx Mar 20-22
  else if (month === 2 && day >= 20 && day <= 22) {
    greeting = lang === "ar" ? "عيد مبارك" : "Eid Mubarak"
  }
  // Friday greeting
  else if (dayOfWeek === 5) {
    greeting = lang === "ar" ? "جمعة مباركة" : "Jumu'ah Mubarak"
  }
  // Time-of-day fallback
  else if (lang === "ar") {
    if (hour < 12) greeting = "صباح الخير"
    else if (hour < 17) greeting = "مساء الخير"
    else greeting = "مساء النور"
  } else {
    if (hour < 12) greeting = "Good morning"
    else if (hour < 17) greeting = "Good afternoon"
    else greeting = "Good evening"
  }

  // Format date
  const options: Intl.DateTimeFormatOptions = { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  }
  const date = now.toLocaleDateString(lang === "ar" ? "ar-AE" : "en-US", options)

  return { greeting, date }
}

function GreetingHeader({ language, userName }: { language: "en" | "ar" | "bilingual"; userName?: string }) {
  const [greetingData, setGreetingData] = useState<{ greeting: string; date: string } | null>(null)

  useEffect(() => {
    setGreetingData(getGreeting(language))
  }, [language])

  // Static fallback for server render to avoid hydration mismatch
  const fallbackGreeting = language === "ar" ? "مرحباً" : "Welcome"
  
  // Personalized greeting with name (FIX 35)
  const personalGreeting = greetingData?.greeting
    ? userName
      ? language === "ar" 
        ? `${greetingData.greeting}، ${userName}`
        : `${greetingData.greeting}, ${userName}`
      : greetingData.greeting
    : fallbackGreeting

  return (
    <div className="space-y-1">
      <h1 className="text-title-2 font-semibold">
        {personalGreeting}
      </h1>
      <p className="text-callout text-muted-foreground min-h-[1.25rem]">
        {greetingData?.date ?? "\u00A0"}
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const { language, preferences } = useNexus()

  return (
    <div className="p-6 space-y-12 max-w-7xl mx-auto pb-20">
      {/* Top Row - Score and Shard Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SovereigntyScore />
        <ShardMap className="h-[200px]" />
      </div>

      {/* Daily Briefing */}
      <Card>
        <CardHeader className="pb-2">
          <GreetingHeader language={language} userName={preferences.name || undefined} />
        </CardHeader>
        <CardContent>
          <p className="text-body mb-4">
            {language === "ar" 
              ? "ثلاثة أمور تتطلب انتباهك."
              : "Three things require your attention."}
          </p>
          <div className="space-y-3">
            {briefingItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all"
                >
                  <div className="p-2 rounded-lg bg-card">
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {language === "ar" ? item.titleAr : item.titleEn}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {language === "ar" ? item.summaryAr : item.summaryEn}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <Link
            href="/briefing"
            className="mt-4 inline-flex items-center text-sm text-nexus-jade hover:text-nexus-jade-hover"
          >
            {language === "ar" ? "عرض الكل" : "View All"}
            <ChevronRight className="h-4 w-4 ms-1" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-nexus-jade hover:bg-nexus-jade-hover text-background h-12 px-6">
          <Link href="/chat">
            <MessageCircle className="h-5 w-5 me-2" aria-hidden="true" />
            {language === "ar" ? "محادثة جديدة" : "New Conversation"}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 px-6 border-nexus-jade/30 hover:bg-nexus-jade/10 hover:border-nexus-jade">
          <Link href="/voice">
            <Mic className="h-5 w-5 me-2" aria-hidden="true" />
            {language === "ar" ? "الوضع الصوتي" : "Voice Mode"}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 px-6 border-nexus-jade/30 hover:bg-nexus-jade/10 hover:border-nexus-jade">
          <Link href="/vault">
            <Upload className="h-5 w-5 me-2" aria-hidden="true" />
            {language === "ar" ? "رفع إلى الخزنة" : "Upload to Vault"}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 px-6 border-nexus-jade/30 hover:bg-nexus-jade/10 hover:border-nexus-jade">
          <Link href="/domains/financial">
            <BarChart3 className="h-5 w-5 me-2" aria-hidden="true" />
            {language === "ar" ? "فحص الأسواق" : "Check Markets"}
          </Link>
        </Button>
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline">
            {language === "ar" ? "المحادثات الأخيرة" : "Recent Conversations"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getRecentConversations(language).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-full bg-muted mb-3">
                <MessageCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-medium text-foreground mb-1">
                {language === "ar" ? "لا توجد محادثات بعد" : "No conversations yet"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {language === "ar"
                  ? "ابدأ محادثة جديدة لتظهر هنا"
                  : "Start a new conversation and it will appear here"}
              </p>
              <Button asChild size="sm" className="bg-nexus-jade hover:bg-nexus-jade-hover text-background">
                <Link href="/chat">
                  <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "ابدأ محادثة" : "Start a Conversation"}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {getRecentConversations(language).map((conv) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary hover:shadow-md hover:shadow-black/10 hover:-translate-y-0.5 transition-all"
                >
                  <span className="flex-1 font-medium truncate">{conv.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {conv.domain}
                  </Badge>
                  <Lock className="h-3 w-3 text-nexus-gold" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">{conv.timestamp}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-headline">
            {language === "ar" ? "نظرة عامة على المجالات" : "Domain Overview"}
          </CardTitle>
          <Link
            href="/domains"
            className="text-sm text-nexus-jade hover:text-nexus-jade-hover flex items-center"
          >
            {language === "ar" ? "عرض الكل" : "View All Domains"}
            <ChevronRight className="h-4 w-4 ms-1" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {topDomains.map((domain) => {
              const Icon = domain.icon
              return (
                <Link
                  key={domain.id}
                  href={`/domains/${domain.id}`}
                  className="flex flex-col items-center p-4 rounded-xl bg-secondary/50 hover:bg-secondary hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all text-center"
                >
                  <Icon className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
                  <span className="font-medium text-sm">
                    {language === "ar" ? domain.nameAr : domain.nameEn}
                  </span>
                  <div className="w-full mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {language === "ar" ? "الإتقان" : "Mastery"}
                      </span>
                      <span className="text-muted-foreground">{domain.mastery}%</span>
                    </div>
                    <Progress value={domain.mastery} className="h-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vault Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-headline flex items-center gap-2">
            <Lock className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
            {language === "ar" ? "ملخص الخزنة" : "Vault Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <p className="text-muted-foreground flex-1">
              <span className="text-foreground font-medium">0</span> {language === "ar" ? "مستند" : "documents"}
              {" · "}
              <span className="text-foreground font-medium">0</span> {language === "ar" ? "جزء" : "shards"}
              {" "}
              <Lock className="inline h-3 w-3 text-nexus-gold" aria-hidden="true" />
              {" · "}
              {language === "ar" ? "ابدأ بالرفع" : "Start uploading"}
            </p>
            <div className="relative w-full md:w-80">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="dashboard-vault-search" className="sr-only">
                {language === "ar" ? "البحث في الخزنة" : "Search Vault"}
              </label>
              <Input
                id="dashboard-vault-search"
                placeholder={language === "ar" ? "البحث في الخزنة..." : "Search Vault..."}
                className="ps-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value) {
                    window.location.href = `/vault?search=${encodeURIComponent(e.currentTarget.value)}`
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Intelligence Footer */}
      <div className="text-center py-4">
        <p className="text-caption text-muted-foreground flex items-center justify-center gap-2">
          <Lock className="h-3 w-3 text-nexus-gold" aria-hidden="true" />
          {language === "ar" 
            ? "مدعوم بـ 28 خدمة ذكاء اصطناعي · جميع البيانات مشفرة"
            : "Powered by 28 AI services · All data encrypted"}
        </p>
      </div>
    </div>
  )
}
