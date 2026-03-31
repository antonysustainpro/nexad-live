// Backend API Types - Used for frontend-backend communication
// These interfaces define the shape of data expected from the backend API

// Sovereignty Status (GET /api/v1/sovereignty/status)
export interface SovereigntyStatusResponse {
  encryption_algo: string
  shard_count: number
  processing_mode: "local" | "hybrid"
  key_valid: boolean
  jurisdiction: string
  jurisdiction_flag: string
}

// Sovereignty Score (GET /api/v1/sovereignty/score)
export interface SovereigntyScoreResponse {
  score: number
  grade: string
  factors: Array<{
    name: string
    score: number
    label: string
  }>
}

// Shard Distribution (GET /api/v1/vault/shards)
export interface ShardDistributionResponse {
  nodes: Array<{
    node_id: string
    location: string
    shard_count: number
    status: "active" | "syncing" | "offline"
  }>
  total_shards: number
}

// Key Status (GET /api/v1/keys/status)
export interface KeyStatusResponse {
  key_exists: boolean
  key_id: string | null
  fingerprint: string | null
  created_at: string | null
  algorithm: string | null
  backup_method: string | null
  last_rotated_at: string | null
}

// Generate Keypair (POST /api/v1/keys/generate)
export interface GenerateKeypairRequest {
  algorithm: string
}

export interface GenerateKeypairResponse {
  key_id: string
  fingerprint: string
  public_key_jwk: Record<string, unknown>
  created_at: string
}

// Backup Key (POST /api/v1/keys/{key_id}/backup)
export interface BackupKeyRequest {
  passphrase_hash: string
}

export interface BackupKeyResponse {
  backup_data: string // Base64 encoded for QR
  backup_format: string
}

// Prove Delete (POST /api/v1/vault/prove-delete)
export interface ProveDeleteRequest {
  document_id: string
}

export interface DeletionCertificate {
  deletion_hash: string
  timestamp: string
  node_confirmations: string[]
  merkle_root: string
  merkle_verified: boolean
}

// Access Log (GET /api/v1/vault/access-log)
export interface AccessLogResponse {
  entries: Array<{
    timestamp: string
    actor: string
    action: string
    resource: string
    ip_hint?: string
  }>
  total_entries: number
  third_party_access_count: number
}

// Vault Info (GET /api/v1/vault/info)
export interface VaultInfoResponse {
  name: string
  points_count: number
  vectors_count: number
  status: string
  document_count?: number
  total_size_bytes?: number
}

// Privacy Comparison (GET /api/v1/privacy/comparison)
export interface PrivacyComparisonResponse {
  user_stats: {
    total_queries: number
    pii_items_scrubbed: number
    data_sent_to_providers_percent: number
  }
  comparison_data: {
    chatgpt_percent: number
    nexus_max_percent: number
  }
}

// Daily Briefing (GET /api/v1/briefing)
export interface BriefingResponse {
  items: Array<{
    id: string
    icon: string
    title: string
    titleAr: string
    summary: string
    summaryAr: string
    detail: string
    detailAr: string
    prompt: string
  }>
  generated_at: string
}

// Sovereignty Report (GET /api/v1/sovereignty/report)
export interface SovereigntyReportResponse {
  score: number
  grade: string
  recommendations: Array<{
    id: string
    title: string
    titleAr: string
    description: string
    descriptionAr: string
    impact: number
    status: "pending" | "completed"
  }>
  key_info: {
    fingerprint: string
    created_at: string
    algorithm: string
    backup_method: string
  }
  shard_stats: {
    active_shards: number
    nodes: number
    redundancy: number
    health_percent: number
  }
}

// Chat Stream Events
export interface ChatMetadataEvent {
  type: "metadata"
  data: {
    domain: {
      domain: string
      confidence: number
    }
    emotion: {
      dominant_emotion: string
      confidence: number
    }
    specialists: Array<{
      name: string
      icon: string
      confidence: number
      contribution: number
    }>
    routing: {
      pii_scrubbed: number
      providers_used: string[]
    }
  }
}

export interface ChatRAGSourcesEvent {
  type: "rag_sources"
  data: Array<{
    text: string
    score: number
    metadata: Record<string, unknown>
  }>
}

export interface ChatTokenEvent {
  type: "token"
  data: {
    content: string
    provider?: string
    model?: string
  }
}

export interface ChatSovereigntyEvent {
  type: "sovereignty"
  data: {
    fragments: Array<{
      fragment_id: string
      node_id: string
      size_bytes: number
    }>
    merkle_root: string
  }
}

export interface ChatDoneEvent {
  type: "done"
  data: {
    total_tokens?: number
    latency_ms?: number
  }
}

export type ChatStreamEvent =
  | ChatMetadataEvent
  | ChatRAGSourcesEvent
  | ChatTokenEvent
  | ChatSovereigntyEvent
  | ChatDoneEvent

// Message with PII field
export interface MessageWithPII {
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
  piiScrubbed?: number
}

// =============================================
// Butler Types
// =============================================

export interface ButlerCard {
  id: string
  type: string
  category: ButlerCategory
  priority: "urgent" | "high" | "normal" | "low"
  title: string
  titleAr: string
  summary: string
  summaryAr: string
  source: string
  timestamp: string
  expiresAt?: string
  actionLabel?: string
  actionUrl?: string
  actionType?: "external" | "internal" | "chat" | "report"
  affiliateDisclosure?: string
  affiliateDisclosureAr?: string
  rating?: number
  priceOriginal?: string
  priceDiscounted?: string
  marketData?: {
    symbol: string
    price: number
    change: number
    changePercent: number
  }
  alertSeverity?: "info" | "warning" | "critical"
  confidence?: number
}

export type ButlerCategory =
  | "deal"
  | "market"
  | "alert"
  | "news"
  | "event"
  | "health"
  | "school"
  | "recipe"
  | "insight"
  | "regulatory"
  | "crypto"
  | "travel"
  | "education"
  | "home"
  | "entertainment"
  | "restaurants"
  | "fitness"
  | "tech"
  | "fashion"
  | "real estate"
  | "art"
  | "sports"
  | "automotive"
  | "gaming"
  | "pets"
  | "gardening"
  | "beauty"
  | "investment"

export type ButlerPersona =
  | "parent"
  | "advisor"
  | "trader"
  | "family"
  | "hnwi"
  | "student"
  | "entrepreneur"
  | "healthcare"
  | "creative"
  | "fitness"
  | "retiree"
  | "tech"
  | "expat"
  | "foodlover"
  | "traveler"
  | "other"

export interface PrivacyGlassStats {
  trackersBlocked: number
  anonymousRequests: number
  cookieCount: 0
  encryptionStatus: "active"
  dataAutoDeleteCountdown: string
  fetchLog: Array<{
    url: string
    timestamp: string
    proxyRegion: string
    status: string
  }>
}

export interface ButlerFeedResponse {
  cards: ButlerCard[]
  total: number
  privacyStats: PrivacyGlassStats
  generatedAt: string
  userId: string
  persona: string
}

export interface ButlerOnboardingData {
  persona: ButlerPersona
  categories: ButlerCategory[]
  location: string
  familyInfo?: {
    familySize: number
    childrenAges: string[]
    dietaryPreferences: string[]
  }
  freeText?: string
}

// =============================================
// Notification Types
// =============================================

export type NotificationCategory = "alerts" | "butler" | "billing" | "security"

export interface Notification {
  id: string
  title: string
  titleAr: string
  body: string
  bodyAr: string
  category: NotificationCategory
  icon: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
  actionLabelAr?: string
}

// =============================================
// Profile Types
// =============================================

export interface UserProfile {
  id: string
  fullName: string
  email: string
  company: string
  phone: string
  role: string
  avatarUrl: string | null
  apiKey: string
  tier: "FREE" | "PRO" | "ENTERPRISE"
  memberSince: string
}

// =============================================
// Team Types
// =============================================

export type TeamMemberRole = "admin" | "member" | "viewer"

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamMemberRole
  avatarUrl: string | null
  lastActive: string
  apiCalls: number
  tokensUsed: number
}

export interface TeamInvitation {
  id: string
  email: string
  role: TeamMemberRole
  invitedAt: string
  expiresAt: string
}

// =============================================
// Referral Types
// =============================================

export type ReferralStatus = "pending" | "active" | "expired"

export interface Referral {
  id: string
  name: string
  date: string
  status: ReferralStatus
  creditEarned: number
}

export interface ReferralStats {
  totalReferrals: number
  activeReferrals: number
  creditsEarned: number
  referralCode: string
}

// =============================================
// Usage Types
// =============================================

export interface UsageMetric {
  date: string
  apiCalls: number
  tokensUsed: number
  storageUsedMb: number
}

export interface DomainUsage {
  domain: string
  calls: number
  tokens: number
  costUsd: number
}

export interface UsageSummary {
  totalApiCalls: number
  totalTokens: number
  totalStorageMb: number
  activeDomains: number
  billingPeriodStart: string
  billingPeriodEnd: string
  daysRemaining: number
}

// =============================================
// Three-Tier Chat System Types
// =============================================

export type ChatTier = "basic" | "pro" | "enterprise"

export interface ChatTierConfig {
  tier: ChatTier
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  features: ChatTierFeature[]
  limits: ChatTierLimits
  pricing: {
    monthly: number
    yearly: number
    currency: "USD" | "AED"
  }
}

export interface ChatTierFeature {
  id: string
  name: string
  nameAr: string
  enabled: boolean
  icon: string
}

export interface ChatTierLimits {
  messagesPerDay: number | "unlimited"
  tokensPerMessage: number
  fileUploadsPerDay: number
  maxFileSizeMb: number
  voiceMinutesPerMonth: number
  videoMinutesPerMonth: number
  concurrentChats: number
  historyRetentionDays: number
}

// Base session fields shared by all tiers
interface BaseChatSession {
  sessionId: string
  userId: string
  startedAt: string
  messages: MessageWithPII[]
  status: "active" | "idle" | "closed"
}

// Basic: WebSocket text chat
export interface BasicChatSession extends BaseChatSession {
  type: "basic"
}

// Pro: WebSocket + Voice (Twilio)
export interface ProChatSession extends BaseChatSession {
  type: "pro"
  voiceEnabled: boolean
  voiceProvider: "twilio" | "native"
  voiceSessionId?: string
  transcriptionEnabled: boolean
  ttsEnabled: boolean
}

// Enterprise: WebSocket + Voice + Video (WebRTC)
export interface EnterpriseChatSession extends BaseChatSession {
  type: "enterprise"
  voiceEnabled: boolean
  voiceProvider: "twilio" | "native"
  voiceSessionId?: string
  transcriptionEnabled: boolean
  ttsEnabled: boolean
  videoEnabled: boolean
  screenShareEnabled: boolean
  webrtcPeerId?: string
  recordingEnabled: boolean
  recordingConsentGiven: boolean
}

export type ChatSession = BasicChatSession | ProChatSession | EnterpriseChatSession

// Chat capability flags based on tier
export interface ChatCapabilities {
  textChat: boolean
  voiceInput: boolean
  voiceOutput: boolean
  videoCall: boolean
  screenShare: boolean
  fileUpload: boolean
  codeExecution: boolean
  realTimeCollaboration: boolean
  priorityRouting: boolean
  dedicatedSupport: boolean
}

export const CHAT_TIER_CONFIGS: Record<ChatTier, ChatTierConfig> = {
  basic: {
    tier: "basic",
    name: "Basic",
    nameAr: "أساسي",
    description: "Text chat with AI assistance",
    descriptionAr: "محادثة نصية مع مساعدة الذكاء الاصطناعي",
    features: [
      { id: "text_chat", name: "Text Chat", nameAr: "محادثة نصية", enabled: true, icon: "MessageCircle" },
      { id: "file_upload", name: "File Upload", nameAr: "رفع الملفات", enabled: true, icon: "Upload" },
      { id: "history", name: "Chat History", nameAr: "سجل المحادثات", enabled: true, icon: "History" },
    ],
    limits: {
      messagesPerDay: 100,
      tokensPerMessage: 4096,
      fileUploadsPerDay: 10,
      maxFileSizeMb: 10,
      voiceMinutesPerMonth: 0,
      videoMinutesPerMonth: 0,
      concurrentChats: 1,
      historyRetentionDays: 30,
    },
    pricing: { monthly: 0, yearly: 0, currency: "USD" },
  },
  pro: {
    tier: "pro",
    name: "Pro",
    nameAr: "احترافي",
    description: "Text + Voice chat with priority routing",
    descriptionAr: "محادثة نصية وصوتية مع توجيه أولوي",
    features: [
      { id: "text_chat", name: "Text Chat", nameAr: "محادثة نصية", enabled: true, icon: "MessageCircle" },
      { id: "voice_input", name: "Voice Input", nameAr: "إدخال صوتي", enabled: true, icon: "Mic" },
      { id: "voice_output", name: "Voice Output", nameAr: "إخراج صوتي", enabled: true, icon: "Volume2" },
      { id: "file_upload", name: "File Upload", nameAr: "رفع الملفات", enabled: true, icon: "Upload" },
      { id: "priority", name: "Priority Routing", nameAr: "توجيه أولوي", enabled: true, icon: "Zap" },
    ],
    limits: {
      messagesPerDay: 1000,
      tokensPerMessage: 16384,
      fileUploadsPerDay: 50,
      maxFileSizeMb: 50,
      voiceMinutesPerMonth: 60,
      videoMinutesPerMonth: 0,
      concurrentChats: 5,
      historyRetentionDays: 90,
    },
    pricing: { monthly: 29, yearly: 290, currency: "USD" },
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    nameAr: "مؤسسي",
    description: "Full suite: Text + Voice + Video with WebRTC",
    descriptionAr: "مجموعة كاملة: نص + صوت + فيديو مع WebRTC",
    features: [
      { id: "text_chat", name: "Text Chat", nameAr: "محادثة نصية", enabled: true, icon: "MessageCircle" },
      { id: "voice_input", name: "Voice Input", nameAr: "إدخال صوتي", enabled: true, icon: "Mic" },
      { id: "voice_output", name: "Voice Output", nameAr: "إخراج صوتي", enabled: true, icon: "Volume2" },
      { id: "video_call", name: "Video Call", nameAr: "مكالمة فيديو", enabled: true, icon: "Video" },
      { id: "screen_share", name: "Screen Share", nameAr: "مشاركة الشاشة", enabled: true, icon: "Monitor" },
      { id: "file_upload", name: "File Upload", nameAr: "رفع الملفات", enabled: true, icon: "Upload" },
      { id: "priority", name: "Priority Routing", nameAr: "توجيه أولوي", enabled: true, icon: "Zap" },
      { id: "dedicated", name: "Dedicated Support", nameAr: "دعم مخصص", enabled: true, icon: "HeadphonesIcon" },
    ],
    limits: {
      messagesPerDay: "unlimited",
      tokensPerMessage: 32768,
      fileUploadsPerDay: 200,
      maxFileSizeMb: 200,
      voiceMinutesPerMonth: 300,
      videoMinutesPerMonth: 120,
      concurrentChats: 20,
      historyRetentionDays: 365,
    },
    pricing: { monthly: 99, yearly: 990, currency: "USD" },
  },
}

// =============================================
// Multi-File Upload Types
// =============================================

export type FileUploadStatus = "pending" | "uploading" | "processing" | "complete" | "error"

export interface UploadingFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  status: FileUploadStatus
  progress: number
  error?: string
  chunksTotal?: number
  chunksUploaded?: number
  startedAt: string
  completedAt?: string
}

export interface FileUploadConfig {
  maxFileSize: number // bytes
  maxFiles: number
  allowedTypes: string[]
  chunkSize: number // bytes for chunked upload
  concurrentUploads: number
}

// Comprehensive MIME types for document upload
export const SUPPORTED_FILE_TYPES = {
  // Documents
  pdf: { mime: "application/pdf", ext: ".pdf", category: "document" },
  doc: { mime: "application/msword", ext: ".doc", category: "document" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx", category: "document" },
  odt: { mime: "application/vnd.oasis.opendocument.text", ext: ".odt", category: "document" },
  rtf: { mime: "application/rtf", ext: ".rtf", category: "document" },

  // Spreadsheets
  xls: { mime: "application/vnd.ms-excel", ext: ".xls", category: "spreadsheet" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx", category: "spreadsheet" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", ext: ".ods", category: "spreadsheet" },
  csv: { mime: "text/csv", ext: ".csv", category: "spreadsheet" },

  // Presentations
  ppt: { mime: "application/vnd.ms-powerpoint", ext: ".ppt", category: "presentation" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: ".pptx", category: "presentation" },
  odp: { mime: "application/vnd.oasis.opendocument.presentation", ext: ".odp", category: "presentation" },

  // Text & Code
  txt: { mime: "text/plain", ext: ".txt", category: "text" },
  md: { mime: "text/markdown", ext: ".md", category: "text" },
  json: { mime: "application/json", ext: ".json", category: "data" },
  xml: { mime: "application/xml", ext: ".xml", category: "data" },
  yaml: { mime: "application/x-yaml", ext: ".yaml", category: "data" },
  yml: { mime: "application/x-yaml", ext: ".yml", category: "data" },
  html: { mime: "text/html", ext: ".html", category: "text" },

  // Images
  jpg: { mime: "image/jpeg", ext: ".jpg", category: "image" },
  jpeg: { mime: "image/jpeg", ext: ".jpeg", category: "image" },
  png: { mime: "image/png", ext: ".png", category: "image" },
  gif: { mime: "image/gif", ext: ".gif", category: "image" },
  webp: { mime: "image/webp", ext: ".webp", category: "image" },
  svg: { mime: "image/svg+xml", ext: ".svg", category: "image" },
  heic: { mime: "image/heic", ext: ".heic", category: "image" },

  // Audio
  mp3: { mime: "audio/mpeg", ext: ".mp3", category: "audio" },
  wav: { mime: "audio/wav", ext: ".wav", category: "audio" },
  ogg: { mime: "audio/ogg", ext: ".ogg", category: "audio" },
  m4a: { mime: "audio/mp4", ext: ".m4a", category: "audio" },
  webm_audio: { mime: "audio/webm", ext: ".webm", category: "audio" },

  // Video
  mp4: { mime: "video/mp4", ext: ".mp4", category: "video" },
  webm: { mime: "video/webm", ext: ".webm", category: "video" },
  mov: { mime: "video/quicktime", ext: ".mov", category: "video" },
  avi: { mime: "video/x-msvideo", ext: ".avi", category: "video" },

  // Archives
  zip: { mime: "application/zip", ext: ".zip", category: "archive" },
  tar: { mime: "application/x-tar", ext: ".tar", category: "archive" },
  gz: { mime: "application/gzip", ext: ".gz", category: "archive" },

  // E-books
  epub: { mime: "application/epub+zip", ext: ".epub", category: "ebook" },
  mobi: { mime: "application/x-mobipocket-ebook", ext: ".mobi", category: "ebook" },
} as const

export type SupportedFileType = keyof typeof SUPPORTED_FILE_TYPES

export function getAllSupportedExtensions(): string {
  return Object.values(SUPPORTED_FILE_TYPES).map(t => t.ext).join(",")
}

export function getAllSupportedMimeTypes(): string[] {
  return [...new Set(Object.values(SUPPORTED_FILE_TYPES).map(t => t.mime))]
}

export function getFileCategory(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (!ext) return "unknown"
  const typeInfo = Object.values(SUPPORTED_FILE_TYPES).find(t => t.ext === `.${ext}`)
  return typeInfo?.category || "unknown"
}
