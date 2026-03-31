/**
 * API Validation using Zod
 * Ensures type safety between frontend and backend
 * SEC-008: JSON schema validation on all API inputs
 * SEC-024: Input sanitization for user inputs
 */
import { z } from "zod"

// ============================================
// INPUT SANITIZATION UTILITIES
// SEC-INPUT-R3: Upgraded with NFKC, invisible char stripping, bidi override removal
// ============================================

/**
 * SEC-INPUT-R3-001: Strip invisible Unicode characters that can bypass visual inspection.
 */
function stripInvisibleChars(s: string): string {
  return s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFFF9-\uFFFB\u180E\u00AD]/g, "")
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 * - NFKC normalization (prevents NFC/NFKC confusion attacks, fullwidth bypass)
 * - Trims whitespace
 * - Removes null bytes
 * - Strips control characters (except newlines for text areas)
 * - Strips invisible Unicode characters and bidi overrides
 */
export function sanitizeString(input: string, allowNewlines = false): string {
  let sanitized = stripInvisibleChars(
    input
      .normalize("NFKC")  // SEC-INPUT-R3: NFKC not NFC
      .trim()
      .replace(/\0/g, "") // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
  )

  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, " ")
  }

  return sanitized
}

/**
 * Sanitize email - NFKC normalize, lowercase, trim, strip invisible chars
 */
export function sanitizeEmail(email: string): string {
  return stripInvisibleChars(
    email.normalize("NFKC").trim().toLowerCase()
  )
}

// ============================================
// INPUT VALIDATION SCHEMAS (SEC-008)
// ============================================

// Login Request Schema
export const LoginRequestSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(254, "Email too long")
    .transform(sanitizeEmail),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password too long"),
})

// Registration Request Schema
// password is optional for sovereign-key (API-key-based) registration flows
export const RegisterRequestSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Name too long")
    // SEC-INPUT-R3: Normalize NFKC first so fullwidth chars collapse before regex check
    .transform((val) => val.normalize("NFKC"))
    // Allow letters (any language), spaces, hyphens, apostrophes
    .pipe(z.string().regex(/^[a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\s'-]+$/, "Name contains invalid characters"))
    .transform((val) => sanitizeString(val)),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(254, "Email too long")
    .transform(sanitizeEmail),
  password: z
    .string()
    // SEC-INPUT-R6: Raise password min from 8 to 12 to match backend enforcement.
    // Bypass payload: { password: "Abc12345" } → 8-char password accepted at frontend but
    // should be rejected to prevent inconsistency with backend's 12-char minimum.
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password too long")
    // SEC-AUTH-009: Enforce minimum password complexity at API level.
    // Client-side strength meter is advisory only; server must enforce.
    .refine(
      (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw),
      "Password must contain at least one lowercase letter, one uppercase letter, and one digit"
    )
    .optional(),
  // Optional fields from sovereign-key signup flow
  company: z
    .string()
    .max(200, "Company name too long")
    .transform((val) => sanitizeString(val))
    .optional(),
  tier: z
    .enum(["FREE", "PRO", "ENTERPRISE"])
    .optional(),
})

// Generic validation result type
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details: z.ZodIssue[] }

/**
 * Validate request body against a schema
 * Returns sanitized data on success, or error details on failure
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message || "Invalid input"
    return {
      success: false,
      error: firstError,
      details: result.error.issues,
    }
  }
  return { success: true, data: result.data }
}

// Email Verification Request Schema
export const EmailVerifyRequestSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(254, "Email too long")
    .transform(sanitizeEmail),
  code: z
    .string()
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be exactly 6 digits"),
})

// Type exports for request bodies
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>
export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequestSchema>

// Sovereignty Score Response Schema
export const SovereigntyScoreSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.string(),
  factors: z.array(z.object({
    name: z.string(),
    score: z.number().min(0).max(100),
    label: z.string(),
  })),
})

// Shard Distribution Response Schema
export const ShardDistributionSchema = z.object({
  nodes: z.array(z.object({
    node_id: z.string(),
    location: z.string(),
    shard_count: z.number().int().nonnegative(),
    status: z.enum(["active", "syncing", "offline"]),
  })),
  total_shards: z.number().int().nonnegative(),
})

// Vault Document Schema
export const VaultDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  doc_type: z.string(),
  language: z.string(),
  tags: z.array(z.string()),
  chunks_stored: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
})

// Chat Message Schema
// SEC-INPUT-R3: NFKC normalization + invisible char stripping + null byte removal
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string()
    .max(50000, "Content too long")
    .transform((val) => stripInvisibleChars(
      val.normalize("NFKC").replace(/\0/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    )),
})

// Billing Subscription Schema
export const SubscriptionSchema = z.object({
  tier: z.enum(["FREE", "PRO", "ENTERPRISE"]),
  status: z.enum(["active", "canceled", "past_due"]),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  priceUsd: z.number().nonnegative(),
  priceAed: z.number().nonnegative(),
})

// Generic validation helper
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  const result = schema.safeParse(data)
  if (!result.success) {
    // Invalid response - return null without logging
    return null
  }
  return result.data
}

// Type exports for use in components
export type ValidatedSovereigntyScore = z.infer<typeof SovereigntyScoreSchema>
export type ValidatedShardDistribution = z.infer<typeof ShardDistributionSchema>
export type ValidatedVaultDocument = z.infer<typeof VaultDocumentSchema>
export type ValidatedChatMessage = z.infer<typeof ChatMessageSchema>
export type ValidatedSubscription = z.infer<typeof SubscriptionSchema>
