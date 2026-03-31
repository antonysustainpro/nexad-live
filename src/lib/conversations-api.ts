/**
 * Conversation API - Layer 2: Episodic Memory
 *
 * This module handles conversation history storage and retrieval
 * for the 7-layer memory system. It provides episodic memory
 * capabilities for long-term conversation persistence.
 */

import { getCsrfToken } from "@/lib/csrf"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface ConversationMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  summary?: string
  tags?: string[]
  message_count: number
  last_message?: string
  emotion_summary?: {
    dominant: string
    range: string[]
  }
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[]
}

export interface ConversationSearchResult {
  conversation_id: string
  message_id: string
  content: string
  similarity: number
  context: {
    before?: string
    after?: string
  }
}

// Helper to get auth headers
function getHeaders(userId: string): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-User-ID": userId,
  }

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
  }

  return headers
}

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  title: string,
  firstMessage?: ConversationMessage,
  signal?: AbortSignal
): Promise<Conversation> {
  try {
    const response = await fetch(`${API_BASE}/brain/conversations`, {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({
        user_id: userId,
        title,
        first_message: firstMessage,
      }),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to create conversation")
  }
}

/**
 * List all conversations for a user
 */
export async function listConversations(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    sort?: "created" | "updated" | "messages"
  },
  signal?: AbortSignal
): Promise<{ conversations: Conversation[]; total: number }> {
  try {
    const params = new URLSearchParams()
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.offset) params.append("offset", options.offset.toString())
    if (options?.sort) params.append("sort", options.sort)

    const response = await fetch(`${API_BASE}/brain/conversations?${params}`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    // Return empty list as fallback
    return { conversations: [], total: 0 }
  }
}

/**
 * Get a conversation with all its messages
 */
export async function getConversation(
  userId: string,
  conversationId: string,
  signal?: AbortSignal
): Promise<ConversationWithMessages> {
  try {
    const response = await fetch(`${API_BASE}/brain/conversations/${conversationId}`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to get conversation")
  }
}

/**
 * Update conversation metadata
 */
export async function updateConversation(
  userId: string,
  conversationId: string,
  updates: {
    title?: string
    summary?: string
    tags?: string[]
  },
  signal?: AbortSignal
): Promise<Conversation> {
  try {
    const response = await fetch(`${API_BASE}/brain/conversations/${conversationId}`, {
      method: "PATCH",
      headers: getHeaders(userId),
      body: JSON.stringify(updates),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to update conversation")
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  userId: string,
  conversationId: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/brain/conversations/${conversationId}`, {
      method: "DELETE",
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to delete conversation")
  }
}

/**
 * Add a message to an existing conversation
 */
export async function addMessageToConversation(
  userId: string,
  conversationId: string,
  message: Omit<ConversationMessage, "id" | "timestamp">,
  signal?: AbortSignal
): Promise<ConversationMessage> {
  try {
    const response = await fetch(`${API_BASE}/brain/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify(message),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to add message: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to add message")
  }
}

/**
 * Search across all conversations
 */
export async function searchConversations(
  userId: string,
  query: string,
  options?: {
    limit?: number
    conversation_ids?: string[]
    date_from?: string
    date_to?: string
  },
  signal?: AbortSignal
): Promise<ConversationSearchResult[]> {
  try {
    const response = await fetch(`${API_BASE}/brain/memory/search`, {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({
        query,
        user_id: userId,
        ...options,
      }),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to search conversations: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    return []
  }
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(
  userId: string,
  signal?: AbortSignal
): Promise<{
  total_conversations: number
  total_messages: number
  avg_messages_per_conversation: number
  most_active_times: { hour: number; count: number }[]
  emotion_distribution: Record<string, number>
  topic_cloud: { topic: string; weight: number }[]
}> {
  try {
    const response = await fetch(`${API_BASE}/brain/memory/stats`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get memory stats: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    // Return default stats
    return {
      total_conversations: 0,
      total_messages: 0,
      avg_messages_per_conversation: 0,
      most_active_times: [],
      emotion_distribution: {},
      topic_cloud: [],
    }
  }
}