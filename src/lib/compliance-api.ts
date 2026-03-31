/**
 * Compliance API - Enterprise Compliance Center
 *
 * This module provides comprehensive compliance management including
 * audit trails, certificates, data handling reports, retention policies,
 * and compliance tracking. Essential for enterprise requirements.
 */

import { getHeaders as getCommonHeaders, resilientFetch, isAbortError } from "@/lib/api-common"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface AuditEntry {
  id: string
  timestamp: string
  user_id: string
  user_name: string
  action: string
  resource_type: string
  resource_id: string
  ip_address: string
  user_agent: string
  status: "success" | "failure"
  details?: Record<string, any>
  risk_level: "low" | "medium" | "high"
}

export interface ComplianceCertificate {
  cert_id: string
  type: "soc2" | "iso27001" | "gdpr" | "pci" | "hipaa" | "custom"
  issued_date: string
  expiry_date: string
  status: "active" | "expired" | "pending"
  issuer: string
  scope: string[]
  verification_url?: string
  document_hash: string
}

export interface DataHandlingReport {
  report_id: string
  generated_at: string
  period_start: string
  period_end: string
  data_categories: {
    category: string
    volume: number
    retention_days: number
    encryption: boolean
    anonymized: boolean
  }[]
  processing_activities: {
    activity: string
    purpose: string
    legal_basis: string
    recipients: string[]
  }[]
  security_measures: string[]
  incidents: number
  data_requests: {
    type: "access" | "deletion" | "portability" | "correction"
    count: number
    avg_completion_days: number
  }[]
}

export interface RetentionPolicy {
  policy_id: string
  name: string
  data_type: string
  retention_period_days: number
  deletion_method: "soft" | "hard" | "anonymize"
  legal_requirement?: string
  auto_apply: boolean
  exceptions?: {
    condition: string
    action: string
  }[]
  last_applied?: string
  affected_records?: number
}

export interface CostBreakdown {
  period: string
  total_cost: number
  currency: string
  categories: {
    category: string
    cost: number
    percentage: number
    trend: "up" | "down" | "stable"
  }[]
  compliance_costs: {
    standard: string
    cost: number
    activities: {
      activity: string
      cost: number
    }[]
  }[]
  optimization_suggestions: string[]
}

export interface ComplianceSummary {
  overall_score: number // 0-100
  last_updated: string
  standards: {
    standard: string
    status: "compliant" | "partial" | "non-compliant"
    score: number
    last_audit: string
    issues: number
    critical_issues: number
  }[]
  risk_areas: {
    area: string
    risk_level: "low" | "medium" | "high" | "critical"
    description: string
    remediation: string
  }[]
  upcoming_deadlines: {
    deadline: string
    requirement: string
    days_remaining: number
  }[]
}

export interface ComplianceAcknowledgment {
  ack_id: string
  policy_id: string
  policy_name: string
  user_id: string
  acknowledged_at: string
  ip_address: string
  signature?: string
  version: string
}

// Helper to get auth headers
// Helper to get auth headers (wraps common function)
function getHeaders(userId?: string): HeadersInit {
  return getCommonHeaders(userId)
}

/**
 * Get audit trail for a user
 */
export async function getAuditTrail(
  userId: string,
  options?: {
    from_date?: string
    to_date?: string
    action_types?: string[]
    resource_types?: string[]
    limit?: number
    offset?: number
  },
  signal?: AbortSignal
): Promise<{ entries: AuditEntry[]; total: number }> {
  try {
    const params = new URLSearchParams()
    if (options?.from_date) params.append("from_date", options.from_date)
    if (options?.to_date) params.append("to_date", options.to_date)
    if (options?.action_types) params.append("actions", options.action_types.join(","))
    if (options?.resource_types) params.append("resources", options.resource_types.join(","))
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.offset) params.append("offset", options.offset.toString())

    const response = await resilientFetch(
      `${API_BASE}/compliance/audit-trail/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get audit trail: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    return { entries: [], total: 0 }
  }
}

/**
 * Download audit trail as PDF
 */
export async function downloadAuditTrail(
  userId: string,
  options?: {
    from_date?: string
    to_date?: string
    format?: "pdf" | "csv" | "json"
  },
  signal?: AbortSignal
): Promise<Blob> {
  try {
    const params = new URLSearchParams()
    if (options?.from_date) params.append("from_date", options.from_date)
    if (options?.to_date) params.append("to_date", options.to_date)
    params.append("format", options?.format || "pdf")

    const response = await resilientFetch(
      `${API_BASE}/compliance/audit-trail/${userId}/download?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to download audit trail: ${response.statusText}`)
    }

    return response.blob()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to download audit trail")
  }
}

/**
 * Request a compliance certificate
 */
export async function requestCertificate(
  type: string,
  scope: string[],
  signal?: AbortSignal
): Promise<{ request_id: string; estimated_completion: string }> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/request-certificate`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ type, scope }),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to request certificate: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to request certificate")
  }
}

/**
 * Download a compliance certificate
 */
export async function downloadCertificate(
  certId: string,
  signal?: AbortSignal
): Promise<Blob> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/certificates/${certId}/download`,
      {
        headers: getHeaders(),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to download certificate: ${response.statusText}`)
    }

    return response.blob()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to download certificate")
  }
}

/**
 * Get list of compliance certificates
 */
export async function getCertificates(
  userId: string,
  options?: {
    status?: "active" | "expired" | "all"
    type?: string
  },
  signal?: AbortSignal
): Promise<ComplianceCertificate[]> {
  try {
    const params = new URLSearchParams()
    if (options?.status) params.append("status", options.status)
    if (options?.type) params.append("type", options.type)

    const response = await resilientFetch(
      `${API_BASE}/compliance/certificates/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get certificates: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return [
      {
        cert_id: "cert-001",
        type: "soc2",
        issued_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        issuer: "Certified Compliance Authority",
        scope: ["Data Security", "Availability", "Processing Integrity"],
        document_hash: "a7b9c2d4e5f6...",
      },
    ]
  }
}

/**
 * Generate data handling report
 */
export async function generateDataHandlingReport(
  period_start: string,
  period_end: string,
  categories?: string[],
  signal?: AbortSignal
): Promise<DataHandlingReport> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/data-handling-report`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          period_start,
          period_end,
          categories,
        }),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to generate data handling report")
  }
}

/**
 * Get retention policies
 */
export async function getRetentionPolicies(
  options?: {
    data_type?: string
    active_only?: boolean
  },
  signal?: AbortSignal
): Promise<RetentionPolicy[]> {
  try {
    const params = new URLSearchParams()
    if (options?.data_type) params.append("data_type", options.data_type)
    if (options?.active_only !== undefined) {
      params.append("active_only", options.active_only.toString())
    }

    const response = await resilientFetch(
      `${API_BASE}/compliance/retention-policies?${params}`,
      {
        headers: getHeaders(),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get retention policies: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    return []
  }
}

/**
 * Apply retention policy
 */
export async function applyRetentionPolicy(
  policy_id: string,
  options?: {
    dry_run?: boolean
    force?: boolean
  },
  signal?: AbortSignal
): Promise<{
  policy_id: string
  affected_records: number
  deleted_records: number
  status: "completed" | "partial" | "failed"
  errors?: string[]
}> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/retention-apply`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          policy_id,
          ...options,
        }),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to apply retention policy: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to apply retention policy")
  }
}

/**
 * Get compliance cost breakdown
 */
export async function getCostBreakdown(
  userId: string,
  options?: {
    period?: "monthly" | "quarterly" | "yearly"
    include_forecast?: boolean
  },
  signal?: AbortSignal
): Promise<CostBreakdown> {
  try {
    const params = new URLSearchParams()
    if (options?.period) params.append("period", options.period)
    if (options?.include_forecast !== undefined) {
      params.append("include_forecast", options.include_forecast.toString())
    }

    const response = await resilientFetch(
      `${API_BASE}/compliance/cost-breakdown/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get cost breakdown: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      period: "monthly",
      total_cost: 15000,
      currency: "AED",
      categories: [
        { category: "Audit & Monitoring", cost: 5000, percentage: 33, trend: "stable" },
        { category: "Data Security", cost: 4000, percentage: 27, trend: "up" },
        { category: "Training & Awareness", cost: 3000, percentage: 20, trend: "stable" },
        { category: "External Assessments", cost: 3000, percentage: 20, trend: "down" },
      ],
      compliance_costs: [
        {
          standard: "SOC2",
          cost: 8000,
          activities: [
            { activity: "Annual Audit", cost: 5000 },
            { activity: "Continuous Monitoring", cost: 3000 },
          ],
        },
      ],
      optimization_suggestions: [
        "Automate compliance monitoring to reduce manual audit costs",
        "Implement integrated GRC platform",
      ],
    }
  }
}

/**
 * Get compliance summary
 */
export async function getComplianceSummary(
  userId: string,
  signal?: AbortSignal
): Promise<ComplianceSummary> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/summary/${userId}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get compliance summary: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      overall_score: 87,
      last_updated: new Date().toISOString(),
      standards: [
        {
          standard: "SOC2 Type II",
          status: "compliant",
          score: 92,
          last_audit: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          issues: 3,
          critical_issues: 0,
        },
        {
          standard: "ISO 27001",
          status: "partial",
          score: 78,
          last_audit: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          issues: 8,
          critical_issues: 2,
        },
      ],
      risk_areas: [
        {
          area: "Access Control",
          risk_level: "medium",
          description: "Privileged access management needs improvement",
          remediation: "Implement PAM solution and regular access reviews",
        },
      ],
      upcoming_deadlines: [
        {
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          requirement: "Annual SOC2 audit",
          days_remaining: 30,
        },
      ],
    }
  }
}

/**
 * Acknowledge compliance policy
 */
export async function acknowledgePolicy(
  policy_id: string,
  version: string,
  signature?: string,
  signal?: AbortSignal
): Promise<ComplianceAcknowledgment> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/acknowledge`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          policy_id,
          version,
          signature,
        }),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to acknowledge policy: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to acknowledge policy")
  }
}

/**
 * Get compliance acknowledgments
 */
export async function getAcknowledgments(
  userId: string,
  options?: {
    policy_id?: string
    from_date?: string
  },
  signal?: AbortSignal
): Promise<ComplianceAcknowledgment[]> {
  try {
    const params = new URLSearchParams()
    if (options?.policy_id) params.append("policy_id", options.policy_id)
    if (options?.from_date) params.append("from_date", options.from_date)

    const response = await resilientFetch(
      `${API_BASE}/compliance/acknowledgments/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get acknowledgments: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    return []
  }
}

/**
 * Export all compliance data
 */
export async function exportComplianceData(
  options?: {
    include_audit?: boolean
    include_certificates?: boolean
    include_policies?: boolean
    format?: "json" | "csv" | "zip"
  },
  signal?: AbortSignal
): Promise<Blob> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/compliance/export-compliance-data`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(options || {}),
        signal,
      },
      "compliance-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to export compliance data: ${response.statusText}`)
    }

    return response.blob()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to export compliance data")
  }
}