/**
 * Next.js Instrumentation file (REL-006)
 *
 * This file runs once when the Next.js server starts.
 * It's used to initialize monitoring, cleanup handlers, and other
 * server-side setup that needs to happen at startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Initialize Sentry for error monitoring
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // Only run on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid bundling server code in edge/client
    const {
      registerCleanupHandler,
      CleanupPriority,
      markServerHealthy,
      configureRedisCleanup,
    } = await import("./lib/shutdown")

    console.log("[Instrumentation] Initializing server-side cleanup handlers...")

    // SEC-025: Mark server as healthy on startup (REL-007)
    markServerHealthy()

    // SEC-027: Configure Redis cleanup for persistent Redis connections
    // Note: Upstash Redis is REST-based and stateless, so no cleanup needed
    // If using ioredis or node-redis, configure cleanup here:
    // configureRedisCleanup({
    //   flushPendingOperations: async () => { await redis.flushPendingOps() },
    //   drainConnections: async (timeout) => { await redis.quit({ timeout }) },
    //   closePool: async () => { await redis.disconnect() },
    // })

    // REL-007: Register cleanup handlers with proper priorities

    // Register a health check cleanup (priority: HEALTH_CHECK)
    registerCleanupHandler(
      async () => {
        console.log("[Cleanup] Flushing any pending logs...")
        // Flush console logs or any buffered data
        // In production, this would flush to a logging service
      },
      "flush-logs",
      CleanupPriority.DEFAULT
    )

    // Register WebSocket server cleanup if one exists (priority: WEBSOCKET)
    // Currently WebSockets are client-side only via createVoiceWebSocket
    // Server-side WebSocket connections are tracked via registerWebSocket()
    // and cleaned up automatically by closeAllWebSockets()
    registerCleanupHandler(
      async () => {
        console.log("[Cleanup] Server-side WebSocket cleanup complete (handled by shutdown module)")
        // If a custom WS server is added later, close it here:
        // await wsServer?.close()
      },
      "websocket-server",
      CleanupPriority.WEBSOCKET
    )

    // Register connection draining for keep-alive (priority: IN_FLIGHT_REQUESTS)
    registerCleanupHandler(
      async () => {
        console.log("[Cleanup] Keep-alive connection draining complete")
        // Next.js handles most of this automatically, but this is where
        // custom HTTP servers or proxies would drain their connections
      },
      "keep-alive-drain",
      CleanupPriority.IN_FLIGHT_REQUESTS
    )

    console.log("[Instrumentation] Server-side cleanup handlers registered with priority ordering")
  }

  // Edge runtime (Vercel Edge Functions) has different lifecycle
  if (process.env.NEXT_RUNTIME === "edge") {
    console.log("[Instrumentation] Running in Edge runtime - cleanup handled by platform")
  }
}
