# NexusAD Performance Tuning Guide
**Version:** 2.0.0
**Classification:** INTERNAL — ENGINEERING
**Last Updated:** 2026-03-31

---

## Table of Contents

1. [Performance Targets](#performance-targets)
2. [CDN Configuration](#cdn-configuration)
3. [Caching Strategies](#caching-strategies)
4. [Backend Optimization](#backend-optimization)
5. [Resource Scaling](#resource-scaling)
6. [Monitoring Setup](#monitoring-setup)

---

## Performance Targets

These are the binding performance SLOs for NexusAD. Any regression beyond these thresholds triggers an incident.

| Metric | Target | Critical Threshold | Measurement |
|--------|--------|-------------------|-------------|
| Time to First Byte (TTFB) | < 200ms | > 500ms | Vercel Analytics |
| First Contentful Paint (FCP) | < 1.5s | > 3.0s | Core Web Vitals |
| Largest Contentful Paint (LCP) | < 2.5s | > 4.0s | Core Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | > 0.25 | Core Web Vitals |
| Interaction to Next Paint (INP) | < 200ms | > 500ms | Core Web Vitals |
| Chat first token latency | < 2.0s | > 5.0s | Sentry custom metric |
| Chat total response (standard) | < 8.0s | > 15.0s | Sentry custom metric |
| API proxy latency (p99) | < 500ms | > 2.0s | Vercel Analytics |
| Vault upload (1MB file) | < 3.0s | > 8.0s | Sentry custom metric |
| Page load (dashboard) | < 2.0s | > 5.0s | Vercel Analytics |

**Chat mode latency targets (approximate, AI provider dependent):**

| Mode | Expected | Description |
|------|----------|-------------|
| fast | 2–3s | Cerebras + Grok ultrafast routing |
| standard | 3–6s | Balanced routing |
| thinking | 8–20s | Board of Directors multi-model debate |
| pro | 10–25s | McKinsey-grade analysis |
| document | 15–45s | Long-form document generation |

---

## CDN Configuration

### Vercel Edge Network

NexusAD's frontend is deployed on Vercel, which operates a global CDN automatically. The following configurations in `next.config.ts` and `vercel.json` maximize CDN efficiency:

**Static asset caching (already configured in `next.config.ts`):**
```typescript
// Long-lived immutable cache for JS/CSS bundles
// next.config.ts — already in production
{
  source: "/_next/static/(.*)",
  headers: [
    { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
  ]
}

// 24-hour cache with stale-while-revalidate for images
{
  source: "/(.*\\.(png|jpg|jpeg|gif|svg|ico|webp|avif))",
  headers: [
    { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=43200" }
  ]
}
```

**API routes must never be cached (already configured in `vercel.json`):**
```json
{
  "source": "/api/(.*)",
  "headers": [{ "key": "Cache-Control", "value": "no-store, must-revalidate" }]
}
```

### Image Optimization

Next.js automatic image optimization is configured in `next.config.ts`:

```typescript
images: {
  formats: ["image/avif", "image/webp"],  // Modern, smaller formats
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256],
  minimumCacheTTL: 86400,  // 24 hours
}
```

**Always use Next.js `<Image>` component** instead of `<img>` tags. This ensures:
- Automatic WebP/AVIF conversion (30–50% smaller than JPEG)
- Lazy loading by default
- Correct sizing prevents Cumulative Layout Shift
- Responsive srcset generation

### Optional: Cloudflare in Front of Vercel

For maximum performance in the UAE market, add Cloudflare as an additional CDN layer:

```
Benefits:
- Cloudflare has a UAE PoP in Dubai (DXB)
- Additional DDoS protection layer
- Bot management
- Web Application Firewall (WAF)

Configuration:
1. Add nexusad.ai to Cloudflare
2. Set SSL mode: Full (Strict)
3. Cache Rules:
   - Cache static assets: /_next/static/* → Cache Everything, TTL 1 year
   - Bypass cache for API routes: /api/* → Bypass
   - Bypass cache for auth routes: /login, /auth/* → Bypass
4. Page Rules:
   - Disable security features for /api/v1/auth/* (OAuth redirects must not be modified)
```

---

## Caching Strategies

### Frontend Caching Layers

```
Request flow with caching:

Browser → Service Worker (if installed)
       → Browser HTTP Cache (Cache-Control headers)
       → Vercel/Cloudflare CDN Edge
       → Next.js server (for dynamic routes)
       → Redis (for rate limits, sessions)
       → Backend (RunPod)
```

### Next.js Data Caching

For any server-side data fetching, use Next.js built-in cache:

**Static data (infrequently changing):**
```typescript
// Cache for 1 hour, revalidate in background
const data = await fetch('/api/v1/some-static-data', {
  next: { revalidate: 3600 }
})
```

**Dynamic data (user-specific, must be fresh):**
```typescript
// No cache — always fresh
const data = await fetch('/api/v1/user-specific-data', {
  cache: 'no-store'
})
```

**Session-aware routes:** All routes requiring authentication MUST use `cache: 'no-store'` to prevent cross-user data leakage.

### Redis Caching (Upstash)

Redis is currently used for:
1. Distributed rate limiting (primary use)
2. Session timeout tracking

**Recommended addition — API response caching:**

For the Butler feed (checked frequently by users), implement a short TTL cache:

```typescript
// In src/lib/api.ts — add cache wrapper for butler feed
const CACHE_TTL_SECONDS = 60  // 1 minute

async function getButlerFeedCached(userId: string) {
  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  const cacheKey = `butler:feed:${userId}`

  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  // Fetch fresh data
  const fresh = await getButlerFeed(userId)

  // Cache with TTL
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(fresh))

  return fresh
}
```

**Cache invalidation strategy:**
- Butler feed: invalidate on `triggerButlerRefresh()` call
- Vault document list: invalidate on upload, delete, or ingest operations
- User profile: invalidate on any settings update

### Browser-Side Caching

React Query or SWR are recommended for all API data in the frontend. These provide:
- Stale-while-revalidate pattern
- Automatic background refetching
- Deduplication of simultaneous requests
- Optimistic updates for mutations

Current architecture uses direct API calls. Migrating to React Query is a recommended performance improvement — track as a P2 task.

---

## Backend Optimization

### AI Provider Routing Performance

The backend's smart routing across 13 AI providers is the primary determinant of chat response latency. Key optimization points:

**1. Fast mode configuration:**
Fast mode uses Cerebras + Grok for 2–3 second responses. This is already implemented. Ensure the `fast` mode is prominently exposed in the UI for users who need speed over depth.

**2. Streaming (SSE) vs. non-streaming:**
Always use streaming (`streamChat()`) for chat responses, not the non-streaming `sendChatMessage()`. Streaming makes the interface feel faster because the first token appears within ~1–2 seconds even for long responses.

**3. Model routing fallback chain:**
Configure the backend with a fallback chain. If the primary model fails or is slow, route to the next available:
```
Primary:  User's preferred model
Fallback: Grok-3 (fast)
Ultimate: Cerebras (fastest — used for fast mode)
```

### SSE Streaming Optimization

The chat SSE endpoint streams multiple event types. Parse and render them in real time:

```typescript
// Already in src/lib/api.ts — ensure these event types are all handled
const eventHandlers = {
  'token': (data) => appendToMessage(data),        // Render immediately
  'content': (data) => appendToMessage(data),       // Render immediately
  'rag_sources': (data) => showSources(data),       // Show sources as they arrive
  'sovereignty': (data) => updateSovereigntyUI(data), // Update privacy metrics
  'ping': () => {},                                 // Keep-alive, ignore
  'done': () => finalizeMessage(),                  // Complete the message
  'error': (data) => showError(data),               // Handle errors
}
```

Never wait for the stream to complete before rendering. Show each token as it arrives.

### Vault Performance

For large vault operations:
- Use chunked uploads for files > 1MB
- Implement progress indicators (upload is already wired via `uploadToVault()`)
- Shard distribution across 3 UAE nodes (`SHARD_NODES` in constants.ts) is automatic

**Vault search optimization:**
The `/api/v1/vault/search` endpoint performs semantic search. For fast results:
- Keep vault documents focused (avoid uploading entire books)
- Optimal document size: 1–50 pages
- Use descriptive document titles (improves search relevance)

### RunPod GPU Utilization

For the AI backend on RunPod:

```
Recommended GPU configuration:
- Voice I/O and image generation: RTX 4090 or A100 (80GB)
- Text-only workloads: A10G or L40S
- Minimum VRAM: 24GB for running multiple models simultaneously

Optimization settings:
- Enable flash attention: reduces memory usage and improves throughput
- Use model quantization (INT8/INT4) for faster inference where quality allows
- Batch requests: run multiple users' requests through the same model in parallel
```

---

## Resource Scaling

### Frontend Scaling (Vercel)

Vercel scales automatically with zero configuration. Each request is handled by an isolated serverless function instance. There is no concept of "scaling up" — the platform handles it.

**Vercel function limits to be aware of:**
| Resource | Limit | Implication |
|----------|-------|-------------|
| Function execution time | 300 seconds (Pro) | SSE streaming stays within limit |
| Function memory | 1024 MB | Sufficient for current workloads |
| Function payload | 4.5 MB response, 4.5 MB request | Large file uploads must go directly to backend |
| Concurrent executions | Unlimited (Pro) | No scaling bottleneck |

**If you hit the 4.5 MB request payload limit for file uploads:**
Implement direct-to-backend uploads with a presigned URL pattern:
1. Frontend requests an upload URL from the proxy
2. Proxy generates a signed URL from the backend
3. Frontend uploads directly to the backend's S3-compatible storage
4. Frontend notifies the proxy that upload is complete

### Backend Scaling (RunPod)

Configure RunPod autoscaling:

```yaml
scaling:
  min_replicas: 2          # Always keep 2 warm (zero cold-start for users)
  max_replicas: 20         # Scale to 20 under heavy load

  scale_up_trigger:
    metric: cpu_utilization
    threshold: 70          # Scale up when CPU > 70%
    duration: 60s          # Must be sustained for 60 seconds
    cooldown: 180s         # Wait 3 min before scaling up again

  scale_down_trigger:
    metric: cpu_utilization
    threshold: 20          # Scale down when CPU < 20%
    duration: 300s         # Must be sustained for 5 minutes
    cooldown: 600s         # Wait 10 min before scaling down

  scale_by: 2              # Add 2 replicas at a time
```

**GPU scaling specifics:**
GPU instances take 30–90 seconds to start. Keep `min_replicas: 2` to ensure users never wait for a cold-start GPU.

### Redis Scaling (Upstash)

Upstash scales automatically. For high-traffic scenarios:
- Upgrade to Upstash Pro (higher throughput)
- Enable read replicas for read-heavy workloads
- Current usage (rate limiting + sessions) is lightweight — no scaling concern at current scale

### Capacity Planning

| Traffic Level | Frontend | Backend Pods | Redis |
|---------------|----------|-------------|-------|
| < 100 concurrent users | Vercel auto | 2 pods | Free tier |
| 100–1,000 concurrent | Vercel auto | 2–5 pods | Pro tier |
| 1,000–10,000 concurrent | Vercel Enterprise | 5–20 pods | Pro tier + replicas |
| > 10,000 concurrent | Vercel Enterprise + dedicated | 20+ pods | Enterprise tier |

---

## Monitoring Setup

### Core Monitoring Stack

NexusAD uses three monitoring tools:

| Tool | Purpose | Where |
|------|---------|--------|
| Sentry | Error tracking, performance tracing | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
| Vercel Analytics | Web Vitals, traffic, function metrics | Automatic (via `@vercel/analytics`) |
| Vercel Speed Insights | Real-user performance data | Automatic (via `@vercel/speed-insights`) |

### Sentry Configuration

Current Sentry configuration (`sentry.client.config.ts`):
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,         // 100% of transactions traced — reduce to 0.1 at scale
  replaysSessionSampleRate: 0.1, // 10% of sessions recorded
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions recorded
  enabled: process.env.NODE_ENV === "production",
})
```

**At scale (> 1,000 users), reduce `tracesSampleRate` to avoid Sentry quota overruns:**
```typescript
tracesSampleRate: 0.1,  // 10% sampling at scale
```

**Custom performance metrics to add:**

```typescript
// In src/lib/api.ts — wrap chat calls with Sentry transactions
import * as Sentry from "@sentry/nextjs"

export async function streamChatWithMetrics(request: ChatRequest) {
  const transaction = Sentry.startTransaction({
    name: "chat.stream",
    op: "ai.chat",
    data: { mode: request.mode }
  })

  const span = transaction.startChild({ op: "chat.first_token" })

  try {
    const stream = await streamChat(request)
    span.finish()  // Mark first-token time

    return stream
  } catch (err) {
    transaction.setStatus("internal_error")
    throw err
  } finally {
    transaction.finish()
  }
}
```

### Alert Configuration

Set up the following Sentry alerts:

**Error rate alerts:**
```
Alert: High 5xx rate
Condition: error_rate > 1% over 5 minutes
Action: Page on-call engineer
Priority: P0

Alert: Auth failure spike
Condition: error_type:"AuthError" count > 50 in 5 minutes
Action: Page on-call engineer + security team
Priority: P0

Alert: New error type
Condition: first_seen error with level:error
Action: Email engineering team
Priority: P1
```

**Performance alerts:**
```
Alert: LCP degradation
Condition: p75 LCP > 3.0s
Action: Email engineering team
Priority: P1

Alert: API latency spike
Condition: p99 transaction duration > 2s for any API route
Action: Slack notification to #engineering
Priority: P2
```

### Vercel Analytics Dashboard

Key metrics to watch in the Vercel dashboard:

1. **Function Duration** — p50, p90, p99 for each serverless function
2. **Error Rate** — 4xx and 5xx rates by route
3. **Bandwidth** — total egress (cost driver)
4. **Edge Requests** — requests served from CDN vs. origin

Access at: `https://vercel.com/abousader-6045s-projects/nexad/analytics`

### Structured Logging Integration

The middleware emits structured JSON logs in production (SEC-072). Ingest these into a log aggregator:

**Recommended: Axiom (integrates natively with Vercel)**
```
1. Create an Axiom dataset: "nexusad-production"
2. In Vercel: Settings → Log Drains → Add Axiom
3. Query pattern for security events:
   level:security | summarize count() by code | sort by count desc
```

**Recommended: Datadog (for enterprise customers)**
```
1. Install Datadog agent on RunPod pods
2. Configure log forwarder for structured JSON
3. Create dashboards:
   - Security events by type (SEC-XXX codes)
   - Rate limit hits by endpoint group
   - Session timeouts by user
   - CSRF violations by IP
```

### Key Queries for Operational Monitoring

```bash
# Top security events (last 24 hours)
SELECT code, COUNT(*) as count
FROM logs
WHERE level = 'security' AND timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY code
ORDER BY count DESC;

# Rate-limited IPs (potential attackers)
SELECT ip, COUNT(*) as count
FROM logs
WHERE code = 'SEC-022' AND timestamp > NOW() - INTERVAL 1 HOUR
GROUP BY ip
ORDER BY count DESC
LIMIT 20;

# Session timeouts by user (identify UX issues)
SELECT userId, COUNT(*) as timeouts
FROM logs
WHERE code = 'SEC-026' AND timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY userId
ORDER BY timeouts DESC;

# Chat error rate by mode
SELECT mode,
       COUNT(*) as total,
       SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors,
       ROUND(100.0 * SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate
FROM chat_events
WHERE timestamp > NOW() - INTERVAL 1 HOUR
GROUP BY mode;
```

### Performance Baseline (Establish After Initial Production Deploy)

Run these measurements within the first 7 days of production launch and record them as the baseline:

```bash
# 1. Core Web Vitals baseline
# Use Chrome DevTools → Lighthouse → Performance
# Target: LCP < 2.5s, FID < 100ms, CLS < 0.1

# 2. API latency baseline
for endpoint in "/" "/chat" "/vault" "/api/health"; do
  echo "Testing $endpoint"
  curl -w "@curl-format.txt" -s -o /dev/null "https://nexusad.ai$endpoint"
done

# curl-format.txt:
# time_namelookup: %{time_namelookup}s\n
# time_connect: %{time_connect}s\n
# time_starttransfer: %{time_starttransfer}s\n  ← TTFB
# time_total: %{time_total}s\n

# 3. Load test (use k6 or Locust)
k6 run --vus 50 --duration 60s load-test.js
# Target: zero errors, p99 < 500ms at 50 concurrent users

# 4. Chat latency baseline (time to first token)
time curl -X POST "https://nexusad.ai/api/proxy/chat" \
  -H "Content-Type: application/json" \
  -H "Cookie: nexus-session=<test-token>" \
  -d '{"message": "hello", "mode": "fast"}' \
  --no-buffer | head -c 1
```

---

*Previous: [03-SECURITY-HARDENING-GUIDE.md](./03-SECURITY-HARDENING-GUIDE.md)*
*Next: [05-OPERATIONS-RUNBOOK.md](./05-OPERATIONS-RUNBOOK.md)*
