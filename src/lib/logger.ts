/**
 * Secure Logger with Comprehensive PII Redaction
 *
 * This logger automatically redacts Personally Identifiable Information (PII)
 * from all log messages to comply with UAE PDPL and data protection regulations.
 *
 * REL-014 Fix: Implements log redaction policy
 * SEC-001: PII redaction applies to ALL environments (not just dev)
 * SEC-002: Pattern evasion prevention (normalization, homoglyphs, base64)
 * SEC-003: Structured data redaction for JSON objects
 */

// PII-001: Sensitive JSON field names that should always be redacted
const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'apikey',
  'privateKey',
  'private_key',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'creditCard',
  'credit_card',
  'creditCardNumber',
  'credit_card_number',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'email',
  'emailAddress',
  'email_address',
  'phone',
  'phoneNumber',
  'phone_number',
  'mobile',
  'mobileNumber',
  'mobile_number',
  'emiratesId',
  'emirates_id',
  'uaeId',
  'uae_id',
  'passport',
  'passportNumber',
  'passport_number',
  'iban',
  'bankAccount',
  'bank_account',
  'accountNumber',
  'account_number',
  'dob',
  'dateOfBirth',
  'date_of_birth',
  'birthDate',
  'birth_date',
  'ipAddress',
  'ip_address',
  'authorization',
  'auth',
  'bearer',
  'jwt',
  'sessionId',
  'session_id',
  'cookie',
  'cookies',
])

// SEC-004: Unicode homoglyph mappings for evasion detection
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic lookalikes
  '\u0430': 'a', // а -> a
  '\u0435': 'e', // е -> e
  '\u043E': 'o', // о -> o
  '\u0440': 'p', // р -> p
  '\u0441': 'c', // с -> c
  '\u0445': 'x', // х -> x
  '\u0443': 'y', // у -> y
  // Greek lookalikes
  '\u03B1': 'a', // α -> a
  '\u03B5': 'e', // ε -> e
  '\u03BF': 'o', // ο -> o
  // Special characters
  '\u2010': '-', // Hyphen
  '\u2011': '-', // Non-breaking hyphen
  '\u2012': '-', // Figure dash
  '\u2013': '-', // En dash
  '\u2014': '-', // Em dash
  '\u2212': '-', // Minus sign
  '\uFF0D': '-', // Fullwidth hyphen-minus
  '\u00A0': ' ', // Non-breaking space
  '\u2003': ' ', // Em space
  '\u2002': ' ', // En space
  '\u2009': ' ', // Thin space
  '\u200A': ' ', // Hair space
  '\u200B': '', // Zero-width space
  '\u200C': '', // Zero-width non-joiner
  '\u200D': '', // Zero-width joiner
  '\uFEFF': '', // Zero-width no-break space (BOM)
  // Fullwidth digits
  '\uFF10': '0',
  '\uFF11': '1',
  '\uFF12': '2',
  '\uFF13': '3',
  '\uFF14': '4',
  '\uFF15': '5',
  '\uFF16': '6',
  '\uFF17': '7',
  '\uFF18': '8',
  '\uFF19': '9',
}

// PII-002: Comprehensive PII patterns to redact
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; name: string }> = [
  // PII-003: Email addresses (comprehensive)
  {
    pattern: /[a-zA-Z0-9._%+\-!#$&'*/=?^`{|}~]+@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/gi,
    replacement: '[EMAIL_REDACTED]',
    name: 'email',
  },

  // PII-004: UAE Emirates ID - All formats
  // Format: 784-YYYY-NNNNNNN-C (standard with dashes)
  { pattern: /784-\d{4}-\d{7}-\d/g, replacement: '[UAE_ID_REDACTED]', name: 'uae_id_dashed' },
  // Format: 784YYYYNNNNNNNC (no dashes, 15 digits)
  { pattern: /\b784\d{12}\b/g, replacement: '[UAE_ID_REDACTED]', name: 'uae_id_nodash' },
  // Format with spaces: 784 YYYY NNNNNNN C
  { pattern: /784\s+\d{4}\s+\d{7}\s+\d/g, replacement: '[UAE_ID_REDACTED]', name: 'uae_id_spaced' },

  // PII-005: Passport numbers - UAE and international
  // UAE passport: starts with letter, 7 digits
  { pattern: /\b[A-Z]\d{7}\b/gi, replacement: '[PASSPORT_REDACTED]', name: 'uae_passport' },
  // US passport: 9 digits or 2 letters + 7 digits
  { pattern: /\b[A-Z]{2}\d{7}\b/gi, replacement: '[PASSPORT_REDACTED]', name: 'us_passport_new' },
  { pattern: /\b\d{9}\b/g, replacement: '[PASSPORT_REDACTED]', name: 'us_passport' },
  // UK passport: 9 digits
  { pattern: /\bGBR\d{9}\b/gi, replacement: '[PASSPORT_REDACTED]', name: 'uk_passport' },
  // Generic passport format (letter + 6-9 alphanumeric)
  {
    pattern: /\b(?:passport|PASSPORT)[:\s#]*[A-Z0-9]{6,9}\b/gi,
    replacement: '[PASSPORT_REDACTED]',
    name: 'generic_passport',
  },

  // PII-006: IBAN - UAE format (AE + 2 check digits + 3 bank code + 16 account)
  // Total: 23 characters for UAE
  { pattern: /\bAE\d{2}\s?\d{3}\s?\d{16}\b/gi, replacement: '[IBAN_REDACTED]', name: 'uae_iban' },
  { pattern: /\bAE\d{21}\b/gi, replacement: '[IBAN_REDACTED]', name: 'uae_iban_nodash' },
  // International IBAN (2 letters + 2 check + up to 30 alphanumeric)
  {
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
    replacement: '[IBAN_REDACTED]',
    name: 'international_iban',
  },

  // PII-007: Credit card numbers (with Luhn validation handled separately)
  // Visa, Mastercard, Amex, Discover patterns
  {
    pattern: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|6(?:011|5[0-9]{2})|3[47][0-9]{2})[-.\s]?[0-9]{4}[-.\s]?[0-9]{4}[-.\s]?[0-9]{1,4}\b/g,
    replacement: '[CARD_REDACTED]',
    name: 'credit_card_brand',
  },
  // Generic 13-19 digit card numbers with optional separators
  {
    pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{1,7}\b/g,
    replacement: '[CARD_REDACTED]',
    name: 'credit_card_generic',
  },

  // PII-008: API keys and secrets (common prefixes)
  // OpenAI style
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, replacement: '[API_KEY_REDACTED]', name: 'openai_key' },
  { pattern: /\bpk-[A-Za-z0-9_-]{20,}\b/g, replacement: '[API_KEY_REDACTED]', name: 'public_key' },
  // Generic API key patterns
  {
    pattern: /\b(?:api[_-]?key|apikey)['":\s=]*['"]?[A-Za-z0-9_-]{16,}['"]?/gi,
    replacement: '[API_KEY_REDACTED]',
    name: 'api_key_generic',
  },
  { pattern: /\bkey[_-][A-Za-z0-9_-]{20,}\b/g, replacement: '[API_KEY_REDACTED]', name: 'key_prefix' },
  {
    pattern: /\btoken[_-][A-Za-z0-9_-]{20,}\b/g,
    replacement: '[TOKEN_REDACTED]',
    name: 'token_prefix',
  },
  // Stripe keys
  {
    pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g,
    replacement: '[STRIPE_KEY_REDACTED]',
    name: 'stripe_key',
  },
  // AWS keys
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[AWS_KEY_REDACTED]', name: 'aws_access_key' },
  {
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
    replacement: '[POTENTIAL_SECRET_REDACTED]',
    name: 'aws_secret_key',
  },
  // GitHub tokens
  {
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
    name: 'github_token',
  },
  // Anthropic keys
  {
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[ANTHROPIC_KEY_REDACTED]',
    name: 'anthropic_key',
  },

  // PII-009: JWT tokens (three base64 segments with dots)
  {
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g,
    replacement: '[JWT_REDACTED]',
    name: 'jwt_token',
  },

  // PII-010: IP addresses - IPv4
  {
    pattern: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IPv4_REDACTED]',
    name: 'ipv4',
  },

  // PII-011: IP addresses - IPv6 (various formats)
  {
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    replacement: '[IPv6_REDACTED]',
    name: 'ipv6_full',
  },
  {
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b/g,
    replacement: '[IPv6_REDACTED]',
    name: 'ipv6_compressed_end',
  },
  {
    pattern: /\b:(?::[0-9a-fA-F]{1,4}){1,7}\b/g,
    replacement: '[IPv6_REDACTED]',
    name: 'ipv6_compressed_start',
  },
  {
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b/g,
    replacement: '[IPv6_REDACTED]',
    name: 'ipv6_compressed_mid',
  },
  { pattern: /\b::1\b/g, replacement: '[IPv6_REDACTED]', name: 'ipv6_localhost' },
  { pattern: /\b::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi, replacement: '[IPv6_REDACTED]', name: 'ipv6_mapped' },

  // PII-012: GPS coordinates (latitude/longitude)
  // Decimal format: 25.276987, 55.296249
  {
    pattern: /\b[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*,\s*[-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?)\b/g,
    replacement: '[GPS_REDACTED]',
    name: 'gps_decimal',
  },
  // DMS format: 25°16'37.2"N 55°17'46.5"E
  {
    pattern: /\b\d{1,3}°\d{1,2}'\d{1,2}(?:\.\d+)?["']?[NSEW]\s*\d{1,3}°\d{1,2}'\d{1,2}(?:\.\d+)?["']?[NSEW]\b/gi,
    replacement: '[GPS_REDACTED]',
    name: 'gps_dms',
  },

  // PII-013: Date of birth patterns
  // ISO format: YYYY-MM-DD
  {
    pattern: /\b(?:dob|dateofbirth|date_of_birth|birth_date|birthdate)['":\s=]*['"]?(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])['"]?/gi,
    replacement: '[DOB_REDACTED]',
    name: 'dob_iso',
  },
  // US format: MM/DD/YYYY or MM-DD-YYYY
  {
    pattern: /\b(?:dob|dateofbirth|date_of_birth|birth_date|birthdate)['":\s=]*['"]?(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}['"]?/gi,
    replacement: '[DOB_REDACTED]',
    name: 'dob_us',
  },
  // EU format: DD/MM/YYYY or DD-MM-YYYY
  {
    pattern: /\b(?:dob|dateofbirth|date_of_birth|birth_date|birthdate)['":\s=]*['"]?(?:0[1-9]|[12]\d|3[01])[-/](?:0[1-9]|1[0-2])[-/](?:19|20)\d{2}['"]?/gi,
    replacement: '[DOB_REDACTED]',
    name: 'dob_eu',
  },

  // PII-014: UAE phone numbers (all formats)
  // +971 format
  {
    pattern: /\+971[-.\s]?(?:0)?(?:50|52|54|55|56|58|2|3|4|6|7|9)[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: '[UAE_PHONE_REDACTED]',
    name: 'uae_phone_plus',
  },
  // 00971 format
  {
    pattern: /00971[-.\s]?(?:0)?(?:50|52|54|55|56|58|2|3|4|6|7|9)[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: '[UAE_PHONE_REDACTED]',
    name: 'uae_phone_00',
  },
  // Local format: 05x xxx xxxx
  {
    pattern: /\b0(?:50|52|54|55|56|58)[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[UAE_PHONE_REDACTED]',
    name: 'uae_phone_local',
  },
  // Landline: 0X XXX XXXX
  {
    pattern: /\b0[2-9][-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[UAE_PHONE_REDACTED]',
    name: 'uae_landline',
  },

  // PII-015: International phone numbers
  {
    pattern: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    replacement: '[PHONE_REDACTED]',
    name: 'international_phone',
  },
  {
    pattern: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: '[PHONE_REDACTED]',
    name: 'us_phone',
  },

  // PII-016: Passwords in URLs, JSON, or query strings
  {
    pattern: /(?:password|passwd|pwd|pass)['":\s=]*['"]?[^\s'"&,}\]]{4,}['"]?/gi,
    replacement: '[PASSWORD_REDACTED]',
    name: 'password',
  },

  // PII-017: Authorization headers
  {
    pattern: /(?:authorization|bearer|auth)['":\s]*['"]?(?:Bearer\s+)?[A-Za-z0-9_.-]+['"]?/gi,
    replacement: '[AUTH_REDACTED]',
    name: 'auth_header',
  },

  // PII-018: Social Security Numbers (US)
  {
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
    name: 'ssn',
  },

  // PII-019: Session IDs and cookies
  {
    pattern: /(?:session[_-]?id|sessionid|sid)['":\s=]*['"]?[A-Za-z0-9_.-]{16,}['"]?/gi,
    replacement: '[SESSION_REDACTED]',
    name: 'session_id',
  },
]

/**
 * SEC-005: Normalize string by removing homoglyphs and invisible characters
 * This prevents evasion by using lookalike characters
 * @param input - The string to normalize
 * @returns Normalized string with standard ASCII characters
 */
function normalizeForMatching(input: string): string {
  let normalized = input

  // Replace homoglyphs with ASCII equivalents
  for (const [homoglyph, replacement] of Object.entries(HOMOGLYPH_MAP)) {
    normalized = normalized.split(homoglyph).join(replacement)
  }

  return normalized
}

/**
 * PII-020: Decode URL-encoded strings (%XX patterns)
 * Handles standard URL encoding like %40 for @, %20 for space
 * @param input - The string to decode
 * @returns URL-decoded string
 */
function decodeURLEncoding(input: string): string {
  try {
    // PII-020: Handle both standard URL encoding and component encoding
    // decodeURIComponent handles %XX patterns
    return decodeURIComponent(input)
  } catch {
    // PII-020: If decoding fails (invalid sequences), return original
    // This prevents malformed input from breaking the logger
    return input
  }
}

/**
 * PII-021: Decode hex-encoded strings (\xNN patterns)
 * Handles JavaScript-style hex escapes like \x40 for @
 * @param input - The string to decode
 * @returns Hex-decoded string
 */
function decodeHexEncoding(input: string): string {
  // PII-021: Match \xNN patterns where NN is two hex digits
  return input.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16))
    } catch {
      // PII-021: If conversion fails, return original match
      return `\\x${hex}`
    }
  })
}

/**
 * PII-022: Recursively decode nested encodings to prevent bypass attacks
 * Process order: URL decode -> Hex decode -> Base64 decode
 * Limited to 3 levels to prevent infinite loops from malicious input
 * @param input - The string to decode
 * @param depth - Current recursion depth (max 3)
 * @returns Fully decoded string
 */
function decodeNestedEncodings(input: string, depth = 0): string {
  // PII-022: Limit recursion to prevent DoS via deeply nested encodings
  const MAX_DECODE_DEPTH = 3
  if (depth >= MAX_DECODE_DEPTH) {
    return input
  }

  let decoded = input
  let previousDecoded = ''

  // PII-022: Keep decoding until no more changes occur (or max depth reached)
  while (decoded !== previousDecoded && depth < MAX_DECODE_DEPTH) {
    previousDecoded = decoded

    // PII-022: Step 1 - URL decode (%XX patterns like %40 for @)
    const urlDecoded = decodeURLEncoding(decoded)

    // PII-022: Step 2 - Hex decode (\xNN patterns like \x40 for @)
    const hexDecoded = decodeHexEncoding(urlDecoded)

    // PII-022: If decoding changed the string, recurse to handle nested layers
    if (hexDecoded !== decoded) {
      decoded = decodeNestedEncodings(hexDecoded, depth + 1)
    } else {
      decoded = hexDecoded
    }
  }

  return decoded
}

/**
 * SEC-006: Remove formatting characters for pattern matching
 * This prevents evasion by adding spaces/dashes in sensitive data
 * @param input - The string to clean
 * @returns String with spaces, dashes, and formatting removed
 */
function removeFormatting(input: string): string {
  return input.replace(/[\s\-_.()]/g, '')
}

/**
 * SEC-007: Detect and decode Base64 encoded PII
 * PII-023: Enhanced to also check decoded content for nested encodings
 * @param input - The string to check for base64 content
 * @returns The input with decoded base64 sections redacted if they contain PII
 */
function detectBase64PII(input: string): string {
  // Match potential base64 strings (minimum 20 chars to avoid false positives)
  const base64Pattern = /\b[A-Za-z0-9+/]{20,}={0,2}\b/g

  return input.replace(base64Pattern, (match) => {
    try {
      // Try to decode as base64
      const decoded = Buffer.from(match, 'base64').toString('utf-8')

      // Check if decoded content is valid text (mostly printable ASCII)
      const printableRatio =
        decoded.split('').filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length /
        decoded.length

      if (printableRatio > 0.8) {
        // PII-023: Also decode any nested URL/hex encodings within base64 content
        const fullyDecoded = decodeNestedEncodings(decoded)

        // Check if decoded content contains PII (check both original and fully decoded)
        for (const { pattern, name } of PII_PATTERNS) {
          if (pattern.test(decoded) || pattern.test(fullyDecoded)) {
            return `[BASE64_${name.toUpperCase()}_REDACTED]`
          }
          // Reset regex lastIndex for global patterns
          pattern.lastIndex = 0
        }
      }
    } catch {
      // Not valid base64, ignore
    }
    return match
  })
}

/**
 * SEC-008: Luhn algorithm validation for credit card numbers
 * @param cardNumber - Card number with only digits
 * @returns true if valid Luhn checksum
 */
function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) {
    return false
  }

  let sum = 0
  let isEven = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * SEC-009: Additional card number validation and redaction
 * @param input - String to check for card numbers
 * @returns String with valid card numbers redacted
 */
function redactCardNumbers(input: string): string {
  // Match any sequence that could be a card number (13-19 digits with optional separators)
  const potentialCardPattern = /\b(\d[\d\s\-_.]{11,22}\d)\b/g

  return input.replace(potentialCardPattern, (match) => {
    const digitsOnly = match.replace(/\D/g, '')

    if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && isValidLuhn(digitsOnly)) {
      return '[CARD_REDACTED]'
    }

    return match
  })
}

/**
 * SEC-003: Recursively redact sensitive fields from objects
 * @param obj - Object to redact
 * @param depth - Current recursion depth (max 10)
 * @returns Redacted object
 */
function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]'
  }

  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return redactPII(obj)
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item, depth + 1))
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase()

      // PII-001: Check if field name indicates sensitive data
      if (SENSITIVE_FIELD_NAMES.has(lowerKey) || SENSITIVE_FIELD_NAMES.has(key)) {
        redacted[key] = '[FIELD_REDACTED]'
      } else if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('credential')
      ) {
        // Additional partial match for common sensitive field name patterns
        redacted[key] = '[FIELD_REDACTED]'
      } else {
        redacted[key] = redactSensitiveFields(value, depth + 1)
      }
    }

    return redacted
  }

  return obj
}

/**
 * Redacts PII from a string by replacing sensitive patterns with placeholders
 * SEC-001: Applies to ALL environments, not just development
 * SEC-002: Includes normalization and evasion prevention
 * PII-024: Enhanced with URL/Hex/nested encoding bypass protection
 * @param input - The string to redact PII from
 * @returns The redacted string
 */
export function redactPII(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }

  let result = input

  // PII-024: Decode nested encodings FIRST to catch bypass attempts
  // Process order: URL decode -> Hex decode -> Base64 decode
  // This catches patterns like:
  //   - URL encoded: user%40example.com -> user@example.com
  //   - Hex encoded: user\x40example.com -> user@example.com
  //   - Double encoded: user%2540example.com -> user%40example.com -> user@example.com
  const decodedInput = decodeNestedEncodings(result)

  // PII-024: If decoding revealed different content, we need to redact both
  // the decoded content AND replace encoded patterns in the original
  if (decodedInput !== result) {
    // Check if the decoded version contains PII that the original doesn't
    // If so, we have a bypass attempt - redact the entire suspicious segment
    let hasEncodedPII = false
    for (const { pattern } of PII_PATTERNS) {
      pattern.lastIndex = 0
      const matchesDecoded = pattern.test(decodedInput)
      pattern.lastIndex = 0
      const matchesOriginal = pattern.test(result)
      if (matchesDecoded && !matchesOriginal) {
        hasEncodedPII = true
        break
      }
    }

    // PII-024: If encoded PII detected, process the decoded version
    if (hasEncodedPII) {
      result = decodedInput
    }
  }

  // SEC-005: Normalize homoglyphs
  const normalized = normalizeForMatching(result)
  if (normalized !== result) {
    // If normalization changed the string, there might be evasion attempts
    result = normalized
  }

  // SEC-007: Check for base64 encoded PII (now also handles nested encodings within base64)
  result = detectBase64PII(result)

  // SEC-009: Validate and redact card numbers with Luhn
  result = redactCardNumbers(result)

  // Apply all pattern-based redactions
  for (const { pattern, replacement } of PII_PATTERNS) {
    // Reset lastIndex for global regex patterns
    pattern.lastIndex = 0
    result = result.replace(pattern, replacement)
  }

  // SEC-006: Also check normalized version (spaces/dashes removed) for certain patterns
  // This catches attempts like "784 1234 5678901 2" for UAE IDs
  const cleanedInput = removeFormatting(result)
  for (const { pattern, replacement, name } of PII_PATTERNS) {
    // Only apply to specific patterns that might be evaded with formatting
    if (
      ['uae_id', 'credit_card', 'iban', 'phone', 'ssn'].some((prefix) => name.startsWith(prefix))
    ) {
      pattern.lastIndex = 0
      if (pattern.test(cleanedInput) && !pattern.test(result)) {
        // Pattern matches cleaned but not original - possible evasion
        result = replacement
        break
      }
    }
  }

  return result
}

/**
 * SEC-003: Safely stringify and redact data for logging
 * Handles structured data with field-name-based redaction
 * @param data - Any data to be logged
 * @returns Redacted string representation
 */
function safeStringifyAndRedact(data: unknown): string {
  try {
    // First, redact sensitive fields by name
    const fieldRedacted = redactSensitiveFields(data)
    // Then stringify and apply pattern-based redaction
    const stringified = JSON.stringify(fieldRedacted)
    return redactPII(stringified)
  } catch {
    return '[UNSERIALIZABLE_DATA]'
  }
}

/**
 * SEC-010: Log level configuration for production
 * In production, only log warn and error levels unless DEBUG is enabled
 */
const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  const isProduction = process.env.NODE_ENV === 'production'
  const debugEnabled = process.env.DEBUG === 'true'

  if (level === 'debug') {
    return debugEnabled
  }

  if (level === 'info') {
    return !isProduction || debugEnabled
  }

  // warn and error always log
  return true
}

/**
 * SEC-001: Secure logger that automatically redacts PII from all log output
 * CRITICAL: Redaction applies to ALL environments for security compliance
 */
export const logger = {
  info: (message: string, data?: unknown) => {
    if (shouldLog('info')) {
      // SEC-001: Always redact, regardless of environment
      const redactedMessage = redactPII(message)
      if (data !== undefined) {
        try {
          console.log(redactedMessage, JSON.parse(safeStringifyAndRedact(data)))
        } catch {
          console.log(redactedMessage, safeStringifyAndRedact(data))
        }
      } else {
        console.log(redactedMessage)
      }
    }
  },

  error: (message: string, error?: unknown) => {
    if (shouldLog('error')) {
      // SEC-001: Always redact, regardless of environment
      const redactedMessage = redactPII(message)
      if (error !== undefined) {
        // Handle Error objects specially to preserve stack traces
        if (error instanceof Error) {
          const redactedError = {
            name: error.name,
            message: redactPII(error.message),
            stack: error.stack ? redactPII(error.stack) : undefined,
          }
          console.error(redactedMessage, redactedError)
        } else {
          try {
            console.error(redactedMessage, JSON.parse(safeStringifyAndRedact(error)))
          } catch {
            console.error(redactedMessage, safeStringifyAndRedact(error))
          }
        }
      } else {
        console.error(redactedMessage)
      }
    }
  },

  warn: (message: string, data?: unknown) => {
    if (shouldLog('warn')) {
      // SEC-001: Always redact, regardless of environment
      const redactedMessage = redactPII(message)
      if (data !== undefined) {
        try {
          console.warn(redactedMessage, JSON.parse(safeStringifyAndRedact(data)))
        } catch {
          console.warn(redactedMessage, safeStringifyAndRedact(data))
        }
      } else {
        console.warn(redactedMessage)
      }
    }
  },

  debug: (message: string, data?: unknown) => {
    if (shouldLog('debug')) {
      // SEC-001: Always redact, regardless of environment
      const redactedMessage = redactPII(message)
      if (data !== undefined) {
        try {
          console.debug(redactedMessage, JSON.parse(safeStringifyAndRedact(data)))
        } catch {
          console.debug(redactedMessage, safeStringifyAndRedact(data))
        }
      } else {
        console.debug(redactedMessage)
      }
    }
  },
}

export default logger
