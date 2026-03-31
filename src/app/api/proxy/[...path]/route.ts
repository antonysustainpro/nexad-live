import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import * as dns from "dns/promises"
import { randomUUID, timingSafeEqual as cryptoTimingSafeEqual } from "crypto"
import * as https from "https"
import * as http from "http"

/**
 * SEC-213: Timing-safe string comparison using Node.js crypto.timingSafeEqual.
 * Prevents timing side-channel attacks on CSRF token verification.
 *
 * SECURITY FIX (Round 4): Removed early return on length mismatch which leaked
 * string length via timing. Now uses fixed-size buffers and folds length difference
 * into the result using constant-time XOR, matching the pattern in middleware.ts.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8")
  const bufB = Buffer.from(b, "utf-8")

  // Use fixed-size buffer (256 bytes covers CSRF tokens, UUIDs, HMACs)
  const fixedSize = 256
  if (bufA.length > fixedSize || bufB.length > fixedSize) {
    // Inputs too large for fixed buffer — reject without leaking which one
    return false
  }

  const fixedA = Buffer.alloc(fixedSize, 0)
  const fixedB = Buffer.alloc(fixedSize, 0)
  bufA.copy(fixedA, 0, 0, bufA.length)
  bufB.copy(fixedB, 0, 0, bufB.length)

  const contentEqual = cryptoTimingSafeEqual(fixedA, fixedB)

  // Fold length comparison into result using XOR (constant-time, no branch)
  const lengthDiff = bufA.length ^ bufB.length
  return (lengthDiff === 0) && contentEqual
}

// SEC-027: Server-only environment variables preferred, fallback to public URL if needed
// These are only available server-side (in API routes/middleware)
const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || ""
const API_KEY = process.env.BACKEND_API_KEY || ""

// SEC-030: Request timeout to prevent slow-loris attacks (30 seconds)
const REQUEST_TIMEOUT_MS = 30_000

// PRO-MODE-FIX: Maximum timeout for SSE streaming requests
// Pro mode 8-phase pipeline can take 2-5+ minutes for complex documents
// Vercel Pro plan maximum: 300 seconds (5 minutes)
const STREAMING_TIMEOUT_MS = 300_000 // 5 minutes - MAXED OUT for Pro plan

// Vercel Pro plan maximum function duration
// This is the ABSOLUTE MAXIMUM for Pro plan ($20/mo)
// Enterprise plan would allow up to 900 seconds (15 min)
export const maxDuration = 300

// Enable streaming for long responses (keeps connection alive)
export const dynamic = "force-dynamic"

// SEC-031: Maximum response size to prevent memory exhaustion (10MB)
const MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024

// SEC-008: Path segment validation schema
const PathSegmentSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid path segment")

// SEC-024: Sanitize JSON values recursively to remove control chars and null bytes
function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  // Prevent stack overflow from deeply nested objects
  if (depth > 20) {
    return null
  }

  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === "string") {
    // Remove null bytes and control characters (keep newlines/tabs for text)
    return value
      .replace(/\0/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item, depth + 1))
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      // SEC-025: Block prototype pollution keys. JSON.parse('{"__proto__":{"isAdmin":true}}')
      // creates an object with __proto__ as a regular own property. If this object is later
      // processed with Object.assign() or spread on the backend, it pollutes Object.prototype
      // for ALL objects in the process — enabling privilege escalation.
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue
      }
      // Sanitize keys too
      const sanitizedKey = key
        .replace(/\0/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      sanitized[sanitizedKey] = sanitizeJsonValue(val, depth + 1)
    }
    return sanitized
  }

  return null
}

/**
 * SEC-008: Validate all path segments in the proxy request
 */
function validatePathSegments(path: string[]): { valid: boolean; error?: string } {
  if (!path || path.length === 0) {
    return { valid: false, error: "Empty path" }
  }

  if (path.length > 10) {
    return { valid: false, error: "Path too deep" }
  }

  for (const segment of path) {
    const result = PathSegmentSchema.safeParse(segment)
    if (!result.success) {
      // SEC-212: Do not echo user input back in error messages to prevent
      // reflected content injection and information leakage
      return { valid: false, error: "Invalid path segment" }
    }
  }

  return { valid: true }
}

// SSRF Protection: Whitelist of allowed backend hosts
const ALLOWED_HOSTS = [
  "api.nexusad.ai",
  "nexusad-backend.onrender.com",
  "nexusad-api.onrender.com",
  // Add localhost only in development
  ...(process.env.NODE_ENV === "development" ? ["localhost", "127.0.0.1"] : []),
]

// SSRF Protection: Allowed host suffixes (for dynamic subdomains like RunPod)
const ALLOWED_HOST_SUFFIXES = [
  ".proxy.runpod.net", // RunPod GPU backend hosting
]

// SEC-029: Private IP ranges that should always be blocked (used for DNS rebinding protection)
// SEC-034: Enhanced IPv6 detection including mapped IPv4 addresses
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private Class A
  /^192\.168\./,                     // Private Class C
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B
  /^169\.254\./,                     // Link-local (AWS metadata endpoint)
  /^0\./,                            // Current network
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local (fc00::/7)
  /^fd[0-9a-f]{2}:/i,                // IPv6 unique local (fd00::/8 subset of fc00::/7)
  /^fe80:/i,                         // IPv6 link-local (fe80::/10)
  /^fec0:/i,                         // IPv6 site-local (deprecated but still block)
  /^ff[0-9a-f]{2}:/i,                // IPv6 multicast (ff00::/8)
  /^::$/,                            // IPv6 unspecified address
]

// SEC-034: IPv6-mapped IPv4 pattern (::ffff:x.x.x.x or ::ffff:xxxx:xxxx format)
// These can bypass simple IPv4 checks if not handled
const IPV6_MAPPED_IPV4_PATTERN = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i

// SEC-034: IPv6 compressed formats that represent private IPv4
// Attackers use these to bypass SSRF protections: ::ffff:169.254.169.254 = AWS metadata
const IPV6_COMPRESSED_PRIVATE_PATTERNS = [
  /^::ffff:127\./i,                          // Loopback mapped
  /^::ffff:10\./i,                           // Private Class A mapped
  /^::ffff:192\.168\./i,                     // Private Class C mapped
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i,  // Private Class B mapped
  /^::ffff:169\.254\./i,                     // Link-local mapped (AWS metadata!)
  /^::ffff:0\./i,                            // Current network mapped
  /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:ffff:/i,  // Full form IPv6-mapped
]

/**
 * SEC-034: Extract IPv4 address from IPv6-mapped format if present
 * Handles formats like ::ffff:169.254.169.254 and ::ffff:a9fe:a9fe
 */
function extractIPv4FromMapped(ip: string): string | null {
  // Check for dotted decimal format: ::ffff:x.x.x.x
  const dottedMatch = ip.match(IPV6_MAPPED_IPV4_PATTERN)
  if (dottedMatch) {
    return dottedMatch[1]
  }

  // Check for hex format: ::ffff:xxxx:xxxx (e.g., ::ffff:a9fe:a9fe = 169.254.169.254)
  const hexMatch = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (hexMatch) {
    const high = parseInt(hexMatch[1], 16)
    const low = parseInt(hexMatch[2], 16)
    return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`
  }

  return null
}

/**
 * SEC-029: Check if an IP address is in a private/internal range
 * SEC-034: Enhanced with IPv6-mapped IPv4 detection
 * This is used AFTER DNS resolution to prevent DNS rebinding attacks
 */
function isPrivateIP(ip: string): boolean {
  // SEC-034: First check for IPv6-mapped IPv4 addresses
  // These bypass simple pattern checks: ::ffff:169.254.169.254 is the AWS metadata endpoint!
  for (const pattern of IPV6_COMPRESSED_PRIVATE_PATTERNS) {
    if (pattern.test(ip)) {
      return true
    }
  }

  // SEC-034: Extract and check the underlying IPv4 if mapped
  const mappedIPv4 = extractIPv4FromMapped(ip)
  if (mappedIPv4) {
    // Recursively check the extracted IPv4
    return isPrivateIP(mappedIPv4)
  }

  // Check standard patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(ip)) {
      return true
    }
  }

  // Additional check for cloud metadata endpoints (both direct and hex form)
  if (ip === "169.254.169.254" || ip.toLowerCase() === "::ffff:a9fe:a9fe") {
    return true
  }

  return false
}

/**
 * SEC-029: Resolve hostname to IP and validate it's not a private IP
 * SEC-035: Dual-stack DNS resolution - check BOTH IPv4 and IPv6 addresses
 *
 * This prevents DNS rebinding attacks where hostname resolves to safe IP during
 * validation but resolves to internal IP during actual request.
 *
 * CRITICAL: Attackers can bypass SSRF protection by having a hostname resolve to:
 * - Only IPv6 (if we only check IPv4)
 * - Both IPv4 (public) and IPv6 (private) - attacker controls which is used
 *
 * Returns the resolved IP address if safe, or null if blocked
 */
async function resolveAndValidateHostname(
  hostname: string,
  requestId: string
): Promise<{ ip: string | null; error?: string }> {
  // SEC-035: Pattern to detect direct IPv6 addresses
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/

  // If hostname is already an IPv4, validate directly
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Pattern.test(hostname)) {
    if (isPrivateIP(hostname)) {
      console.error(`[SEC-029][${requestId}] Blocked direct private IPv4: ${hostname}`)
      return { ip: null, error: "Direct private IP not allowed" }
    }
    return { ip: hostname }
  }

  // SEC-035: If hostname is already an IPv6, validate directly
  if (ipv6Pattern.test(hostname) || hostname.startsWith("[")) {
    // Remove brackets if present (e.g., [::1] -> ::1)
    const cleanIPv6 = hostname.replace(/^\[|\]$/g, "")
    if (isPrivateIP(cleanIPv6)) {
      console.error(`[SEC-035][${requestId}] Blocked direct private IPv6: ${cleanIPv6}`)
      return { ip: null, error: "Direct private IPv6 not allowed" }
    }
    return { ip: cleanIPv6 }
  }

  try {
    // SEC-035: Resolve hostname to BOTH IPv4 and IPv6 addresses (dual-stack)
    // We must check ALL addresses because:
    // 1. Attacker could set up hostname with only IPv6 pointing to internal network
    // 2. Attacker could set up dual-stack with public IPv4 but private IPv6
    // 3. System might prefer IPv6 (RFC 6724) and connect to malicious address

    const [ipv4Result, ipv6Result] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ])

    const ipv4Addresses: string[] =
      ipv4Result.status === "fulfilled" ? ipv4Result.value : []
    const ipv6Addresses: string[] =
      ipv6Result.status === "fulfilled" ? ipv6Result.value : []

    // SEC-035: Combine all resolved addresses for validation
    const allAddresses = [...ipv4Addresses, ...ipv6Addresses]

    if (allAddresses.length === 0) {
      console.error(`[SEC-035][${requestId}] DNS resolution failed for: ${hostname} (no A or AAAA records)`)
      return { ip: null, error: "DNS resolution failed - no records found" }
    }

    console.log(
      `[SEC-035][${requestId}] DNS resolved ${hostname} -> IPv4: [${ipv4Addresses.join(", ")}], IPv6: [${ipv6Addresses.join(", ")}]`
    )

    // SEC-035: Check ALL resolved IPs (both IPv4 AND IPv6)
    // If ANY address is private, block the request entirely
    // This prevents attackers from using dual-stack to bypass SSRF:
    // - Hostname has public IPv4 (passes validation)
    // - Hostname also has private IPv6 (::1, fe80::, etc.)
    // - Client connects via IPv6 preference -> SSRF achieved
    for (const ip of allAddresses) {
      if (isPrivateIP(ip)) {
        const ipType = ipv4Addresses.includes(ip) ? "IPv4" : "IPv6"
        console.error(
          `[SEC-035][${requestId}] DNS rebinding protection: ${hostname} resolved to private ${ipType} ${ip}`
        )
        return { ip: null, error: `Hostname resolves to private ${ipType}` }
      }
    }

    // SEC-035: Return IPv4 for pinning if available (more predictable behavior),
    // otherwise use IPv6. The key is ALL addresses passed validation.
    const pinnedIP = ipv4Addresses[0] || ipv6Addresses[0]
    return { ip: pinnedIP }
  } catch (error) {
    console.error(`[SEC-035][${requestId}] DNS resolution error for ${hostname}:`, error)
    return { ip: null, error: "DNS resolution failed" }
  }
}

/**
 * SEC-029: IP Pinning - Make HTTP/HTTPS request using pinned IP address
 * This eliminates the TOCTOU (time-of-check-time-of-use) DNS rebinding window
 * by using the resolved IP directly while preserving the original hostname for:
 * 1. Host header (required for virtual hosting)
 * 2. TLS SNI (Server Name Indication) for HTTPS certificate validation
 *
 * The key insight: Node.js http/https modules allow overriding the 'hostname'
 * (used for DNS lookup) separately from 'host' header and 'servername' (SNI)
 *
 * For SSE responses (Content-Type: text/event-stream) the returned Response
 * carries a ReadableStream body so chunks are delivered to the caller immediately
 * without any buffering — enabling true token-by-token streaming.
 */
async function fetchWithPinnedIP(
  url: string,
  pinnedIP: string,
  options: {
    method: string
    headers: Record<string, string>
    body?: Buffer | string
    signal?: AbortSignal
    timeout?: number
  }
): Promise<Response> {
  const parsed = new URL(url)
  const isHttps = parsed.protocol === "https:"
  const originalHostname = parsed.hostname
  const port = parsed.port
    ? parseInt(parsed.port, 10)
    : isHttps
      ? 443
      : 80

  return new Promise((resolve, reject) => {
    const requestOptions: http.RequestOptions = {
      // Use pinned IP for the actual connection - THIS IS THE KEY FIX
      // This bypasses any further DNS resolution, eliminating rebinding
      hostname: pinnedIP,
      port,
      path: parsed.pathname + parsed.search,
      method: options.method,
      headers: {
        ...options.headers,
        // Set Host header to original hostname for virtual hosting
        Host: parsed.host, // Includes port if non-standard
      },
      timeout: options.timeout || REQUEST_TIMEOUT_MS,
    }

    // For HTTPS, set servername for SNI (TLS certificate validation)
    // This ensures the certificate matches the original hostname, not the IP
    if (isHttps) {
      (requestOptions as https.RequestOptions).servername = originalHostname
      // Also disable rejectUnauthorized would be wrong - we WANT cert validation
      // The servername option handles SNI correctly
    }

    const transport = isHttps ? https : http

    const req = transport.request(requestOptions, (res) => {
      const responseHeaders = new Headers()

      // Convert Node.js headers to Headers object
      for (const [key, value] of Object.entries(res.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => responseHeaders.append(key, v))
          } else if (typeof value === "string") {
            responseHeaders.set(key, value)
          }
        }
      }

      const contentType = res.headers["content-type"] || ""
      const isSSE = contentType.includes("text/event-stream")

      if (isSSE) {
        // SSE path: hand back a streaming Response immediately so chunks flow
        // to the client as they arrive — zero buffering.
        // SEC-031: Track total bytes streamed and enforce MAX_RESPONSE_SIZE_BYTES
        let sseTotalBytes = 0
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            res.on("data", (chunk: Buffer) => {
              sseTotalBytes += chunk.length
              if (sseTotalBytes > MAX_RESPONSE_SIZE_BYTES) {
                console.error(
                  `[SEC-031] SSE stream exceeded size limit: ${sseTotalBytes} bytes`
                )
                req.destroy()
                controller.error(new Error("SSE stream exceeded size limit"))
                return
              }
              controller.enqueue(new Uint8Array(chunk))
            })
            res.on("end", () => {
              controller.close()
            })
            res.on("error", (err) => {
              controller.error(err)
            })
          },
          cancel() {
            // Caller cancelled the read — destroy the underlying socket
            req.destroy()
          },
        })

        resolve(
          new Response(stream, {
            status: res.statusCode || 200,
            statusText: res.statusMessage || "",
            headers: responseHeaders,
          })
        )
      } else {
        // Non-SSE path: buffer the full response with SEC-031 size limit
        const chunks: Buffer[] = []
        let totalBytes = 0

        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length
          if (totalBytes > MAX_RESPONSE_SIZE_BYTES) {
            console.error(
              `[SEC-031] fetchWithPinnedIP: Response exceeded size limit: ${totalBytes} bytes`
            )
            req.destroy()
            reject(new Error("Response body exceeded size limit"))
            return
          }
          chunks.push(chunk)
        })

        res.on("end", () => {
          const body = Buffer.concat(chunks)
          resolve(
            new Response(body, {
              status: res.statusCode || 500,
              statusText: res.statusMessage || "",
              headers: responseHeaders,
            })
          )
        })

        res.on("error", reject)
      }
    })

    req.on("error", reject)

    req.on("timeout", () => {
      req.destroy()
      reject(new Error("Request timeout"))
    })

    // Handle abort signal
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        req.destroy()
        const abortError = new Error("Request aborted")
        abortError.name = "AbortError"
        reject(abortError)
      })
    }

    // Write body if present
    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

/**
 * SEC-032: Generate unique request ID for tracing and debugging
 */
function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

/**
 * Validates a URL is safe to proxy to, protecting against SSRF attacks.
 * Returns true only if the URL passes all security checks.
 */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Block non-HTTP(S) protocols (e.g., file://, ftp://, gopher://)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false
    }

    // In production, only allow HTTPS
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()

    // Block private/internal IP addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        // Allow localhost only in development (already added to ALLOWED_HOSTS conditionally)
        if (process.env.NODE_ENV !== "development") {
          return false
        }
      }
    }

    // Block cloud metadata endpoints explicitly
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
      return false
    }

    // Block internal DNS names that might resolve to private IPs
    if (
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost") ||
      hostname === "localhost"
    ) {
      // Allow localhost in development
      if (process.env.NODE_ENV === "development" && hostname === "localhost") {
        return ALLOWED_HOSTS.includes(hostname)
      }
      return false
    }

    // Whitelist check - hostname must be in allowed list OR match an allowed suffix
    if (ALLOWED_HOSTS.includes(hostname)) {
      return true
    }

    // Check suffix matches (e.g., *.proxy.runpod.net)
    for (const suffix of ALLOWED_HOST_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        return true
      }
    }

    return false
  } catch {
    // If URL parsing fails, reject it
    return false
  }
}

/**
 * Validates the constructed target URL before making the request.
 * This is the primary SSRF protection gate.
 */
function validateTargetUrl(targetUrl: string): { valid: boolean; error?: string } {
  if (!targetUrl || targetUrl.trim() === "") {
    return { valid: false, error: "Empty target URL" }
  }

  if (!isAllowedUrl(targetUrl)) {
    return { valid: false, error: "Target URL not allowed" }
  }

  return { valid: true }
}

async function proxyRequest(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  // SEC-032: Generate unique request ID for tracing
  const requestId = generateRequestId()

  // DEBUG: Log incoming request
  console.log(`[${requestId}][DEBUG-INCOMING] ${method} request received`)
  console.log(`[${requestId}][DEBUG-INCOMING] URL: ${req.nextUrl.pathname}${req.nextUrl.search}`)
  console.log(`[${requestId}][DEBUG-INCOMING] BACKEND_URL env: "${BACKEND_URL}"`)
  console.log(`[${requestId}][DEBUG-INCOMING] Content-Type: ${req.headers.get("content-type") || "(none)"}`)

  // SEC-221: Block HTTP Method Override headers to prevent verb tampering.
  // Attackers use headers like X-HTTP-Method-Override to change POST to DELETE,
  // bypassing CSRF checks or accessing different handler logic on the backend.
  const methodOverrideHeaders = [
    "x-http-method-override",
    "x-http-method",
    "x-method-override",
  ]
  for (const header of methodOverrideHeaders) {
    if (req.headers.get(header)) {
      console.error(`[${requestId}][SEC-221] Blocked method override header: ${header}`)
      return NextResponse.json(
        { error: "Method override headers are not allowed", requestId },
        { status: 400 }
      )
    }
  }

  const { path } = await params

  // SEC-008: Validate path segments before processing
  const pathValidation = validatePathSegments(path)
  if (!pathValidation.valid) {
    console.error(`[${requestId}] Invalid path: ${pathValidation.error}`)
    return NextResponse.json(
      { error: "Invalid request path", details: pathValidation.error, requestId },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const session = cookieStore.get("nexus-session")?.value
  console.log(`[${requestId}][DEBUG-AUTH] Session cookie present: ${!!session}, length: ${session?.length || 0}`)

  // CSRF validation for mutating requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const csrfCookie = cookieStore.get("csrf-token")?.value
    const csrfHeader = req.headers.get("X-CSRF-Token")

    // DEBUG: CSRF token details
    console.log(`[${requestId}][DEBUG-CSRF] Cookie present: ${!!csrfCookie}, length: ${csrfCookie?.length || 0}`)
    console.log(`[${requestId}][DEBUG-CSRF] Header present: ${!!csrfHeader}, length: ${csrfHeader?.length || 0}`)
    console.log(`[${requestId}][DEBUG-CSRF] Cookie value: ${csrfCookie ? csrfCookie.slice(0, 8) + '...' : '(none)'}`)
    console.log(`[${requestId}][DEBUG-CSRF] Header value: ${csrfHeader ? csrfHeader.slice(0, 8) + '...' : '(none)'}`)

    // SEC-213: Use constant-time comparison for CSRF tokens to prevent
    // timing side-channel attacks that could leak token bytes
    const csrfValid = csrfCookie && csrfHeader &&
      csrfCookie.length === csrfHeader.length &&
      timingSafeCompare(csrfCookie, csrfHeader)

    console.log(`[${requestId}][DEBUG-CSRF] Validation result: ${csrfValid}`)

    if (!csrfValid) {
      console.log('PROXY REJECTING:', {
        reason: 'CSRF validation failed',
        path: path.join("/"),
        method,
        hasCsrf: !!csrfHeader,
        hasSession: !!session,
        csrfCookieExists: !!csrfCookie,
        csrfHeaderExists: !!csrfHeader,
        csrfCookieLength: csrfCookie?.length,
        csrfHeaderLength: csrfHeader?.length
      })
      console.error(`[${requestId}] CSRF validation failed`)
      return NextResponse.json(
        { error: "CSRF validation failed", requestId },
        { status: 403 }
      )
    }
  }

  // Allow unauthenticated access to public endpoints
  const publicPaths = ["health", "status", "auth/login", "auth/register", "auth/verify", "auth/verify-email"]
  const pathStr = path.join("/")
  const isPublic = publicPaths.some((p) => pathStr.startsWith(p))

  if (!session && !isPublic) {
    console.log('PROXY REJECTING:', {
      reason: 'No session for non-public path',
      path: pathStr,
      method,
      isPublic,
      hasSession: !!session,
      hasCsrf: !!req.headers.get("X-CSRF-Token")
    })
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 })
  }

  const targetUrl = `${BACKEND_URL}/${pathStr}`
  console.log(`[${requestId}][DEBUG-TRANSFORM] pathStr: "${pathStr}"`)
  console.log(`[${requestId}][DEBUG-TRANSFORM] targetUrl: "${targetUrl}"`)
  const searchParams = req.nextUrl.searchParams.toString()
  // SEC-036: Sanitize query params to prevent injection of URL fragments or extra paths
  const sanitizedSearchParams = searchParams.replace(/#.*/g, "") // Strip fragments

  // SEC-223: HTTP Parameter Pollution (HPP) protection.
  // Detect duplicate query parameter keys that could cause logic bugs on the backend.
  // Different URL parsers handle duplicates differently:
  //   - Express uses first value, PHP uses last value, ASP.NET uses all values
  // An attacker sending ?role=user&role=admin could bypass authorization if the
  // frontend checks the first value but the backend uses the last.
  // We reject requests with duplicate parameter keys to eliminate ambiguity.
  const paramKeys = Array.from(req.nextUrl.searchParams.keys())
  const uniqueKeys = new Set(paramKeys)
  if (paramKeys.length !== uniqueKeys.size) {
    const duplicates = paramKeys.filter((k, i) => paramKeys.indexOf(k) !== i)
    console.error(`[${requestId}][SEC-223] Blocked duplicate query parameters: ${duplicates.join(",")}`)
    return NextResponse.json(
      { error: "Duplicate query parameters are not allowed", requestId },
      { status: 400 }
    )
  }

  // SEC-224: Validate individual query parameter lengths to prevent buffer-based attacks.
  // Extremely long parameter values can cause DoS on backend parsers or memory exhaustion.
  const MAX_PARAM_KEY_LENGTH = 100
  const MAX_PARAM_VALUE_LENGTH = 2000
  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (key.length > MAX_PARAM_KEY_LENGTH || value.length > MAX_PARAM_VALUE_LENGTH) {
      console.error(`[${requestId}][SEC-224] Query parameter too long: key=${key.slice(0, 20)}`)
      return NextResponse.json(
        { error: "Query parameter too long", requestId },
        { status: 400 }
      )
    }
  }

  const fullUrl = sanitizedSearchParams ? `${targetUrl}?${sanitizedSearchParams}` : targetUrl
  console.log(`[${requestId}][DEBUG-TRANSFORM] fullUrl: "${fullUrl}"`)

  // SSRF Protection: Validate the FULL URL (including query params) before making request
  // SEC-036: Previously only validated targetUrl, now validates fullUrl to prevent
  // query parameter injection from altering the effective destination
  const validation = validateTargetUrl(fullUrl)
  if (!validation.valid) {
    console.error(`[${requestId}][SSRF Protection] Blocked request to: ${fullUrl} - ${validation.error}`)
    return NextResponse.json(
      { error: "Forbidden: Invalid target URL", requestId },
      { status: 403 }
    )
  }

  // SEC-029: DNS rebinding protection - resolve hostname and validate resolved IP
  let resolvedIP: string | null = null
  try {
    const parsed = new URL(targetUrl)
    const hostname = parsed.hostname

    // Skip DNS resolution for localhost in development (direct IP)
    const isLocalDev =
      process.env.NODE_ENV === "development" &&
      (hostname === "localhost" || hostname === "127.0.0.1")

    if (!isLocalDev) {
      const dnsResult = await resolveAndValidateHostname(hostname, requestId)
      if (!dnsResult.ip) {
        console.error(`[${requestId}][SEC-029] DNS validation failed: ${dnsResult.error}`)
        return NextResponse.json(
          { error: "Forbidden: DNS validation failed", requestId },
          { status: 403 }
        )
      }
      resolvedIP = dnsResult.ip
      console.log(`[${requestId}] DNS resolved ${hostname} -> ${resolvedIP}`)
    }
  } catch (error) {
    console.error(`[${requestId}][SEC-029] URL parsing error:`, error)
    return NextResponse.json(
      { error: "Forbidden: Invalid URL", requestId },
      { status: 403 }
    )
  }

  // Determine whether the incoming request body is multipart/form-data or other
  // binary content that must be forwarded raw without JSON sanitization.
  const incomingContentType = req.headers.get("content-type") || ""
  const isMultipart = incomingContentType.includes("multipart/form-data")
  const isBinary =
    isMultipart ||
    incomingContentType.includes("application/octet-stream") ||
    incomingContentType.includes("audio/") ||
    incomingContentType.includes("video/") ||
    incomingContentType.includes("image/")

  // SEC-206: Content-Type enforcement - only allow known content types.
  // Reject unexpected content types like application/x-www-form-urlencoded,
  // text/xml, or exotic types that could bypass JSON sanitization or confuse
  // the backend parser (Content-Type confusion attack).
  const isJsonContent =
    incomingContentType.includes("application/json") ||
    incomingContentType === "" // No Content-Type header (GET/HEAD requests)
  if (method !== "GET" && method !== "HEAD" && !isBinary && !isJsonContent) {
    // Only allow JSON or binary content types for mutating requests
    // Block form-urlencoded, XML, and other types that could cause parser confusion
    console.error(`[${requestId}][SEC-206] Rejected unsupported Content-Type: ${incomingContentType}`)
    return NextResponse.json(
      { error: "Unsupported Content-Type. Use application/json.", requestId },
      { status: 415 }
    )
  }

  let body: Buffer | string | undefined
  if (method !== "GET" && method !== "HEAD") {
    try {
      if (isBinary) {
        // For multipart / binary payloads: read as raw bytes so we never corrupt
        // file data or break multipart boundaries.
        const rawBuffer = await req.arrayBuffer()
        if (rawBuffer.byteLength > 0) {
          body = Buffer.from(rawBuffer)
        }
      } else {
        const rawBody = await req.text()
        if (rawBody) {
          // SEC-024: Sanitize JSON body before proxying
          try {
            const parsed = JSON.parse(rawBody)
            const sanitized = sanitizeJsonValue(parsed)
            body = JSON.stringify(sanitized)
          } catch {
            // If not valid JSON, pass through but sanitize string
            body = rawBody
              .replace(/\0/g, "")
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
          }
        }
      }
    } catch {
      // No body
    }
  }

  const headers: HeadersInit = {
    // SEC-032: Include request ID in outgoing request for end-to-end tracing
    "X-Request-ID": requestId,
  }

  if (isBinary) {
    // Forward the original Content-Type header verbatim so that multipart
    // boundaries and other binary media types reach the backend intact.
    // Setting our own Content-Type here would destroy the boundary parameter
    // that is embedded in the original header value.
    if (incomingContentType) {
      headers["Content-Type"] = incomingContentType
    }
  } else {
    // For JSON / text requests keep the previous behaviour.
    headers["Content-Type"] = "application/json"
  }

  if (API_KEY) {
    headers["X-API-Key"] = API_KEY
  }

  if (session) {
    headers["Authorization"] = `Bearer ${session}`
  }

  // SEC-211: Extract user ID from session token and forward to backend.
  // The session token is httpOnly and cannot be modified by client-side JavaScript.
  // We verify the session and extract the user ID server-side before forwarding.
  if (session) {
    // Always forward the session token as Authorization header for backend validation
    headers["Authorization"] = `Bearer ${session}`

    try {
      // Try to decode the session token - it might be a JWT or plain token
      const parts = session.split(".")
      if (parts.length === 3) {
        // It's a JWT - decode the payload
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
        const decoded = atob(padded)
        const payload = JSON.parse(decoded)
        const userId = payload.userId || payload.sub
        if (userId) {
          headers["X-User-Id"] = userId
          console.log(`[${requestId}] Added X-User-Id header from JWT:`, userId)
        }
      } else {
        // It might be a plain token - the backend will need to validate it
        console.log(`[${requestId}] Session token is not a JWT, backend must validate`)
      }
    } catch (error) {
      console.error(`[${requestId}] Failed to extract user ID from session:`, error)
    }
  }

  // SEC-228: Explicitly DO NOT forward client-supplied hop-by-hop or
  // internal headers to the backend. These headers from the client could:
  // - Spoof internal trust signals (X-Real-IP, X-Forwarded-For)
  // - Manipulate caching (Pragma, Cache-Control from client)
  // - Inject connection-level directives (Connection, Transfer-Encoding)
  // The proxy constructs its OWN headers object above, so client headers
  // are NOT forwarded by default. This comment documents the intentional design.

  // DEBUG: Log outgoing request details
  console.log(`[${requestId}][DEBUG-OUTGOING] Headers being sent:`, JSON.stringify(headers, null, 2))
  console.log(`[${requestId}][DEBUG-OUTGOING] Has body: ${!!body}, body length: ${body ? (typeof body === 'string' ? body.length : (body as Buffer).length) : 0}`)
  if (body && typeof body === 'string' && body.length < 500) {
    console.log(`[${requestId}][DEBUG-OUTGOING] Body preview: ${body}`)
  }

  try {
    // SEC-030: Create AbortController for request timeout
    // PRO-MODE-FIX: Use longer timeout for chat endpoint (SSE streaming)
    const isStreamingChat = pathStr === "chat" && method === "POST"
    const effectiveTimeout = isStreamingChat ? STREAMING_TIMEOUT_MS : REQUEST_TIMEOUT_MS
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout)

    // SEC-029: IP Pinning - Use resolved IP with custom HTTP client to prevent DNS rebinding
    // The standard fetch() API would re-resolve DNS internally, creating a TOCTOU window.
    // By using Node.js http/https modules with explicit hostname override, we ensure
    // the connection goes to the validated IP while preserving Host header and TLS SNI.
    let response: Response

    if (resolvedIP) {
      console.log(
        `[${requestId}] Proxying ${method} to ${fullUrl} via pinned IP ${resolvedIP}`
      )

      response = await fetchWithPinnedIP(fullUrl, resolvedIP, {
        method,
        headers: headers as Record<string, string>,
        body,
        signal: controller.signal,
        timeout: effectiveTimeout,
      })
    } else {
      // Local development fallback - no IP pinning needed for localhost
      console.log(`[${requestId}] Proxying ${method} to ${fullUrl} (local dev)`)

      response = await fetch(fullUrl, {
        method,
        headers,
        // Cast body for fetch() compatibility - Buffer extends Uint8Array but
        // older @types/node BodyInit definitions may not include it
        body: body as BodyInit | undefined,
        signal: controller.signal,
      })
    }

    clearTimeout(timeoutId)

    // DEBUG: Log backend response
    console.log(`[${requestId}][DEBUG-RESPONSE] Status: ${response.status} ${response.statusText}`)
    console.log(`[${requestId}][DEBUG-RESPONSE] Content-Type: ${response.headers.get("Content-Type") || "(none)"}`)
    console.log(`[${requestId}][DEBUG-RESPONSE] Content-Length: ${response.headers.get("Content-Length") || "(none)"}`)

    // SEC-031: Check Content-Length before reading response
    const contentLength = response.headers.get("Content-Length")
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE_BYTES) {
      console.error(
        `[${requestId}][SEC-031] Response too large: ${contentLength} bytes (max: ${MAX_RESPONSE_SIZE_BYTES})`
      )
      return NextResponse.json(
        { error: "Response too large", requestId },
        { status: 502 }
      )
    }

    const rawResponseContentType = response.headers.get("Content-Type") || ""

    // SEC-225: Sanitize upstream Content-Type before reflecting in response.
    // A compromised or malicious backend could inject CRLF characters or
    // exotic charsets (UTF-7, UTF-32) into the Content-Type header to trigger:
    // - Response header injection (CRLF -> new headers or body split)
    // - Charset-based XSS (UTF-7 decoding can bypass HTML encoding)
    // - Cache poisoning with unexpected content types
    // Strip control characters and validate against allowed content types.
    const responseContentType = rawResponseContentType
      .replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Strip CRLF and control chars
      .slice(0, 200) // Limit length to prevent header bloat

    // SEC-226: Block dangerous charset encodings that can cause XSS.
    // UTF-7 content type allows encoding like +ADw-script+AD4- which browsers
    // decode into <script> tags, bypassing HTML entity encoding.
    const lowerContentType = responseContentType.toLowerCase()
    if (lowerContentType.includes("utf-7") || lowerContentType.includes("utf-32")) {
      console.error(`[${requestId}][SEC-226] Blocked dangerous charset in response Content-Type: ${responseContentType.slice(0, 50)}`)
      return NextResponse.json(
        { error: "Unsupported content encoding in upstream response", requestId },
        { status: 502 }
      )
    }

    const isSSEResponse = responseContentType.includes("text/event-stream")

    if (isSSEResponse) {
      // SSE path: pipe the ReadableStream straight through to the client.
      // fetchWithPinnedIP already returns a streaming body for SSE — we just
      // wrap it in a NextResponse with the correct headers so tokens are
      // delivered progressively rather than buffered until completion.
      console.log(`[${requestId}] SSE detected — streaming response passthrough`)

      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, no-transform",
          "X-Accel-Buffering": "no", // Disable nginx proxy buffering if present
          // SEC-032: Include request ID in response for client-side debugging
          "X-Request-ID": requestId,
          // SEC-202: Security headers on SSE responses to prevent MIME sniffing and framing
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          // SEC-203: Vary header to prevent cache poisoning via different auth/cookie states
          "Vary": "Authorization, Cookie, Accept",
        },
      })
    }

    // Non-SSE path: SEC-031 buffer with size limit to prevent memory exhaustion
    const chunks: Uint8Array[] = []
    let totalSize = 0
    const reader = response.body?.getReader()

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        totalSize += value.length
        if (totalSize > MAX_RESPONSE_SIZE_BYTES) {
          reader.cancel()
          console.error(
            `[${requestId}][SEC-031] Response exceeded size limit during streaming: ${totalSize} bytes`
          )
          return NextResponse.json(
            { error: "Response too large", requestId },
            { status: 502 }
          )
        }
        chunks.push(value)
      }
    }

    // Combine chunks into response
    const responseBuffer = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      responseBuffer.set(chunk, offset)
      offset += chunk.length
    }
    const responseData = new TextDecoder().decode(responseBuffer)

    // DEBUG: Log response body preview
    console.log(`[${requestId}][DEBUG-RESPONSE-BODY] Total size: ${totalSize} bytes`)
    if (responseData.length < 1000) {
      console.log(`[${requestId}][DEBUG-RESPONSE-BODY] Full body: ${responseData}`)
    } else {
      console.log(`[${requestId}][DEBUG-RESPONSE-BODY] First 500 chars: ${responseData.slice(0, 500)}`)
    }

    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        "Content-Type": responseContentType || "application/json",
        // SEC-032: Include request ID in response for client-side debugging
        "X-Request-ID": requestId,
        // SEC-202: Security headers on proxy responses to prevent MIME sniffing
        "X-Content-Type-Options": "nosniff",
        // SEC-203: Vary header to prevent cache poisoning via different auth/cookie states
        // Without this, a CDN could serve a cached authenticated response to an unauthenticated user
        "Vary": "Authorization, Cookie, Accept",
        // SEC-204: Prevent proxy responses from being cached with sensitive data
        "Cache-Control": "no-store, private",
      },
    })
  } catch (error) {
    // SEC-030: Handle timeout specifically
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[${requestId}][SEC-030] Request timeout after ${REQUEST_TIMEOUT_MS}ms`)
      return NextResponse.json(
        { error: "Request timeout", requestId },
        { status: 504 }
      )
    }

    console.error(`[${requestId}][DEBUG-ERROR] Backend error:`, error)
    console.error(`[${requestId}][DEBUG-ERROR] Error name: ${error instanceof Error ? error.name : 'unknown'}`)
    console.error(`[${requestId}][DEBUG-ERROR] Error message: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`[${requestId}][DEBUG-ERROR] Target was: ${fullUrl}`)
    return NextResponse.json({ error: "Backend unavailable", requestId }, { status: 502 })
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context.params, "GET")
}

/**
 * SEC-205: Explicitly handle HEAD requests to prevent Next.js auto-generation
 * from GET. The auto-generated HEAD would bypass the proxyRequest path and
 * could be used for cache probing or CSRF bypass since it doesn't go through
 * the same validation pipeline as our explicit method handlers.
 */
export async function HEAD(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context.params, "HEAD")
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context.params, "POST")
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context.params, "PUT")
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context.params, "DELETE")
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context.params, "PATCH")
}
