"use client"

import React, { useState, useEffect } from "react"
import { Lock, Check, X, ChevronDown, ChevronUp, Shield, RefreshCw } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { motion } from "motion/react"
import { cn, sanitizeUrl, sanitizeImageUrl } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Domain translation helper for bilingual support
const getDomainLabelAr = (domain: string): string => {
  const domainMap: Record<string, string> = {
    Financial: "مالي",
    Legal: "قانوني",
    Health: "صحي",
    "Real Estate": "عقارات",
    Personal: "شخصي",
    Technical: "تقني",
    General: "عام",
  }
  return domainMap[domain] || domain
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  domain?: string
  domainIcon?: string
  provider?: string
  model?: string
  sources?: Array<{
    text: string
    score: number
    metadata: Record<string, unknown>
  }>
  factCheck?: {
    verified: boolean
    confidence: number
    sources: string[]
  }
  isStreaming?: boolean
  piiScrubbed?: number // NEW: Number of PII items scrubbed from this message
}

interface MessageBubbleProps {
  message: Message
  onRegenerate?: () => void
}

export const MessageBubble = React.memo(({ message, onRegenerate }: MessageBubbleProps) => {
  const { language, isRTL } = useNexus()
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-4",
        isUser ? (isRTL ? "justify-start" : "justify-end") : (isRTL ? "justify-end" : "justify-start")
      )}
    >
      <div
        className={cn(
          "relative max-w-[80%] p-4",
          isUser
            ? cn(
                "bg-nexus-jade/10 border border-nexus-jade/20",
                isRTL
                  ? "rounded-2xl rounded-bl-sm"
                  : "rounded-2xl rounded-br-sm"
              )
            : cn(
                "bg-card border border-border",
                isRTL
                  ? "rounded-2xl rounded-br-sm"
                  : "rounded-2xl rounded-bl-sm"
              )
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* AI Message Header */}
        {!isUser && (message.domain || message.provider || message.piiScrubbed) && (
          <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              {message.domain && (
                <Badge variant="secondary" className="text-xs">
                  {language === "ar" ? getDomainLabelAr(message.domain) : message.domain}
                </Badge>
              )}
              {message.piiScrubbed && message.piiScrubbed > 0 && (
                <Badge variant="outline" className="text-xs border-nexus-gold/30 text-nexus-gold">
                  <Shield className="h-3 w-3 me-1" aria-hidden="true" />
                  {message.piiScrubbed} {language === "ar" ? "بيانات محمية" : "PII protected"}
                </Badge>
              )}
            </div>
            {message.provider && (
              <span className="text-caption text-nexus-gold font-medium">
                {language === "ar" ? "العقل السيادي" : "Sovereign Brain"}
              </span>
            )}
          </div>
        )}

        {/* Message Content */}
        <div dir="auto" className="text-body leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-secondary prose-pre:p-3 prose-strong:font-bold prose-strong:text-foreground prose-em:italic prose-blockquote:border-s-2 prose-blockquote:border-nexus-jade prose-blockquote:ps-4 prose-blockquote:italic">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc ps-5 my-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal ps-5 my-2">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-s-2 border-nexus-jade ps-4 italic my-2">{children}</blockquote>,
              // SEC-UI-103: Sanitize link hrefs to prevent javascript: XSS from AI-generated markdown
              a: ({ href, children }) => (
                <a
                  href={sanitizeUrl(href)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nexus-jade hover:underline"
                >
                  {children}
                </a>
              ),
              // SEC-UI-104: Sanitize image sources to prevent data exfiltration via markdown images
              img: ({ src, alt }) => (
                <img
                  src={sanitizeImageUrl(typeof src === "string" ? src : undefined)}
                  alt={alt || ""}
                  className="max-w-full rounded"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ),
              code: ({ children, className }) => {
                const isInline = !className
                return isInline
                  ? <code className="bg-secondary px-1 py-0.5 rounded text-sm">{children}</code>
                  : <code className={className}>{children}</code>
              },
            }}
          >{message.content}</ReactMarkdown>
          {message.isStreaming && (
            <span
              className="inline-block w-0.5 h-[1.1em] bg-nexus-jade animate-typing-cursor ms-0.5 align-middle rounded-sm"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Sources Accordion */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen} className="mt-3">
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-nexus-jade hover:text-nexus-jade-hover transition-colors">
              {sourcesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {language === "ar" ? `المصادر (${message.sources.length})` : `Sources (${message.sources.length})`}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {message.sources.map((source, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-secondary/50 text-sm"
                >
                  <p className="text-muted-foreground line-clamp-2">{source.text}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {language === "ar" ? "الصلة:" : "Relevance:"} {Math.round(source.score * 100)}%
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Fact Check Badge */}
        {!isUser && message.factCheck && (
          <div className="mt-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              {message.factCheck.verified ? (
                <>
                  <Check className="h-4 w-4 text-emotion-joyful" />
                  <span className="text-sm text-emotion-joyful">
                    {language === "ar" ? "تم التحقق" : "Verified"}
                  </span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    {language === "ar" ? "لم يتم التحقق" : "Unverified"}
                  </span>
                </>
              )}
              <span className="text-caption text-muted-foreground">
                ({Math.round(message.factCheck.confidence * 100)}%)
              </span>
            </div>
          </div>
        )}

        {/* Regenerate Button - assistant messages only */}
        {!isUser && onRegenerate && !message.isStreaming && (
          <div className={cn(
            "flex mt-2 pt-1 transition-opacity duration-150",
            isRTL ? "justify-start" : "justify-end",
            isHovered ? "opacity-100" : "opacity-0 focus-within:opacity-100"
          )}>
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-nexus-jade transition-colors rounded-md px-2 py-1 hover:bg-secondary/60"
              aria-label={language === "ar" ? "إعادة التوليد" : "Regenerate response"}
              title={language === "ar" ? "إعادة التوليد" : "Regenerate response"}
            >
              <RefreshCw className="h-3 w-3" />
              <span>{language === "ar" ? "إعادة" : "Regenerate"}</span>
            </button>
          </div>
        )}

        {/* Gold Lock Icon */}
        <Lock
          aria-hidden="true"
          className={cn(
            "absolute h-3 w-3 text-nexus-gold",
            isUser
              ? (isRTL ? "bottom-2 start-2" : "bottom-2 end-2")
              : (isRTL ? "bottom-2 start-2" : "bottom-2 end-2")
          )}
        />
      </div>
    </motion.div>
  )
})

MessageBubble.displayName = "MessageBubble";

// Typing Indicator Component - Sequential phases, not looping
export const TypingIndicator = React.memo(() => {
  const { language } = useNexus()
  const [phase, setPhase] = useState(0)

  const phases = [
    { text: language === "ar" ? "تشفير استفسارك..." : "Encrypting your query...", duration: 1200 },
    { text: language === "ar" ? "التوزيع عبر الأجزاء..." : "Distributing across shards...", duration: 2500 },
    { text: language === "ar" ? "استشارة المختصين..." : "Consulting specialists...", duration: null }, // hold forever
  ]

  useEffect(() => {
    const currentPhase = phases[phase]
    if (currentPhase?.duration) {
      const timer = setTimeout(() => {
        if (phase < phases.length - 1) {
          setPhase(prev => prev + 1)
        }
      }, currentPhase.duration)
      return () => clearTimeout(timer)
    }
  }, [phase, phases])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 text-callout text-muted-foreground p-3 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm"
    >
      {/* Sovereignty-themed loading dots */}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-nexus-gold"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <motion.span
        key={phase}
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 5 }}
        transition={{ duration: 0.3 }}
        className="italic"
      >
        {phases[phase]?.text}
      </motion.span>
    </motion.div>
  )
})

TypingIndicator.displayName = "TypingIndicator"
