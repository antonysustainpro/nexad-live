/**
 * Graceful shutdown utilities for NexusAD (REL-006)
 *
 * This module provides a centralized way to register and execute cleanup
 * handlers during application shutdown. It ensures that:
 * - WebSocket connections are properly closed
 * - Database connections are drained
 * - Redis connections are cleaned up
 * - In-flight requests are completed
 * - Resources are released cleanly
 *
 * Cleanup ordering (REL-007):
 * 1. Mark server as unhealthy (stop receiving new requests)
 * 2. Wait for in-flight requests to complete (with timeout)
 * 3. Close WebSocket connections gracefully
 * 4. Close database connections
 * 5. Flush and close Redis connections
 * 6. Exit process
 *
 * Usage:
 * 1. Register cleanup handlers at module initialization:
 *    registerCleanupHandler(async () => { await db.disconnect() }, 'database', 3)
 *
 * 2. Handlers run automatically on SIGTERM/SIGINT (server environments)
 *
 * 3. For client-side cleanup (e.g., WebSocket), use onBeforeUnload:
 *    registerClientCleanupHandler(() => { ws.close() })
 */

// SEC-024: Cleanup handler with metadata for ordering
type CleanupHandler = () => Promise<void> | void
type ClientCleanupHandler = () => void

interface RegisteredHandler {
  handler: CleanupHandler
  name: string
  priority: number // Lower numbers run first (REL-007)
}

// REL-007: Cleanup priority levels (lower = earlier in shutdown)
export const CleanupPriority = {
  HEALTH_CHECK: 0, // Mark unhealthy first
  STOP_ACCEPTING: 1, // Stop accepting new requests
  IN_FLIGHT_REQUESTS: 2, // Wait for in-flight requests
  WEBSOCKET: 3, // Close WebSocket connections
  DATABASE: 4, // Close database connections
  REDIS: 5, // Close Redis connections (last before exit)
  DEFAULT: 10, // Default priority for unspecified handlers
} as const

// Server-side cleanup handlers (async-capable) with priority ordering
const cleanupHandlers: RegisteredHandler[] = []

// Client-side cleanup handlers (sync only, for beforeunload)
const clientCleanupHandlers: ClientCleanupHandler[] = []

// Track if shutdown is in progress to prevent duplicate runs
let isShuttingDown = false

// SEC-025: Health check state for graceful shutdown coordination
let isServerHealthy = true

// REL-008: In-flight request tracking
let inFlightRequestCount = 0
const IN_FLIGHT_DRAIN_TIMEOUT_MS = 10000 // 10s to drain requests

// Shutdown timeout (30 seconds max for cleanup) - REL-006
const SHUTDOWN_TIMEOUT_MS = 30000

// REL-009: Force exit timeout (absolute maximum)
const FORCE_EXIT_TIMEOUT_MS = 35000

// SEC-026: WebSocket connection registry for cleanup
const registeredWebSockets: Set<WebSocket | { close: (code?: number, reason?: string) => void }> = new Set()

// SEC-027: Redis cleanup handlers
interface RedisCleanupConfig {
  flushPendingOperations?: () => Promise<void>
  drainConnections?: (timeoutMs: number) => Promise<void>
  closePool?: () => Promise<void>
}
let redisCleanupConfig: RedisCleanupConfig | null = null

/**
 * Register a cleanup handler for server-side shutdown
 * Handlers are executed in priority order during graceful shutdown (REL-007)
 *
 * @param handler - Async or sync function to run during cleanup
 * @param name - Human-readable name for logging
 * @param priority - Execution priority (lower = earlier). Use CleanupPriority constants.
 */
export function registerCleanupHandler(
  handler: CleanupHandler,
  name: string = "unnamed",
  priority: number = CleanupPriority.DEFAULT
): void {
  cleanupHandlers.push({ handler, name, priority })
  // REL-007: Keep handlers sorted by priority for ordered execution
  cleanupHandlers.sort((a, b) => a.priority - b.priority)
}

/**
 * Unregister a cleanup handler by handler function or name
 * Useful for dynamic resources that may be created/destroyed during runtime
 *
 * @param handlerOrName - The handler function or name to remove
 * @returns true if handler was found and removed
 */
export function unregisterCleanupHandler(handlerOrName: CleanupHandler | string): boolean {
  const index =
    typeof handlerOrName === "string"
      ? cleanupHandlers.findIndex((h) => h.name === handlerOrName)
      : cleanupHandlers.findIndex((h) => h.handler === handlerOrName)
  if (index !== -1) {
    cleanupHandlers.splice(index, 1)
    return true
  }
  return false
}

// SEC-025: Health check integration for graceful shutdown
/**
 * Get the current health status of the server
 * Returns false when shutdown is in progress (REL-007)
 */
export function isServerReady(): boolean {
  return isServerHealthy && !isShuttingDown
}

/**
 * Mark server as unhealthy (called at start of shutdown)
 * Load balancers should stop routing traffic to this instance
 */
export function markServerUnhealthy(): void {
  isServerHealthy = false
  console.log("[Shutdown] Server marked as unhealthy - no longer accepting new requests")
}

/**
 * Mark server as healthy (called on startup)
 */
export function markServerHealthy(): void {
  isServerHealthy = true
  console.log("[Shutdown] Server marked as healthy - ready to accept requests")
}

// REL-008: In-flight request tracking
/**
 * Increment in-flight request count (call at request start)
 */
export function trackRequestStart(): void {
  if (isShuttingDown) {
    console.warn("[Shutdown] Request started during shutdown - may be interrupted")
  }
  inFlightRequestCount++
}

/**
 * Decrement in-flight request count (call at request end)
 */
export function trackRequestEnd(): void {
  inFlightRequestCount = Math.max(0, inFlightRequestCount - 1)
}

/**
 * Get current in-flight request count
 */
export function getInFlightRequestCount(): number {
  return inFlightRequestCount
}

/**
 * Wait for all in-flight requests to complete (with timeout)
 * REL-008: Part of graceful shutdown sequence
 */
async function waitForInFlightRequests(): Promise<void> {
  if (inFlightRequestCount === 0) {
    console.log("[Shutdown] No in-flight requests to drain")
    return
  }

  console.log(`[Shutdown] Waiting for ${inFlightRequestCount} in-flight requests to complete...`)

  const startTime = Date.now()
  const checkInterval = 100 // Check every 100ms

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime

      if (inFlightRequestCount === 0) {
        clearInterval(interval)
        console.log(`[Shutdown] All in-flight requests completed in ${elapsed}ms`)
        resolve()
        return
      }

      if (elapsed >= IN_FLIGHT_DRAIN_TIMEOUT_MS) {
        clearInterval(interval)
        console.warn(
          `[Shutdown] Timed out waiting for ${inFlightRequestCount} in-flight requests after ${IN_FLIGHT_DRAIN_TIMEOUT_MS}ms`
        )
        resolve()
        return
      }
    }, checkInterval)
  })
}

// SEC-026: WebSocket management for graceful shutdown
/**
 * Register a WebSocket connection for cleanup during shutdown
 * @param ws - WebSocket instance to track
 */
export function registerWebSocket(ws: WebSocket | { close: (code?: number, reason?: string) => void }): void {
  registeredWebSockets.add(ws)
}

/**
 * Unregister a WebSocket connection (call when connection closes normally)
 * @param ws - WebSocket instance to untrack
 */
export function unregisterWebSocket(ws: WebSocket | { close: (code?: number, reason?: string) => void }): void {
  registeredWebSockets.delete(ws)
}

/**
 * Close all registered WebSocket connections gracefully
 * SEC-026: Part of graceful shutdown sequence
 */
async function closeAllWebSockets(): Promise<void> {
  const count = registeredWebSockets.size
  if (count === 0) {
    console.log("[Shutdown] No WebSocket connections to close")
    return
  }

  console.log(`[Shutdown] Closing ${count} WebSocket connections...`)

  const closePromises: Promise<void>[] = []

  // Convert Set to Array for broader TypeScript compatibility
  const wsArray = Array.from(registeredWebSockets)
  for (const ws of wsArray) {
    closePromises.push(
      new Promise((resolve) => {
        try {
          // Close with 1001 (Going Away) code - indicates server shutdown
          ws.close(1001, "Server shutting down")
        } catch (error) {
          // SEC: Don't log full error — may contain connection details
          console.error("[Shutdown] Error closing WebSocket")
        }
        // Don't wait for close event, resolve immediately after close() call
        resolve()
      })
    )
  }

  await Promise.all(closePromises)
  registeredWebSockets.clear()
  console.log(`[Shutdown] Closed ${count} WebSocket connections`)
}

// SEC-027: Redis cleanup configuration
/**
 * Configure Redis cleanup handlers for graceful shutdown
 * Call this during server initialization to set up Redis cleanup
 *
 * @param config - Redis cleanup configuration
 */
export function configureRedisCleanup(config: RedisCleanupConfig): void {
  redisCleanupConfig = config
  console.log("[Shutdown] Redis cleanup handlers configured")
}

/**
 * Execute Redis cleanup sequence
 * SEC-027: Flush pending operations, drain connections, close pool
 */
async function cleanupRedis(): Promise<void> {
  if (!redisCleanupConfig) {
    console.log("[Shutdown] No Redis cleanup configured (may be using REST-based Redis like Upstash)")
    return
  }

  const REDIS_DRAIN_TIMEOUT_MS = 5000

  try {
    // Step 1: Flush pending operations
    if (redisCleanupConfig.flushPendingOperations) {
      console.log("[Shutdown] Flushing pending Redis operations...")
      await redisCleanupConfig.flushPendingOperations()
    }

    // Step 2: Drain connections with timeout
    if (redisCleanupConfig.drainConnections) {
      console.log(`[Shutdown] Draining Redis connections (timeout: ${REDIS_DRAIN_TIMEOUT_MS}ms)...`)
      await redisCleanupConfig.drainConnections(REDIS_DRAIN_TIMEOUT_MS)
    }

    // Step 3: Close connection pool
    if (redisCleanupConfig.closePool) {
      console.log("[Shutdown] Closing Redis connection pool...")
      await redisCleanupConfig.closePool()
    }

    console.log("[Shutdown] Redis cleanup completed")
  } catch (error) {
    // SEC: Only log message, not full error object
    const errMsg = error instanceof Error ? error.message : 'unknown'
    console.error("[Shutdown] Redis cleanup failed:", errMsg)
    // Continue with shutdown even if Redis cleanup fails
  }
}

/**
 * Register a client-side cleanup handler for browser beforeunload
 * These handlers must be synchronous (browser limitation)
 *
 * @param handler - Sync function to run before page unload
 */
export function registerClientCleanupHandler(handler: ClientCleanupHandler): void {
  clientCleanupHandlers.push(handler)

  // Register the beforeunload listener only once
  if (typeof window !== "undefined" && clientCleanupHandlers.length === 1) {
    window.addEventListener("beforeunload", runClientCleanupHandlers)
  }
}

/**
 * Unregister a client-side cleanup handler
 *
 * @param handler - The handler to remove
 * @returns true if handler was found and removed
 */
export function unregisterClientCleanupHandler(handler: ClientCleanupHandler): boolean {
  const index = clientCleanupHandlers.indexOf(handler)
  if (index !== -1) {
    clientCleanupHandlers.splice(index, 1)
    // Remove the event listener if no more handlers
    if (typeof window !== "undefined" && clientCleanupHandlers.length === 0) {
      window.removeEventListener("beforeunload", runClientCleanupHandlers)
    }
    return true
  }
  return false
}

/**
 * Run all client-side cleanup handlers (sync)
 * Called automatically on beforeunload
 */
function runClientCleanupHandlers(): void {
  for (const handler of clientCleanupHandlers) {
    try {
      handler()
    } catch (error) {
      // Best effort - can't do async logging in beforeunload
      // SEC: Don't log full error — may contain sensitive state
      console.error("[Shutdown] Client cleanup handler failed")
    }
  }
}

/**
 * Run all server-side cleanup handlers in priority order
 * Called automatically on SIGTERM/SIGINT, or manually for testing
 *
 * REL-007: Cleanup ordering:
 * 1. Mark server as unhealthy (priority 0)
 * 2. Stop accepting new requests (priority 1)
 * 3. Wait for in-flight requests (priority 2)
 * 4. Close WebSocket connections (priority 3)
 * 5. Close database connections (priority 4)
 * 6. Close Redis connections (priority 5)
 * 7. Run custom handlers (priority 10+)
 *
 * @returns Promise that resolves when all handlers complete (or timeout)
 */
export async function runCleanupHandlers(): Promise<void> {
  // Prevent duplicate shutdown runs
  if (isShuttingDown) {
    console.log("[Shutdown] Shutdown already in progress, skipping duplicate call")
    return
  }

  isShuttingDown = true

  // REL-009: Set up force exit timer as absolute failsafe
  const forceExitTimer = setTimeout(() => {
    console.error(`[Shutdown] FORCE EXIT: Cleanup exceeded ${FORCE_EXIT_TIMEOUT_MS}ms absolute limit`)
    process.exit(1)
  }, FORCE_EXIT_TIMEOUT_MS)

  // Don't let force exit timer keep process alive
  if (forceExitTimer.unref) {
    forceExitTimer.unref()
  }

  console.log(`[Shutdown] Starting graceful shutdown sequence...`)
  console.log(`[Shutdown] Registered handlers: ${cleanupHandlers.map((h) => `${h.name}(p${h.priority})`).join(", ")}`)

  const startTime = Date.now()

  // SEC-025: Step 1 - Mark server as unhealthy immediately
  markServerUnhealthy()

  // Create a timeout promise for the main cleanup
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Shutdown timeout after ${SHUTDOWN_TIMEOUT_MS}ms`))
    }, SHUTDOWN_TIMEOUT_MS)
  })

  // REL-007: Run cleanup in ordered phases
  const cleanupPromise = (async () => {
    // Phase 1: Wait for in-flight requests (REL-008)
    console.log("[Shutdown] Phase 1: Draining in-flight requests...")
    await waitForInFlightRequests()

    // Phase 2: Close WebSocket connections (SEC-026)
    console.log("[Shutdown] Phase 2: Closing WebSocket connections...")
    await closeAllWebSockets()

    // Phase 3: Run registered handlers in priority order
    console.log("[Shutdown] Phase 3: Running cleanup handlers...")
    for (const { handler, name, priority } of cleanupHandlers) {
      try {
        console.log(`[Shutdown] Running handler: ${name} (priority: ${priority})...`)
        const handlerStart = Date.now()
        await handler()
        const handlerDuration = Date.now() - handlerStart
        console.log(`[Shutdown] Handler ${name} completed in ${handlerDuration}ms`)
      } catch (error) {
        // SEC: Only log handler name, not full error (may contain connection strings, secrets)
        const errMsg = error instanceof Error ? error.message : 'unknown'
        console.error(`[Shutdown] Cleanup handler '${name}' failed:`, errMsg)
        // Continue with other handlers even if one fails
      }
    }

    // Phase 4: Redis cleanup (SEC-027) - always runs last
    console.log("[Shutdown] Phase 4: Cleaning up Redis connections...")
    await cleanupRedis()
  })()

  try {
    await Promise.race([cleanupPromise, timeoutPromise])
    const duration = Date.now() - startTime
    console.log(`[Shutdown] Graceful cleanup complete in ${duration}ms`)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Shutdown] Cleanup timed out or failed after ${duration}ms`)
    // Force continue - we tried our best
  } finally {
    clearTimeout(forceExitTimer)
  }
}

/**
 * Get the current shutdown state
 * Useful for handlers that need to check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown
}

/**
 * Get the number of registered cleanup handlers
 * Useful for debugging and testing
 */
export function getCleanupHandlerCount(): { server: number; client: number } {
  return {
    server: cleanupHandlers.length,
    client: clientCleanupHandlers.length,
  }
}

/**
 * Get detailed shutdown status for monitoring
 * REL-007: Useful for health check endpoints
 */
export function getShutdownStatus(): {
  isShuttingDown: boolean
  isServerHealthy: boolean
  inFlightRequests: number
  registeredWebSockets: number
  cleanupHandlerCount: number
} {
  // SEC: Do not expose handler names or priority details — reveals internal architecture
  return {
    isShuttingDown,
    isServerHealthy,
    inFlightRequests: inFlightRequestCount,
    registeredWebSockets: registeredWebSockets.size,
    cleanupHandlerCount: cleanupHandlers.length,
  }
}

// Register signal handlers for Node.js environments
// This runs on module load but only in server context
if (typeof process !== "undefined" && typeof window === "undefined") {
  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"]

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`)
      await runCleanupHandlers()
      process.exit(0)
    })
  }

  // Handle uncaught exceptions with cleanup attempt
  process.on("uncaughtException", async (error) => {
    // SEC: Only log message, never full error object (may contain sensitive data)
    const msg = error instanceof Error ? error.message : 'Unknown exception'
    console.error("[Shutdown] Uncaught exception, attempting cleanup:", msg)
    try {
      await runCleanupHandlers()
    } catch (cleanupError) {
      console.error("[Shutdown] Cleanup during uncaught exception failed")
    }
    process.exit(1)
  })

  // Handle unhandled promise rejections with cleanup attempt
  process.on("unhandledRejection", async (reason, _promise) => {
    // SEC: Never log promise reference or full reason — may contain user data or secrets
    const msg = reason instanceof Error ? reason.message : 'Unknown rejection'
    console.error("[Shutdown] Unhandled rejection:", msg)
    // Don't exit on unhandled rejection, just log
    // Node.js 15+ exits by default, but we want to be explicit
  })
}
