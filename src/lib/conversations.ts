// Local conversation storage until backend implements /chat/conversations endpoint
// This stores conversations in localStorage for persistence across sessions

import type { Message } from "@/components/message-bubble"
import { sanitizeParsedJson } from "@/lib/utils"

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
  domain?: string
}

const STORAGE_KEY = "nexus-conversations"

// Get all conversations
export function getConversations(): Conversation[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    // SEC-UI-107: Sanitize parsed JSON to prevent prototype pollution from tampered localStorage
    return stored ? sanitizeParsedJson(JSON.parse(stored)) : []
  } catch {
    return []
  }
}

// Get a single conversation by ID
export function getConversation(id: string): Conversation | null {
  const conversations = getConversations()
  return conversations.find(c => c.id === id) || null
}

// Create a new conversation
export function createConversation(title?: string): Conversation {
  const id = generateId()
  const now = new Date().toISOString()
  const conversation: Conversation = {
    id,
    title: title || "New Conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  }

  const conversations = getConversations()
  conversations.unshift(conversation)
  saveConversations(conversations)

  return conversation
}

// Update a conversation
export function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, "title" | "messages" | "domain">>
): Conversation | null {
  const conversations = getConversations()
  const index = conversations.findIndex(c => c.id === id)

  if (index === -1) return null

  conversations[index] = {
    ...conversations[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  saveConversations(conversations)
  return conversations[index]
}

// Add a message to a conversation
export function addMessage(conversationId: string, message: Message): Conversation | null {
  const conversation = getConversation(conversationId)
  if (!conversation) return null

  return updateConversation(conversationId, {
    messages: [...conversation.messages, message],
  })
}

// Update a message in a conversation (for streaming updates)
export function updateMessage(
  conversationId: string,
  messageId: string,
  updates: Partial<Message>
): Conversation | null {
  const conversation = getConversation(conversationId)
  if (!conversation) return null

  const messages = conversation.messages.map(m =>
    m.id === messageId ? { ...m, ...updates } : m
  )

  return updateConversation(conversationId, { messages })
}

// Delete a conversation
export function deleteConversation(id: string): boolean {
  const conversations = getConversations()
  const filtered = conversations.filter(c => c.id !== id)

  if (filtered.length === conversations.length) return false

  saveConversations(filtered)
  return true
}

// Generate auto-title from first message
// SEC-BL-012: Sanitize title content — strip control chars and null bytes to prevent
// XSS or display corruption when title is rendered in conversation list
export function generateTitle(content: string): string {
  // Strip null bytes and control characters, then take first 50 chars
  const sanitized = content.replace(/[\0\x01-\x1f\x7f]/g, "").trim()
  if (!sanitized) return "New Conversation"
  const truncated = sanitized.slice(0, 50)
  return truncated.length < sanitized.length ? `${truncated}...` : truncated
}

// Helper to save to localStorage
function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return
  try {
    // Keep only last 100 conversations to avoid storage limits
    const limited = conversations.slice(0, 100)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited))
    // Notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent("nexus-conversations-updated"))
  } catch {
    // Storage quota exceeded or unavailable - silently fail
  }
}

// SEC-SM-004: Generate unique ID using crypto only — no Math.random fallback.
// Math.random() is NOT cryptographically secure and conversation IDs could be predicted.
function generateId(): string {
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
