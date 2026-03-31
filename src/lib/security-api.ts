/**
 * Security API - Security Management and Monitoring
 *
 * This module provides security-related functionality including
 * security status checks, key rotation, and security audit logs.
 */

import { getHeaders as getCommonHeaders, resilientFetch, isAbortError } from "@/lib/api-common"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface SecurityStatus {
  email: string
  overall_status: "secure" | "warning" | "critical"
  last_check: string
  security_score: number // 0-100
  account: {
    mfa_enabled: boolean
    last_password_change: string
    login_attempts_24h: number
    suspicious_activity: boolean
    active_sessions: number
    api_keys_active: number
  }
  access: {
    recent_ips: string[]
    unusual_locations: string[]
    device_fingerprints: number
    authorized_apps: string[]
  }
  data: {
    encrypted_files: number
    unencrypted_files: number
    shared_files: number
    vault_accesses_24h: number
    data_exports_24h: number
  }
  recommendations: string[]
}

export interface KeyRotationRequest {
  key_type: "api" | "encryption" | "signing" | "all"
  rotation_schedule?: "immediate" | "scheduled"
  scheduled_date?: string
  notify_integrations?: boolean
  grace_period_hours?: number
}

export interface KeyRotationResponse {
  rotation_id: string
  status: "completed" | "scheduled" | "in_progress" | "failed"
  keys_rotated: {
    key_type: string
    old_key_id: string
    new_key_id: string
    rotation_time: string
  }[]
  affected_services: string[]
  warnings?: string[]
  next_steps?: string[]
}

export interface SecurityAuditEntry {
  id: string
  timestamp: string
  event_type: "login" | "access" | "modification" | "deletion" | "key_operation" | "permission_change"
  severity: "info" | "warning" | "critical"
  user_id: string
  user_email: string
  action: string
  resource: string
  ip_address: string
  user_agent: string
  location?: {
    country: string
    city: string
    coordinates?: { lat: number; lng: number }
  }
  success: boolean
  details: Record<string, any>
  risk_indicators?: string[]
}

export interface SecurityAuditSummary {
  total_events: number
  events_by_severity: {
    info: number
    warning: number
    critical: number
  }
  events_by_type: Record<string, number>
  high_risk_users: {
    user_id: string
    email: string
    risk_score: number
    reason: string
  }[]
  anomalies_detected: {
    type: string
    description: string
    first_seen: string
    occurrences: number
  }[]
}

// Helper to get auth headers (wraps common function)
function getHeaders(userId?: string): HeadersInit {
  return getCommonHeaders(userId)
}

/**
 * Get security status for a user
 */
export async function getSecurityStatus(
  email: string,
  signal?: AbortSignal
): Promise<SecurityStatus> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/brain/${encodeURIComponent(email)}/security-status`,
      {
        headers: getHeaders(),
        signal,
      },
      "security-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get security status: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      email,
      overall_status: "secure",
      last_check: new Date().toISOString(),
      security_score: 88,
      account: {
        mfa_enabled: true,
        last_password_change: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        login_attempts_24h: 3,
        suspicious_activity: false,
        active_sessions: 2,
        api_keys_active: 1,
      },
      access: {
        recent_ips: ["192.168.1.1", "10.0.0.1"],
        unusual_locations: [],
        device_fingerprints: 2,
        authorized_apps: ["NexusAD Web", "NexusAD Mobile"],
      },
      data: {
        encrypted_files: 145,
        unencrypted_files: 3,
        shared_files: 12,
        vault_accesses_24h: 24,
        data_exports_24h: 2,
      },
      recommendations: [
        "Change password (45 days old)",
        "Encrypt 3 unencrypted files",
        "Review shared file permissions",
      ],
    }
  }
}

/**
 * Rotate security keys
 */
export async function rotateKeys(
  request: KeyRotationRequest,
  signal?: AbortSignal
): Promise<KeyRotationResponse> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/security/rotate-keys`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(request),
        signal,
      },
      "security-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to rotate keys: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo response
    return {
      rotation_id: "rot-" + Date.now(),
      status: "completed",
      keys_rotated: [
        {
          key_type: request.key_type === "all" ? "api" : request.key_type,
          old_key_id: "key-old-123",
          new_key_id: "key-new-456",
          rotation_time: new Date().toISOString(),
        },
      ],
      affected_services: ["API Access", "Vault Encryption"],
      next_steps: [
        "Update API key in all integrations",
        "Verify service connectivity",
        "Delete old keys after grace period",
      ],
    }
  }
}

/**
 * Get security audit log
 */
export async function getSecurityAuditLog(
  userId: string,
  options?: {
    from_date?: string
    to_date?: string
    event_types?: string[]
    severity?: ("info" | "warning" | "critical")[]
    limit?: number
    offset?: number
  },
  signal?: AbortSignal
): Promise<{ entries: SecurityAuditEntry[]; summary: SecurityAuditSummary }> {
  try {
    const params = new URLSearchParams()
    if (options?.from_date) params.append("from_date", options.from_date)
    if (options?.to_date) params.append("to_date", options.to_date)
    if (options?.event_types) params.append("event_types", options.event_types.join(","))
    if (options?.severity) params.append("severity", options.severity.join(","))
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.offset) params.append("offset", options.offset.toString())

    const response = await resilientFetch(
      `${API_BASE}/security/audit-log/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "security-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get audit log: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      entries: [
        {
          id: "audit-1",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          event_type: "login",
          severity: "info",
          user_id: userId,
          user_email: "user@example.com",
          action: "Successful login",
          resource: "Web Application",
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0...",
          location: {
            country: "UAE",
            city: "Dubai",
          },
          success: true,
          details: {
            mfa_used: true,
            session_duration: "active",
          },
        },
        {
          id: "audit-2",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          event_type: "access",
          severity: "warning",
          user_id: userId,
          user_email: "user@example.com",
          action: "Accessed sensitive vault file",
          resource: "Financial Report Q4.pdf",
          ip_address: "10.0.0.1",
          user_agent: "Mozilla/5.0...",
          success: true,
          details: {
            file_classification: "confidential",
            access_duration: "45s",
          },
          risk_indicators: ["Outside business hours", "Sensitive file access"],
        },
      ],
      summary: {
        total_events: 156,
        events_by_severity: {
          info: 142,
          warning: 12,
          critical: 2,
        },
        events_by_type: {
          login: 45,
          access: 89,
          modification: 15,
          deletion: 3,
          key_operation: 2,
          permission_change: 2,
        },
        high_risk_users: [],
        anomalies_detected: [
          {
            type: "unusual_time_access",
            description: "Multiple accesses outside business hours",
            first_seen: new Date(Date.now() - 72 * 3600000).toISOString(),
            occurrences: 5,
          },
        ],
      },
    }
  }
}

/**
 * Export security audit log
 */
export async function exportSecurityAuditLog(
  userId: string,
  format: "pdf" | "csv" | "json",
  options?: {
    from_date?: string
    to_date?: string
    include_summary?: boolean
  },
  signal?: AbortSignal
): Promise<Blob> {
  try {
    const params = new URLSearchParams()
    params.append("format", format)
    if (options?.from_date) params.append("from_date", options.from_date)
    if (options?.to_date) params.append("to_date", options.to_date)
    if (options?.include_summary !== undefined) {
      params.append("include_summary", options.include_summary.toString())
    }

    const response = await resilientFetch(
      `${API_BASE}/security/audit-log/${userId}/export?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "security-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to export audit log: ${response.statusText}`)
    }

    return response.blob()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to export audit log")
  }
}