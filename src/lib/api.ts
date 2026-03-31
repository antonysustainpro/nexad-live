import type {
  SovereigntyStatusResponse,
  SovereigntyScoreResponse,
  ShardDistributionResponse,
  KeyStatusResponse,
  GenerateKeypairResponse,
  BackupKeyResponse,
  DeletionCertificate,
  AccessLogResponse,
  VaultInfoResponse as VaultInfoType,
  UserProfile,
  PrivacyComparisonResponse,
  BriefingResponse,
  SovereigntyReportResponse,
  ButlerFeedResponse,
  PrivacyGlassStats,
  ButlerOnboardingData,
  TeamMember,
  TeamInvitation,
  TeamMemberRole,
  Notification,
  Referral,
  ReferralStats,
} from "@/lib/types"

import { getCsrfToken } from "./csrf"
import { withRetry, withCircuitBreaker, type RetryOptions } from "./resilience"

// Use server-side proxy to hide API keys from client
const API_BASE = "/api/proxy"

// REL-004: Default retry config for read-only (GET) API calls
const READ_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 800,
  maxDelayMs: 5000,
  jitterFactor: 0.3,
}

// REL-004: Default retry config for mutating (POST/PUT/DELETE) API calls
// Fewer retries and longer backoff to avoid duplicate side-effects
const MUTATION_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 1,
  baseDelayMs: 1500,
  maxDelayMs: 5000,
  jitterFactor: 0.2,
}

/**
 * REL-004: Fetch with retry and circuit breaker for GET requests.
 * Wraps a fetch call with automatic retry (exponential backoff)
 * and circuit breaker protection.
 */
async function resilientFetch(
  url: string,
  init: RequestInit,
  circuitName: string,
  retryOpts: RetryOptions = READ_RETRY_OPTIONS
): Promise<Response> {
  return withCircuitBreaker(circuitName, () =>
    withRetry(
      async () => {
        // Always include credentials to send session cookies
        const response = await fetch(url, { ...init, credentials: "include" })
        if (!response.ok && [500, 502, 503, 504].includes(response.status)) {
          throw new Error(`API error: ${response.status}`)
        }
        return response
      },
      { ...retryOpts, signal: init.signal as AbortSignal | undefined }
    )
  )
}

// Helper to check if error is AbortError
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

// Helper to get auth headers with CSRF protection
function getAuthHeaders(userId = ""): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  headers["X-User-ID"] = userId

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
  }

  return headers
}

// Helper for form data uploads (no Content-Type header)
function getAuthHeadersForUpload(userId = ""): HeadersInit {
  const headers: HeadersInit = {}
  headers["X-User-ID"] = userId

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
  }

  return headers
}

// Types
export interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

export interface Session {
  user: {
    id: string
    email?: string
    name?: string
  }
  expiresAt?: string
}

export interface VaultProfile {
  user_id: string
  entity_name: string
  entity_type?: string
  jurisdictions?: string[]
  team_size?: number
  risk_appetite?: number
  asset_focus?: string[]
  investment_budget_range?: string
  time_horizon?: string
  current_goals?: string
  key_competitors?: string
  open_matters?: string
  report_style?: string
  favorite_sections?: string[]
  auto_include?: Record<string, boolean>
  language_preference?: string
  created_at?: string
  updated_at?: string
}

export type IntelligenceMode = "standard" | "fast" | "thinking" | "pro" | "document"

export interface ChatRequest {
  messages: Message[]
  stream?: boolean
  use_rag?: boolean
  fact_check?: boolean
  emotion_state?: string | null
  provider?: string | null
  model?: string | null
  temperature?: number
  max_tokens?: number
  mode?: IntelligenceMode
  language?: "en" | "ar" | "bilingual" | "mixed"
  client_profile?: Record<string, unknown>
}

export interface ChatMetadata {
  domain: string
  confidence: number
  emotion?: string
  specialists?: Array<{
    name: string
    icon: string
    confidence: number
    contribution: number
  }>
}

export interface RAGSource {
  text: string
  score: number
  metadata: Record<string, unknown>
}

export interface VoiceInfo {
  voice_id: string
  name: string
  category: string
}

export interface VaultDocument {
  id: string
  title: string
  doc_type: string
  language: string
  tags: string[]
  chunks_stored: number
  created_at: string
}

export interface VaultSearchResult {
  text: string
  score: number
  metadata: Record<string, unknown>
}

export interface StockData {
  symbol: string
  price: number
  change: number
  change_percent: number
  volume: number
}

export interface ForexData {
  from: string
  to: string
  rate: number
  bid: number
  ask: number
}

export interface OrchestrationPhaseEvent {
  type: "phase"
  phase: string
  message: string
  icon?: string
  providers?: string[]
}

export interface OrchestrationAuditEvent {
  type: "audit"
  auditors: Array<{
    name: string
    provider: string
    model?: string
    score: number
    feedback?: string
    error?: boolean
  }>
  passed: boolean
  ceoApproved?: boolean
  ceoScore?: number
  ceoFeedback?: string
}

export interface OrchestrationCompleteEvent {
  type: "orchestration_complete"
  orchestration: {
    mode: string
    shards: Array<{
      provider: string
      model: string
      task: string
      tokens: number
    }>
    timing: {
      decompose_ms: number
      shards_ms: number
      merge_ms: number
      total_ms: number
    }
    audit_history?: Array<{
      iteration: number
      scores: Record<string, number>
      passed: boolean
    }>
  }
  pii_scrubbed: number
  total_tokens: number
}

export interface BrainstormEvent {
  type: "brainstorm"
  needs_clarification: boolean
  content: string
}

// Chat API
export async function* streamChat(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<{
  type: "metadata" | "rag_sources" | "token" | "done" | "sovereignty" | "phase" | "audit" | "orchestration_complete" | "brainstorm" | "error" | "content" | "ping" | "verification"
  data: unknown
}> {
  // REL-004: Retry the initial connection (not the streaming body) via resilientFetch.
  // This handles transient 502/503/504 on the initial POST to /chat.
  const payload = { ...request, stream: true, max_tokens: request.max_tokens || 4096 }
  console.log("[streamChat] Sending request with mode:", payload.mode, "messages:", payload.messages.length)

  const response = await resilientFetch(
    `${API_BASE}/chat`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
      credentials: "include", // Send session cookie
      signal,
    },
    "chat-api",
    MUTATION_RETRY_OPTIONS
  )

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    console.error("[Chat API] Error response:", response.status, errorBody)
    throw new Error(`Chat API error: ${response.status} - ${errorBody}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        if (data === "[DONE]") {
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.type) {
            if (parsed.type === "phase") {
              yield { type: "phase", data: parsed }
            } else if (parsed.type === "audit") {
              yield { type: "audit", data: parsed }
            } else if (parsed.type === "orchestration_complete") {
              yield { type: "orchestration_complete", data: parsed }
            } else if (parsed.type === "brainstorm") {
              yield { type: "brainstorm", data: parsed }
            } else if (parsed.type === "error") {
              yield { type: "error", data: parsed }
            } else if (parsed.type === "content") {
              yield { type: "content", data: parsed }
            } else if (parsed.type === "ping") {
              yield { type: "ping", data: parsed }
            } else if (parsed.type === "verification") {
              yield { type: "verification", data: parsed }
            } else {
              yield { type: parsed.type, data: parsed.data ?? parsed }
            }
          } else if (parsed.domain) {
            yield { type: "metadata", data: parsed }
          } else if (parsed.results) {
            yield { type: "rag_sources", data: parsed.results }
          } else if (parsed.content) {
            yield { type: "token", data: parsed }
          } else if (parsed.done) {
            yield { type: "done", data: parsed }
          } else if (parsed.needs_clarification) {
            yield { type: "brainstorm", data: parsed }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  // Flush remaining buffer after stream ends
  if (buffer.trim()) {
    const lines = buffer.split("\n")
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        if (data === "[DONE]") continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.type) {
            if (parsed.type === "phase") {
              yield { type: "phase", data: parsed }
            } else if (parsed.type === "audit") {
              yield { type: "audit", data: parsed }
            } else if (parsed.type === "orchestration_complete") {
              yield { type: "orchestration_complete", data: parsed }
            } else if (parsed.type === "brainstorm") {
              yield { type: "brainstorm", data: parsed }
            } else if (parsed.type === "error") {
              yield { type: "error", data: parsed }
            } else if (parsed.type === "content") {
              yield { type: "content", data: parsed }
            } else if (parsed.type === "ping") {
              yield { type: "ping", data: parsed }
            } else if (parsed.type === "verification") {
              yield { type: "verification", data: parsed }
            } else {
              yield { type: parsed.type, data: parsed.data ?? parsed }
            }
          } else if (parsed.domain) {
            yield { type: "metadata", data: parsed }
          } else if (parsed.results) {
            yield { type: "rag_sources", data: parsed.results }
          } else if (parsed.content) {
            yield { type: "token", data: parsed }
          } else if (parsed.done) {
            yield { type: "done", data: parsed }
          } else if (parsed.needs_clarification) {
            yield { type: "brainstorm", data: parsed }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

// Non-streaming chat
export async function sendChatMessage(
  messages: Message[],
  options: Partial<ChatRequest> = {},
  signal?: AbortSignal
): Promise<{
  content: string
  emotion?: { dominant: string; confidence: number }
  domain?: { domain: string; confidence: number }
}> {
  const response = await resilientFetch(
    `${API_BASE}/chat`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        messages,
        stream: false,
        max_tokens: options.max_tokens || 500,
        ...options,
      }),
      signal,
    },
    "chat-api",
    MUTATION_RETRY_OPTIONS
  )

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`)
  }

  return response.json()
}

export async function detectDomain(message: string, signal?: AbortSignal): Promise<{ domain: string; confidence: number; language: string }> {
  const response = await resilientFetch(
    `${API_BASE}/chat/detect-domain`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message }),
      signal,
    },
    "chat-api",
    MUTATION_RETRY_OPTIONS
  )
  if (!response.ok) throw new Error(`Domain detection error: ${response.status}`)
  return response.json()
}

export async function factCheck(claim: string, context: string, signal?: AbortSignal): Promise<{
  verified: boolean
  confidence: number
  sources: string[]
}> {
  const response = await resilientFetch(
    `${API_BASE}/chat/fact-check`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ claim, context }),
      signal,
    },
    "chat-api",
    MUTATION_RETRY_OPTIONS
  )
  if (!response.ok) throw new Error(`Fact check error: ${response.status}`)
  return response.json()
}

// Voice API
export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<{
  transcript: string
  confidence: number
  language: string
}> {
  const formData = new FormData()
  formData.append("audio", audio)

  const response = await resilientFetch(
    `${API_BASE}/voice/transcribe`,
    {
      method: "POST",
      headers: getAuthHeadersForUpload(),
      body: formData,
      signal,
    },
    "voice-api",
    MUTATION_RETRY_OPTIONS
  )
  if (!response.ok) throw new Error(`Transcription error: ${response.status}`)
  return response.json()
}

export async function speak(text: string, voice = "default", emotion_state = "neutral", signal?: AbortSignal): Promise<Blob> {
  const formData = new FormData()
  formData.append("text", text)
  formData.append("voice", voice)
  formData.append("emotion_state", emotion_state)

  const response = await resilientFetch(
    `${API_BASE}/voice/speak`,
    {
      method: "POST",
      headers: getAuthHeadersForUpload(),
      body: formData,
      signal,
    },
    "voice-api",
    MUTATION_RETRY_OPTIONS
  )
  if (!response.ok) throw new Error(`Speech error: ${response.status}`)
  return response.blob()
}

export async function getVoices(signal?: AbortSignal): Promise<{ voices: VoiceInfo[] }> {
  const response = await resilientFetch(
    `${API_BASE}/voice/voices`,
    { headers: getAuthHeaders(), signal },
    "voice-api"
  )
  if (!response.ok) throw new Error(`Voices error: ${response.status}`)
  return response.json()
}

export function createVoiceWebSocket(language = "ar"): WebSocket {
  // SEC-UI-115: Validate language parameter to prevent WebSocket URL injection.
  // Only allow known language codes to be passed as query parameter.
  const VALID_LANGUAGES = ["ar", "en", "bilingual"]
  const safeLang = VALID_LANGUAGES.includes(language) ? language : "ar"

  // Construct absolute WebSocket URL from current window location
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3000"
  return new WebSocket(`${protocol}//${host}/api/v1/voice/live?language=${encodeURIComponent(safeLang)}`)
}

/**
 * REL-012: Resilient WebSocket with automatic reconnection.
 *
 * Creates a WebSocket that automatically reconnects with exponential backoff
 * when the connection drops unexpectedly. Handles:
 * - Network disconnection and recovery
 * - Server restarts (1001 Going Away)
 * - Abnormal closures (1006)
 * - Stale connection detection via heartbeat
 *
 * @param language - Language for the voice WebSocket
 * @param options - Reconnection configuration
 * @returns Object with the current WebSocket ref and control functions
 */
export function createResilientVoiceWebSocket(
  language = "ar",
  options: {
    maxReconnectAttempts?: number
    baseDelayMs?: number
    maxDelayMs?: number
    heartbeatIntervalMs?: number
    onReconnect?: (attempt: number) => void
    onMaxRetriesExhausted?: () => void
    onOpen?: (ws: WebSocket) => void
    onMessage?: (event: MessageEvent) => void
    onError?: (event: Event) => void
  } = {}
): {
  getSocket: () => WebSocket | null
  close: () => void
  reconnect: () => void
} {
  const {
    maxReconnectAttempts = 10,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    heartbeatIntervalMs = 30_000,
    onReconnect,
    onMaxRetriesExhausted,
    onOpen,
    onMessage,
    onError,
  } = options

  let ws: WebSocket | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let intentionallyClosed = false

  // Closeable status codes that indicate we should NOT reconnect
  const NON_RETRYABLE_CLOSE_CODES = [1000, 1008, 1011] // Normal, Policy Violation, Internal Error

  function connect() {
    if (intentionallyClosed) return

    ws = createVoiceWebSocket(language)

    ws.addEventListener("open", () => {
      reconnectAttempt = 0 // Reset on successful connection
      startHeartbeat()
      onOpen?.(ws!)
    })

    ws.addEventListener("message", (event) => {
      onMessage?.(event)
    })

    ws.addEventListener("error", (event) => {
      onError?.(event)
    })

    ws.addEventListener("close", (event) => {
      stopHeartbeat()

      // Don't reconnect if we closed intentionally or got a non-retryable code
      if (intentionallyClosed || NON_RETRYABLE_CLOSE_CODES.includes(event.code)) {
        return
      }

      scheduleReconnect()
    })
  }

  function scheduleReconnect() {
    if (reconnectAttempt >= maxReconnectAttempts) {
      onMaxRetriesExhausted?.()
      return
    }

    const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, reconnectAttempt))
    const jitteredDelay = delay * (0.7 + Math.random() * 0.6) // 70-130% of delay

    reconnectAttempt++
    onReconnect?.(reconnectAttempt)

    reconnectTimer = setTimeout(() => {
      connect()
    }, jitteredDelay)
  }

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }))
        } catch {
          // Connection may be dead — close and let reconnect logic handle it
          ws.close()
        }
      }
    }, heartbeatIntervalMs)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function close() {
    intentionallyClosed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    stopHeartbeat()
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, "Client closed")
    }
    ws = null
  }

  function reconnect() {
    intentionallyClosed = false
    reconnectAttempt = 0
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close()
    }
    connect()
  }

  // Start initial connection
  connect()

  return {
    getSocket: () => ws,
    close,
    reconnect,
  }
}

// Vault API
export async function initVault(signal?: AbortSignal): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/vault/init`, {
    method: "POST",
    headers: getAuthHeaders(),
    signal,
  })
  if (!response.ok) throw new Error(`Vault init error: ${response.status}`)
  return response.json()
}

export async function ingestDocument(data: {
  text: string
  title: string
  doc_type: string
  language: string
  tags: string[]
}, signal?: AbortSignal): Promise<{ chunks_stored: number }> {
  const response = await fetch(`${API_BASE}/vault/ingest`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
    signal,
  })
  if (!response.ok) throw new Error(`Vault ingest error: ${response.status}`)
  return response.json()
}

export async function uploadToVault(file: File, signal?: AbortSignal): Promise<{ chunks_stored: number; filename: string }> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${API_BASE}/vault/upload`, {
    method: "POST",
    headers: getAuthHeadersForUpload(),
    body: formData,
    signal,
  })
  if (!response.ok) throw new Error(`Vault upload error: ${response.status}`)
  return response.json()
}

export async function searchVault(query: string, top_k = 5, signal?: AbortSignal): Promise<{ results: VaultSearchResult[] }> {
  const response = await resilientFetch(
    `${API_BASE}/vault/search`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, top_k }),
      signal,
    },
    "vault-api",
    READ_RETRY_OPTIONS // POST but read-only (search query), safe to retry
  )
  if (!response.ok) throw new Error(`Vault search error: ${response.status}`)
  return response.json()
}

export async function deleteDocument(docId: string, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE}/vault/document/${docId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    signal,
  })
  if (!response.ok) throw new Error(`Vault delete error: ${response.status}`)
}

export async function getVaultInfo(signal?: AbortSignal): Promise<{
  name: string
  points_count: number
  vectors_count: number
  status: string
}> {
  const response = await resilientFetch(
    `${API_BASE}/vault/info`,
    { headers: getAuthHeaders(), signal },
    "vault-api"
  )
  if (!response.ok) throw new Error(`Vault info error: ${response.status}`)
  return response.json()
}

export async function listVaultDocuments(signal?: AbortSignal): Promise<VaultDocument[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/documents`,
      { headers: getAuthHeaders(), signal },
      "vault-api"
    )
    if (!response.ok) return null
    const data = await response.json()
    // Backend may return { documents: [...] } or a plain array
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.documents)) return data.documents
    return null
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

/**
 * Clears all user data from the backend (vault documents) and from localStorage
 * (conversations). Returns an object describing what succeeded/failed.
 */
export async function clearAllUserData(): Promise<{
  vaultCleared: boolean
  conversationsCleared: boolean
  errors: string[]
}> {
  const errors: string[] = []
  let vaultCleared = false
  let conversationsCleared = false

  // 1. Delete all vault documents from the backend
  try {
    const docs = await listVaultDocuments()
    if (docs && docs.length > 0) {
      const deleteResults = await Promise.allSettled(
        docs.map((doc) => deleteDocument(doc.id))
      )
      const failed = deleteResults.filter((r) => r.status === "rejected")
      if (failed.length > 0) {
        errors.push(`Failed to delete ${failed.length} vault document(s)`)
      } else {
        vaultCleared = true
      }
    } else {
      // No documents to delete — counts as success
      vaultCleared = true
    }
  } catch {
    errors.push("Could not reach vault to delete documents")
  }

  // 2. Delete ALL user-related data from localStorage
  // SEC: Must clear every key to prevent data leaking across user sessions
  try {
    if (typeof window !== "undefined") {
      const keysToRemove = [
        "nexus-conversations",
        "nexus-user-display",
        "nexus-user-id",
        "nexus-preferences",
        "nexus-onboarded",
        "nexus-referral-code",
        "nexus-sidebar-collapsed",
        "nexusad-client-profile",
        "nexusad-billing-tier",
        "nexusad-onboarding-checklist",
        "nexusad-cookie-consent", // GDPR: Clear cookie consent on full data wipe
      ]
      keysToRemove.forEach(key => localStorage.removeItem(key))
    }
    conversationsCleared = true
  } catch {
    errors.push("Could not clear local data")
  }

  return { vaultCleared, conversationsCleared, errors }
}

// Finance API
// NOTE: The four functions below (getStock, getForex, getCrypto, searchFinance) are
// backend-ready but not yet wired to any UI. The proxy routes and response types are
// fully implemented. A finance widget or /finance page should call these when that
// feature is built. Do not remove them — they are intentional future-feature stubs.

/**
 * Fetch real-time stock data for a given ticker symbol.
 * UI NOT YET IMPLEMENTED — backend-ready, pending a finance widget.
 */
export async function getStock(symbol: string, signal?: AbortSignal): Promise<StockData> {
  const response = await resilientFetch(
    `${API_BASE}/finance/stock/${symbol}`,
    { headers: getAuthHeaders(), signal },
    "finance-api"
  )
  if (!response.ok) throw new Error(`Stock error: ${response.status}`)
  return response.json()
}

/**
 * Fetch a live forex exchange rate between two currency codes (e.g. "USD" to "EUR").
 * UI NOT YET IMPLEMENTED — backend-ready, pending a finance widget.
 */
export async function getForex(from: string, to: string, signal?: AbortSignal): Promise<ForexData> {
  const response = await resilientFetch(
    `${API_BASE}/finance/forex/${from}/${to}`,
    { headers: getAuthHeaders(), signal },
    "finance-api"
  )
  if (!response.ok) throw new Error(`Forex error: ${response.status}`)
  return response.json()
}

/**
 * Fetch real-time crypto price and market data for a given coin symbol (e.g. "BTC").
 * UI NOT YET IMPLEMENTED — backend-ready, pending a finance widget.
 */
export async function getCrypto(symbol: string, signal?: AbortSignal): Promise<{ symbol: string; price: number; market: string }> {
  const response = await resilientFetch(
    `${API_BASE}/finance/crypto/${symbol}`,
    { headers: getAuthHeaders(), signal },
    "finance-api"
  )
  if (!response.ok) throw new Error(`Crypto error: ${response.status}`)
  return response.json()
}

/**
 * Search for stocks, ETFs, or funds by keyword and return matching symbols.
 * UI NOT YET IMPLEMENTED — backend-ready, pending a finance widget.
 */
export async function searchFinance(keywords: string, signal?: AbortSignal): Promise<Array<{
  symbol: string
  name: string
  type: string
  region: string
}>> {
  const response = await resilientFetch(
    `${API_BASE}/finance/search/${keywords}`,
    { headers: getAuthHeaders(), signal },
    "finance-api"
  )
  if (!response.ok) throw new Error(`Finance search error: ${response.status}`)
  return response.json()
}

// Health API
export async function checkHealth(signal?: AbortSignal): Promise<{ status: string }> {
  const response = await resilientFetch(
    `${API_BASE.replace("/api/proxy", "")}/health`,
    { signal },
    "health-api"
  )
  if (!response.ok) throw new Error(`Health check error: ${response.status}`)
  return response.json()
}

export async function getSystemStatus(signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await resilientFetch(
    `${API_BASE.replace("/api/proxy", "")}/status`,
    { signal },
    "health-api"
  )
  if (!response.ok) throw new Error(`Status error: ${response.status}`)
  return response.json()
}

// ============================================
// Backend API Functions with AbortSignal support
// ============================================

export async function getSovereigntyStatus(signal?: AbortSignal): Promise<SovereigntyStatusResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/status`,
      { headers: getAuthHeaders(), signal },
      "sovereignty-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getSovereigntyScore(signal?: AbortSignal): Promise<SovereigntyScoreResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/score`,
      { headers: getAuthHeaders(), signal },
      "sovereignty-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getShardDistribution(signal?: AbortSignal): Promise<ShardDistributionResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/shards`,
      { headers: getAuthHeaders(), signal },
      "vault-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getKeyStatus(signal?: AbortSignal): Promise<KeyStatusResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/keys/status`,
      { headers: getAuthHeaders(), signal },
      "keys-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function generateKeypair(algorithm: string, signal?: AbortSignal): Promise<GenerateKeypairResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/keys/generate`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ algorithm }),
        signal,
      },
      "keys-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function backupKey(keyId: string, passphraseHash: string, signal?: AbortSignal): Promise<BackupKeyResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/keys/${keyId}/backup`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ passphrase_hash: passphraseHash }),
        signal,
      },
      "keys-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function rotateKey(keyId: string, signal?: AbortSignal): Promise<{ new_key_id: string; fingerprint: string; rotated_at: string } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/keys/${keyId}/rotate`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        signal,
      },
      "keys-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function proveDelete(documentId: string, signal?: AbortSignal): Promise<DeletionCertificate | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/prove-delete`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ document_id: documentId }),
        signal,
      },
      "vault-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getAccessLog(signal?: AbortSignal): Promise<AccessLogResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/access-log`,
      { headers: getAuthHeaders(), signal },
      "vault-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getPrivacyComparison(signal?: AbortSignal): Promise<PrivacyComparisonResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/privacy/comparison`,
      { headers: getAuthHeaders(), signal },
      "privacy-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getDailyBriefing(date?: string, signal?: AbortSignal): Promise<BriefingResponse | null> {
  try {
    const url = date ? `${API_BASE}/briefing?date=${encodeURIComponent(date)}` : `${API_BASE}/briefing`
    const response = await resilientFetch(
      url,
      { headers: getAuthHeaders(), signal },
      "briefing-api"
    )
    if (!response.ok) return null
    const json = await response.json()
    // Backend wraps payload in { success, data }
    return json?.data ?? json
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getSovereigntyReport(signal?: AbortSignal): Promise<SovereigntyReportResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/report`,
      { headers: getAuthHeaders(), signal },
      "sovereignty-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export type { VaultInfoType }

export async function getVaultProfile(userId: string, signal?: AbortSignal): Promise<VaultProfile | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/profile/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "user-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function updateVaultProfile(userId: string, profile: Partial<VaultProfile>, signal?: AbortSignal): Promise<VaultProfile | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/profile/${userId}`,
      {
        method: "PUT",
        headers: getAuthHeaders(userId),
        body: JSON.stringify(profile),
        signal,
      },
      "user-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function createVaultProfile(profile: {
  user_id: string
  entity_name: string
  entity_type?: string
  jurisdictions?: string[]
  team_size?: number
  risk_appetite?: number
  asset_focus?: string[]
  investment_budget_range?: string
  time_horizon?: string
  current_goals?: string
  key_competitors?: string
  open_matters?: string
  report_style?: string
  favorite_sections?: string[]
  auto_include?: Record<string, boolean>
  language_preference?: string
}, signal?: AbortSignal): Promise<VaultProfile | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/profile`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(profile),
        signal,
      },
      "user-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Memory Layer Integration Functions
export type MemoryLayerStatus = {
  layer: number
  name: string
  active: boolean
  dataCount: number
}

export function getActiveMemoryLayers(profile?: VaultProfile | null): MemoryLayerStatus[] {
  const layers: MemoryLayerStatus[] = [
    { layer: 0, name: "Sensory Memory", active: true, dataCount: 0 }, // Always active
    { layer: 1, name: "Working Memory", active: true, dataCount: 0 }, // Always active
    { layer: 2, name: "Episodic Memory", active: false, dataCount: 0 }, // Not implemented yet
    { layer: 3, name: "Semantic Memory", active: false, dataCount: 0 }, // Vault documents
    { layer: 4, name: "Procedural Memory", active: !!profile, dataCount: profile ? 1 : 0 }, // Profile exists
    { layer: 5, name: "Emotional Memory", active: true, dataCount: 0 }, // Emotion tracking
    { layer: 6, name: "Meta-Cognitive", active: false, dataCount: 0 }, // Not implemented
  ]

  return layers
}

// User Profile API (for account profile, not vault profile)
export async function getUserProfile(userId: string, signal?: AbortSignal): Promise<UserProfile | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/user/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "user-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function updateUserProfile(userId: string, profile: Partial<UserProfile>, signal?: AbortSignal): Promise<UserProfile | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/user/${userId}`,
      {
        method: "PUT",
        headers: getAuthHeaders(userId),
        body: JSON.stringify(profile),
        signal,
      },
      "user-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function deleteUserAccount(userId: string, signal?: AbortSignal): Promise<{ deleted: boolean } | null> {
  try {
    const response = await fetch(`${API_BASE}/user/${userId}`, {
      method: "DELETE",
      headers: getAuthHeaders(userId),
      signal,
    })
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Butler API
export async function getButlerFeed(userId: string, signal?: AbortSignal): Promise<ButlerFeedResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/feed/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "butler-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getPrivacyGlass(userId: string, signal?: AbortSignal): Promise<PrivacyGlassStats | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/privacy-glass/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "butler-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function butlerInteract(cardId: string, action: string, userId?: string, signal?: AbortSignal): Promise<{ recorded: boolean } | null> {
  // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
  let parsedUserId: string | null = null
  try {
    parsedUserId = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("nexus-user-display") || "{}").id : null
  } catch {
    // Corrupted localStorage
  }
  const effectiveUserId = userId || parsedUserId || ""
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/interact`,
      {
        method: "POST",
        headers: getAuthHeaders(effectiveUserId),
        body: JSON.stringify({ card_id: cardId, action, user_id: effectiveUserId }),
        signal,
      },
      "butler-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function butlerOnboard(data: ButlerOnboardingData, userId?: string, signal?: AbortSignal): Promise<{ success: boolean } | null> {
  // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
  let parsedUserId2: string | null = null
  try {
    parsedUserId2 = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("nexus-user-display") || "{}").id : null
  } catch {
    // Corrupted localStorage
  }
  const effectiveUserId = userId || parsedUserId2 || ""
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/onboard`,
      {
        method: "POST",
        headers: getAuthHeaders(effectiveUserId),
        body: JSON.stringify({ user_id: effectiveUserId, ...data }),
        signal,
      },
      "butler-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getButlerOnboardingStatus(userId: string, signal?: AbortSignal): Promise<{ onboarded: boolean; persona: string | null } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/onboarding-status/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "butler-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function triggerButlerRefresh(userId: string, signal?: AbortSignal): Promise<ButlerFeedResponse | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/fetch-now/${userId}`,
      {
        method: "POST",
        headers: getAuthHeaders(userId),
        signal,
      },
      "butler-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Auth API
export async function getSession(signal?: AbortSignal): Promise<Session | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/auth/session`,
      {
        headers: getAuthHeaders(),
        credentials: "include",
        signal,
      },
      "auth-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Auth API - These should NOT be used, use /api/v1/auth/login instead
export interface AuthResponse {
  token: string
  user: {
    id: string
    email: string
    fullName: string
  }
}

// DEPRECATED: Use /api/v1/auth/login which sets httpOnly cookie
export async function login(email: string, password: string, signal?: AbortSignal): Promise<AuthResponse | null> {
  try {
    // Use server-side auth route that sets httpOnly cookie
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
      signal,
    })
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// DEPRECATED: Use /api/v1/auth/register which sets httpOnly cookie
export async function register(data: {
  fullName: string
  email: string
  password: string
}, signal?: AbortSignal): Promise<AuthResponse | null> {
  try {
    // Use server-side auth route that sets httpOnly cookie
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
      signal,
    })
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function forgotPassword(email: string, signal?: AbortSignal): Promise<{ sent: boolean } | null> {
  try {
    // SEC-AUTH-008: Include CSRF token for proxy POST requests
    const headers: HeadersInit = { "Content-Type": "application/json" }
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      (headers as Record<string, string>)["X-CSRF-Token"] = csrfToken
    }
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
      signal,
    })
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function verifyEmail(email: string, code: string, signal?: AbortSignal): Promise<{ verified: boolean } | null> {
  try {
    // Use dedicated server-side auth endpoint (same pattern as login/register)
    const headers: HeadersInit = { "Content-Type": "application/json" }
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      (headers as Record<string, string>)["X-CSRF-Token"] = csrfToken
    }
    const response = await fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, code }),
      signal,
    })
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Data Export API (GDPR)
export interface DataExport {
  id: string
  date: string
  type: string
  format: string
  size: string
  status: "ready" | "processing" | "expired"
  downloadUrl?: string
}

export async function requestDataExport(options: {
  types: string[]
  format: "json" | "csv" | "pdf"
}, signal?: AbortSignal): Promise<{ requestId: string; estimatedTime: string } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/gdpr/export`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(options),
        signal,
      },
      "gdpr-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function getDataExports(signal?: AbortSignal): Promise<DataExport[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/gdpr/exports`,
      { headers: getAuthHeaders(), signal },
      "gdpr-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// GDPR Consent Record API (Article 7(1) - Controller must demonstrate consent)
export async function recordConsentServer(consent: {
  preferences: { essential: true; analytics: boolean; functional: boolean }
  method: "accept-all" | "reject-all" | "custom"
  version: string
}): Promise<boolean> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/gdpr/consent`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...consent,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        }),
      },
      "gdpr-api",
      MUTATION_RETRY_OPTIONS
    )
    return response.ok
  } catch {
    return false
  }
}

// Search API
export interface SearchResult {
  id: string
  type: "conversation" | "document" | "setting" | "help"
  title: string
  description?: string
  href: string
  domain?: string
  date?: string
  tags?: string[]
}

export async function globalSearch(query: string, signal?: AbortSignal): Promise<SearchResult[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/search?q=${encodeURIComponent(query)}`,
      { headers: getAuthHeaders(), signal },
      "search-api"
    )
    if (!response.ok) return null
    const json = await response.json()
    // Backend wraps payload in { success, data }
    return json?.data ?? json
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Vault Document Detail API
export interface VaultDocumentDetail {
  id: string
  name: string
  nameAr: string
  type: string
  domain: string
  domainAr: string
  dateAdded: string
  chunks: number
  usageCount: number
  fingerprint: string
  content: string
  relatedConversations: Array<{ id: string; title: string; date: string }>
}

export async function getVaultDocument(docId: string, signal?: AbortSignal): Promise<VaultDocumentDetail | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/vault/document/${docId}`,
      { headers: getAuthHeaders(), signal },
      "vault-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Team Management API
export async function getTeamMembers(signal?: AbortSignal): Promise<TeamMember[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/team/members`,
      { headers: getAuthHeaders(), signal },
      "team-api"
    )
    if (!response.ok) throw new Error(`Failed to load team members (${response.status})`)
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export async function getTeamInvitations(signal?: AbortSignal): Promise<TeamInvitation[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/team/invitations`,
      { headers: getAuthHeaders(), signal },
      "team-api"
    )
    if (!response.ok) throw new Error(`Failed to load invitations (${response.status})`)
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export async function inviteTeamMember(email: string, role: TeamMemberRole, signal?: AbortSignal): Promise<TeamInvitation | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/team/invite`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, role }),
        signal,
      },
      "team-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function updateTeamMember(memberId: string, role: TeamMemberRole, signal?: AbortSignal): Promise<TeamMember | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/team/members/${memberId}`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
        signal,
      },
      "team-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function removeTeamMember(memberId: string, signal?: AbortSignal): Promise<{ removed: boolean } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/team/members/${memberId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
        signal,
      },
      "team-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function cancelTeamInvitation(invitationId: string, signal?: AbortSignal): Promise<{ cancelled: boolean } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/team/invitations/${invitationId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
        signal,
      },
      "team-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Notifications API
export async function getNotifications(userId = "", signal?: AbortSignal): Promise<Notification[]> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/notifications/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "butler-api"
    )
    if (!response.ok) throw new Error("Failed to load notifications")
    return response.json()
  } catch (err) {
    if (isAbortError(err)) throw err
    throw err instanceof Error ? err : new Error("Failed to load notifications")
  }
}

export async function markNotificationRead(notificationId: string, signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/notifications/${notificationId}/read`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        signal,
      },
      "butler-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function markAllNotificationsRead(userId = "", signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/notifications/${userId}/read-all`,
      {
        method: "PUT",
        headers: getAuthHeaders(userId),
        signal,
      },
      "butler-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function dismissNotification(notificationId: string, signal?: AbortSignal): Promise<{ success: boolean } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/butler/notifications/${notificationId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
        signal,
      },
      "butler-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Settings API
export interface SettingsPayload {
  theme?: string
  language?: string
  fontSize?: string
  sendSound?: boolean
  arriveSound?: boolean
  successSound?: boolean
  masterVolume?: number
  localProcessingOnly?: boolean
  biometricLock?: boolean
  autoLockTimeout?: string
  pushNotifications?: boolean
}

export async function getSettings(userId = "", signal?: AbortSignal): Promise<SettingsPayload | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/user/${userId}/settings`,
      { headers: getAuthHeaders(userId), signal },
      "user-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function updateSettings(userId: string, settings: SettingsPayload, signal?: AbortSignal): Promise<SettingsPayload | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/user/${userId}/settings`,
      {
        method: "PUT",
        headers: getAuthHeaders(userId),
        body: JSON.stringify(settings),
        signal,
      },
      "user-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Persona API
export interface PersonaPayload {
  personality: "professional" | "friendly" | "direct" | "adaptive"
  formalCasual: number
  conciseDetailed: number
  languageBalance: number
}

export async function getPersona(userId = "", signal?: AbortSignal): Promise<PersonaPayload | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/user/${userId}/persona`,
      { headers: getAuthHeaders(userId), signal },
      "user-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function updatePersona(userId: string, persona: PersonaPayload, signal?: AbortSignal): Promise<PersonaPayload | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/user/${userId}/persona`,
      {
        method: "PUT",
        headers: getAuthHeaders(userId),
        body: JSON.stringify(persona),
        signal,
      },
      "user-api",
      MUTATION_RETRY_OPTIONS
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Domains API
export interface DomainMastery {
  id: string
  mastery: number
  documents: number
  conversations: number
}

export async function getDomainsMastery(userId = "", signal?: AbortSignal): Promise<DomainMastery[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/domains/mastery/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "domains-api"
    )
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

// Referral API
export async function getReferralCode(userId = "", signal?: AbortSignal): Promise<{ code: string } | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/referral/code/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "referral-api"
    )
    if (!response.ok) throw new Error(`Failed to load referral code (${response.status})`)
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export async function getReferralStats(userId = "", signal?: AbortSignal): Promise<ReferralStats | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/referral/stats/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "referral-api"
    )
    if (!response.ok) throw new Error(`Failed to load referral stats (${response.status})`)
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export async function getReferrals(userId = "", signal?: AbortSignal): Promise<Referral[] | null> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/referral/list/${userId}`,
      { headers: getAuthHeaders(userId), signal },
      "referral-api"
    )
    if (!response.ok) throw new Error(`Failed to load referrals (${response.status})`)
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export async function uploadAvatar(
  userId: string,
  file: File,
  signal?: AbortSignal
): Promise<{ avatar_url: string } | null> {
  try {
    const formData = new FormData()
    formData.append("avatar", file)

    const response = await fetch(`${API_BASE}/user/${userId}/avatar`, {
      method: "POST",
      headers: getAuthHeadersForUpload(userId),
      body: formData,
      signal,
    })
    if (!response.ok) return null
    return response.json()
  } catch (err) {
    if (isAbortError(err)) return null
    return null
  }
}

export async function logout(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(),
    })
    return response.ok
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Export
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportDocumentRequest {
  content: string
  title: string
  format: "pdf" | "docx" | "html" | "md"
  include_cover?: boolean
  include_toc?: boolean
  confidential?: boolean
  subtitle?: string
}

/**
 * Export document content to a professionally formatted file.
 * Returns a Blob that can be downloaded.
 */
export async function exportDocument(
  request: ExportDocumentRequest,
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    const response = await fetch(`${API_BASE}/export/document`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        content: request.content,
        title: request.title,
        format: request.format,
        include_cover: request.include_cover ?? true,
        include_toc: request.include_toc ?? true,
        confidential: request.confidential ?? true,
        subtitle: request.subtitle,
      }),
      signal,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Export failed: ${response.status} - ${error}`)
    }

    return response.blob()
  } catch (err) {
    if (isAbortError(err)) return null
    console.error("Export document error:", err)
    return null
  }
}
