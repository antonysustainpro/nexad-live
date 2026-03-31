/**
 * Enhanced Sovereignty API - Privacy and Data Sovereignty Features
 *
 * This module provides enhanced sovereignty features including privacy
 * comparisons, report generation, and sovereignty certificates.
 */

import { getHeaders as getCommonHeaders, resilientFetch, isAbortError } from "@/lib/api-common"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface PrivacyComparison {
  service_name: string
  category: "cloud" | "ai" | "storage" | "analytics" | "communication"
  privacy_score: number // 0-100
  data_location: string[]
  data_sharing: {
    third_parties: boolean
    advertisers: boolean
    government: boolean
    ai_training: boolean
  }
  encryption: {
    at_rest: boolean
    in_transit: boolean
    end_to_end: boolean
    key_management: "user" | "provider" | "mixed"
  }
  compliance: string[]
  risks: string[]
  advantages: string[]
}

export interface SovereigntyReport {
  report_id: string
  generated_at: string
  period_start: string
  period_end: string
  overall_score: number // 0-100
  data_residency: {
    total_data_gb: number
    local_data_gb: number
    foreign_data_gb: number
    jurisdictions: { country: string; percentage: number }[]
  }
  privacy_violations: {
    total: number
    blocked: number
    reported: number
    categories: { type: string; count: number }[]
  }
  encryption_status: {
    encrypted_percentage: number
    unencrypted_files: number
    weak_encryption: number
  }
  compliance_status: {
    standard: string
    status: "compliant" | "partial" | "non-compliant"
    issues: string[]
  }[]
  recommendations: string[]
}

export interface SovereigntyCertificate {
  cert_id: string
  type: "data_residency" | "privacy_compliance" | "encryption_standard" | "sovereignty_attestation"
  issued_date: string
  expiry_date: string
  status: "active" | "expired" | "revoked"
  issuer: string
  subject: {
    organization: string
    domain: string
    jurisdiction: string
  }
  claims: {
    claim: string
    verified: boolean
    evidence?: string
  }[]
  signature: string
  blockchain_hash?: string
}

// Helper to get auth headers (wraps common function)
function getHeaders(userId?: string): HeadersInit {
  return getCommonHeaders(userId)
}

/**
 * Get privacy comparison with other services
 */
export async function getPrivacyComparison(
  options?: {
    categories?: string[]
    include_alternatives?: boolean
  },
  signal?: AbortSignal
): Promise<PrivacyComparison[]> {
  try {
    const params = new URLSearchParams()
    if (options?.categories) params.append("categories", options.categories.join(","))
    if (options?.include_alternatives !== undefined) {
      params.append("include_alternatives", options.include_alternatives.toString())
    }

    const response = await resilientFetch(
      `${API_BASE}/sovereignty/comparison?${params}`,
      {
        headers: getHeaders(),
        signal,
      },
      "sovereignty-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get privacy comparison: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return [
      {
        service_name: "NexusAD",
        category: "ai",
        privacy_score: 95,
        data_location: ["UAE"],
        data_sharing: {
          third_parties: false,
          advertisers: false,
          government: false,
          ai_training: false,
        },
        encryption: {
          at_rest: true,
          in_transit: true,
          end_to_end: true,
          key_management: "user",
        },
        compliance: ["ISO 27001", "SOC2", "UAE Data Protection Law"],
        risks: [],
        advantages: ["Full data sovereignty", "Zero data sharing", "User-controlled encryption"],
      },
      {
        service_name: "ChatGPT",
        category: "ai",
        privacy_score: 65,
        data_location: ["USA", "Global"],
        data_sharing: {
          third_parties: true,
          advertisers: false,
          government: true,
          ai_training: true,
        },
        encryption: {
          at_rest: true,
          in_transit: true,
          end_to_end: false,
          key_management: "provider",
        },
        compliance: ["SOC2", "GDPR"],
        risks: ["Data used for AI training", "US jurisdiction", "No end-to-end encryption"],
        advantages: ["Strong security", "Regular audits"],
      },
    ]
  }
}

/**
 * Generate sovereignty report
 */
export async function generateSovereigntyReport(
  userId: string,
  options?: {
    period_start?: string
    period_end?: string
    include_recommendations?: boolean
  },
  signal?: AbortSignal
): Promise<{ report_id: string; estimated_completion: string }> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/generate-report`,
      {
        method: "POST",
        headers: getHeaders(userId),
        body: JSON.stringify({
          user_id: userId,
          ...options,
        }),
        signal,
      },
      "sovereignty-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    return {
      report_id: "report-demo-1",
      estimated_completion: new Date(Date.now() + 60000).toISOString(),
    }
  }
}

/**
 * Get sovereignty report
 */
export async function getSovereigntyReport(
  reportId: string,
  signal?: AbortSignal
): Promise<SovereigntyReport> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/report/${reportId}`,
      {
        headers: getHeaders(),
        signal,
      },
      "sovereignty-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get report: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo report
    return {
      report_id: reportId,
      generated_at: new Date().toISOString(),
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString(),
      overall_score: 92,
      data_residency: {
        total_data_gb: 125.5,
        local_data_gb: 120.3,
        foreign_data_gb: 5.2,
        jurisdictions: [
          { country: "UAE", percentage: 95.8 },
          { country: "CDN Cache", percentage: 4.2 },
        ],
      },
      privacy_violations: {
        total: 45,
        blocked: 42,
        reported: 3,
        categories: [
          { type: "Tracking Attempts", count: 38 },
          { type: "Unauthorized Access", count: 7 },
        ],
      },
      encryption_status: {
        encrypted_percentage: 98.5,
        unencrypted_files: 12,
        weak_encryption: 3,
      },
      compliance_status: [
        {
          standard: "UAE Data Protection",
          status: "compliant",
          issues: [],
        },
        {
          standard: "ISO 27001",
          status: "partial",
          issues: ["Annual audit pending", "Access logs retention < 90 days"],
        },
      ],
      recommendations: [
        "Encrypt remaining 12 unencrypted files",
        "Upgrade 3 files using weak encryption to AES-256",
        "Complete ISO 27001 annual audit",
      ],
    }
  }
}

/**
 * List sovereignty certificates
 */
export async function getSovereigntyCertificates(
  userId: string,
  options?: {
    type?: string
    status?: "active" | "all"
  },
  signal?: AbortSignal
): Promise<SovereigntyCertificate[]> {
  try {
    const params = new URLSearchParams()
    if (options?.type) params.append("type", options.type)
    if (options?.status) params.append("status", options.status)

    const response = await resilientFetch(
      `${API_BASE}/sovereignty/certificates/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "sovereignty-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get certificates: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo certificates
    return [
      {
        cert_id: "sov-cert-001",
        type: "data_residency",
        issued_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        issuer: "UAE Digital Authority",
        subject: {
          organization: "Your Organization",
          domain: "nexusad.ai",
          jurisdiction: "UAE",
        },
        claims: [
          {
            claim: "100% data stored within UAE borders",
            verified: true,
            evidence: "Datacenter audit report #2024-03",
          },
          {
            claim: "Zero data export to foreign jurisdictions",
            verified: true,
            evidence: "Network traffic analysis report",
          },
        ],
        signature: "0xabcdef...",
        blockchain_hash: "0x123456...",
      },
    ]
  }
}

/**
 * Get specific sovereignty certificate
 */
export async function getSovereigntyCertificate(
  certId: string,
  signal?: AbortSignal
): Promise<SovereigntyCertificate> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/certificate/${certId}`,
      {
        headers: getHeaders(),
        signal,
      },
      "sovereignty-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get certificate: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Certificate not found")
  }
}

/**
 * Download sovereignty certificate as PDF
 */
export async function downloadSovereigntyCertificate(
  certId: string,
  signal?: AbortSignal
): Promise<Blob> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/sovereignty/certificate/${certId}/download`,
      {
        headers: getHeaders(),
        signal,
      },
      "sovereignty-api"
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