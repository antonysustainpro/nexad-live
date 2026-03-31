/**
 * SEC-020: File upload validation utilities
 * Protects against malicious file uploads (RCE, malware injection)
 *
 * SEC-030: Archive content scanning (zip bombs, nested archives)
 * SEC-031: Polyglot file detection (multi-format files)
 * SEC-032: Enhanced filename sanitization (null bytes, unicode attacks)
 * SEC-033: Content-based MIME detection (don't trust headers)
 * SEC-036: Secure temp file handling (symlink attack prevention)
 */

import JSZip from 'jszip'
import * as tar from 'tar-stream'
import { Readable } from 'stream'
import { createGunzip } from 'zlib'
import { randomBytes } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Allowed MIME types - whitelist approach
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // SECURITY FIX (Round 6): SVG removed from global allowed MIME types.
  // SVGs are XML and can contain <script>, event handlers, XXE entities,
  // and CSS-based data exfiltration. User-uploaded SVGs are blocked.
  // 'image/svg+xml',  // BLOCKED — SVG script execution / XXE risk
  'image/heic',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  // Text/Data
  'text/plain',
  'text/csv',
  'text/markdown',
  // SECURITY FIX (Round 6): text/html removed — can contain <script>, event handlers,
  // and phishing content when served back to users.
  // 'text/html',  // BLOCKED — XSS risk on re-serve
  'application/json',
  // SECURITY FIX (Round 6): application/xml removed — can contain XXE entities
  // (<!ENTITY xxe SYSTEM "file:///etc/passwd">) and entity expansion bombs (Billion Laughs).
  // 'application/xml',  // BLOCKED — XXE / entity expansion risk
  'application/x-yaml',
  // Audio (for voice features)
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
  // Video (for enterprise tier)
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  // Archives (limited)
  'application/zip',
  'application/gzip',
  'application/x-tar',
  // E-books
  'application/epub+zip',
  'application/x-mobipocket-ebook',
])

// Allowed file extensions - must match MIME types
const ALLOWED_EXTENSIONS = new Set([
  // Images
  // SECURITY FIX (Round 6): .svg removed — SVG can contain scripts/XXE
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf',
  // Text/Data
  // SECURITY FIX (Round 6): .html and .xml removed — XSS and XXE risk
  '.txt', '.csv', '.md', '.json', '.yaml', '.yml',
  // Audio
  '.mp3', '.wav', '.ogg', '.m4a', '.webm',
  // Video
  '.mp4', '.mov', '.avi',
  // Archives
  '.zip', '.tar', '.gz', '.tgz', '.tar.gz',
  // E-books
  '.epub', '.mobi',
])

// Dangerous/executable extensions - always blocked
const DANGEROUS_EXTENSIONS = new Set([
  // Windows executables
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  // Scripts
  '.sh', '.bash', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  // Java/JVM
  '.jar', '.war', '.class',
  // .NET
  '.dll', '.so', '.dylib',
  // Office macros
  '.docm', '.xlsm', '.pptm', '.dotm', '.xltm', '.potm',
  // Other dangerous
  '.hta', '.cpl', '.reg', '.inf', '.lnk', '.url', '.app', '.dmg', '.pkg', '.deb', '.rpm',
  // PHP/Web
  '.php', '.php3', '.php4', '.php5', '.phtml', '.asp', '.aspx', '.jsp', '.cgi', '.pl', '.py',
])

// SEC-032: Windows reserved filenames that could cause issues
const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
])

// Magic bytes signatures for dangerous file types
const DANGEROUS_SIGNATURES: { name: string; bytes: number[]; offset?: number }[] = [
  { name: 'Windows Executable (MZ)', bytes: [0x4D, 0x5A] },
  { name: 'ELF Executable', bytes: [0x7F, 0x45, 0x4C, 0x46] },
  { name: 'Shell Script (#!)', bytes: [0x23, 0x21] },
  { name: 'Java Class File', bytes: [0xCA, 0xFE, 0xBA, 0xBE] },
  { name: 'Mach-O 32-bit', bytes: [0xFE, 0xED, 0xFA, 0xCE] },
  { name: 'Mach-O 64-bit', bytes: [0xFE, 0xED, 0xFA, 0xCF] },
  { name: 'Mach-O Universal', bytes: [0xCA, 0xFE, 0xBA, 0xBE] },
]

// SEC-033: Content-based MIME detection signatures
// Maps magic bytes to actual MIME type (don't trust Content-Type header)
const MIME_SIGNATURES: { mimeType: string; bytes: number[][]; offset?: number; mask?: number[] }[] = [
  // Images
  { mimeType: 'image/jpeg', bytes: [[0xFF, 0xD8, 0xFF]] },
  { mimeType: 'image/png', bytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]] },
  { mimeType: 'image/gif', bytes: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]] },
  { mimeType: 'image/webp', bytes: [[0x52, 0x49, 0x46, 0x46]], offset: 0 }, // RIFF header, need to check WEBP at offset 8
  { mimeType: 'image/bmp', bytes: [[0x42, 0x4D]] },
  { mimeType: 'image/tiff', bytes: [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]] },
  // Documents
  { mimeType: 'application/pdf', bytes: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  // Archives
  { mimeType: 'application/zip', bytes: [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]] },
  { mimeType: 'application/gzip', bytes: [[0x1F, 0x8B]] },
  { mimeType: 'application/x-tar', bytes: [[0x75, 0x73, 0x74, 0x61, 0x72]], offset: 257 }, // "ustar" at offset 257
  { mimeType: 'application/x-rar-compressed', bytes: [[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07]] },
  { mimeType: 'application/x-7z-compressed', bytes: [[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]] },
  // Audio
  { mimeType: 'audio/mpeg', bytes: [[0xFF, 0xFB], [0xFF, 0xFA], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]] }, // MP3 frames or ID3 tag
  { mimeType: 'audio/wav', bytes: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF header
  { mimeType: 'audio/ogg', bytes: [[0x4F, 0x67, 0x67, 0x53]] }, // OggS
  // Video
  { mimeType: 'video/mp4', bytes: [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], offset: 4 }, // ftyp at offset 4
  { mimeType: 'video/webm', bytes: [[0x1A, 0x45, 0xDF, 0xA3]] }, // EBML header
  // Office formats (OOXML are ZIP-based)
  { mimeType: 'application/vnd.openxmlformats-officedocument', bytes: [[0x50, 0x4B, 0x03, 0x04]] }, // ZIP-based
]

// Default max file size (10MB)
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

// Tier-based max file sizes
export const TIER_MAX_FILE_SIZES: Record<string, number> = {
  basic: 10 * 1024 * 1024,      // 10MB
  pro: 50 * 1024 * 1024,        // 50MB
  enterprise: 200 * 1024 * 1024, // 200MB
}

// SEC-030: Archive limits for zip bomb and nested archive protection
export const ARCHIVE_LIMITS = {
  maxCompressionRatio: 100,        // SEC-030: Max 100:1 compression ratio (zip bomb protection)
  maxEntries: 1000,                // Max files in archive
  maxNestedDepth: 3,               // SEC-030: Max archive nesting (archives within archives)
  maxDecompressedSize: 500 * 1024 * 1024, // 500MB max total decompressed
  maxSingleFileSize: 100 * 1024 * 1024,   // 100MB max per file in archive
} as const

export interface FileValidationResult {
  valid: boolean
  error?: string
  errorCode?:
    | 'FILE_TOO_LARGE'
    | 'INVALID_TYPE'
    | 'INVALID_EXTENSION'
    | 'DANGEROUS_EXTENSION'
    | 'SUSPICIOUS_FILENAME'
    | 'DANGEROUS_CONTENT'
    | 'CONTENT_MISMATCH'
    | 'ARCHIVE_ZIP_BOMB'
    | 'ARCHIVE_NESTED_TOO_DEEP'
    | 'ARCHIVE_DANGEROUS_CONTENT'
    | 'POLYGLOT_DETECTED'
    | 'RESERVED_FILENAME'
    | 'UNICODE_ATTACK'
  detectedMimeType?: string
}

export interface FileValidationOptions {
  maxFileSize?: number
  tier?: 'basic' | 'pro' | 'enterprise'
  allowedMimeTypes?: Set<string>
  allowedExtensions?: Set<string>
  // SEC-037: Removed skipArchiveScan option - archive scanning must ALWAYS run
  // CSO flagged this as a bypass risk. If performance is a concern, callers
  // should use a separate validation function for trusted sources instead.
  currentArchiveDepth?: number  // Internal: track nested archive depth
}

/**
 * Get file extension from filename (lowercase, with dot)
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return ''
  }
  return '.' + filename.slice(lastDot + 1).toLowerCase()
}

/**
 * SEC-032: Normalize unicode in filename to prevent homoglyph attacks
 * Converts to NFC form and removes zero-width characters
 */
function normalizeUnicode(filename: string): string {
  // Normalize to NFC (canonical composition)
  let normalized = filename.normalize('NFC')

  // SEC-032: Remove zero-width characters used in unicode attacks
  // Zero-width space (U+200B), zero-width non-joiner (U+200C),
  // zero-width joiner (U+200D), left-to-right mark (U+200E), etc.
  normalized = normalized.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')

  // Remove other invisible/control characters
  normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')

  return normalized
}

/**
 * SEC-032: Check for unicode homoglyph/lookalike attacks
 * Detects characters that look like ASCII but aren't
 */
function hasUnicodeAttack(filename: string): { attack: boolean; reason?: string } {
  // Check for Cyrillic/Greek lookalikes of Latin characters
  // These can make "exe" look like "ехе" (Cyrillic)
  const lookalikePairs = [
    { latin: 'a', lookalikes: ['\u0430', '\u03B1'] }, // Cyrillic а, Greek α
    { latin: 'c', lookalikes: ['\u0441', '\u03C2'] }, // Cyrillic с, Greek ς
    { latin: 'e', lookalikes: ['\u0435', '\u03B5'] }, // Cyrillic е, Greek ε
    { latin: 'o', lookalikes: ['\u043E', '\u03BF'] }, // Cyrillic о, Greek ο
    { latin: 'p', lookalikes: ['\u0440', '\u03C1'] }, // Cyrillic р, Greek ρ
    { latin: 'x', lookalikes: ['\u0445', '\u03C7'] }, // Cyrillic х, Greek χ
    { latin: 's', lookalikes: ['\u0455'] },           // Cyrillic ѕ
  ]

  for (const pair of lookalikePairs) {
    for (const lookalike of pair.lookalikes) {
      if (filename.includes(lookalike)) {
        return {
          attack: true,
          reason: `Unicode lookalike character detected (${lookalike} looks like ${pair.latin})`
        }
      }
    }
  }

  // Check for right-to-left override (can make "exe.txt" display as "txt.exe")
  if (filename.includes('\u202E') || filename.includes('\u202D')) {
    return { attack: true, reason: 'Right-to-left override character detected' }
  }

  return { attack: false }
}

/**
 * SEC-032: Check for Windows reserved filenames
 */
function isWindowsReservedName(filename: string): boolean {
  // Get base name without extension
  const baseName = filename.split('.')[0].toLowerCase()
  return WINDOWS_RESERVED_NAMES.has(baseName)
}

/**
 * Check if filename has suspicious patterns (double extensions, null bytes, etc.)
 * SEC-032: Enhanced with null byte injection, path traversal, unicode attack prevention
 */
function hasSuspiciousFilename(filename: string): { suspicious: boolean; reason?: string } {
  // SEC-032: Check for null bytes (path traversal attack)
  if (filename.includes('\0')) {
    return { suspicious: true, reason: 'Filename contains null bytes (SEC-032)' }
  }

  // SEC-032: Check for null byte injection patterns (URL encoded)
  if (filename.includes('%00') || filename.includes('\\x00') || filename.includes('\\0')) {
    return { suspicious: true, reason: 'Filename contains encoded null bytes (SEC-032)' }
  }

  // SEC-032: Check for path traversal (including URL-encoded variants)
  const pathTraversalPatterns = [
    '..',
    '/',
    '\\',
    '%2e%2e',  // URL-encoded ..
    '%2f',     // URL-encoded /
    '%5c',     // URL-encoded \
    '..../',   // Double-encoded traversal
  ]
  for (const pattern of pathTraversalPatterns) {
    if (filename.toLowerCase().includes(pattern)) {
      return { suspicious: true, reason: `Filename contains path traversal characters: ${pattern} (SEC-032)` }
    }
  }

  // SEC-032: Check for unicode attacks
  const unicodeCheck = hasUnicodeAttack(filename)
  if (unicodeCheck.attack) {
    return { suspicious: true, reason: `${unicodeCheck.reason} (SEC-032)` }
  }

  // SEC-032: Check for Windows reserved names
  if (isWindowsReservedName(filename)) {
    return { suspicious: true, reason: 'Windows reserved filename detected (CON, PRN, AUX, etc.) (SEC-032)' }
  }

  // Check for double extensions with dangerous second extension
  const parts = filename.split('.')
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      const ext = '.' + parts[i].toLowerCase()
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        return { suspicious: true, reason: `Suspicious double extension detected: ${ext}` }
      }
    }
  }

  // Check for hidden files (starting with dot)
  if (filename.startsWith('.')) {
    return { suspicious: true, reason: 'Hidden file detected' }
  }

  // Check for excessively long filenames (potential buffer overflow)
  if (filename.length > 255) {
    return { suspicious: true, reason: 'Filename too long' }
  }

  // SEC-032: Check for filenames that are just whitespace or dots after normalization
  const normalized = normalizeUnicode(filename)
  if (!normalized || /^[\s.]+$/.test(normalized)) {
    return { suspicious: true, reason: 'Filename is empty or only whitespace after normalization (SEC-032)' }
  }

  return { suspicious: false }
}

/**
 * SEC-033: Detect MIME type from file content (magic bytes)
 * Don't trust Content-Type header - detect from actual bytes
 */
export function detectMimeTypeFromContent(bytes: Uint8Array): string | null {
  for (const sig of MIME_SIGNATURES) {
    const offset = sig.offset || 0

    for (const sigBytes of sig.bytes) {
      if (bytes.length < offset + sigBytes.length) continue

      let match = true
      for (let i = 0; i < sigBytes.length; i++) {
        if (bytes[offset + i] !== sigBytes[i]) {
          match = false
          break
        }
      }

      if (match) {
        // Special handling for RIFF-based formats (need secondary check)
        if (sig.mimeType === 'image/webp' || sig.mimeType === 'audio/wav') {
          // Check for WEBP at offset 8
          if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
            return 'image/webp'
          }
          // Check for WAVE at offset 8
          if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
            return 'audio/wav'
          }
          // Check for AVI at offset 8
          if (bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20) {
            return 'video/x-msvideo'
          }
          continue // RIFF but unknown subtype
        }

        return sig.mimeType
      }
    }
  }

  return null
}

/**
 * SEC-031: Check for polyglot files (files valid in multiple formats)
 * These can bypass security checks by appearing as one type but executing as another
 */
export async function detectPolyglot(
  bytes: Uint8Array,
  declaredType: string
): Promise<{ isPolyglot: boolean; reason?: string }> {
  // SEC-031: Check for PDF with embedded JavaScript
  if (declaredType === 'application/pdf' || detectMimeTypeFromContent(bytes) === 'application/pdf') {
    const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

    // Check for JavaScript in PDF
    const jsPatterns = [
      '/JavaScript',
      '/JS ',
      '/JS(',
      '/S /JavaScript',
      '/OpenAction',
      '/AA',  // Additional Actions
      '/Launch',
      '/EmbeddedFile',
    ]

    for (const pattern of jsPatterns) {
      if (content.includes(pattern)) {
        return {
          isPolyglot: true,
          reason: `PDF contains potentially dangerous element: ${pattern} (SEC-031)`
        }
      }
    }
  }

  // SEC-031: Check for images with appended executable content
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
  const detectedType = detectMimeTypeFromContent(bytes)

  if (imageTypes.includes(declaredType) || (detectedType && imageTypes.includes(detectedType))) {
    // Check for MZ header (Windows executable) anywhere in the file
    for (let i = 100; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x4D && bytes[i + 1] === 0x5A) {
        // Found MZ header after image data - possible polyglot
        return {
          isPolyglot: true,
          reason: 'Image file contains appended executable content (MZ header detected) (SEC-031)'
        }
      }
    }

    // Check for ELF header
    for (let i = 100; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x7F && bytes[i + 1] === 0x45 && bytes[i + 2] === 0x4C && bytes[i + 3] === 0x46) {
        return {
          isPolyglot: true,
          reason: 'Image file contains appended executable content (ELF header detected) (SEC-031)'
        }
      }
    }

    // Check for PHP/script content appended to images
    const textContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(Math.max(0, bytes.length - 10000)))
    const scriptPatterns = ['<?php', '<?=', '<script', '<%', '#!/']
    for (const pattern of scriptPatterns) {
      if (textContent.includes(pattern)) {
        return {
          isPolyglot: true,
          reason: `Image file contains appended script content: ${pattern} (SEC-031)`
        }
      }
    }
  }

  // SEC-031: Check for ZIP polyglot (valid ZIP that's also something else)
  // Many formats are ZIP-based (DOCX, XLSX, JAR, APK)
  const zipMimeTypes = [
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/epub+zip',
  ]

  if (zipMimeTypes.includes(declaredType)) {
    // Check if file also matches dangerous signatures at the start
    for (const sig of DANGEROUS_SIGNATURES) {
      if (sig.name.includes('Executable') || sig.name.includes('Class')) {
        let match = true
        for (let i = 0; i < sig.bytes.length && i < bytes.length; i++) {
          if (bytes[i] !== sig.bytes[i]) {
            match = false
            break
          }
        }
        if (match) {
          return {
            isPolyglot: true,
            reason: `ZIP-based file also matches dangerous signature: ${sig.name} (SEC-031)`
          }
        }
      }
    }
  }

  return { isPolyglot: false }
}

/**
 * Validate file metadata (type, size, extension) without reading content
 * Use this for quick client-side validation
 */
export function validateFile(
  file: File | { name: string; type: string; size: number },
  options: FileValidationOptions = {}
): FileValidationResult {
  const {
    maxFileSize = options.tier ? TIER_MAX_FILE_SIZES[options.tier] : DEFAULT_MAX_FILE_SIZE,
    allowedMimeTypes = ALLOWED_MIME_TYPES,
    allowedExtensions = ALLOWED_EXTENSIONS,
  } = options

  // SEC-032: Normalize filename first to prevent unicode attacks
  const normalizedName = normalizeUnicode(file.name)

  // Check file size
  if (file.size > maxFileSize) {
    const maxMB = Math.round(maxFileSize / (1024 * 1024))
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxMB}MB`,
      errorCode: 'FILE_TOO_LARGE',
    }
  }

  // Check file size is not zero (empty file)
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Empty files are not allowed',
      errorCode: 'FILE_TOO_LARGE',
    }
  }

  // Get and validate extension
  const ext = getFileExtension(normalizedName)

  // Check for dangerous extensions first
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type '${ext}' is not allowed for security reasons`,
      errorCode: 'DANGEROUS_EXTENSION',
    }
  }

  // Check extension against whitelist
  if (!ext || !allowedExtensions.has(ext)) {
    return {
      valid: false,
      error: `File extension '${ext || 'none'}' is not allowed`,
      errorCode: 'INVALID_EXTENSION',
    }
  }

  // Check MIME type against whitelist
  // Note: MIME type can be spoofed, so we also validate content later
  if (file.type && !allowedMimeTypes.has(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed`,
      errorCode: 'INVALID_TYPE',
    }
  }

  // Check for suspicious filename patterns (SEC-032 enhanced)
  const filenameCheck = hasSuspiciousFilename(normalizedName)
  if (filenameCheck.suspicious) {
    return {
      valid: false,
      error: filenameCheck.reason,
      errorCode: 'SUSPICIOUS_FILENAME',
    }
  }

  return { valid: true }
}

/**
 * SEC-033: Validate file content with content-based MIME detection
 * Don't trust Content-Type header - detect actual type from bytes
 */
export async function validateFileContent(
  file: File | Blob
): Promise<FileValidationResult> {
  try {
    // Read first 512 bytes for magic number detection (increased from 16 for better detection)
    const headerBuffer = await file.slice(0, 512).arrayBuffer()
    const headerBytes = new Uint8Array(headerBuffer)

    // Check for dangerous magic bytes
    for (const sig of DANGEROUS_SIGNATURES) {
      let match = true
      for (let i = 0; i < sig.bytes.length; i++) {
        if (headerBytes[i] !== sig.bytes[i]) {
          match = false
          break
        }
      }
      if (match) {
        return {
          valid: false,
          error: `File content appears to be executable (${sig.name})`,
          errorCode: 'DANGEROUS_CONTENT',
        }
      }
    }

    // SEC-033: Detect actual MIME type from content
    const detectedMimeType = detectMimeTypeFromContent(headerBytes)

    // For files with known signatures, verify content matches declared type
    if (file instanceof File && file.type && detectedMimeType) {
      // Allow ZIP-based formats to detect as ZIP
      const zipBasedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/epub+zip',
        'application/x-mobipocket-ebook',
      ]

      const isZipBased = zipBasedTypes.includes(file.type) && detectedMimeType === 'application/zip'

      if (!isZipBased && detectedMimeType !== file.type) {
        // Allow OOXML generic type to match specific OOXML types
        if (!(detectedMimeType === 'application/vnd.openxmlformats-officedocument' &&
              file.type.startsWith('application/vnd.openxmlformats-officedocument'))) {
          return {
            valid: false,
            error: `File content (${detectedMimeType}) does not match declared type '${file.type}' (SEC-033)`,
            errorCode: 'CONTENT_MISMATCH',
            detectedMimeType,
          }
        }
      }
    }

    // SEC-031: Check for polyglot files
    // Read more of the file for polyglot detection (up to 1MB or full file)
    const polyglotCheckSize = Math.min(file.size, 1024 * 1024)
    const fullBuffer = await file.slice(0, polyglotCheckSize).arrayBuffer()
    const fullBytes = new Uint8Array(fullBuffer)

    const polyglotCheck = await detectPolyglot(
      fullBytes,
      file instanceof File ? file.type : (detectedMimeType || '')
    )

    if (polyglotCheck.isPolyglot) {
      return {
        valid: false,
        error: polyglotCheck.reason,
        errorCode: 'POLYGLOT_DETECTED',
        detectedMimeType: detectedMimeType || undefined,
      }
    }

    return { valid: true, detectedMimeType: detectedMimeType || undefined }
  } catch {
    return {
      valid: false,
      error: 'Failed to read file content for validation',
      errorCode: 'DANGEROUS_CONTENT',
    }
  }
}

/**
 * SEC-030: Scan ZIP archive contents recursively
 * Checks for zip bombs, nested archives, and dangerous files
 */
export async function scanZipArchive(
  file: File | Blob,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const currentDepth = options.currentArchiveDepth || 0

  // SEC-030: Check max nesting depth
  if (currentDepth >= ARCHIVE_LIMITS.maxNestedDepth) {
    return {
      valid: false,
      error: `Archive nesting too deep (max ${ARCHIVE_LIMITS.maxNestedDepth} levels) (SEC-030)`,
      errorCode: 'ARCHIVE_NESTED_TOO_DEEP',
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    const entries = Object.keys(zip.files)

    // SEC-030: Check entry count
    if (entries.length > ARCHIVE_LIMITS.maxEntries) {
      return {
        valid: false,
        error: `Archive contains too many files (${entries.length} > ${ARCHIVE_LIMITS.maxEntries}) (SEC-030)`,
        errorCode: 'ARCHIVE_ZIP_BOMB',
      }
    }

    let totalDecompressedSize = 0

    for (const entryName of entries) {
      const entry = zip.files[entryName]

      // Skip directories
      if (entry.dir) continue

      // SEC-030: Check filename for path traversal in archive
      const filenameCheck = hasSuspiciousFilename(entryName)
      if (filenameCheck.suspicious) {
        return {
          valid: false,
          error: `Dangerous filename in archive: ${entryName} - ${filenameCheck.reason}`,
          errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
        }
      }

      // SEC-030: Check extension of files in archive
      const ext = getFileExtension(entryName)
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        return {
          valid: false,
          error: `Archive contains dangerous file type: ${entryName} (SEC-030)`,
          errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
        }
      }

      // Get uncompressed size (if available in ZIP metadata)
      // JSZip internal _data property for size info - cast to any for access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entryData = (entry as any)._data
      const compressedSize = entryData?.compressedSize || 0
      const uncompressedSize = entryData?.uncompressedSize || 0

      // SEC-030: Check compression ratio for this file (zip bomb detection)
      if (compressedSize > 0 && uncompressedSize > 0) {
        const ratio = uncompressedSize / compressedSize
        if (ratio > ARCHIVE_LIMITS.maxCompressionRatio) {
          return {
            valid: false,
            error: `Potential zip bomb detected: ${entryName} has compression ratio ${ratio.toFixed(1)}:1 (max ${ARCHIVE_LIMITS.maxCompressionRatio}:1) (SEC-030)`,
            errorCode: 'ARCHIVE_ZIP_BOMB',
          }
        }
      }

      // Track total decompressed size
      totalDecompressedSize += uncompressedSize || entryData?.compressedSize || 0

      // SEC-030: Check total decompressed size
      if (totalDecompressedSize > ARCHIVE_LIMITS.maxDecompressedSize) {
        return {
          valid: false,
          error: `Archive total decompressed size exceeds limit (${Math.round(totalDecompressedSize / (1024 * 1024))}MB > ${Math.round(ARCHIVE_LIMITS.maxDecompressedSize / (1024 * 1024))}MB) (SEC-030)`,
          errorCode: 'ARCHIVE_ZIP_BOMB',
        }
      }

      // SEC-030: Check single file size
      if (uncompressedSize > ARCHIVE_LIMITS.maxSingleFileSize) {
        return {
          valid: false,
          error: `File in archive too large: ${entryName} (${Math.round(uncompressedSize / (1024 * 1024))}MB) (SEC-030)`,
          errorCode: 'ARCHIVE_ZIP_BOMB',
        }
      }

      // SEC-030: Check for nested archives and scan recursively
      const archiveExtensions = new Set(['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'])
      if (archiveExtensions.has(ext)) {
        // Decompress and scan the nested archive
        const nestedContent = await entry.async('blob')
        const nestedResult = await scanArchiveContent(
          new File([nestedContent], entryName),
          { ...options, currentArchiveDepth: currentDepth + 1 }
        )

        if (!nestedResult.valid) {
          return nestedResult
        }
      } else {
        // SEC-030: Scan file content for dangerous signatures
        const content = await entry.async('uint8array')

        // Check for executable signatures in decompressed content
        for (const sig of DANGEROUS_SIGNATURES) {
          let match = true
          for (let i = 0; i < sig.bytes.length && i < content.length; i++) {
            if (content[i] !== sig.bytes[i]) {
              match = false
              break
            }
          }
          if (match) {
            return {
              valid: false,
              error: `Archive contains executable content: ${entryName} (${sig.name}) (SEC-030)`,
              errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
            }
          }
        }

        // Check allowed types for files in archive
        if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
          return {
            valid: false,
            error: `Archive contains disallowed file type: ${entryName} (SEC-030)`,
            errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
          }
        }
      }
    }

    // SEC-030: Final compression ratio check based on actual sizes
    if (file.size > 0 && totalDecompressedSize > 0) {
      const overallRatio = totalDecompressedSize / file.size
      if (overallRatio > ARCHIVE_LIMITS.maxCompressionRatio) {
        return {
          valid: false,
          error: `Potential zip bomb: overall compression ratio ${overallRatio.toFixed(1)}:1 exceeds limit of ${ARCHIVE_LIMITS.maxCompressionRatio}:1 (SEC-030)`,
          errorCode: 'ARCHIVE_ZIP_BOMB',
        }
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to scan archive: ${error instanceof Error ? error.message : 'Unknown error'}`,
      errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
    }
  }
}

/**
 * SEC-030: Scan TAR archive contents
 */
export async function scanTarArchive(
  file: File | Blob,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const currentDepth = options.currentArchiveDepth || 0

  if (currentDepth >= ARCHIVE_LIMITS.maxNestedDepth) {
    return {
      valid: false,
      error: `Archive nesting too deep (max ${ARCHIVE_LIMITS.maxNestedDepth} levels) (SEC-030)`,
      errorCode: 'ARCHIVE_NESTED_TOO_DEEP',
    }
  }

  return new Promise(async (resolve) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const extract = tar.extract()
      let entryCount = 0
      let totalSize = 0
      let hasError = false

      extract.on('entry', (header, stream, next) => {
        if (hasError) {
          stream.resume()
          next()
          return
        }

        entryCount++

        // SEC-030: Check entry count
        if (entryCount > ARCHIVE_LIMITS.maxEntries) {
          hasError = true
          resolve({
            valid: false,
            error: `Archive contains too many files (SEC-030)`,
            errorCode: 'ARCHIVE_ZIP_BOMB',
          })
          stream.resume()
          next()
          return
        }

        // SEC-030: Check filename
        const filenameCheck = hasSuspiciousFilename(header.name)
        if (filenameCheck.suspicious) {
          hasError = true
          resolve({
            valid: false,
            error: `Dangerous filename in archive: ${header.name} - ${filenameCheck.reason}`,
            errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
          })
          stream.resume()
          next()
          return
        }

        // SEC-030: Check extension
        const ext = getFileExtension(header.name)
        if (DANGEROUS_EXTENSIONS.has(ext)) {
          hasError = true
          resolve({
            valid: false,
            error: `Archive contains dangerous file type: ${header.name} (SEC-030)`,
            errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
          })
          stream.resume()
          next()
          return
        }

        // Check allowed types
        if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
          hasError = true
          resolve({
            valid: false,
            error: `Archive contains disallowed file type: ${header.name} (SEC-030)`,
            errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
          })
          stream.resume()
          next()
          return
        }

        // Track size
        totalSize += header.size || 0

        if (totalSize > ARCHIVE_LIMITS.maxDecompressedSize) {
          hasError = true
          resolve({
            valid: false,
            error: `Archive total size exceeds limit (SEC-030)`,
            errorCode: 'ARCHIVE_ZIP_BOMB',
          })
          stream.resume()
          next()
          return
        }

        // Collect content to check for dangerous signatures
        const chunks: Buffer[] = []
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => {
          if (hasError) {
            next()
            return
          }

          const content = Buffer.concat(chunks)
          const bytes = new Uint8Array(content)

          // Check for dangerous signatures
          for (const sig of DANGEROUS_SIGNATURES) {
            let match = true
            for (let i = 0; i < sig.bytes.length && i < bytes.length; i++) {
              if (bytes[i] !== sig.bytes[i]) {
                match = false
                break
              }
            }
            if (match) {
              hasError = true
              resolve({
                valid: false,
                error: `Archive contains executable content: ${header.name} (${sig.name}) (SEC-030)`,
                errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
              })
              return
            }
          }

          next()
        })
      })

      extract.on('finish', () => {
        if (!hasError) {
          // SEC-030: Check compression ratio
          if (file.size > 0 && totalSize > 0) {
            const ratio = totalSize / file.size
            if (ratio > ARCHIVE_LIMITS.maxCompressionRatio) {
              resolve({
                valid: false,
                error: `Potential zip bomb: compression ratio ${ratio.toFixed(1)}:1 exceeds limit (SEC-030)`,
                errorCode: 'ARCHIVE_ZIP_BOMB',
              })
              return
            }
          }
          resolve({ valid: true })
        }
      })

      extract.on('error', (err) => {
        if (!hasError) {
          resolve({
            valid: false,
            error: `Failed to scan TAR archive: ${err.message}`,
            errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
          })
        }
      })

      // Check if gzipped
      const isGzipped = buffer[0] === 0x1F && buffer[1] === 0x8B

      if (isGzipped) {
        const gunzip = createGunzip()
        gunzip.pipe(extract)

        const readable = Readable.from(buffer)
        readable.pipe(gunzip)
      } else {
        const readable = Readable.from(buffer)
        readable.pipe(extract)
      }
    } catch (error) {
      resolve({
        valid: false,
        error: `Failed to scan archive: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'ARCHIVE_DANGEROUS_CONTENT',
      })
    }
  })
}

/**
 * SEC-030: Unified archive content scanner
 * Routes to appropriate scanner based on archive type
 */
export async function scanArchiveContent(
  file: File | Blob,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  // Read first bytes to detect archive type
  const headerBuffer = await file.slice(0, 8).arrayBuffer()
  const headerBytes = new Uint8Array(headerBuffer)

  // ZIP signature: PK\x03\x04
  if (headerBytes[0] === 0x50 && headerBytes[1] === 0x4B &&
      headerBytes[2] === 0x03 && headerBytes[3] === 0x04) {
    return scanZipArchive(file, options)
  }

  // GZIP signature: \x1f\x8b
  if (headerBytes[0] === 0x1F && headerBytes[1] === 0x8B) {
    return scanTarArchive(file, options)
  }

  // TAR files might not have signature at start, check by extension
  if (file instanceof File) {
    const ext = getFileExtension(file.name)
    if (ext === '.tar' || ext === '.tgz') {
      return scanTarArchive(file, options)
    }
  }

  // Unknown archive format - run basic validation only
  return { valid: true }
}

/**
 * Full validation: metadata + content + archive scanning
 * Use this for complete server-side validation before processing
 */
export async function validateFileComplete(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  // First validate metadata
  const metadataResult = validateFile(file, options)
  if (!metadataResult.valid) {
    return metadataResult
  }

  // Then validate content (includes SEC-031 polyglot detection and SEC-033 MIME detection)
  const contentResult = await validateFileContent(file)
  if (!contentResult.valid) {
    return contentResult
  }

  // SEC-030: If it's an archive, scan contents
  // SEC-037: Archive scanning is MANDATORY - no skip option allowed (CSO security requirement)
  if (isArchiveFile(file)) {
    const archiveResult = await scanArchiveContent(file, options)
    if (!archiveResult.valid) {
      return archiveResult
    }
  }

  return { valid: true, detectedMimeType: contentResult.detectedMimeType }
}

/**
 * SEC-032: Enhanced filename sanitization
 * Removes dangerous characters, normalizes unicode, prevents injection attacks
 */
export function sanitizeFilename(filename: string): string {
  // SEC-032: Normalize unicode first
  let sanitized = normalizeUnicode(filename)

  // SEC-032: Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // SEC-032: Remove URL-encoded null bytes
  sanitized = sanitized.replace(/%00/gi, '')

  // SEC-032: Remove path separators
  sanitized = sanitized.replace(/[/\\]/g, '_')

  // SEC-032: Remove other potentially dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_')

  // SEC-032: Remove semicolons (command injection)
  sanitized = sanitized.replace(/;/g, '_')

  // SEC-032: Remove backticks (shell injection)
  sanitized = sanitized.replace(/`/g, '_')

  // SEC-032: Remove dollar signs (variable injection)
  sanitized = sanitized.replace(/\$/g, '_')

  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, '_')

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '')

  // SEC-032: Check for Windows reserved names and rename if needed
  const baseName = sanitized.split('.')[0].toLowerCase()
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    sanitized = '_' + sanitized
  }

  // Truncate to reasonable length while preserving extension
  if (sanitized.length > 200) {
    const ext = getFileExtension(sanitized)
    const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length)
    sanitized = nameWithoutExt.slice(0, 200 - ext.length) + ext
  }

  // If filename is empty after sanitization, generate a default
  if (!sanitized) {
    sanitized = 'unnamed_file'
  }

  return sanitized
}

/**
 * Check if file type is an image (for avatar uploads, etc.)
 */
export function isImageFile(file: { type: string; name: string }): boolean {
  const imageTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // SECURITY FIX (Round 6): SVG removed — XML-based format with script execution risk
    // 'image/svg+xml',  // BLOCKED
    'image/heic',
  ])

  // SECURITY FIX (Round 6): .svg removed from image extensions for same reason
  const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'])

  const ext = getFileExtension(file.name)
  return imageTypes.has(file.type) || imageExtensions.has(ext)
}

/**
 * Validate image file specifically (stricter rules for avatar uploads)
 */
export function validateImageFile(
  file: File | { name: string; type: string; size: number },
  maxSize: number = 5 * 1024 * 1024 // 5MB default for images
): FileValidationResult {
  // Check if it's actually an image
  if (!isImageFile(file)) {
    return {
      valid: false,
      error: 'Only image files are allowed',
      errorCode: 'INVALID_TYPE',
    }
  }

  // SVG files need special handling (can contain scripts)
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return {
      valid: false,
      error: 'SVG files are not allowed for avatars due to security concerns',
      errorCode: 'INVALID_TYPE',
    }
  }

  // Check size
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024))
    return {
      valid: false,
      error: `Image too large. Maximum size is ${maxMB}MB`,
      errorCode: 'FILE_TOO_LARGE',
    }
  }

  // Check filename (SEC-032 enhanced)
  const filenameCheck = hasSuspiciousFilename(file.name)
  if (filenameCheck.suspicious) {
    return {
      valid: false,
      error: filenameCheck.reason,
      errorCode: 'SUSPICIOUS_FILENAME',
    }
  }

  return { valid: true }
}

/**
 * Check if file is an archive type
 */
export function isArchiveFile(file: { type: string; name: string }): boolean {
  const archiveTypes = new Set([
    'application/zip',
    'application/gzip',
    'application/x-tar',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ])
  const archiveExtensions = new Set(['.zip', '.gz', '.tar', '.rar', '.7z', '.tgz', '.tar.gz'])
  const ext = getFileExtension(file.name)

  // Handle double extensions like .tar.gz
  const fullName = file.name.toLowerCase()
  if (fullName.endsWith('.tar.gz') || fullName.endsWith('.tgz')) {
    return true
  }

  return archiveTypes.has(file.type) || archiveExtensions.has(ext)
}

/**
 * Validate archive file with strict limits (SEC-030)
 * For client-side quick validation before deep server-side scan
 */
export function validateArchiveFile(
  file: File | { name: string; type: string; size: number },
  options: FileValidationOptions = {}
): FileValidationResult {
  // First run standard validation
  const baseResult = validateFile(file, options)
  if (!baseResult.valid) {
    return baseResult
  }

  // Check if it's actually an archive
  if (!isArchiveFile(file)) {
    return { valid: true } // Not an archive, skip archive-specific checks
  }

  // Warn about archive risks - full validation requires server-side extraction
  // For now, we accept archives with a size limit that prevents obvious zip bombs
  const tier = options.tier || 'basic'
  const maxSize = TIER_MAX_FILE_SIZES[tier] || DEFAULT_MAX_FILE_SIZE

  // Archives get stricter size limits (50% of normal) to account for compression
  const archiveMaxSize = Math.floor(maxSize * 0.5)
  if (file.size > archiveMaxSize) {
    return {
      valid: false,
      error: `Archive too large. Maximum archive size is ${Math.round(archiveMaxSize / (1024 * 1024))}MB`,
      errorCode: 'FILE_TOO_LARGE',
    }
  }

  return { valid: true }
}

/**
 * SEC-036: Secure temporary directory creation
 * Creates a unique temp directory with randomized name to prevent symlink attacks
 *
 * Attack scenario this prevents:
 * 1. Attacker creates symlink at predictable temp path pointing to /etc/passwd
 * 2. Application writes uploaded file to that path
 * 3. Attacker's content overwrites sensitive system file
 *
 * Defense: Use cryptographically random directory names that can't be predicted
 */
export interface SecureTempDirResult {
  path: string
  cleanup: () => Promise<void>
}

/**
 * SEC-036: Create a secure temporary directory with unpredictable name
 * Returns the path and a cleanup function
 */
export async function createSecureTempDir(prefix = 'nexus-upload-'): Promise<SecureTempDirResult> {
  // SEC-036: Generate cryptographically random suffix (32 hex chars = 128 bits)
  const randomSuffix = randomBytes(16).toString('hex')
  const dirName = `${prefix}${randomSuffix}`

  // Use OS temp directory as base
  const baseTempDir = os.tmpdir()
  const targetDir = path.join(baseTempDir, dirName)

  // SEC-036: Check if path already exists (should never happen with 128-bit random)
  // This is defense-in-depth against extremely unlikely collision
  try {
    const stat = await fs.promises.lstat(targetDir)
    if (stat) {
      // Path exists - this is suspicious, could be an attack or cosmic ray collision
      throw new Error(`SEC-036: Temp path collision detected: ${targetDir}`)
    }
  } catch (err) {
    // ENOENT is expected - path doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }

  // SEC-036: Create directory with restricted permissions (owner only)
  await fs.promises.mkdir(targetDir, { mode: 0o700, recursive: false })

  // SEC-036: Verify the created path is a directory, not a symlink
  // This catches TOCTOU race where attacker creates symlink between check and mkdir
  const stat = await fs.promises.lstat(targetDir)
  if (stat.isSymbolicLink()) {
    // Symlink detected - this is an attack attempt
    await fs.promises.rmdir(targetDir).catch(() => {}) // Best effort cleanup
    throw new Error(`SEC-036: Symlink attack detected on temp directory: ${targetDir}`)
  }

  // Return path and cleanup function
  const cleanup = async () => {
    try {
      // SEC-036: Remove directory and contents securely
      await fs.promises.rm(targetDir, { recursive: true, force: true })
    } catch {
      // Best effort cleanup - log but don't throw
      console.warn(`SEC-036: Failed to cleanup temp directory: ${targetDir}`)
    }
  }

  return { path: targetDir, cleanup }
}

/**
 * SEC-036: Write file to secure temp location with symlink protection
 * Returns the full path to the written file
 */
export async function writeSecureTempFile(
  content: Buffer | Uint8Array,
  filename: string,
  tempDir?: string
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  // SEC-032: Sanitize filename first
  const sanitizedName = sanitizeFilename(filename)

  // Create secure temp dir if not provided
  let tempDirResult: SecureTempDirResult | null = null
  let targetDir: string

  if (tempDir) {
    // Validate provided temp dir
    targetDir = tempDir

    // SEC-036: Verify temp dir exists and is a directory (not symlink)
    const stat = await fs.promises.lstat(targetDir)
    if (stat.isSymbolicLink()) {
      throw new Error(`SEC-036: Symlink detected in temp directory path: ${targetDir}`)
    }
    if (!stat.isDirectory()) {
      throw new Error(`SEC-036: Temp path is not a directory: ${targetDir}`)
    }
  } else {
    tempDirResult = await createSecureTempDir()
    targetDir = tempDirResult.path
  }

  // SEC-036: Construct target file path and verify it's within temp dir
  const targetPath = path.join(targetDir, sanitizedName)
  const resolvedPath = path.resolve(targetPath)
  const resolvedDir = path.resolve(targetDir)

  // SEC-036: Path traversal check - ensure file stays within temp dir
  if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
    throw new Error(`SEC-036: Path traversal detected: ${sanitizedName}`)
  }

  // SEC-036: Check if file already exists (shouldn't in fresh temp dir)
  try {
    const existingStat = await fs.promises.lstat(targetPath)
    if (existingStat.isSymbolicLink()) {
      throw new Error(`SEC-036: Symlink attack detected on temp file: ${targetPath}`)
    }
    // File exists - delete it first to ensure clean state
    await fs.promises.unlink(targetPath)
  } catch (err) {
    // ENOENT is expected - file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }

  // SEC-036: Write file with restricted permissions and O_EXCL flag
  // O_EXCL ensures the file didn't exist at write time (prevents TOCTOU)
  const fileHandle = await fs.promises.open(
    targetPath,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
    0o600 // Owner read/write only
  )

  try {
    await fileHandle.write(Buffer.from(content))
  } finally {
    await fileHandle.close()
  }

  // SEC-036: Final verification - ensure written file is not a symlink
  const finalStat = await fs.promises.lstat(targetPath)
  if (finalStat.isSymbolicLink()) {
    await fs.promises.unlink(targetPath).catch(() => {})
    throw new Error(`SEC-036: File became symlink after write (race condition): ${targetPath}`)
  }

  // Cleanup function removes the file and optionally the temp dir
  const cleanup = async () => {
    try {
      await fs.promises.unlink(targetPath).catch(() => {})
      if (tempDirResult) {
        await tempDirResult.cleanup()
      }
    } catch {
      // Best effort
    }
  }

  return { filePath: targetPath, cleanup }
}

/**
 * SEC-036: Read file from temp location with symlink protection
 * Verifies the file is not a symlink before reading
 */
export async function readSecureTempFile(filePath: string): Promise<Buffer> {
  // SEC-036: Verify file is not a symlink before reading
  const stat = await fs.promises.lstat(filePath)

  if (stat.isSymbolicLink()) {
    throw new Error(`SEC-036: Symlink detected when reading temp file: ${filePath}`)
  }

  if (!stat.isFile()) {
    throw new Error(`SEC-036: Path is not a regular file: ${filePath}`)
  }

  return fs.promises.readFile(filePath)
}
