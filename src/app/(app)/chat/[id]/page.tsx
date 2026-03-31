"use client"

import { useState, useRef, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check, X, Info, Loader2 } from "lucide-react"
import { ExportDropdown } from "@/components/export-dropdown"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { EMOTIONS } from "@/lib/constants"
import { streamChat } from "@/lib/api"
import {
  getConversation,
  updateConversation,
  generateTitle,
  type Conversation,
} from "@/lib/conversations"

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

export default function ChatConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { language, isRTL } = useNexus()

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isLoadingConversation, setIsLoadingConversation] = useState(true)
  const [title, setTitle] = useState("New Conversation")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load conversation from localStorage
  useEffect(() => {
    const loadedConversation = getConversation(resolvedParams.id)
    if (loadedConversation) {
      setConversation(loadedConversation)
      setTitle(loadedConversation.title)
      setEditTitle(loadedConversation.title)
      setMessages(loadedConversation.messages)
    }
    setIsLoadingConversation(false)
  }, [resolvedParams.id])

  // SEC-SM-R3-005: Debounce localStorage writes to prevent race conditions.
  // Without debouncing, every streamed token triggers a read-modify-write cycle on localStorage.
  // Multiple rapid writes can corrupt data if two writes overlap, and excessive writes
  // hammer the synchronous localStorage API causing UI jank. 300ms debounce coalesces updates.
  useEffect(() => {
    if (conversation && messages.length > 0) {
      const messagesToSave = messages.filter(m => !m.isStreaming)
      if (messagesToSave.length > 0) {
        const timer = setTimeout(() => {
          updateConversation(conversation.id, { messages: messagesToSave })
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [conversation, messages])
  const [shardText, setShardText] = useState("")
  const [showShard, setShowShard] = useState(false)
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
  }>({})

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

  const handleShardComplete = useCallback(() => {
    setShowShard(false)
  }, [])

  const handleSaveTitle = () => {
    setTitle(editTitle)
    setIsEditingTitle(false)
    // Save to localStorage
    if (conversation) {
      updateConversation(conversation.id, { title: editTitle })
    }
  }

  const handleCancelEdit = () => {
    setEditTitle(title)
    setIsEditingTitle(false)
  }

  const handleSend = async (content: string, files?: File[]) => {
    if (!content.trim() && !files?.length) return

    // FIX 26: Abort any existing stream before starting new one
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setShardText(content)
    setShowShard(true)

    // SEC-SM-004: Use cryptographic IDs, not predictable Date.now()
    const userMessage: Message = {
      id: generateMessageId(),
      role: "user",
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Auto-generate title from first message
    if (messages.length === 0 && title === "New Conversation") {
      const newTitle = generateTitle(content)
      setTitle(newTitle)
      setEditTitle(newTitle)
      if (conversation) {
        updateConversation(conversation.id, { title: newTitle })
      }
    }

    try {
      const stream = streamChat({
        messages: [...messages, { role: "user", content }],
        stream: true,
        use_rag: true,
      }, abortControllerRef.current?.signal)

      let aiContent = ""
      // SEC-SM-004: Use cryptographic IDs, not predictable Date.now()+1
      const aiMessageId = generateMessageId()
      let streamStarted = false

      for await (const event of stream) {
        // On first event, create the assistant message and hide loading indicator
        if (!streamStarted) {
          streamStarted = true
          setMessages(prev => [...prev, {
            id: aiMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          }])
          setIsLoading(false)
        }
        if (event.type === "metadata") {
          const metadata = event.data as { domain?: string; confidence?: number; emotion?: string; specialists?: Array<{ name: string; icon: string; confidence: number; contribution: number }> }
          setIntelligence(prev => ({
            ...prev,
            domain: metadata.domain,
            domainConfidence: metadata.confidence,
            emotion: metadata.emotion as keyof typeof EMOTIONS,
            specialists: metadata.specialists,
          }))
        } else if (event.type === "rag_sources") {
          const sources = event.data as Array<{ text: string; score: number; metadata: Record<string, unknown> }>
          setIntelligence(prev => ({ ...prev, sources }))
        } else if (event.type === "token") {
          aiContent += (event.data as { content: string }).content
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, content: aiContent } : m
          ))
        } else if (event.type === "done") {
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, isStreaming: false } : m
          ))
        }
      }
      // After for-await loop completes, ensure message is marked complete.
      // This handles cases where the "done" event is never sent (network drop,
      // server-side bug, or abnormal stream termination).
      setMessages(prev => prev.map(m =>
        m.id === aiMessageId && m.isStreaming
          ? { ...m, isStreaming: false }
          : m
      ))
      // If stream ended without producing any events, clean up loading state
      if (!streamStarted) {
        setIsLoading(false)
      }
    } catch (error) {
      // Show error message to user instead of mock fallback
      const errorMessage = error instanceof Error && error.name === "AbortError"
        ? "Request was cancelled."
        : "Unable to connect to NexusAD. Please check your connection and try again."
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

  // Convert messages to markdown for export
  const getExportContent = useCallback(() => {
    if (messages.length === 0) return ""

    const lines: string[] = []

    // Add conversation header
    lines.push(`# ${title}`)
    lines.push("")
    lines.push(`**Date:** ${new Date().toLocaleDateString()}`)
    lines.push("")
    lines.push("---")
    lines.push("")

    // Add executive summary from last assistant message
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant")
    if (lastAssistantMsg) {
      lines.push("## Summary")
      lines.push("")
      // Take first paragraph or first 500 chars
      const summary = lastAssistantMsg.content.split("\n\n")[0].slice(0, 500)
      lines.push(summary)
      lines.push("")
      lines.push("---")
      lines.push("")
    }

    // Add conversation
    lines.push("## Conversation")
    lines.push("")

    for (const msg of messages) {
      if (msg.role === "user") {
        lines.push("### User")
        lines.push("")
        lines.push(msg.content)
        lines.push("")
      } else if (msg.role === "assistant") {
        lines.push("### Assistant")
        lines.push("")
        lines.push(msg.content)
        lines.push("")
      }
    }

    return lines.join("\n")
  }, [messages, title])

  // Loading state
  if (isLoadingConversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-nexus-jade" aria-hidden="true" />
      </div>
    )
  }

  // Not found state
  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">
          {language === "ar" ? "المحادثة غير موجودة" : "Conversation not found"}
        </p>
        <Button onClick={() => router.push("/chat")} variant="outline">
          {language === "ar" ? "ابدأ محادثة جديدة" : "Start a new chat"}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full relative", isRTL && "flex-row-reverse")}>
      <ShardAnimation
        text={shardText}
        isActive={showShard}
        onComplete={handleShardComplete}
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
            <SheetTitle>{language === "ar" ? "معلومات المحادثة" : "Chat Intelligence"}</SheetTitle>
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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Editable Title + Export */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-8 text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle()
                    if (e.key === "Escape") handleCancelEdit()
                  }}
                />
                <Button size="icon" variant="ghost" onClick={handleSaveTitle} className="h-8 w-8" aria-label="Save title">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8" aria-label="Cancel edit">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-2 hover:text-nexus-jade transition-colors group"
              >
                <h1 className="text-lg font-semibold truncate">{title}</h1>
                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Export Button */}
          {messages.length > 0 && !isEditingTitle && (
            <ExportDropdown
              getContent={getExportContent}
              title={title}
              language={language}
              disabled={isLoading}
              className="ms-4 flex-shrink-0"
            />
          )}
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4 pb-4">
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
        </ScrollArea>

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
          }}
          disabled={isLoading}
          isStreaming={messages.some(m => m.isStreaming)}
        />
      </div>

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
