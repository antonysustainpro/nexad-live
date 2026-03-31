/**
 * Intelligence API - Business Intelligence Dashboard
 *
 * This module provides access to competitive intelligence, market data,
 * and UAE-specific regulatory and economic information. Core value
 * proposition for executive decision-making.
 */

import { getHeaders as getCommonHeaders, resilientFetch, isAbortError } from "@/lib/api-common"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface CompetitorAnalysis {
  competitor_id: string
  name: string
  sector: string
  market_share: number
  recent_activities: {
    date: string
    type: "acquisition" | "expansion" | "product_launch" | "partnership"
    description: string
    impact_score: number
  }[]
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  financial_metrics?: {
    revenue?: number
    growth_rate?: number
    market_cap?: number
  }
}

export interface MarketIntelligence {
  sector: string
  market_size: number
  growth_rate: number
  key_trends: {
    trend: string
    impact: "positive" | "negative" | "neutral"
    timeframe: string
  }[]
  regulatory_changes: {
    date: string
    regulation: string
    impact: string
  }[]
  opportunities: {
    opportunity: string
    potential_value: number
    time_to_capture: string
    requirements: string[]
  }[]
}

export interface UAECPIData {
  date: string
  overall_cpi: number
  yoy_change: number
  mom_change: number
  categories: {
    category: string
    weight: number
    index: number
    change: number
  }[]
  forecast: {
    next_quarter: number
    next_year: number
    confidence: number
  }
}

export interface UAERegulation {
  regulation_id: string
  title: string
  authority: string
  effective_date: string
  sectors_affected: string[]
  summary: string
  full_text_url?: string
  compliance_deadline?: string
  penalties?: {
    type: string
    amount: string
  }[]
  key_requirements: string[]
  impact_assessment: {
    cost: "low" | "medium" | "high"
    complexity: "low" | "medium" | "high"
    urgency: "low" | "medium" | "high"
  }
}

export interface UAERealEstateData {
  location: string
  property_type: "residential" | "commercial" | "industrial"
  avg_price_sqft: number
  yoy_change: number
  mom_change: number
  supply: {
    current: number
    upcoming: number
    absorption_rate: number
  }
  demand_indicators: {
    occupancy_rate: number
    rental_yield: number
    transaction_volume: number
  }
  forecast: {
    next_quarter: number
    next_year: number
    drivers: string[]
  }
}

export interface IntelligenceSearchResult {
  type: "competitor" | "market" | "regulation" | "real_estate" | "economic"
  relevance: number
  title: string
  summary: string
  source: string
  date: string
  data: any
}

// Helper to get auth headers (wraps common function)
function getHeaders(userId?: string): HeadersInit {
  return getCommonHeaders(userId)
}

/**
 * Get competitor analysis for a specific user's industry
 */
export async function getCompetitorAnalysis(
  userId: string,
  options?: {
    sector?: string
    limit?: number
    include_financials?: boolean
  },
  signal?: AbortSignal
): Promise<CompetitorAnalysis[]> {
  try {
    const params = new URLSearchParams()
    if (options?.sector) params.append("sector", options.sector)
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.include_financials !== undefined) {
      params.append("include_financials", options.include_financials.toString())
    }

    const response = await resilientFetch(
      `${API_BASE}/intelligence/competitors/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "intelligence-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get competitor analysis: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data for development
    return [
      {
        competitor_id: "comp-1",
        name: "Emirates NBD",
        sector: "Banking",
        market_share: 15.5,
        recent_activities: [
          {
            date: new Date().toISOString(),
            type: "expansion",
            description: "Launched new digital banking platform",
            impact_score: 8,
          },
        ],
        strengths: ["Strong digital presence", "Large customer base"],
        weaknesses: ["High operational costs"],
        opportunities: ["Fintech partnerships"],
        threats: ["New digital-only banks"],
        financial_metrics: {
          revenue: 2500000000,
          growth_rate: 7.5,
          market_cap: 15000000000,
        },
      },
    ]
  }
}

/**
 * Get market intelligence data
 */
export async function getMarketData(
  userId: string,
  options?: {
    sectors?: string[]
    timeframe?: "daily" | "weekly" | "monthly" | "quarterly"
  },
  signal?: AbortSignal
): Promise<MarketIntelligence[]> {
  try {
    const params = new URLSearchParams()
    if (options?.sectors) params.append("sectors", options.sectors.join(","))
    if (options?.timeframe) params.append("timeframe", options.timeframe)

    const response = await resilientFetch(
      `${API_BASE}/intelligence/market-data/${userId}?${params}`,
      {
        headers: getHeaders(userId),
        signal,
      },
      "intelligence-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get market data: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return [
      {
        sector: "Technology",
        market_size: 45000000000,
        growth_rate: 12.5,
        key_trends: [
          {
            trend: "AI adoption accelerating",
            impact: "positive",
            timeframe: "2024-2026",
          },
          {
            trend: "Cybersecurity investment surge",
            impact: "positive",
            timeframe: "Ongoing",
          },
        ],
        regulatory_changes: [],
        opportunities: [
          {
            opportunity: "Government digital transformation",
            potential_value: 500000000,
            time_to_capture: "6-12 months",
            requirements: ["Local partnerships", "Security certifications"],
          },
        ],
      },
    ]
  }
}

/**
 * Get UAE Consumer Price Index data
 */
export async function getUAECPI(signal?: AbortSignal): Promise<UAECPIData> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/intelligence/uae-cpi`,
      {
        headers: getHeaders(),
        signal,
      },
      "intelligence-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get CPI data: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      date: new Date().toISOString(),
      overall_cpi: 112.3,
      yoy_change: 2.8,
      mom_change: 0.3,
      categories: [
        {
          category: "Food & Beverages",
          weight: 0.14,
          index: 115.2,
          change: 3.5,
        },
        {
          category: "Housing & Utilities",
          weight: 0.34,
          index: 108.9,
          change: 1.8,
        },
      ],
      forecast: {
        next_quarter: 113.1,
        next_year: 115.5,
        confidence: 0.85,
      },
    }
  }
}

/**
 * Get UAE regulatory updates
 */
export async function getUAERegulations(
  options?: {
    sectors?: string[]
    from_date?: string
    compliance_status?: "upcoming" | "active" | "all"
  },
  signal?: AbortSignal
): Promise<UAERegulation[]> {
  try {
    const params = new URLSearchParams()
    if (options?.sectors) params.append("sectors", options.sectors.join(","))
    if (options?.from_date) params.append("from_date", options.from_date)
    if (options?.compliance_status) params.append("status", options.compliance_status)

    const response = await resilientFetch(
      `${API_BASE}/intelligence/uae-regulations?${params}`,
      {
        headers: getHeaders(),
        signal,
      },
      "intelligence-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get regulations: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return [
      {
        regulation_id: "reg-2024-001",
        title: "UAE Data Protection Law",
        authority: "UAE Data Office",
        effective_date: "2024-01-01",
        sectors_affected: ["All"],
        summary: "Comprehensive data protection requirements for all businesses",
        compliance_deadline: "2024-06-30",
        key_requirements: [
          "Appoint a Data Protection Officer",
          "Conduct data protection impact assessments",
          "Implement data breach notification procedures",
        ],
        impact_assessment: {
          cost: "medium",
          complexity: "high",
          urgency: "high",
        },
      },
    ]
  }
}

/**
 * Get UAE real estate market data
 */
export async function getUAERealEstate(
  options?: {
    locations?: string[]
    property_types?: ("residential" | "commercial" | "industrial")[]
  },
  signal?: AbortSignal
): Promise<UAERealEstateData[]> {
  try {
    const params = new URLSearchParams()
    if (options?.locations) params.append("locations", options.locations.join(","))
    if (options?.property_types) params.append("types", options.property_types.join(","))

    const response = await resilientFetch(
      `${API_BASE}/intelligence/uae-realestate?${params}`,
      {
        headers: getHeaders(),
        signal,
      },
      "intelligence-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get real estate data: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return [
      {
        location: "Dubai Marina",
        property_type: "residential",
        avg_price_sqft: 1450,
        yoy_change: 8.5,
        mom_change: 1.2,
        supply: {
          current: 15000,
          upcoming: 3500,
          absorption_rate: 0.85,
        },
        demand_indicators: {
          occupancy_rate: 0.92,
          rental_yield: 6.5,
          transaction_volume: 450,
        },
        forecast: {
          next_quarter: 1480,
          next_year: 1550,
          drivers: ["Expo 2020 legacy", "Foreign investment growth"],
        },
      },
    ]
  }
}

/**
 * Search across all intelligence sources
 */
export async function searchIntelligence(
  query: string,
  options?: {
    types?: ("competitor" | "market" | "regulation" | "real_estate" | "economic")[]
    date_from?: string
    date_to?: string
    limit?: number
  },
  signal?: AbortSignal
): Promise<IntelligenceSearchResult[]> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/intelligence/search`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          query,
          ...options,
        }),
        signal,
      },
      "intelligence-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to search intelligence: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    return []
  }
}