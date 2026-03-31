"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MessageCircle, Lock, Info } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useNexus } from "@/contexts/nexus-context"
import { MessageBubble, TypingIndicator, type Message } from "@/components/message-bubble"
import { ChatInput } from "@/components/chat-input"
import { IntelligencePanel } from "@/components/intelligence-panel"
import { ShardAnimation } from "@/components/shard-animation"
import { ModeSelector, type IntelligenceMode } from "@/components/mode-selector"
import { LanguageSelector } from "@/components/language-selector"
import { OrchestrationPhases, type OrchestrationState, type OrchestrationPhase, type AuditorResult } from "@/components/orchestration-phases"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { EMOTIONS } from "@/lib/constants"
import { streamChat, type IntelligenceMode as APIModeType } from "@/lib/api"
import { usePrivacyMetrics } from "@/contexts/privacy-metrics-context"
import { createConversation, updateConversation, generateTitle } from "@/lib/conversations"

// Valid modes for runtime validation
const VALID_MODES: IntelligenceMode[] = ["standard", "fast", "thinking", "pro", "document"]

function validateMode(mode: string | null): IntelligenceMode {
  if (mode && VALID_MODES.includes(mode as IntelligenceMode)) {
    return mode as IntelligenceMode
  }
  return "standard"
}

// SEC-SM-004: Generate unique message IDs using crypto only — no Math.random fallback.
// Math.random() is NOT cryptographically secure and message IDs could be predicted.
function generateMessageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: use crypto.getRandomValues which IS cryptographically secure
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")
  }
  throw new Error("SEC-SM-004: No cryptographically secure random source available")
}

// Pre-seeded default phases for each orchestration mode.
// These appear immediately in the UI so users see descriptive labels
// instead of empty green spinners while waiting for backend phase events.
function getDefaultPhasesForMode(mode: IntelligenceMode): OrchestrationPhase[] {
  if (mode === "thinking") {
    return [
      { id: "default-1", phase: "analyze", message: "Analyzing your request", status: "active" },
      { id: "default-2", phase: "consult", message: "Consulting AI specialists", status: "pending" },
      { id: "default-3", phase: "cross_examine", message: "Cross-examining responses", status: "pending" },
      { id: "default-4", phase: "synthesize", message: "Synthesizing final answer", status: "pending" },
    ]
  }
  if (mode === "fast") {
    return [
      { id: "default-1", phase: "fast_analyze", message: "Analyzing your request", status: "active" },
      { id: "default-2", phase: "fast_generate", message: "Generating fast response", status: "pending" },
      { id: "default-3", phase: "fast_verify", message: "Verifying answer", status: "pending" },
    ]
  }
  if (mode === "pro" || mode === "document") {
    return [
      { id: "default-1", phase: "init", message: "Initializing sovereign pipeline", status: "active" },
      { id: "default-2", phase: "brainstorm", message: "Analyzing your request", status: "pending" },
      { id: "default-3", phase: "decompose", message: "Breaking down into specialist tasks", status: "pending" },
      { id: "default-4", phase: "shards", message: "Consulting specialists", status: "pending" },
      { id: "default-5", phase: "cross_audit", message: "Reviewing shard consistency", status: "pending" },
      { id: "default-6", phase: "merge", message: "Synthesizing intelligence", status: "pending" },
      { id: "default-7", phase: "audit", message: "Multi-auditor review", status: "pending" },
      { id: "default-8", phase: "ceo_gate", message: "Final CEO gate", status: "pending" },
    ]
  }
  return []
}

// Valid SSE event types for security validation
const VALID_SSE_EVENT_TYPES = [
  "metadata",
  "rag_sources",
  "token",
  "done",
  "sovereignty",
  "phase",
  "audit",
  "orchestration_complete",
  "brainstorm",
  "error",
  "content",
  "ping",
  "verification"
] as const

type ValidSSEEventType = typeof VALID_SSE_EVENT_TYPES[number]

function isValidEventType(type: string): type is ValidSSEEventType {
  return VALID_SSE_EVENT_TYPES.includes(type as ValidSSEEventType)
}

function ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get("prompt")
  const initialMode = validateMode(searchParams.get("mode"))
  const { language, isRTL } = useNexus()
  const { recordPiiScrubbed, recordAnonymousRequest } = usePrivacyMetrics()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [shardText, setShardText] = useState("")
  const [showShard, setShowShard] = useState(false)
  const [mode, setMode] = useState<IntelligenceMode>(initialMode)
  const [orchestrationState, setOrchestrationState] = useState<OrchestrationState>({
    mode: "standard",
    phases: [],
  })
  const [showOrchestration, setShowOrchestration] = useState(false)
  const [intelligence, setIntelligence] = useState<{
    domain?: string
    domainConfidence?: number
    emotion?: keyof typeof EMOTIONS
    emotionConfidence?: number
    specialists?: Array<{ name: string; icon: string; confidence: number; contribution: number }>
    sources?: Array<{ text: string; score: number; metadata: Record<string, unknown> }>
    provider?: string
    model?: string
    tokenCount?: number
    latency?: number
    piiScrubbed?: number
  }>({})
  const [sovereigntyData, setSovereigntyData] = useState<{
    fragments: Array<{ fragment_id: string; node_id: string; size_bytes: number }>
    merkle_root: string
  } | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // SEC-SM-R3-005: Debounce localStorage writes to prevent race conditions.
  // Without debouncing, every streamed token triggers a read-modify-write cycle on localStorage.
  // Multiple rapid writes can corrupt data if two writes overlap, and excessive writes
  // hammer the synchronous localStorage API causing UI jank. 300ms debounce coalesces updates.
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const messagesToSave = messages.filter(m => !m.isStreaming)
      if (messagesToSave.length > 0) {
        const timer = setTimeout(() => {
          updateConversation(conversationId, { messages: messagesToSave })
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [conversationId, messages])

  // FIX 8: Pre-fill input from URL prompt param
  // SEC-SM-R3-004: Sanitize URL-provided prompt — limit length and strip null bytes.
  // An attacker could craft a URL with an extremely long prompt to cause UI jank,
  // or inject null bytes to exploit downstream parsers.
  useEffect(() => {
    if (initialPrompt) {
      const sanitized = initialPrompt
        .replace(/\0/g, "")  // Strip null bytes
        .slice(0, 5000)       // Reasonable max length for URL-prefilled prompt
      setInput(sanitized)
    }
  }, [initialPrompt])

  const handleShardComplete = useCallback(() => {
    setShowShard(false)
  }, [])

  const handleSend = async (content: string, files?: File[]) => {
    if (!content.trim() && !files?.length) return
    // SEC-BL-016: Enforce message length limit matching backend ChatMessageSchema
    if (content.length > 50000) return

    // FIX 24: Abort any existing stream before starting new one
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    // Create conversation on first message
    let currentConversationId = conversationId
    if (!currentConversationId) {
      const newTitle = generateTitle(content)
      const newConversation = createConversation(newTitle)
      currentConversationId = newConversation.id
      setConversationId(currentConversationId)
    }

    // Create user message immediately with unique ID
    const userMessage: Message = {
      id: generateMessageId(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    // Trigger shard animation and add message together
    setShardText(content)
    setShowShard(true)
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Show orchestration panel for thinking/pro/fast modes with pre-seeded phases
    // so users immediately see descriptive labels instead of empty spinners
    if (mode !== "standard") {
      setShowOrchestration(true)
      const defaultPhases = getDefaultPhasesForMode(mode)
      setOrchestrationState({
        mode,
        phases: defaultPhases,
        currentPhase: defaultPhases[0]?.phase,
      })
    }

    // Capture current messages for the API call
    const currentMessages = [...messages, { role: "user" as const, content: content.trim() }]

    try {
      const stream = streamChat({
        messages: currentMessages,
        stream: true,
        use_rag: true,
        mode: mode as APIModeType,
      }, abortControllerRef.current?.signal)

      let aiContent = ""
      const aiMsgId = generateMessageId()
      let phaseCounter = 0
      let streamStarted = false
      let orchestrationDismissed = false

      for await (const event of stream) {
        // On first event, create the assistant message and hide loading indicator
        if (!streamStarted) {
          streamStarted = true
          // Record anonymous request - API call made through privacy proxy
          recordAnonymousRequest({
            url: `chat/${mode}`,
            timestamp: new Date().toISOString(),
            proxyRegion: "UAE",
            status: "streaming",
          })
          setMessages(prev => [...prev, {
            id: aiMsgId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          }])
          setIsLoading(false)
        }
        // Validate SSE event type before processing - silently skip unknown types
        if (!isValidEventType(event.type)) {
          continue
        }

        if (event.type === "metadata") {
          const meta = event.data as {
            domain?: { domain: string; confidence: number }
            emotion?: { dominant_emotion: string; confidence: number }
            specialists?: Array<{ name: string; icon: string; confidence: number; contribution: number }>
            routing?: { pii_scrubbed: number }
          }
          // Record REAL PII scrubbing to privacy metrics
          if (meta.routing?.pii_scrubbed && meta.routing.pii_scrubbed > 0) {
            recordPiiScrubbed(meta.routing.pii_scrubbed)
            // Also record this as an anonymous request with PII scrubbing
            recordAnonymousRequest({
              url: "chat",
              timestamp: new Date().toISOString(),
              proxyRegion: "UAE",
              status: "protected",
              piiScrubbed: meta.routing.pii_scrubbed,
            })
          }
          setIntelligence(prev => ({
            ...prev,
            domain: meta.domain?.domain || prev.domain,
            domainConfidence: meta.domain?.confidence ? meta.domain.confidence / 100 : prev.domainConfidence,
            emotion: (meta.emotion?.dominant_emotion as keyof typeof EMOTIONS) || prev.emotion,
            emotionConfidence: meta.emotion?.confidence || prev.emotionConfidence,
            specialists: meta.specialists || prev.specialists,
            piiScrubbed: meta.routing?.pii_scrubbed || 0,
          }))
        } else if (event.type === "rag_sources") {
          setIntelligence(prev => ({ ...prev, sources: event.data as Array<{ text: string; score: number; metadata: Record<string, unknown> }> }))
        } else if (event.type === "phase") {
          // Orchestration phase update
          const phaseData = event.data as OrchestrationPhase
          phaseCounter++
          setOrchestrationState(prev => {
            // Strategy: If we have pre-seeded default phases, advance them
            // sequentially. Otherwise append as before.
            const hasDefaultPhases = prev.phases.some(p => p.id.startsWith("default-"))

            if (hasDefaultPhases) {
              // Find the first pending default phase and activate it,
              // marking the current active one as complete.
              let activatedOne = false
              const updatedPhases = prev.phases.map(p => {
                if (p.status === "active") {
                  return { ...p, status: "complete" as const }
                }
                if (!activatedOne && p.status === "pending") {
                  activatedOne = true
                  return {
                    ...p,
                    // Overlay backend data if available (phase key, message, providers)
                    phase: phaseData.phase || p.phase,
                    message: phaseData.message || p.message,
                    providers: phaseData.providers || p.providers,
                    status: "active" as const,
                    timestamp: Date.now(),
                  }
                }
                return p
              })
              // If all defaults were already completed, append as new phase
              if (!activatedOne) {
                updatedPhases.push({
                  ...phaseData,
                  id: `phase-${phaseCounter}`,
                  status: "active" as const,
                  timestamp: Date.now(),
                })
              }
              return {
                ...prev,
                phases: updatedPhases,
                currentPhase: phaseData.phase || prev.currentPhase,
                providers: phaseData.providers || prev.providers,
                shardCount: phaseData.providers?.length || prev.shardCount,
              }
            }

            // No default phases — original behavior: mark active as complete, append new
            const updatedPhases = prev.phases.map(p =>
              p.status === "active" ? { ...p, status: "complete" as const } : p
            )
            return {
              ...prev,
              phases: [...updatedPhases, {
                ...phaseData,
                id: `phase-${phaseCounter}`,
                // Ensure phase has a displayable message even if backend sends empty
                message: phaseData.message || phaseData.phase || "Processing",
                status: "active" as const,
                timestamp: Date.now(),
              }],
              currentPhase: phaseData.phase,
              providers: phaseData.providers || prev.providers,
              shardCount: phaseData.providers?.length || prev.shardCount,
            }
          })
        } else if (event.type === "audit") {
          // Multi-auditor results
          const auditData = event.data as {
            auditors: AuditorResult[]
            passed: boolean
            ceoApproved?: boolean
            ceoScore?: number
            ceoFeedback?: string
          }
          setOrchestrationState(prev => ({
            ...prev,
            auditors: auditData.auditors,
            ceoApproved: auditData.ceoApproved,
            ceoScore: auditData.ceoScore,
            ceoFeedback: auditData.ceoFeedback,
          }))
        } else if (event.type === "orchestration_complete") {
          // Final orchestration stats
          const completeData = event.data as {
            orchestration: {
              timing: { total_ms: number }
            }
            total_tokens: number
            pii_scrubbed: number
          }
          // Record REAL PII scrubbing from orchestration completion
          if (completeData.pii_scrubbed && completeData.pii_scrubbed > 0) {
            recordPiiScrubbed(completeData.pii_scrubbed)
            recordAnonymousRequest({
              url: `orchestration/${mode}`,
              timestamp: new Date().toISOString(),
              proxyRegion: "UAE",
              status: "complete",
              piiScrubbed: completeData.pii_scrubbed,
            })
          }
          setOrchestrationState(prev => ({
            ...prev,
            totalTokens: completeData.total_tokens,
            elapsedMs: completeData.orchestration.timing.total_ms,
            phases: prev.phases.map(p => ({ ...p, status: "complete" as const })),
          }))
          setIntelligence(prev => ({
            ...prev,
            piiScrubbed: completeData.pii_scrubbed,
            tokenCount: completeData.total_tokens,
            latency: completeData.orchestration.timing.total_ms,
          }))
          // FIX: Dismiss orchestration immediately when orchestration is complete.
          // The previous 2-second setTimeout was fragile and could leave the modal
          // frozen if the timer never fired or fired on a stale closure.
          setShowOrchestration(false)
        } else if (event.type === "brainstorm") {
          // Pro mode brainstorm questions
          const brainstormData = event.data as { needs_clarification: boolean; content: string }
          if (brainstormData.needs_clarification) {
            aiContent = brainstormData.content
            setMessages(prev => prev.map(msg =>
              msg.id === aiMsgId ? { ...msg, content: aiContent, isStreaming: false } : msg
            ))
            setShowOrchestration(false)
            return
          }
        } else if (event.type === "token") {
          const tokenData = event.data as { content: string; provider?: string; model?: string }
          aiContent += tokenData.content
          setMessages(prev => prev.map(msg =>
            msg.id === aiMsgId ? { ...msg, content: aiContent } : msg
          ))
          // FIX: Hide orchestration overlay as soon as tokens start streaming.
          // The answer is now arriving — the overlay must not block it.
          // Use local flag to avoid calling setShowOrchestration on every token.
          if (!orchestrationDismissed) {
            orchestrationDismissed = true
            setShowOrchestration(false)
          }
          // Capture provider/model from first token
          if (tokenData.provider) {
            setIntelligence(prev => ({
              ...prev,
              provider: tokenData.provider || prev.provider,
              model: tokenData.model || prev.model,
            }))
          }
        } else if (event.type === "content") {
          // Final content from orchestrated modes (thinking/pro/fast)
          const contentData = event.data as { content: string }
          if (contentData.content) {
            aiContent = contentData.content
            setMessages(prev => prev.map(msg =>
              msg.id === aiMsgId ? { ...msg, content: aiContent } : msg
            ))
            // FIX: Hide orchestration overlay when final content arrives
            setShowOrchestration(false)
          }
        } else if (event.type === "ping") {
          // Heartbeat keepalive - no action needed, just prevents timeout
        } else if (event.type === "verification") {
          // Fast mode verification results (optional display)
          const verifyData = event.data as { verified?: boolean; confidence?: number }
          if (verifyData.verified !== undefined) {
            setIntelligence(prev => ({
              ...prev,
              verified: verifyData.verified,
            }))
          }
        } else if (event.type === "sovereignty") {
          const sovereigntyEvent = event.data as {
            fragments: Array<{ fragment_id: string; node_id: string; size_bytes: number }>
            merkle_root: string
          }
          setSovereigntyData(sovereigntyEvent)
        } else if (event.type === "done") {
          setMessages(prev => prev.map(msg =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
          ))
          setShowOrchestration(false)
        } else if (event.type === "error") {
          const errorData = event.data as { message?: string }
          setOrchestrationState(prev => ({
            ...prev,
            phases: [...prev.phases, {
              id: generateMessageId(),
              phase: "error",
              message: errorData.message || "Pipeline error",
              status: "error",
            }],
          }))
          // FIX: Dismiss orchestration overlay on pipeline error so it doesn't
          // stay frozen. The error is still visible in the message stream.
          setShowOrchestration(false)
        }
      }
      // After for-await loop completes, ensure message is marked complete.
      // This handles cases where the "done" event is never sent (network drop,
      // server-side bug, or abnormal stream termination).
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId && m.isStreaming
          ? { ...m, isStreaming: false }
          : m
      ))
      // FIX: Always dismiss orchestration overlay when stream ends, regardless of
      // whether "done" or "orchestration_complete" events were received.
      setShowOrchestration(false)
      // If stream ended without producing any events, clean up loading state
      if (!streamStarted) {
        setIsLoading(false)
      }
    } catch (error) {
      // Log actual error for debugging
      console.error("[NexusAD Chat Error]", error)
      // Show error message to user instead of mock fallback
      const errorMessage = error instanceof Error && error.name === "AbortError"
        ? "Request was cancelled."
        : `Unable to connect to NexusAD. ${error instanceof Error ? error.message : "Please check your connection and try again."}`
      setMessages(prev => {
        // If a streaming assistant message exists, update it with the error
        const hasStreamingMsg = prev.some(msg => msg.isStreaming)
        if (hasStreamingMsg) {
          return prev.map(msg =>
            msg.isStreaming ? { ...msg, isStreaming: false, content: msg.content || errorMessage } : msg
          )
        }
        // Otherwise add a new error message
        return [...prev, {
          id: generateMessageId(),
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        }]
      })
      setShowOrchestration(false)
      setIsLoading(false)
    }
  }

  const handleRegenerate = useCallback(async () => {
    // Find the last user message by scanning in reverse
    const reversedIdx = [...messages].reverse().findIndex(m => m.role === "user")
    if (reversedIdx === -1) return

    const realIndex = messages.length - 1 - reversedIdx
    const lastUserMessage = messages[realIndex]

    // Drop everything after the last user message (removes the last assistant reply)
    const trimmedMessages = messages.slice(0, realIndex + 1)
    setMessages(trimmedMessages)

    // Re-submit the last user message
    await handleSend(lastUserMessage.content)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoiceStart = () => {
    router.push("/voice")
  }

  return (
    <div className={cn("flex h-full relative", isRTL && "flex-row-reverse")}>
      {/* Mode Selector + Language Selector - Top Left */}
      <div className={cn(
        "absolute top-4 z-30 flex items-center gap-2",
        isRTL ? "end-4 flex-row-reverse" : "start-4"
      )}>
        <ModeSelector
          mode={mode}
          onModeChange={setMode}
          disabled={isLoading}
        />
        <LanguageSelector disabled={isLoading} />
      </div>

      {/* Orchestration Phases Overlay - Accessible with keyboard dismiss and focus trap */}
      {showOrchestration && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={language === "ar" ? "مراحل التنسيق" : "Orchestration phases"}
          dir={isRTL ? "rtl" : "ltr"}
          lang={language}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowOrchestration(false)
            }
            // Focus trap - cycle focus within dialog
            if (e.key === "Tab") {
              const dialog = e.currentTarget
              const focusableElements = dialog.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              )
              const firstEl = focusableElements[0]
              const lastEl = focusableElements[focusableElements.length - 1]
              if (e.shiftKey && document.activeElement === firstEl) {
                e.preventDefault()
                lastEl?.focus()
              } else if (!e.shiftKey && document.activeElement === lastEl) {
                e.preventDefault()
                firstEl?.focus()
              }
            }
          }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <OrchestrationPhases
            state={orchestrationState}
            isActive={isLoading || showOrchestration}
            onClose={() => setShowOrchestration(false)}
          />
        </div>
      )}

      {/* Shard Animation */}
      <ShardAnimation
        text={shardText}
        isActive={showShard}
        onComplete={handleShardComplete}
        sovereigntyData={sovereigntyData || undefined}
      />

      {/* Mobile Info Button - Only visible below lg */}
      <Sheet open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-16 end-4 z-40 lg:hidden bg-background/80 backdrop-blur-sm border border-border shadow-lg"
            aria-label="Toggle intelligence panel"
          >
            <Info className="h-5 w-5" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
<SheetHeader className="p-4 border-b">
  <SheetTitle className="flex items-center justify-between">
  {language === "ar" ? "معلومات المحادثة" : "Chat Intelligence"}
  </SheetTitle>
  <SheetDescription className="sr-only">
  {language === "ar" ? "معلومات عن المحادثة الحالية" : "Information about the current conversation"}
  </SheetDescription>
  </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-60px)] h-[calc(100dvh-60px)]">
            <IntelligencePanel
              domain={intelligence.domain}
              domainConfidence={intelligence.domainConfidence}
              emotion={intelligence.emotion}
              emotionConfidence={intelligence.emotionConfidence}
              specialists={intelligence.specialists}
              sources={intelligence.sources}
              provider={intelligence.provider}
              model={intelligence.model}
              tokenCount={intelligence.tokenCount}
              latency={intelligence.latency}
              isProcessing={isLoading}
              isMobile
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 pt-16">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                (mode === "pro" || mode === "document") && "bg-nexus-gold/10",
                mode === "thinking" && "bg-blue-500/10",
                mode === "fast" && "bg-yellow-500/10",
                mode === "standard" && "bg-nexus-jade/10"
              )}>
                <MessageCircle className={cn(
                  "h-8 w-8",
                  (mode === "pro" || mode === "document") && "text-nexus-gold",
                  mode === "thinking" && "text-blue-500",
                  mode === "fast" && "text-yellow-500",
                  mode === "standard" && "text-nexus-jade"
                )} aria-hidden="true" />
              </div>
              <h1 className="text-headline font-semibold mb-2">
                {(mode === "pro" || mode === "document")
                  ? (language === "ar" ? "وضع برو — مستندات بمستوى ماكنزي" : "Pro Mode — McKinsey-Grade Documents")
                  : mode === "thinking"
                    ? (language === "ar" ? "وضع التفكير — نقاش مجلس الإدارة" : "Thinking Mode — Board of Directors Debate")
                    : mode === "fast"
                      ? (language === "ar" ? "وضع سريع — نقاش فائق السرعة" : "Fast Mode — Ultrafast Debate")
                      : (language === "ar" ? "ابدأ محادثتك الأولى" : "Start your first conversation")
                }
              </h1>
              <p className="text-body text-muted-foreground max-w-md mb-6">
                {(mode === "pro" || mode === "document")
                  ? (language === "ar"
                      ? "تقارير 10 صفحات • عقل O3 الاستراتيجي • متخصصون بالأقسام • تصدير PDF/DOCX"
                      : "10-page reports • O3 strategic brain • Section specialists • Export PDF/DOCX")
                  : mode === "thinking"
                    ? (language === "ar"
                        ? "4 متخصصين • فحص متقاطع • سجل التدقيق • بوابة سيادية"
                        : "4 specialists • Cross-examination • Audit trail • Sovereign gate")
                    : mode === "fast"
                      ? (language === "ar"
                          ? "Cerebras Llama-4 • Grok-3 • تجميع سيادي • الخصوصية أولاً"
                          : "Cerebras Llama-4 • Grok-3 • Sovereign synthesis • Privacy-first")
                      : (language === "ar"
                          ? "محادثتك الأولى تبدأ سجلاً سيادياً. كل رسالة مشفرة ومحمية."
                          : "Your first conversation begins a sovereign record. Every message is encrypted and protected.")
                }
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-nexus-gold" aria-hidden="true" />
                  <span>{language === "ar" ? "مشفر من طرف إلى طرف" : "End-to-end encrypted"}</span>
                </div>
                {mode !== "standard" && (
                  <div className={cn(
                    "flex items-center gap-2",
                    (mode === "pro" || mode === "document") ? "text-nexus-gold" : mode === "fast" ? "text-yellow-500" : "text-blue-500"
                  )}>
                    <span className="w-2 h-2 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
                    <span>
                      {(mode === "pro" || mode === "document")
                        ? (language === "ar" ? "O3 + متخصصون جاهزون" : "O3 + specialists ready")
                        : mode === "fast"
                          ? (language === "ar" ? "Cerebras + Grok جاهزون" : "Cerebras + Grok ready")
                          : (language === "ar" ? "4 متخصصين جاهزون" : "4 specialists ready")
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className="space-y-4 pb-4"
              role="log"
              aria-live="polite"
              aria-label={language === "ar" ? "سجل المحادثة" : "Conversation log"}
              aria-relevant="additions"
            >
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onRegenerate={
                    message.role === "assistant" && index === messages.length - 1 && !isLoading
                      ? handleRegenerate
                      : undefined
                  }
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Chat Input */}
        <ChatInput
          onSend={handleSend}
          onVoiceStart={handleVoiceStart}
          onStop={() => {
            abortControllerRef.current?.abort()
            // Immediately mark all streaming messages as complete
            setMessages(prev => prev.map(msg =>
              msg.isStreaming ? { ...msg, isStreaming: false } : msg
            ))
            setIsLoading(false)
            setShowOrchestration(false)
          }}
          disabled={isLoading}
          isStreaming={messages.some(m => m.isStreaming)}
          initialValue={input}
        />
      </div>

      {/* Intelligence Panel - Desktop only */}
      <div className="relative hidden lg:block">
        <IntelligencePanel
          domain={intelligence.domain}
          domainConfidence={intelligence.domainConfidence}
          emotion={intelligence.emotion}
          emotionConfidence={intelligence.emotionConfidence}
          specialists={intelligence.specialists}
          sources={intelligence.sources}
          provider={intelligence.provider}
          model={intelligence.model}
          tokenCount={intelligence.tokenCount}
          latency={intelligence.latency}
          isProcessing={isLoading}
        />
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  )
}
