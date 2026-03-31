/**
 * Creative API - AI-Powered Creative Tools
 *
 * This module provides access to advanced creative capabilities including
 * AI image generation, 3D model creation, document parsing with OCR,
 * and custom Replicate model execution.
 */

import { getHeaders as getCommonHeaders, resilientFetch, isAbortError } from "@/lib/api-common"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/proxy"

export interface ImageGenerationRequest {
  prompt: string
  negative_prompt?: string
  style?: "realistic" | "artistic" | "cartoon" | "sketch" | "oil_painting" | "watercolor"
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:2"
  quality?: "draft" | "standard" | "high"
  num_images?: number // 1-4
  seed?: number
}

export interface GeneratedImage {
  image_id: string
  url: string
  thumbnail_url: string
  prompt: string
  style: string
  created_at: string
  metadata: {
    width: number
    height: number
    seed: number
    model: string
  }
}

export interface Model3DGenerationRequest {
  prompt: string
  object_type?: "product" | "architecture" | "character" | "abstract" | "furniture"
  detail_level?: "low" | "medium" | "high"
  texture_style?: "realistic" | "stylized" | "minimal"
  file_format?: "glb" | "obj" | "fbx" | "usdz"
}

export interface Generated3DModel {
  model_id: string
  url: string
  preview_url: string
  format: string
  prompt: string
  created_at: string
  metadata: {
    vertices: number
    faces: number
    size_mb: number
    dimensions: {
      width: number
      height: number
      depth: number
    }
  }
}

export interface DocumentParseRequest {
  document_url?: string
  document_base64?: string
  file_type: "pdf" | "image" | "docx" | "xlsx"
  parse_options: {
    extract_text?: boolean
    extract_tables?: boolean
    extract_images?: boolean
    ocr_language?: string // ar, en, etc.
    preserve_formatting?: boolean
    page_range?: string // "1-5" or "1,3,5"
  }
}

export interface ParsedDocument {
  document_id: string
  status: "completed" | "processing" | "failed"
  pages: {
    page_number: number
    text: string
    tables?: Array<{
      table_id: string
      rows: string[][]
      headers?: string[]
    }>
    images?: Array<{
      image_id: string
      url: string
      caption?: string
      position: { x: number; y: number }
    }>
  }[]
  metadata: {
    total_pages: number
    word_count: number
    language: string
    confidence: number
  }
  extracted_data?: {
    dates?: string[]
    amounts?: { value: number; currency: string }[]
    emails?: string[]
    phone_numbers?: string[]
    addresses?: string[]
  }
}

export interface ReplicateModelRequest {
  model: string // e.g., "stability-ai/sdxl", "meta/llama-2-70b"
  version?: string
  input: Record<string, any>
  webhook?: string
  webhook_events?: string[]
}

export interface ReplicateModelResponse {
  prediction_id: string
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled"
  output?: any
  logs?: string
  error?: string
  metrics?: {
    predict_time?: number
  }
  urls?: {
    get: string
    cancel: string
  }
}

// Helper to get auth headers (wraps common function)
function getHeaders(userId?: string): HeadersInit {
  return getCommonHeaders(userId)
}

/**
 * Generate AI images
 */
export async function generateImage(
  request: ImageGenerationRequest,
  signal?: AbortSignal
): Promise<GeneratedImage[]> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/creative/generate-image`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(request),
        signal,
      },
      "creative-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return [
      {
        image_id: "img-demo-1",
        url: "https://images.unsplash.com/photo-1686061594434-59d16f77e4ff?w=1024",
        thumbnail_url: "https://images.unsplash.com/photo-1686061594434-59d16f77e4ff?w=256",
        prompt: request.prompt,
        style: request.style || "realistic",
        created_at: new Date().toISOString(),
        metadata: {
          width: 1024,
          height: 1024,
          seed: 12345,
          model: "stable-diffusion-xl",
        },
      },
    ]
  }
}

/**
 * Generate 3D models
 */
export async function generate3DModel(
  request: Model3DGenerationRequest,
  signal?: AbortSignal
): Promise<Generated3DModel> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/creative/generate-3d-model`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(request),
        signal,
      },
      "creative-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to generate 3D model: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      model_id: "3d-demo-1",
      url: "/demo/model.glb",
      preview_url: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=512",
      format: request.file_format || "glb",
      prompt: request.prompt,
      created_at: new Date().toISOString(),
      metadata: {
        vertices: 15420,
        faces: 10280,
        size_mb: 2.4,
        dimensions: {
          width: 100,
          height: 100,
          depth: 100,
        },
      },
    }
  }
}

/**
 * Parse documents with OCR
 */
export async function parseDocument(
  request: DocumentParseRequest,
  signal?: AbortSignal
): Promise<ParsedDocument> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/creative/parse-document`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(request),
        signal,
      },
      "creative-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to parse document: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo data
    return {
      document_id: "doc-demo-1",
      status: "completed",
      pages: [
        {
          page_number: 1,
          text: "This is a demo parsed document. The actual API would extract real text from your uploaded document using advanced OCR technology.",
          tables: [
            {
              table_id: "tbl-1",
              headers: ["Item", "Quantity", "Price"],
              rows: [
                ["Product A", "10", "$100"],
                ["Product B", "5", "$200"],
              ],
            },
          ],
        },
      ],
      metadata: {
        total_pages: 1,
        word_count: 25,
        language: "en",
        confidence: 0.95,
      },
      extracted_data: {
        amounts: [
          { value: 100, currency: "USD" },
          { value: 200, currency: "USD" },
        ],
      },
    }
  }
}

/**
 * Run custom Replicate models
 */
export async function runReplicateModel(
  request: ReplicateModelRequest,
  signal?: AbortSignal
): Promise<ReplicateModelResponse> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/creative/run-replicate`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(request),
        signal,
      },
      "creative-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to run Replicate model: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    // Return demo response
    return {
      prediction_id: "pred-demo-1",
      status: "succeeded",
      output: "Demo output from Replicate model",
      metrics: {
        predict_time: 2.5,
      },
      urls: {
        get: `${API_BASE}/creative/predictions/pred-demo-1`,
        cancel: `${API_BASE}/creative/predictions/pred-demo-1/cancel`,
      },
    }
  }
}

/**
 * Get prediction status
 */
export async function getPredictionStatus(
  predictionId: string,
  signal?: AbortSignal
): Promise<ReplicateModelResponse> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/creative/predictions/${predictionId}`,
      {
        headers: getHeaders(),
        signal,
      },
      "creative-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to get prediction status: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    return {
      prediction_id: predictionId,
      status: "succeeded",
      output: "Completed prediction",
    }
  }
}

/**
 * Cancel a running prediction
 */
export async function cancelPrediction(
  predictionId: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await resilientFetch(
      `${API_BASE}/creative/predictions/${predictionId}/cancel`,
      {
        method: "POST",
        headers: getHeaders(),
        signal,
      },
      "creative-api"
    )

    if (!response.ok) {
      throw new Error(`Failed to cancel prediction: ${response.statusText}`)
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error("Failed to cancel prediction")
  }
}