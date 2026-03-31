"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Compass,
  SmilePlus,
  Users,
  FileText,
  CheckCircle,
  Cpu,
  Activity,
  ChevronLeft,
  ChevronRight,
  Scale,
  DollarSign,
  Heart,
  Landmark,
  Code,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { EMOTIONS } from "@/lib/constants"
import type { MemoryLayerStatus } from "@/lib/api"
import { MemoryIndicator } from "@/components/memory-indicator"

interface Specialist {
  name: string
  icon: string
  confidence: number
  contribution: number
}

interface Source {
  text: string
  score: number
  metadata: Record<string, unknown>
}

interface IntelligencePanelProps {
  domain?: string
  domainConfidence?: number
  emotion?: keyof typeof EMOTIONS
  emotionConfidence?: number
  specialists?: Specialist[]
  sources?: Source[]
  factCheck?: {
    verified: boolean
    confidence: number
    sources: string[]
  }
  provider?: string
  model?: string
  routingReason?: string
  tokenCount?: number
  // cost prop removed - FIX 23: don't show cost to investors
  latency?: number
  isProcessing?: boolean
  isMobile?: boolean
  memoryLayers?: MemoryLayerStatus[]
}

const domainIcons: Record<string, React.ElementType> = {
  Legal: Scale,
  Financial: DollarSign,
  Health: Heart,
  "UAE Government": Landmark,
  Technical: Code,
}

// FIX 2: Domain translation map
const getDomainLabel = (domain: string, lang: "en" | "ar" | "bilingual") => {
  const domainLabels: Record<string, string> = {
    Legal: lang === "ar" ? "قانوني" : "Legal",
    Financial: lang === "ar" ? "مالي" : "Financial",
    "Real Estate": lang === "ar" ? "عقارات" : "Real Estate",
    Health: lang === "ar" ? "صحي" : "Health",
    Technical: lang === "ar" ? "تقني" : "Technical",
    "UAE Government": lang === "ar" ? "الحكومة الإماراتية" : "UAE Government",
  }
  return domainLabels[domain] || domain
}

export function IntelligencePanel({
  domain,
  domainConfidence,
  emotion,
  emotionConfidence,
  specialists = [],
  sources = [],
  factCheck,
  provider,
  model,
  routingReason,
  tokenCount,
  latency,
  isProcessing,
  isMobile = false,
  memoryLayers,
}: IntelligencePanelProps) {
  const { language, isRTL } = useNexus()
  const [collapsed, setCollapsed] = useState(false)

  const DomainIcon = domain ? domainIcons[domain] || Compass : Compass
  const emotionData = emotion ? EMOTIONS[emotion] : null

  // Mobile version renders content directly without toggle/aside wrapper
  if (isMobile) {
    return (
      <div className="p-4 space-y-6 bg-card/80 backdrop-blur-sm">
        {renderPanelContent()}
      </div>
    )
  }

  function renderPanelContent() {
    return (
      <>
        {/* CONTEXT Section */}
        <div className="mb-4">
          <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {language === "ar" ? "السياق" : "CONTEXT"}
          </p>
        </div>

        {/* Memory Layers */}
        {memoryLayers && memoryLayers.length > 0 && (
          <section className="pb-4 border-b border-border">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{language === "ar" ? "طبقات الذاكرة النشطة" : "Active Memory Layers"}</p>
              <MemoryIndicator layers={memoryLayers} showLabels />
            </div>
          </section>
        )}

        {/* Domain */}
        <section className="pb-4 border-b border-border">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Compass className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "المجال" : "Domain"}
          </h3>
          {domain ? (
            <div className="flex items-center gap-3">
              <DomainIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">{getDomainLabel(domain, language)}</p>
                {domainConfidence !== undefined && (
                  <Progress value={domainConfidence * 100} variant="jade" className="h-1 mt-1" />
                )}
              </div>
              {domainConfidence !== undefined && (
                <span className="text-sm text-muted-foreground">
                  {Math.round(domainConfidence * 100)}%
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {language === "ar" ? "في انتظار سؤالك..." : "Awaiting query..."}
            </p>
          )}
        </section>

        {/* Emotion */}
        <section className="pb-4 border-b border-border">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <SmilePlus className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "العاطفة" : "Emotion"}
          </h3>
          {emotionData ? (
            <div className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: emotionData.color }}
              />
              <span className="font-medium">
                {language === "ar" ? emotionData.labelAr : emotionData.label}
              </span>
              {emotionConfidence !== undefined && (
                <span className="text-sm text-muted-foreground ms-auto">
                  {Math.round(emotionConfidence * 100)}%
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {language === "ar" ? "لم يتم الكشف" : "Not detected"}
            </p>
          )}
        </section>

        <Separator className="my-5" />

        {/* SPECIALISTS Section */}
        <div className="mb-4">
          <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {language === "ar" ? "المختصون" : "SPECIALISTS"}
          </p>
        </div>

        {/* Specialists */}
        <section>
          {specialists.length > 0 ? (
            <div className="space-y-2">
              {specialists.map((specialist, i) => (
                <motion.div
                  key={specialist.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-2 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{specialist.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {Math.round(specialist.contribution * 100)}%
                    </span>
                  </div>
                  <Progress value={specialist.confidence * 100} variant="jade" className="h-1" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isProcessing && (
                <span className="w-2 h-2 rounded-full bg-nexus-gold motion-safe:animate-pulse-sovereignty" />
              )}
              <p className="text-sm text-muted-foreground italic">
                {isProcessing 
                  ? (language === "ar" ? "ننسق مع المختصين..." : "Consulting...")
                  : (language === "ar" ? "يتم تفعيل المختصين عند التحدث عن مجالات محددة" : "Specialists activate as you chat about specific domains")}
              </p>
            </div>
          )}
        </section>

        {/* Sources */}
        <section className="mt-4 pb-4 border-b border-border">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "المصادر" : "Sources"}
          </h3>
          {sources.length > 0 ? (
            <div className="space-y-2">
              {sources.slice(0, 3).map((source, i) => (
                <div key={i} className="p-2 rounded-lg bg-secondary/50">
                  <p className="text-sm line-clamp-2 text-muted-foreground">{source.text}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {language === "ar" ? "الصلة:" : "Relevance:"} {Math.round(source.score * 100)}%
                  </p>
                </div>
              ))}
              {sources.length > 3 && (
                <p className="text-sm text-nexus-jade">
                  +{sources.length - 3} {language === "ar" ? "مصادر أخرى" : "more sources"}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {language === "ar" ? "قم بتحميل المستندات إلى الخزنة للحصول على إجابات مدعومة بالمصادر" : "Upload documents to Vault for AI-sourced answers"}
            </p>
          )}
        </section>

        <Separator className="my-5" />

        {/* INFRASTRUCTURE Section */}
        <div className="mb-4">
          <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {language === "ar" ? "البنية التحتية" : "INFRASTRUCTURE"}
          </p>
        </div>

        {/* Active Nodes */}
        <section className="pb-4 border-b border-border">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "العقد النشطة" : "Active Nodes"}
          </h3>
          <div className="space-y-2">
            {[
              { name: "Secure Node 1", nameAr: "عقدة آمنة ١", status: "active" },
              { name: "Secure Node 2", nameAr: "عقدة آمنة ٢", status: "active" },
              { name: "Secure Node 3", nameAr: "عقدة آمنة ٣", status: isProcessing ? "processing" : "active" },
            ].map((node) => (
              <div key={node.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                <span className="text-sm flex items-center gap-2">
                  <span>🔒</span>
                  {language === "ar" ? node.nameAr : node.name}
                </span>
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  node.status === "processing" 
                    ? "bg-nexus-gold motion-safe:animate-pulse-sovereignty" 
                    : "bg-nexus-gold/60"
                )} />
              </div>
            ))}
          </div>
        </section>

        {/* Sovereign Brain */}
        <section className="mt-4 pb-4 border-b border-border">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "العقل السيادي" : "Sovereign Brain"}
          </h3>
          {provider ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-nexus-gold">
                {language === "ar" ? "العقل السيادي" : "Sovereign Brain"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {language === "ar" ? "بانتظار استفسارك..." : "Awaiting..."}
            </p>
          )}
        </section>

        {/* Usage */}
        <section className="mt-4">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "الاستخدام" : "Usage"}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg bg-secondary/50">
              <p className="text-sm font-medium">{tokenCount ?? "-"}</p>
              <p className="text-caption text-muted-foreground">
                {language === "ar" ? "الكلمات المعالجة" : "Tokens"}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/50">
              <p className="text-sm font-medium">
                {latency !== undefined ? `${latency}ms` : "-"}
              </p>
              <p className="text-caption text-muted-foreground">
                {language === "ar" ? "التأخير" : "Latency"}
              </p>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-8 w-8 bg-card border border-border rounded-full z-10",
          isRTL ? "end-0 translate-x-1/2" : "start-0 -translate-x-1/2"
        )}
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
      >
        {collapsed ? (
          isRTL ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        ) : (
          isRTL ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>

      <AnimatePresence>
        {!collapsed && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden lg:block h-[calc(100vh-32px)] h-[calc(100dvh-32px)] border-s border-border bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {renderPanelContent()}
              </div>
            </ScrollArea>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
