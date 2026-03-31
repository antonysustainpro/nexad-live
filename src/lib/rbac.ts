/**
 * Role-Based Access Control and Tenant Isolation (SEC-007, SEC-019, SEC-029)
 *
 * This module provides:
 * - Role-based access control (RBAC) with permission definitions
 * - Tenant isolation to prevent data leakage between tenants
 * - Resource access validation to prevent IDOR attacks
 * - User context extraction from JWT tokens
 * - SEC-029: Audit logging for all access control decisions
 * - SEC-030: External audit log sink with SIEM integration
 * - SEC-031: Time-based permission elevation for admin actions
 * - SEC-032: Permission caching with TTL
 * - SEC-033: Rate limiting for permission checks
 * - SEC-034: Break glass emergency access logging
 * - SEC-035: Local file fallback for audit log persistence (crash-safe)
 * - SEC-036: AES-256-GCM encryption for fallback audit log entries
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ============================================================================
// SEC-030: External Audit Log Sink Interface (SIEM Integration)
// ============================================================================

/**
 * SEC-030: Structured audit log format compatible with CEF and JSON SIEM formats
 */
export interface AccessAuditLog {
  timestamp: string
  userId: string
  tenantId: string
  action: 'read' | 'write' | 'delete' | 'permission_check' | 'admin_action' | 'break_glass'
  resource?: string
  resourceOwnerId?: string
  decision: 'allowed' | 'denied'
  reason?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  // SEC-030: CEF severity level (0-10)
  severity?: number
  // SEC-030: Additional metadata for SIEM
  metadata?: Record<string, unknown>
}

/**
 * SEC-030: Interface for external audit log sink (SIEM integration)
 * Implement this interface to send logs to Splunk, Datadog, ELK, etc.
 */
export interface AuditLogSink {
  /** Unique identifier for this sink */
  readonly id: string
  /** Send a batch of logs to the external system */
  send(logs: AccessAuditLog[]): Promise<AuditSinkResult>
  /** Check if the sink is healthy/connected */
  healthCheck(): Promise<boolean>
}

export interface AuditSinkResult {
  success: boolean
  processedCount: number
  failedCount: number
  error?: string
}

/**
 * SEC-030: Fallback queue for failed audit log deliveries
 */
interface QueuedAuditBatch {
  logs: AccessAuditLog[]
  attempts: number
  lastAttempt: number
  sinkId: string
}

// SEC-030: Audit infrastructure
const auditBuffer: AccessAuditLog[] = []
const MAX_AUDIT_BUFFER = 1000
const registeredSinks: Map<string, AuditLogSink> = new Map()
const failedQueue: QueuedAuditBatch[] = []
const MAX_RETRY_ATTEMPTS = 5
const RETRY_BACKOFF_MS = 1000 // Exponential backoff base
const MAX_FAILED_QUEUE_SIZE = 5000
let flushIntervalId: ReturnType<typeof setInterval> | null = null
const FLUSH_INTERVAL_MS = 5000 // Flush every 5 seconds

// ============================================================================
// SEC-035: Local File Fallback for Audit Log Persistence
// SEC-036: AES-256-GCM Encryption for Fallback Audit Logs
// ============================================================================

/**
 * SEC-035: Configuration for local file fallback
 * - AUDIT_LOG_FALLBACK_PATH: Path to the fallback file (default: /tmp/nexus-audit-fallback.jsonl)
 * - Uses append-only writes for crash safety
 * - JSONL format (one JSON object per line) for easy parsing
 *
 * SEC-036: Encryption configuration
 * - AUDIT_LOG_ENCRYPTION_KEY: 32-byte hex key for AES-256-GCM (or derived from CSRF_SECRET)
 * - Each log entry has unique 12-byte IV for security
 * - Format: IV(24 hex chars) + ":" + ciphertext(hex) + ":" + authTag(32 hex chars) + newline
 */
const AUDIT_LOG_FALLBACK_PATH = process.env.AUDIT_LOG_FALLBACK_PATH || '/tmp/nexus-audit-fallback.jsonl'
let fallbackRecoveryAttempted = false

// SEC-036: Encryption constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV for GCM (recommended by NIST)
const AUTH_TAG_LENGTH = 16 // 128-bit auth tag

/**
 * SEC-036: Derive encryption key from environment variable or CSRF secret
 * Uses HKDF for secure key derivation when using CSRF secret as source
 */
function getAuditLogEncryptionKey(): Buffer {
  const explicitKey = process.env.AUDIT_LOG_ENCRYPTION_KEY

  if (explicitKey) {
    // SEC-036: Validate explicit key is proper 32-byte hex
    if (!/^[a-fA-F0-9]{64}$/.test(explicitKey)) {
      throw new Error('[RBAC SEC-036] AUDIT_LOG_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    }
    return Buffer.from(explicitKey, 'hex')
  }

  // SEC-036: Fall back to deriving from CSRF_SECRET using HKDF
  const csrfSecret = process.env.CSRF_SECRET
  if (!csrfSecret) {
    throw new Error('[RBAC SEC-036] Neither AUDIT_LOG_ENCRYPTION_KEY nor CSRF_SECRET is set. Cannot encrypt audit logs.')
  }

  // Use HKDF to derive a proper 32-byte key from CSRF secret
  // This ensures we get a cryptographically strong key even if CSRF_SECRET is weak
  const salt = Buffer.from('nexus-audit-log-encryption-v1', 'utf8')
  const info = Buffer.from('audit-fallback-aes256gcm', 'utf8')

  // hkdfSync returns ArrayBuffer, wrap in Buffer for crypto operations
  return Buffer.from(crypto.hkdfSync('sha256', csrfSecret, salt, info, 32))
}

/**
 * SEC-036: Encrypt a single audit log entry using AES-256-GCM
 * Returns format: IV(hex):ciphertext(hex):authTag(hex)
 */
function encryptAuditLogEntry(log: AccessAuditLog): string {
  const key = getAuditLogEncryptionKey()

  // SEC-036: Generate unique IV for each entry (critical for GCM security)
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  })

  const plaintext = JSON.stringify({
    _fallbackTimestamp: Date.now(),
    ...log
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  // SEC-036: Format as IV:ciphertext:authTag (all hex encoded)
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`
}

/**
 * SEC-036: Decrypt a single audit log entry from encrypted format
 * Input format: IV(hex):ciphertext(hex):authTag(hex)
 */
function decryptAuditLogEntry(encryptedLine: string): AccessAuditLog | null {
  try {
    const parts = encryptedLine.split(':')
    if (parts.length !== 3) {
      console.warn('[RBAC SEC-036] Invalid encrypted line format (expected 3 parts)')
      return null
    }

    const [ivHex, ciphertextHex, authTagHex] = parts

    // SEC-036: Validate IV length (24 hex chars = 12 bytes)
    if (ivHex.length !== IV_LENGTH * 2) {
      console.warn(`[RBAC SEC-036] Invalid IV length: ${ivHex.length}, expected ${IV_LENGTH * 2}`)
      return null
    }

    // SEC-036: Validate auth tag length (32 hex chars = 16 bytes)
    if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
      console.warn(`[RBAC SEC-036] Invalid auth tag length: ${authTagHex.length}, expected ${AUTH_TAG_LENGTH * 2}`)
      return null
    }

    const key = getAuditLogEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ])

    const parsed = JSON.parse(decrypted.toString('utf8')) as AccessAuditLog & { _fallbackTimestamp?: number }
    // Remove internal fallback timestamp before returning
    delete parsed._fallbackTimestamp

    return parsed
  } catch (error) {
    // SEC-036: Auth tag mismatch or other decryption failure
    if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
      console.warn('[RBAC SEC-036] Decryption failed: authentication tag mismatch (possible tampering or wrong key)')
    } else {
      console.warn(
        '[RBAC SEC-036] Decryption failed:',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
    return null
  }
}

/**
 * SEC-036: Bulk decrypt audit logs from fallback file for recovery tools
 * Exported for administrative recovery scenarios
 *
 * @param filePath - Path to the encrypted fallback file (defaults to AUDIT_LOG_FALLBACK_PATH)
 * @param customKey - Optional 32-byte hex key to use instead of environment variable
 * @returns Array of decrypted audit logs and count of failed entries
 */
export function decryptAuditLogFallbackFile(
  filePath?: string,
  customKey?: string
): { logs: AccessAuditLog[]; decrypted: number; failed: number } {
  const targetPath = filePath || AUDIT_LOG_FALLBACK_PATH

  // SEC-036: Temporarily override key if provided
  const originalKey = process.env.AUDIT_LOG_ENCRYPTION_KEY
  if (customKey) {
    if (!/^[a-fA-F0-9]{64}$/.test(customKey)) {
      throw new Error('[RBAC SEC-036] Custom key must be exactly 64 hex characters (32 bytes)')
    }
    process.env.AUDIT_LOG_ENCRYPTION_KEY = customKey
  }

  try {
    if (!fs.existsSync(targetPath)) {
      return { logs: [], decrypted: 0, failed: 0 }
    }

    const content = fs.readFileSync(targetPath, 'utf8')
    const lines = content.trim().split('\n').filter(line => line.trim())

    const logs: AccessAuditLog[] = []
    let decrypted = 0
    let failed = 0

    for (const line of lines) {
      const log = decryptAuditLogEntry(line)
      if (log) {
        logs.push(log)
        decrypted++
      } else {
        failed++
      }
    }

    return { logs, decrypted, failed }
  } finally {
    // SEC-036: Restore original key
    if (customKey) {
      if (originalKey !== undefined) {
        process.env.AUDIT_LOG_ENCRYPTION_KEY = originalKey
      } else {
        delete process.env.AUDIT_LOG_ENCRYPTION_KEY
      }
    }
  }
}

/**
 * SEC-035: Write audit log to local fallback file (crash-safe, append-only)
 * SEC-036: Now encrypts each entry with AES-256-GCM before writing
 * This is called when SIEM delivery fails and retry queue is exhausted
 */
function writeToFallbackFile(logs: AccessAuditLog[]): boolean {
  if (logs.length === 0) return true

  try {
    // Ensure directory exists
    const dir = path.dirname(AUDIT_LOG_FALLBACK_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    }

    // SEC-036: Encrypt each log entry individually with unique IV
    // Format: IV(hex):ciphertext(hex):authTag(hex) per line
    const encryptedLines: string[] = []
    for (const log of logs) {
      try {
        const encrypted = encryptAuditLogEntry(log)
        encryptedLines.push(encrypted)
      } catch (encryptError) {
        // SEC-036: If encryption fails (e.g., no key), log error but don't lose the audit log
        console.error(
          '[RBAC SEC-036] Encryption failed, audit log cannot be written securely:',
          encryptError instanceof Error ? encryptError.message : 'Unknown error'
        )
        // Return false to indicate failure - we refuse to write unencrypted logs
        return false
      }
    }

    const content = encryptedLines.join('\n') + '\n'

    // SECURITY FIX (Round 6): Check for symlink at fallback path before writing.
    // Predictable /tmp paths are vulnerable to symlink attacks where an attacker
    // pre-creates a symlink to redirect writes (e.g., ln -s /etc/cron.d/evil /tmp/nexus-audit-fallback.jsonl).
    try {
      const stat = fs.lstatSync(AUDIT_LOG_FALLBACK_PATH)
      if (stat.isSymbolicLink()) {
        console.error(`[RBAC SEC-036] Symlink detected at audit fallback path: ${AUDIT_LOG_FALLBACK_PATH} — refusing to write`)
        return false
      }
    } catch (statErr) {
      // ENOENT is fine — file doesn't exist yet, appendFileSync will create it
      if ((statErr as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw statErr
      }
    }

    // Append synchronously for crash safety - this ensures data hits disk before we continue
    fs.appendFileSync(AUDIT_LOG_FALLBACK_PATH, content, { encoding: 'utf8', mode: 0o600 })

    console.warn(`[RBAC FALLBACK] Wrote ${logs.length} encrypted audit logs to fallback file: ${AUDIT_LOG_FALLBACK_PATH}`)
    return true
  } catch (error) {
    // This is a critical failure - we're losing audit logs
    console.error(
      `[RBAC CRITICAL] Failed to write to fallback file ${AUDIT_LOG_FALLBACK_PATH}:`,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return false
  }
}

/**
 * SEC-035: Read and parse audit logs from fallback file
 * SEC-036: Now decrypts each AES-256-GCM encrypted entry
 * Returns logs that were saved during SIEM outages
 */
function readFallbackFile(): AccessAuditLog[] {
  try {
    if (!fs.existsSync(AUDIT_LOG_FALLBACK_PATH)) {
      return []
    }

    const content = fs.readFileSync(AUDIT_LOG_FALLBACK_PATH, 'utf8')
    const lines = content.trim().split('\n').filter(line => line.trim())

    const logs: AccessAuditLog[] = []
    let decryptionFailures = 0

    for (const line of lines) {
      // SEC-036: Decrypt each encrypted line
      const decrypted = decryptAuditLogEntry(line)
      if (decrypted) {
        logs.push(decrypted)
      } else {
        decryptionFailures++
        console.warn(`[RBAC SEC-036] Failed to decrypt fallback log entry (line ${logs.length + decryptionFailures})`)
      }
    }

    if (decryptionFailures > 0) {
      console.warn(`[RBAC SEC-036] ${decryptionFailures} of ${lines.length} fallback log entries could not be decrypted`)
    }

    return logs
  } catch (error) {
    console.error(
      `[RBAC FALLBACK] Failed to read fallback file:`,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return []
  }
}

/**
 * SEC-035: Clear the fallback file after successful recovery
 * Uses atomic rename for safety
 */
function clearFallbackFile(): boolean {
  try {
    if (!fs.existsSync(AUDIT_LOG_FALLBACK_PATH)) {
      return true
    }

    // Rename to .processed instead of deleting, for forensics if needed
    const processedPath = `${AUDIT_LOG_FALLBACK_PATH}.processed.${Date.now()}`
    fs.renameSync(AUDIT_LOG_FALLBACK_PATH, processedPath)

    console.info(`[RBAC FALLBACK] Cleared fallback file, archived to: ${processedPath}`)
    return true
  } catch (error) {
    console.error(
      `[RBAC FALLBACK] Failed to clear fallback file:`,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return false
  }
}

/**
 * SEC-035: Attempt to recover and send any logs from the fallback file
 * Called on startup when a sink is registered
 */
async function recoverFallbackLogs(): Promise<{ recovered: number; failed: number }> {
  const fallbackLogs = readFallbackFile()

  if (fallbackLogs.length === 0) {
    return { recovered: 0, failed: 0 }
  }

  console.info(`[RBAC FALLBACK] Found ${fallbackLogs.length} logs in fallback file, attempting recovery...`)

  let recovered = 0
  let failed = 0

  // Try to send to all registered sinks
  for (const [sinkId, sink] of registeredSinks) {
    try {
      // Check sink health first
      const isHealthy = await sink.healthCheck()
      if (!isHealthy) {
        console.warn(`[RBAC FALLBACK] Sink ${sinkId} is unhealthy, skipping recovery for this sink`)
        continue
      }

      const result = await sink.send(fallbackLogs)
      if (result.success) {
        recovered += result.processedCount
        console.info(`[RBAC FALLBACK] Successfully recovered ${result.processedCount} logs to sink ${sinkId}`)
      } else {
        failed += result.failedCount
        console.warn(`[RBAC FALLBACK] Partial recovery to sink ${sinkId}: ${result.processedCount} success, ${result.failedCount} failed`)
      }
    } catch (error) {
      console.error(
        `[RBAC FALLBACK] Recovery to sink ${sinkId} failed:`,
        error instanceof Error ? error.message : 'Unknown error'
      )
      failed += fallbackLogs.length
    }
  }

  // Only clear fallback file if at least one sink successfully received all logs
  if (recovered >= fallbackLogs.length) {
    clearFallbackFile()
  } else {
    console.warn(`[RBAC FALLBACK] Not all logs recovered (${recovered}/${fallbackLogs.length}), keeping fallback file`)
  }

  return { recovered, failed }
}

/**
 * SEC-035: Get fallback file status for monitoring
 */
export function getAuditFallbackStatus(): {
  path: string
  exists: boolean
  pendingLogs: number
  sizeBytes: number
} {
  let exists = false
  let pendingLogs = 0
  let sizeBytes = 0

  try {
    if (fs.existsSync(AUDIT_LOG_FALLBACK_PATH)) {
      exists = true
      const stats = fs.statSync(AUDIT_LOG_FALLBACK_PATH)
      sizeBytes = stats.size

      // Count lines for pending logs (more efficient than parsing)
      const content = fs.readFileSync(AUDIT_LOG_FALLBACK_PATH, 'utf8')
      pendingLogs = content.trim().split('\n').filter(line => line.trim()).length
    }
  } catch {
    // Ignore errors, return default values
  }

  return {
    path: AUDIT_LOG_FALLBACK_PATH,
    exists,
    pendingLogs,
    sizeBytes,
  }
}

/**
 * SEC-035: Manually trigger fallback recovery (for admin use)
 */
export async function triggerFallbackRecovery(): Promise<{ recovered: number; failed: number }> {
  return recoverFallbackLogs()
}

/**
 * SEC-035: Synchronous shutdown handler - flushes all pending logs to fallback file
 * Call this during graceful shutdown (SIGTERM, SIGINT handlers) to ensure no logs are lost
 * Uses synchronous operations because async may not complete during shutdown
 */
export function flushAuditLogsSync(): { flushed: number; inBuffer: number; inRetryQueue: number } {
  const inBuffer = auditBuffer.length
  const inRetryQueue = failedQueue.reduce((sum, batch) => sum + batch.logs.length, 0)

  // Write buffer to fallback file
  if (auditBuffer.length > 0) {
    const bufferLogs = auditBuffer.splice(0, auditBuffer.length)
    writeToFallbackFile(bufferLogs)
  }

  // Write all retry queue entries to fallback file
  while (failedQueue.length > 0) {
    const batch = failedQueue.shift()
    if (batch) {
      writeToFallbackFile(batch.logs)
    }
  }

  // Stop the flush interval
  if (flushIntervalId) {
    clearInterval(flushIntervalId)
    flushIntervalId = null
  }

  console.info(`[RBAC FALLBACK] Shutdown flush complete: ${inBuffer} from buffer, ${inRetryQueue} from retry queue`)

  return {
    flushed: inBuffer + inRetryQueue,
    inBuffer,
    inRetryQueue,
  }
}

/**
 * SEC-035: Install process shutdown handlers to ensure audit logs are persisted
 * Call this once during application startup
 */
export function installShutdownHandlers(): void {
  let shuttingDown = false

  const handleShutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true

    console.info(`[RBAC FALLBACK] Received ${signal}, flushing audit logs...`)
    const result = flushAuditLogsSync()
    console.info(`[RBAC FALLBACK] Flushed ${result.flushed} audit logs before shutdown`)
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'))
  process.on('SIGINT', () => handleShutdown('SIGINT'))
  process.on('beforeExit', () => handleShutdown('beforeExit'))

  // Handle uncaught exceptions - try to save logs before crashing
  process.on('uncaughtException', (error) => {
    console.error('[RBAC FALLBACK] Uncaught exception, attempting to flush audit logs:', error.message)
    try {
      flushAuditLogsSync()
    } catch (flushError) {
      console.error('[RBAC FALLBACK] Failed to flush during uncaughtException:', flushError)
    }
    // Re-throw to allow normal crash handling
    throw error
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[RBAC FALLBACK] Unhandled rejection, attempting to flush audit logs:', reason)
    try {
      flushAuditLogsSync()
    } catch (flushError) {
      console.error('[RBAC FALLBACK] Failed to flush during unhandledRejection:', flushError)
    }
  })

  console.info('[RBAC FALLBACK] Shutdown handlers installed')
}

/**
 * SEC-030: Register an external audit log sink
 * SEC-035: Also attempts to recover any logs from the fallback file on first sink registration
 */
export function registerAuditSink(sink: AuditLogSink): void {
  registeredSinks.set(sink.id, sink)

  // Start automatic flushing if not already running
  if (!flushIntervalId && registeredSinks.size > 0) {
    flushIntervalId = setInterval(() => {
      void flushAuditLogs()
    }, FLUSH_INTERVAL_MS)
  }

  // SEC-035: Attempt to recover fallback logs on first sink registration
  if (!fallbackRecoveryAttempted) {
    fallbackRecoveryAttempted = true
    // Run recovery asynchronously to not block sink registration
    void recoverFallbackLogs().then(({ recovered, failed }) => {
      if (recovered > 0 || failed > 0) {
        console.info(`[RBAC FALLBACK] Recovery complete: ${recovered} recovered, ${failed} failed`)
      }
    }).catch(error => {
      console.error('[RBAC FALLBACK] Recovery failed:', error instanceof Error ? error.message : 'Unknown error')
    })
  }
}

/**
 * SEC-030: Unregister an audit log sink
 */
export function unregisterAuditSink(sinkId: string): boolean {
  const removed = registeredSinks.delete(sinkId)

  // Stop flushing if no sinks remain
  if (registeredSinks.size === 0 && flushIntervalId) {
    clearInterval(flushIntervalId)
    flushIntervalId = null
  }

  return removed
}

/**
 * SEC-030: Flush audit logs to all registered sinks
 */
export async function flushAuditLogs(): Promise<void> {
  if (auditBuffer.length === 0 && failedQueue.length === 0) {
    return
  }

  // Get current batch and clear buffer atomically
  const currentBatch = auditBuffer.splice(0, auditBuffer.length)

  // Send to all registered sinks
  for (const [sinkId, sink] of registeredSinks) {
    try {
      const result = await sink.send(currentBatch)
      if (!result.success) {
        // SEC-030: Queue failed batch for retry
        queueFailedBatch(currentBatch, sinkId, result.error)
      }
    } catch (error) {
      // SEC-030: Queue failed batch for retry
      queueFailedBatch(currentBatch, sinkId, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Process retry queue
  await processRetryQueue()
}

/**
 * SEC-030: Queue a failed batch for retry with exponential backoff
 * SEC-035: Writes to fallback file instead of dropping logs when queue is full
 */
function queueFailedBatch(logs: AccessAuditLog[], sinkId: string, error?: string): void {
  if (failedQueue.length >= MAX_FAILED_QUEUE_SIZE) {
    // SEC-035: Write to fallback file instead of dropping
    console.error(
      `[RBAC CRITICAL] Audit log queue full (${MAX_FAILED_QUEUE_SIZE}), writing to fallback file. Error: ${error}`
    )
    // Write the oldest queued batch to fallback file
    const oldestBatch = failedQueue.shift()
    if (oldestBatch) {
      writeToFallbackFile(oldestBatch.logs)
    }
  }

  failedQueue.push({
    logs,
    attempts: 1,
    lastAttempt: Date.now(),
    sinkId,
  })
}

/**
 * SEC-030: Process the retry queue with exponential backoff
 * SEC-035: Writes to fallback file instead of dropping logs after max retries
 */
async function processRetryQueue(): Promise<void> {
  const now = Date.now()
  const toRemove: number[] = []
  const toFallback: AccessAuditLog[][] = []

  for (let i = 0; i < failedQueue.length; i++) {
    const batch = failedQueue[i]
    const backoffMs = RETRY_BACKOFF_MS * Math.pow(2, batch.attempts - 1)

    // Check if enough time has passed for retry
    if (now - batch.lastAttempt < backoffMs) {
      continue
    }

    const sink = registeredSinks.get(batch.sinkId)
    if (!sink) {
      // SEC-035: Sink no longer registered, write to fallback file
      console.warn(`[RBAC FALLBACK] Sink ${batch.sinkId} no longer registered, writing ${batch.logs.length} logs to fallback`)
      toFallback.push(batch.logs)
      toRemove.push(i)
      continue
    }

    try {
      const result = await sink.send(batch.logs)
      if (result.success) {
        toRemove.push(i)
      } else {
        batch.attempts++
        batch.lastAttempt = now
        if (batch.attempts > MAX_RETRY_ATTEMPTS) {
          // SEC-035: Write to fallback file instead of dropping
          console.error(
            `[RBAC CRITICAL] Audit log delivery failed after ${MAX_RETRY_ATTEMPTS} attempts, writing ${batch.logs.length} logs to fallback file`
          )
          toFallback.push(batch.logs)
          toRemove.push(i)
        }
      }
    } catch {
      batch.attempts++
      batch.lastAttempt = now
      if (batch.attempts > MAX_RETRY_ATTEMPTS) {
        // SEC-035: Write to fallback file instead of dropping
        console.error(
          `[RBAC CRITICAL] Audit log delivery failed after ${MAX_RETRY_ATTEMPTS} attempts, writing ${batch.logs.length} logs to fallback file`
        )
        toFallback.push(batch.logs)
        toRemove.push(i)
      }
    }
  }

  // SEC-035: Write all failed batches to fallback file
  for (const logs of toFallback) {
    writeToFallbackFile(logs)
  }

  // Remove processed batches (in reverse order to maintain indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    failedQueue.splice(toRemove[i], 1)
  }
}

/**
 * SEC-030: Convert audit log to CEF format for SIEM compatibility
 */
export function formatAsCEF(log: AccessAuditLog): string {
  const severity = log.severity ?? (log.decision === 'denied' ? 5 : 1)
  const extension = [
    `src=${log.ipAddress || 'unknown'}`,
    `suser=${log.userId}`,
    `duser=${log.resourceOwnerId || 'N/A'}`,
    `cs1=${log.tenantId}`,
    `cs1Label=TenantID`,
    `outcome=${log.decision}`,
    `reason=${log.reason || 'N/A'}`,
  ].join(' ')

  return `CEF:0|NexusAI|RBAC|1.0|${log.action}|Access ${log.decision}|${severity}|${extension}`
}

/**
 * SEC-030: Convert audit log to structured JSON for SIEM
 */
export function formatAsJSON(log: AccessAuditLog): string {
  return JSON.stringify({
    '@timestamp': log.timestamp,
    event: {
      category: 'authentication',
      type: log.action,
      outcome: log.decision,
    },
    user: {
      id: log.userId,
      roles: [],
    },
    source: {
      ip: log.ipAddress,
    },
    organization: {
      id: log.tenantId,
    },
    resource: {
      id: log.resource,
      owner: log.resourceOwnerId,
    },
    message: log.reason,
    labels: log.metadata,
  })
}

/**
 * Log an access decision for security auditing (SEC-029, SEC-030, SEC-035)
 * SEC-035: If no sinks are registered, writes directly to fallback file for crash safety
 * @param log - The audit log entry
 */
export function logAccessDecision(log: AccessAuditLog): void {
  // Add to buffer (non-blocking)
  auditBuffer.push(log)

  // SEC-035: If no sinks registered, write to fallback file immediately for crash safety
  // This ensures high-severity events are persisted even if process crashes before flush
  if (registeredSinks.size === 0) {
    // Only write high-severity events immediately (denied access, break glass, admin actions)
    const isHighSeverity = log.decision === 'denied' ||
                          log.action === 'break_glass' ||
                          log.action === 'admin_action' ||
                          (log.severity !== undefined && log.severity >= 5)
    if (isHighSeverity) {
      writeToFallbackFile([log])
    }
  }

  // Trim buffer if too large - SEC-035: write to fallback instead of losing logs
  if (auditBuffer.length > MAX_AUDIT_BUFFER) {
    const overflow = auditBuffer.shift()
    if (overflow) {
      writeToFallbackFile([overflow])
    }
  }

  // Log to console in development for debugging
  if (process.env.NODE_ENV === 'development') {
    const emoji = log.decision === 'allowed' ? '✓' : '✗'
    console.log(
      `[RBAC ${emoji}] ${log.action} by ${log.userId} on ${log.resource || 'N/A'} - ${log.decision}${log.reason ? ` (${log.reason})` : ''}`
    )
  }
}

/**
 * Get audit logs (for admin dashboard or SIEM export)
 */
export function getAuditLogs(): AccessAuditLog[] {
  return [...auditBuffer]
}

/**
 * Clear audit buffer (after export to external system)
 */
export function clearAuditBuffer(): void {
  auditBuffer.length = 0
}

/**
 * SEC-030: Get retry queue status for monitoring
 * SEC-035: Now includes fallback file status
 */
export function getAuditQueueStatus(): {
  bufferSize: number
  failedQueueSize: number
  registeredSinks: string[]
  fallback: {
    path: string
    exists: boolean
    pendingLogs: number
    sizeBytes: number
  }
} {
  return {
    bufferSize: auditBuffer.length,
    failedQueueSize: failedQueue.length,
    registeredSinks: Array.from(registeredSinks.keys()),
    fallback: getAuditFallbackStatus(),
  }
}

// ============================================================================
// SEC-031: Time-Based Permission Elevation for Admin Actions
// ============================================================================

/**
 * SEC-031: Admin elevation session tracking
 */
interface AdminElevationSession {
  userId: string
  tenantId: string
  elevatedAt: number
  expiresAt: number
  scopedTenants?: string[] // SEC-031: Admin can be scoped to specific tenants
  breakGlassReason?: string // SEC-034: Reason for break glass access
}

const adminElevationSessions: Map<string, AdminElevationSession> = new Map()
const ADMIN_ELEVATION_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * SEC-031: Elevate admin permissions (requires re-authentication)
 * Call this after admin successfully re-authenticates
 */
export function elevateAdminPermissions(
  userId: string,
  tenantId: string,
  scopedTenants?: string[],
  breakGlassReason?: string
): AdminElevationSession {
  const now = Date.now()
  const session: AdminElevationSession = {
    userId,
    tenantId,
    elevatedAt: now,
    expiresAt: now + ADMIN_ELEVATION_TTL_MS,
    scopedTenants,
    breakGlassReason,
  }

  const sessionKey = `${userId}:${tenantId}`
  adminElevationSessions.set(sessionKey, session)

  // SEC-034: Log break glass access
  if (breakGlassReason) {
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId,
      tenantId,
      action: 'break_glass',
      decision: 'allowed',
      reason: `Emergency access: ${breakGlassReason}`,
      severity: 8, // High severity for break glass
      metadata: {
        breakGlassReason,
        scopedTenants,
        expiresAt: session.expiresAt,
      },
    })
  }

  // Log admin elevation
  logAccessDecision({
    timestamp: new Date().toISOString(),
    userId,
    tenantId,
    action: 'admin_action',
    decision: 'allowed',
    reason: 'Admin permissions elevated',
    severity: 6,
    metadata: {
      scopedTenants,
      expiresAt: session.expiresAt,
      isBreakGlass: !!breakGlassReason,
    },
  })

  return session
}

/**
 * SEC-031: Check if admin elevation is valid and not expired
 */
export function isAdminElevationValid(userId: string, tenantId: string): boolean {
  const sessionKey = `${userId}:${tenantId}`
  const session = adminElevationSessions.get(sessionKey)

  if (!session) {
    return false
  }

  if (Date.now() > session.expiresAt) {
    // Clean up expired session
    adminElevationSessions.delete(sessionKey)
    return false
  }

  return true
}

/**
 * SEC-031: Check if admin has access to a specific tenant (scoped access)
 */
export function isAdminScopedToTenant(userId: string, adminTenantId: string, targetTenantId: string): boolean {
  const sessionKey = `${userId}:${adminTenantId}`
  const session = adminElevationSessions.get(sessionKey)

  if (!session || Date.now() > session.expiresAt) {
    return false
  }

  // If no scope defined, admin has access to their own tenant only
  if (!session.scopedTenants) {
    return adminTenantId === targetTenantId
  }

  // Check if target tenant is in scoped list
  return session.scopedTenants.includes(targetTenantId)
}

/**
 * SEC-031: Revoke admin elevation
 */
export function revokeAdminElevation(userId: string, tenantId: string): boolean {
  const sessionKey = `${userId}:${tenantId}`
  const existed = adminElevationSessions.has(sessionKey)
  adminElevationSessions.delete(sessionKey)

  if (existed) {
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId,
      tenantId,
      action: 'admin_action',
      decision: 'allowed',
      reason: 'Admin permissions revoked',
      severity: 4,
    })
  }

  return existed
}

/**
 * SEC-031: Get remaining elevation time in seconds
 */
export function getAdminElevationTimeRemaining(userId: string, tenantId: string): number {
  const sessionKey = `${userId}:${tenantId}`
  const session = adminElevationSessions.get(sessionKey)

  if (!session) {
    return 0
  }

  const remaining = session.expiresAt - Date.now()
  return Math.max(0, Math.floor(remaining / 1000))
}

// ============================================================================
// SEC-032: Permission Caching with TTL
// ============================================================================

/**
 * SEC-032: Permission cache entry
 */
interface PermissionCacheEntry {
  hasPermission: boolean
  cachedAt: number
  expiresAt: number
}

const permissionCache: Map<string, PermissionCacheEntry> = new Map()
const PERMISSION_CACHE_TTL_MS = 30 * 1000 // 30 seconds (short TTL for security)
const MAX_PERMISSION_CACHE_SIZE = 10000

/**
 * SEC-032: Generate cache key for permission lookup
 */
function getPermissionCacheKey(userId: string, tenantId: string, permission: string): string {
  return `${userId}:${tenantId}:${permission}`
}

/**
 * SEC-032: Get cached permission result
 */
function getCachedPermission(userId: string, tenantId: string, permission: string): boolean | null {
  const key = getPermissionCacheKey(userId, tenantId, permission)
  const entry = permissionCache.get(key)

  if (!entry) {
    return null
  }

  if (Date.now() > entry.expiresAt) {
    permissionCache.delete(key)
    return null
  }

  return entry.hasPermission
}

/**
 * SEC-032: Cache permission result
 */
function cachePermission(userId: string, tenantId: string, permission: string, hasPermission: boolean): void {
  // Evict oldest entries if cache is full
  if (permissionCache.size >= MAX_PERMISSION_CACHE_SIZE) {
    // Remove ~10% of oldest entries
    const entriesToRemove = Math.floor(MAX_PERMISSION_CACHE_SIZE * 0.1)
    const keys = Array.from(permissionCache.keys())
    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      permissionCache.delete(keys[i])
    }
  }

  const now = Date.now()
  const key = getPermissionCacheKey(userId, tenantId, permission)
  permissionCache.set(key, {
    hasPermission,
    cachedAt: now,
    expiresAt: now + PERMISSION_CACHE_TTL_MS,
  })
}

/**
 * SEC-032: Invalidate permission cache for a user
 */
export function invalidatePermissionCache(userId: string, tenantId?: string): void {
  const prefix = tenantId ? `${userId}:${tenantId}:` : `${userId}:`
  for (const key of permissionCache.keys()) {
    if (key.startsWith(prefix)) {
      permissionCache.delete(key)
    }
  }
}

/**
 * SEC-032: Clear entire permission cache
 */
export function clearPermissionCache(): void {
  permissionCache.clear()
}

// ============================================================================
// SEC-033: Rate Limiting for Permission Checks
// ============================================================================

/**
 * SEC-033: Rate limit tracking
 */
interface RateLimitEntry {
  count: number
  windowStart: number
}

const permissionCheckRateLimits: Map<string, RateLimitEntry> = new Map()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute window
const RATE_LIMIT_MAX_CHECKS = 1000 // Max permission checks per user per minute
const RATE_LIMIT_LOCKOUT_THRESHOLD = 500 // Start logging warnings at this threshold

/**
 * SEC-033: Check rate limit for permission checks
 * Returns true if request should be allowed, false if rate limited
 */
function checkPermissionRateLimit(userId: string, tenantId: string): { allowed: boolean; remaining: number } {
  const key = `${userId}:${tenantId}`
  const now = Date.now()
  const entry = permissionCheckRateLimits.get(key)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Start new window
    permissionCheckRateLimits.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: RATE_LIMIT_MAX_CHECKS - 1 }
  }

  // Increment counter
  entry.count++

  // Log warning if approaching limit
  if (entry.count === RATE_LIMIT_LOCKOUT_THRESHOLD) {
    console.warn(`[RBAC WARNING] User ${userId} approaching permission check rate limit`)
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId,
      tenantId,
      action: 'permission_check',
      decision: 'allowed',
      reason: 'Rate limit warning threshold reached',
      severity: 5,
      metadata: { checkCount: entry.count, windowMs: RATE_LIMIT_WINDOW_MS },
    })
  }

  if (entry.count > RATE_LIMIT_MAX_CHECKS) {
    // Rate limited
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId,
      tenantId,
      action: 'permission_check',
      decision: 'denied',
      reason: 'Permission enumeration rate limit exceeded',
      severity: 7,
      metadata: { checkCount: entry.count, windowMs: RATE_LIMIT_WINDOW_MS },
    })
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX_CHECKS - entry.count }
}

/**
 * SEC-033: Reset rate limit for a user (e.g., after successful action)
 */
export function resetPermissionRateLimit(userId: string, tenantId: string): void {
  const key = `${userId}:${tenantId}`
  permissionCheckRateLimits.delete(key)
}

/**
 * SEC-033: Get current rate limit status
 */
export function getPermissionRateLimitStatus(userId: string, tenantId: string): {
  checksUsed: number
  checksRemaining: number
  windowResetMs: number
} {
  const key = `${userId}:${tenantId}`
  const entry = permissionCheckRateLimits.get(key)
  const now = Date.now()

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    return {
      checksUsed: 0,
      checksRemaining: RATE_LIMIT_MAX_CHECKS,
      windowResetMs: 0,
    }
  }

  return {
    checksUsed: entry.count,
    checksRemaining: Math.max(0, RATE_LIMIT_MAX_CHECKS - entry.count),
    windowResetMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
  }
}

// ============================================================================
// Core Types and Permissions
// ============================================================================

export type Role = 'admin' | 'user' | 'viewer' | 'guest'

export interface UserContext {
  userId: string
  tenantId: string
  role: Role
  permissions: string[]
  sessionId?: string // SEC-031: For tracking admin elevation
  ipAddress?: string // SEC-030: For audit logging
}

// Permission definitions
export const PERMISSIONS = {
  // Resource permissions
  READ_OWN: 'read:own',
  READ_ALL: 'read:all',
  WRITE_OWN: 'write:own',
  WRITE_ALL: 'write:all',
  DELETE_OWN: 'delete:own',
  DELETE_ALL: 'delete:all',

  // Admin permissions
  ADMIN: 'admin:all',
  MANAGE_USERS: 'admin:users',
  MANAGE_TEAM: 'admin:team',
  MANAGE_BILLING: 'admin:billing',

  // Feature permissions
  ACCESS_VAULT: 'feature:vault',
  ACCESS_BUTLER: 'feature:butler',
  ACCESS_VOICE: 'feature:voice',
  ACCESS_ANALYTICS: 'feature:analytics',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// SEC-031: Define which permissions require elevated admin session
const ELEVATED_ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.ADMIN,
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_BILLING,
]

// Role to permissions mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],
  user: [
    PERMISSIONS.READ_OWN,
    PERMISSIONS.WRITE_OWN,
    PERMISSIONS.DELETE_OWN,
    PERMISSIONS.ACCESS_VAULT,
    PERMISSIONS.ACCESS_BUTLER,
    PERMISSIONS.ACCESS_VOICE,
  ],
  viewer: [PERMISSIONS.READ_OWN, PERMISSIONS.ACCESS_VAULT],
  guest: [],
}

// ============================================================================
// Permission Checking Functions
// ============================================================================

/**
 * Check if a user has a specific permission (SEC-007, SEC-031, SEC-032, SEC-033)
 * @param userContext - The authenticated user's context
 * @param permission - The permission to check
 * @param options - Additional options for permission checking
 * @returns True if the user has the permission
 */
export function hasPermission(
  userContext: UserContext,
  permission: Permission | string,
  options?: { skipCache?: boolean; skipRateLimit?: boolean }
): boolean {
  // SEC-033: Check rate limit (unless explicitly skipped for internal calls)
  if (!options?.skipRateLimit) {
    const rateLimit = checkPermissionRateLimit(userContext.userId, userContext.tenantId)
    if (!rateLimit.allowed) {
      return false
    }
  }

  // SEC-032: Check cache first (unless explicitly skipped)
  if (!options?.skipCache) {
    const cached = getCachedPermission(userContext.userId, userContext.tenantId, permission)
    if (cached !== null) {
      return cached
    }
  }

  let result = false

  // SEC-031: Admin role requires elevated session for sensitive permissions
  if (userContext.role === 'admin') {
    const requiresElevation = ELEVATED_ADMIN_PERMISSIONS.includes(permission as Permission)

    if (requiresElevation) {
      // Check if admin has valid elevated session
      if (!isAdminElevationValid(userContext.userId, userContext.tenantId)) {
        // Log denied access due to expired elevation
        logAccessDecision({
          timestamp: new Date().toISOString(),
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          action: 'admin_action',
          decision: 'denied',
          reason: 'Admin elevation expired, re-authentication required',
          severity: 5,
          metadata: { permission },
        })
        result = false
      } else {
        result = true
      }
    } else {
      // Non-elevated admin permissions don't require re-auth
      result = true
    }
  } else {
    // Check explicit permissions first
    if (userContext.permissions.includes(permission)) {
      result = true
    } else {
      // Check role-based permissions
      const rolePermissions = ROLE_PERMISSIONS[userContext.role]
      result = rolePermissions?.includes(permission as Permission) ?? false
    }
  }

  // SEC-032: Cache the result
  if (!options?.skipCache) {
    cachePermission(userContext.userId, userContext.tenantId, permission, result)
  }

  return result
}

/**
 * Check if a user can access a specific resource (SEC-007, SEC-019, SEC-031)
 * This enforces both tenant isolation and ownership checks to prevent IDOR attacks.
 *
 * @param userContext - The authenticated user's context
 * @param resourceOwnerId - The user ID that owns the resource
 * @param resourceTenantId - The tenant ID the resource belongs to
 * @param action - The action being performed (read, write, delete)
 * @returns True if access is allowed
 */
export function canAccessResource(
  userContext: UserContext,
  resourceOwnerId: string,
  resourceTenantId: string,
  action: 'read' | 'write' | 'delete'
): boolean {
  // SEC-007: Tenant isolation - user can ONLY access resources in their tenant
  // This is the primary tenant boundary check
  if (userContext.tenantId !== resourceTenantId) {
    // SEC-031: Check if admin has scoped access to this tenant
    if (userContext.role === 'admin') {
      if (!isAdminScopedToTenant(userContext.userId, userContext.tenantId, resourceTenantId)) {
        return false
      }
    } else {
      return false
    }
  }

  // SEC-031: Admin requires elevated session for resource access
  if (userContext.role === 'admin') {
    if (!isAdminElevationValid(userContext.userId, userContext.tenantId)) {
      // Log admin action without elevation
      logAccessDecision({
        timestamp: new Date().toISOString(),
        userId: userContext.userId,
        tenantId: userContext.tenantId,
        action: 'admin_action',
        resource: resourceOwnerId,
        decision: 'denied',
        reason: 'Admin resource access requires elevated session',
        severity: 5,
        ipAddress: userContext.ipAddress,
      })
      return false
    }

    // SEC-029: Log ALL admin resource access (not just denials)
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      action: 'admin_action',
      resource: resourceOwnerId,
      resourceOwnerId,
      decision: 'allowed',
      reason: `Admin ${action} on resource`,
      severity: 4,
      ipAddress: userContext.ipAddress,
      metadata: { resourceTenantId },
    })

    return true
  }

  // SEC-019: Check if user owns the resource or has 'all' permission
  const isOwner = userContext.userId === resourceOwnerId
  const ownPermission = `${action}:own` as Permission
  const allPermission = `${action}:all` as Permission

  // Owner with appropriate permission
  if (isOwner && hasPermission(userContext, ownPermission, { skipRateLimit: true })) {
    return true
  }

  // User with 'all' permission for this action (within tenant)
  if (hasPermission(userContext, allPermission, { skipRateLimit: true })) {
    return true
  }

  return false
}

/**
 * Validate that a resource ID belongs to the user's tenant (SEC-007)
 * Use this before any database query that accepts a resource ID from user input.
 *
 * @param userContext - The authenticated user's context
 * @param resourceTenantId - The tenant ID extracted from the resource
 * @returns True if the resource belongs to the user's tenant
 */
export function validateTenantAccess(userContext: UserContext, resourceTenantId: string): boolean {
  return userContext.tenantId === resourceTenantId
}

/**
 * Build a tenant-scoped query filter (SEC-007)
 * Add this filter to all database queries to ensure tenant isolation.
 *
 * @param userContext - The authenticated user's context
 * @returns A filter object with tenantId for database queries
 */
export function getTenantFilter(userContext: UserContext): { tenantId: string } {
  return { tenantId: userContext.tenantId }
}

/**
 * Build an owner-scoped query filter for 'own' permission scenarios
 * Use this when the user should only see their own resources.
 *
 * @param userContext - The authenticated user's context
 * @returns A filter object with userId and tenantId for database queries
 */
export function getOwnerFilter(userContext: UserContext): { userId: string; tenantId: string } {
  return {
    userId: userContext.userId,
    tenantId: userContext.tenantId,
  }
}

/**
 * Extract user context from JWT token (SEC-007)
 * IMPORTANT: This only decodes the JWT - verification should happen in middleware first.
 *
 * @param token - The JWT token string
 * @returns UserContext or null if extraction fails
 */
export function extractUserContext(token: string | null): UserContext | null {
  if (!token) return null

  try {
    // Handle Bearer prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token

    // Split JWT into parts
    const parts = cleanToken.split('.')
    if (parts.length !== 3) return null

    // Decode payload (middle segment) - base64url decode
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    )

    // Extract user context from standard and custom claims
    return {
      userId: payload.sub || payload.userId || payload.user_id || '',
      tenantId: payload.tenantId || payload.tenant_id || payload.org_id || 'default',
      role: validateRole(payload.role) || 'user',
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      sessionId: payload.sid || payload.session_id,
    }
  } catch {
    return null
  }
}

/**
 * Validate that a role string is a valid Role type
 */
function validateRole(role: unknown): Role | null {
  const validRoles: Role[] = ['admin', 'user', 'viewer', 'guest']
  if (typeof role === 'string' && validRoles.includes(role as Role)) {
    return role as Role
  }
  return null
}

/**
 * Decorator pattern for protecting API routes (SEC-007)
 * Returns a function that validates user permissions.
 *
 * @param permission - The required permission
 * @returns A validation function
 */
export function requirePermission(
  permission: Permission | string
): (userContext: UserContext | null) => { allowed: boolean; error?: string; status?: number } {
  return function (userContext: UserContext | null): {
    allowed: boolean
    error?: string
    status?: number
  } {
    if (!userContext) {
      return { allowed: false, error: 'Authentication required', status: 401 }
    }
    if (!hasPermission(userContext, permission)) {
      return { allowed: false, error: 'Insufficient permissions', status: 403 }
    }
    return { allowed: true }
  }
}

/**
 * Require resource access - combines authentication, tenant, and ownership checks (SEC-007, SEC-019)
 *
 * @param userContext - The authenticated user's context
 * @param resourceOwnerId - The user ID that owns the resource
 * @param resourceTenantId - The tenant ID the resource belongs to
 * @param action - The action being performed
 * @returns Validation result with allowed flag and optional error
 */
export function requireResourceAccess(
  userContext: UserContext | null,
  resourceOwnerId: string,
  resourceTenantId: string,
  action: 'read' | 'write' | 'delete'
): { allowed: boolean; error?: string; status?: number } {
  if (!userContext) {
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId: 'anonymous',
      tenantId: 'unknown',
      action,
      resource: resourceOwnerId,
      decision: 'denied',
      reason: 'unauthenticated',
    })
    return { allowed: false, error: 'Authentication required', status: 401 }
  }

  // SEC-007: Tenant isolation check
  if (userContext.tenantId !== resourceTenantId) {
    // SEC-031: Check if admin has scoped access
    const isAdminWithScope =
      userContext.role === 'admin' &&
      isAdminScopedToTenant(userContext.userId, userContext.tenantId, resourceTenantId)

    if (!isAdminWithScope) {
      // SEC-029: Log cross-tenant access attempt
      logAccessDecision({
        timestamp: new Date().toISOString(),
        userId: userContext.userId,
        tenantId: userContext.tenantId,
        action,
        resource: resourceOwnerId,
        resourceOwnerId,
        decision: 'denied',
        reason: `cross-tenant attempt to ${resourceTenantId}`,
        severity: 7,
        ipAddress: userContext.ipAddress,
      })
      return { allowed: false, error: 'Resource not found', status: 404 } // 404 to prevent enumeration
    }
  }

  // SEC-019: IDOR protection - verify ownership or elevated permissions
  if (!canAccessResource(userContext, resourceOwnerId, resourceTenantId, action)) {
    logAccessDecision({
      timestamp: new Date().toISOString(),
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      action,
      resource: resourceOwnerId,
      resourceOwnerId,
      decision: 'denied',
      reason: 'insufficient permissions',
      severity: 5,
      ipAddress: userContext.ipAddress,
    })
    return { allowed: false, error: 'Access denied', status: 403 }
  }

  // SEC-029: Log successful access
  logAccessDecision({
    timestamp: new Date().toISOString(),
    userId: userContext.userId,
    tenantId: userContext.tenantId,
    action,
    resource: resourceOwnerId,
    resourceOwnerId,
    decision: 'allowed',
    ipAddress: userContext.ipAddress,
  })

  return { allowed: true }
}

/**
 * Sanitize resource ID to prevent injection attacks (SEC-019)
 * Validates that a resource ID matches expected format.
 *
 * @param resourceId - The resource ID from user input
 * @returns Sanitized ID or null if invalid
 */
export function sanitizeResourceId(resourceId: string | undefined | null): string | null {
  if (!resourceId || typeof resourceId !== 'string') {
    return null
  }

  // Trim and check length
  const cleaned = resourceId.trim()
  if (cleaned.length === 0 || cleaned.length > 128) {
    return null
  }

  // Allow alphanumeric, hyphens, underscores (UUID-like patterns)
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return null
  }

  return cleaned
}

/**
 * Assert tenant context exists and throw if missing (SEC-007)
 * Use this at the start of API handlers that require authentication.
 *
 * @param userContext - The user context to validate
 * @throws Error if user context is missing or invalid
 */
export function assertAuthenticated(
  userContext: UserContext | null
): asserts userContext is UserContext {
  if (!userContext) {
    throw new AuthenticationError('Authentication required')
  }
  if (!userContext.userId || !userContext.tenantId) {
    throw new AuthenticationError('Invalid authentication context')
  }
}

/**
 * Custom error class for authentication failures
 */
export class AuthenticationError extends Error {
  public readonly status = 401
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Custom error class for authorization failures
 */
export class AuthorizationError extends Error {
  public readonly status = 403
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Custom error class for resource not found (used to prevent enumeration)
 */
export class ResourceNotFoundError extends Error {
  public readonly status = 404
  constructor(message: string = 'Resource not found') {
    super(message)
    this.name = 'ResourceNotFoundError'
  }
}

// ============================================================================
// SEC-034: Break Glass Emergency Access
// ============================================================================

/**
 * SEC-034: Initiate break glass emergency access
 * This bypasses normal admin elevation with enhanced logging
 */
export function initiateBreakGlassAccess(
  userId: string,
  tenantId: string,
  reason: string,
  authorizedBy: string,
  scopedTenants?: string[]
): AdminElevationSession {
  // Log break glass initiation with high severity
  logAccessDecision({
    timestamp: new Date().toISOString(),
    userId,
    tenantId,
    action: 'break_glass',
    decision: 'allowed',
    reason: `BREAK GLASS INITIATED: ${reason}`,
    severity: 9,
    metadata: {
      authorizedBy,
      reason,
      scopedTenants,
    },
  })

  // Elevate with break glass flag
  return elevateAdminPermissions(userId, tenantId, scopedTenants, reason)
}

/**
 * SEC-034: Get all active break glass sessions for monitoring
 */
export function getActiveBreakGlassSessions(): Array<{
  userId: string
  tenantId: string
  reason: string
  elevatedAt: Date
  expiresAt: Date
  scopedTenants?: string[]
}> {
  const sessions: Array<{
    userId: string
    tenantId: string
    reason: string
    elevatedAt: Date
    expiresAt: Date
    scopedTenants?: string[]
  }> = []

  for (const [, session] of adminElevationSessions) {
    if (session.breakGlassReason) {
      sessions.push({
        userId: session.userId,
        tenantId: session.tenantId,
        reason: session.breakGlassReason,
        elevatedAt: new Date(session.elevatedAt),
        expiresAt: new Date(session.expiresAt),
        scopedTenants: session.scopedTenants,
      })
    }
  }

  return sessions
}
