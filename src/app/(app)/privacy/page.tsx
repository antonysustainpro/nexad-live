"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import {
  Shield,
  Lock,
  Globe,
  Info,
  Settings,
  ChevronRight,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { getPrivacyComparison } from "@/lib/api"
import type { PrivacyComparisonResponse } from "@/lib/types"

// Animated counter component
function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [target, duration])

  return <span>{count}</span>
}

export default function PrivacyPage() {
  const { language } = useNexus()
  const [comparisonData, setComparisonData] = useState<PrivacyComparisonResponse | null>(null)

  useEffect(() => {
    getPrivacyComparison().then(data => { if (data) setComparisonData(data) })
  }, [])

  // Use real data with fallback
  const totalQueries = comparisonData?.user_stats.total_queries || 1247
  const piiScrubbed = comparisonData?.user_stats.pii_items_scrubbed || 0

  const comparisonRows = [
    { them: "Your name", themAr: "اسمك", us: "Nothing", usAr: "لا شيء" },
    { them: "Your conversations (100%)", themAr: "محادثاتك (100%)", us: "Nothing (encrypted, sharded, your key)", usAr: "لا شيء (مشفر، مجزأ، مفتاحك)" },
    { them: "Your location", themAr: "موقعك", us: "Nothing", usAr: "لا شيء" },
    { them: "Your search history", themAr: "سجل بحثك", us: "Nothing", usAr: "لا شيء" },
    { them: "Data trains their AI", themAr: "البيانات تدرب ذكاءهم", us: "Never", usAr: "أبداً" },
  ]

  return (
    <div className="space-y-0">
      {/* DRAMATIC HERO SECTION - Always dark */}
      <div className="bg-black py-16 px-6 -mx-6 -mt-6 mb-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-light text-white mb-6"
          >
            {language === "ar" ? "ماذا يعرفون. ماذا نعرف." : "What they know. What we know."}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/70 text-lg mb-8"
          >
            {language === "ar" ? "لقد أجريت" : "You've made"}{" "}
            <span className="text-nexus-gold font-bold">
              <AnimatedCounter target={totalQueries} duration={2000} />
            </span>{" "}
            {language === "ar" ? "استفسار مع NexusAD Ai." : "queries with NexusAD Ai."}
          </motion.p>

          {/* Comparison Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/[0.03] rounded-2xl border border-white/10 overflow-hidden mb-8"
          >
            {/* Header */}
            <div className="grid grid-cols-2 border-b border-white/10">
              <div className="p-4 text-white/60 text-sm font-medium">
                {language === "ar" ? "ما تعرفه Google/OpenAI" : "What Google/OpenAI Knows"}
              </div>
              <div className="p-4 text-nexus-gold/60 text-sm font-medium border-s border-white/10">
                {language === "ar" ? "ما يعرفه NexusAD Ai" : "What NexusAD Ai Knows"}
              </div>
            </div>
            {/* Rows */}
            {comparisonRows.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="grid grid-cols-2 border-b border-white/10 last:border-b-0"
              >
                <div className="p-4 text-white text-sm">
                  {language === "ar" ? row.themAr : row.them}
                </div>
                <div className="p-4 text-nexus-gold font-semibold text-sm border-s border-white/10">
                  {language === "ar" ? row.usAr : row.us}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Quote */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-white/70 text-sm italic max-w-xl mx-auto mb-10"
          >
            {language === "ar" 
              ? "لو استخدمت ChatGPT لـ 1,247 استفسار، لكانت OpenAI قد تلقت 100% من بياناتك. مع NexusAD Ai، لم يتلقَ أي مزود أكثر من 24% من أي استفسار."
              : "If you had used ChatGPT for 1,247 queries, OpenAI would have received 100% of your data. With NexusAD Ai, no provider received more than 24% of any single query."}
          </motion.p>

          {/* Donut Charts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="flex justify-center gap-12"
          >
            {/* ChatGPT - Solid Red */}
            <div className="text-center">
              <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto mb-2" role="img" aria-label={language === "ar" ? "رسم بياني: 100% من البيانات إلى خادم واحد" : "Chart: 100% of data to 1 server"}>
                <circle
                  cx="40"
                  cy="40"
                  r="30"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="8"
                />
              </svg>
              <p className="text-white/60 text-sm">ChatGPT</p>
              <p className="text-white/40 text-xs">{language === "ar" ? "100% إلى خادم واحد" : "100% to 1 server"}</p>
            </div>
            {/* NexusAD Ai - 3 Gold Segments */}
            <div className="text-center">
              <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto mb-2" role="img" aria-label={language === "ar" ? "رسم بياني: البيانات موزعة عبر 3 عقد" : "Chart: Data split across 3 nodes"}>
                <circle
                  cx="40"
                  cy="40"
                  r="30"
                  fill="none"
                  stroke="var(--nexus-gold)"
                  strokeWidth="8"
                  strokeDasharray="50 13"
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <p className="text-nexus-gold text-sm">NexusAD Ai</p>
              <p className="text-white/40 text-xs">{language === "ar" ? "موزع عبر 3 عقد آمنة" : "Split across 3 secure nodes"}</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Minimal Content Below Hero */}
      <div className="p-6 space-y-6 max-w-4xl mx-auto pb-24">
        {/* Data Protection Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-nexus-gold/5 border border-nexus-gold/20">
                <div className="p-3 rounded-full bg-nexus-gold/10">
                  <Lock className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">
                    {language === "ar" ? "البيانات المشفرة" : "Data Encrypted"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    AES-256-GCM {language === "ar" ? "تشفير عسكري" : "Military-grade"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-nexus-gold/5 border border-nexus-gold/20">
                <div className="p-3 rounded-full bg-nexus-gold/10">
                  <Globe className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">
                    {language === "ar" ? "موقع البيانات" : "Data Location"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "بنية تحتية مشفرة" : "Encrypted Infrastructure"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Link to Settings for Privacy Controls */}
        <Card className="transition-shadow duration-200 hover:shadow-lg hover:shadow-black/20">
          <CardContent className="p-0">
            <Link href="/settings" className="flex items-center justify-between w-full p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-secondary">
                  <Settings className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold">
                    {language === "ar" ? "إدارة إعدادات الخصوصية" : "Manage Privacy Settings"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" 
                      ? "التشفير، المعالجة المحلية، التحكم في البيانات"
                      : "Encryption, local processing, data controls"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        {/* Info Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-secondary/30 border border-border"
        >
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "NexusAD Ai لا يبيع أو يشارك بياناتك مع أطراف ثالثة. جميع البيانات مشفرة بمعيار AES-256-GCM ومحمية بموجب لوائح حماية البيانات المعمول بها."
              : "NexusAD Ai does not sell or share your data with third parties. All data is encrypted with AES-256-GCM and protected under applicable data protection regulations."}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
