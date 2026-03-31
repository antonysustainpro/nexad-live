/**
 * Meta-Cognitive API - Layer 6: Meta-Cognitive Memory
 *
 * This module handles the system's self-reflection and performance
 * understanding. It tracks user satisfaction, system performance,
 * and adapts based on feedback patterns.
 */

import { getCsrfToken } from "@/lib/csrf"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface BrainHealthMetrics {
  overall_health: number // 0-100
  layer_status: {
    layer_id: number
    name: string
    health: number // 0-100
    last_active: string
    activity_count: number
    issues?: string[]
  }[]
  performance: {
    avg_response_time: number
    success_rate: number
    error_rate: number
    user_satisfaction: number // 0-100
  }
  recommendations: string[]
  last_optimization: string
}

export interface UserSatisfactionMetrics {
  user_id: string
  overall_satisfaction: number // 0-100
  interaction_quality: {
    helpful: number
    accurate: number
    relevant: number
    timely: number
  }
  feedback_summary: {
    positive_count: number
    negative_count: number
    themes: { theme: string; count: number; sentiment: "positive" | "negative" }[]
  }
  improvement_areas: string[]
}

export interface SystemAdaptation {
  adaptation_id: string
  user_id: string
  type: "behavior" | "preference" | "performance"
  description: string
  trigger: string
  applied_at: string
  effectiveness: number // 0-100
}

export interface PerformanceInsight {
  insight_id: string
  category: "speed" | "accuracy" | "relevance" | "user_experience"
  title: string
  description: string
  severity: "info" | "warning" | "critical"
  recommendations: string[]
  detected_at: string
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
 * Get brain health dashboard summary
 */
export async function getBrainHealth(
  userId: string,
  signal?: AbortSignal
): Promise<BrainHealthMetrics> {
  try {
    const response = await fetch(`${API_BASE}/brain/dashboard/summary`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get brain health: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    // Return default metrics
    return {
      overall_health: 85,
      layer_status: [],
      performance: {
        avg_response_time: 0,
        success_rate: 0,
        error_rate: 0,
        user_satisfaction: 0,
      },
      recommendations: [],
      last_optimization: new Date().toISOString(),
    }
  }
}

/**
 * Get user satisfaction metrics
 */
export async function getUserSatisfaction(
  userId: string,
  timeRange?: { from: string; to: string },
  signal?: AbortSignal
): Promise<UserSatisfactionMetrics> {
  try {
    const params = new URLSearchParams()
    if (timeRange?.from) params.append("from", timeRange.from)
    if (timeRange?.to) params.append("to", timeRange.to)

    const response = await fetch(`${API_BASE}/brain/satisfaction/${userId}?${params}`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get satisfaction metrics: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    // Return default metrics
    return {
      user_id: userId,
      overall_satisfaction: 85,
      interaction_quality: {
        helpful: 0,
        accurate: 0,
        relevant: 0,
        timely: 0,
      },
      feedback_summary: {
        positive_count: 0,
        negative_count: 0,
        themes: [],
      },
      improvement_areas: [],
    }
  }
}

/**
 * Record user feedback
 */
export async function recordFeedback(
  userId: string,
  feedback: {
    conversation_id?: string
    message_id?: string
    type: "positive" | "negative" | "suggestion"
    category: "accuracy" | "helpfulness" | "speed" | "relevance" | "other"
    comment?: string
    rating?: number // 1-5
  },
  signal?: AbortSignal
): Promise<{ feedback_id: string; impact: string }> {
  try {
    const response = await fetch(`${API_BASE}/brain/feedback`, {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({
        user_id: userId,
        ...feedback,
      }),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to record feedback: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to record feedback")
  }
}

/**
 * Get system adaptations for user
 */
export async function getSystemAdaptations(
  userId: string,
  options?: {
    type?: "behavior" | "preference" | "performance"
    active_only?: boolean
    limit?: number
  },
  signal?: AbortSignal
): Promise<SystemAdaptation[]> {
  try {
    const params = new URLSearchParams()
    if (options?.type) params.append("type", options.type)
    if (options?.active_only !== undefined) params.append("active_only", options.active_only.toString())
    if (options?.limit) params.append("limit", options.limit.toString())

    const response = await fetch(`${API_BASE}/brain/adaptations/${userId}?${params}`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get adaptations: ${response.statusText}`)
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
 * Get performance insights
 */
export async function getPerformanceInsights(
  userId: string,
  options?: {
    category?: "speed" | "accuracy" | "relevance" | "user_experience"
    severity?: "info" | "warning" | "critical"
    unresolved_only?: boolean
  },
  signal?: AbortSignal
): Promise<PerformanceInsight[]> {
  try {
    const params = new URLSearchParams()
    if (options?.category) params.append("category", options.category)
    if (options?.severity) params.append("severity", options.severity)
    if (options?.unresolved_only !== undefined) params.append("unresolved_only", options.unresolved_only.toString())

    const response = await fetch(`${API_BASE}/brain/insights/${userId}?${params}`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get insights: ${response.statusText}`)
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
 * Trigger system optimization
 */
export async function triggerOptimization(
  userId: string,
  target: "speed" | "accuracy" | "memory" | "all",
  signal?: AbortSignal
): Promise<{
  optimization_id: string
  status: "started" | "in_progress" | "completed"
  estimated_time: number
  improvements: string[]
}> {
  try {
    const response = await fetch(`${API_BASE}/brain/optimize`, {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({
        user_id: userId,
        target,
      }),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to trigger optimization: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to trigger optimization")
  }
}

/**
 * Get optimization status
 */
export async function getOptimizationStatus(
  userId: string,
  optimizationId: string,
  signal?: AbortSignal
): Promise<{
  optimization_id: string
  status: "in_progress" | "completed" | "failed"
  progress: number
  results?: {
    before: BrainHealthMetrics
    after: BrainHealthMetrics
    improvements: string[]
  }
  error?: string
}> {
  try {
    const response = await fetch(`${API_BASE}/brain/optimize/${optimizationId}`, {
      headers: getHeaders(userId),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to get optimization status: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to get optimization status")
  }
}

/**
 * Reindex memory for better performance
 */
export async function reindexMemory(
  userId: string,
  layers?: number[],
  signal?: AbortSignal
): Promise<{
  reindex_id: string
  status: "started" | "in_progress" | "completed"
  layers_affected: number[]
}> {
  try {
    const response = await fetch(`${API_BASE}/brain/memory/reindex`, {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({
        user_id: userId,
        layers: layers || [0, 1, 2, 3, 4, 5, 6], // All layers by default
      }),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to reindex memory: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    throw new Error("Failed to reindex memory")
  }
}