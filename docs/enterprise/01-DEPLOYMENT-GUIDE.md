# NexusAD Enterprise Deployment Guide
**Version:** 2.0.0
**Classification:** INTERNAL — ENGINEERING
**Last Updated:** 2026-03-31

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [High Availability Setup](#high-availability-setup)
3. [Load Balancing Configuration](#load-balancing-configuration)
4. [Blue-Green Deployment Strategy](#blue-green-deployment-strategy)
5. [Rollback Procedures](#rollback-procedures)
6. [Health Check Configuration](#health-check-configuration)

---

## Architecture Overview

NexusAD runs a split-tier architecture across two managed platforms:

```
Internet
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│  Vercel Edge Network (Global CDN)                         │
│  iad1 (US East)  |  dub1 (Dubai)  |  sin1 (Singapore)    │
│  nexusad.ai                                               │
└──────────────────────────┬────────────────────────────────┘
                           │  HTTPS + httpOnly Cookie Auth
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 Application Layer (Vercel Serverless)        │
│  - Security Middleware (SEC-001 → SEC-130)               │
│  - CSRF HMAC Double-Submit                               │
│  - Redis-backed Rate Limiting (Upstash)                  │
│  - Proxy Route: /api/proxy/[...path]                     │
└──────────────────────────┬───────────────────────────────┘
                           │  Bearer Token + X-User-Id
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Sovereign AI Backend (RunPod)                           │
│  https://4ljj3bdk1x0vhv-9000.proxy.runpod.net           │
│  v2.0.0 — 132 endpoints, 20 domains                     │
│  - Smart routing (13 AI providers)                       │
│  - AES-256-GCM vault encryption                         │
│  - PII scrubbing pipeline                                │
│  - Emotion detection + Voice I/O                         │
└──────────────────────────────────────────────────────────┘
```

**Key Properties:**
- Frontend is stateless — session state lives in Redis and httpOnly cookies
- Backend is the single source of truth for all data
- The Next.js proxy is the sole security boundary between browser and backend
- No direct browser-to-backend traffic is permitted

---

## High Availability Setup

### Frontend (Vercel)

Vercel provides automatic high availability. No manual configuration is required for the frontend layer. However the following settings in `vercel.json` MUST be maintained for optimal HA:

```json
{
  "framework": "nextjs",
  "regions": ["iad1", "dub1", "sin1"],
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

**Region Explanation:**
| Region Code | Location | Purpose |
|-------------|----------|---------|
| `iad1` | US East (Virginia) | Primary — highest Vercel capacity |
| `dub1` | Dubai, UAE | MENA users — critical for the UAE-first product |
| `sin1` | Singapore | Asia-Pacific coverage |

**Vercel HA Guarantees:**
- Automatic failover between regions — no action needed
- Each serverless function invocation is isolated (no shared state)
- Static assets served from 100+ edge PoPs globally
- 99.99% SLA on Vercel Enterprise tier

### Backend (RunPod)

RunPod requires explicit HA configuration at the pod level. Follow these steps when provisioning a new backend pod:

**Step 1 — Choose a GPU-enabled persistent volume:**
```
Volume size: minimum 50 GB (recommended 100 GB)
Volume type: Network-attached (persists across restarts)
Mount path: /workspace
```

**Step 2 — Configure automatic restart policy:**
```
Restart policy: Always
Max restarts: Unlimited
Restart delay: 30 seconds
```

**Step 3 — Set health check endpoint:**
```
Health check URL: /health
Health check interval: 30s
Failure threshold: 3
```

**Step 4 — Configure minimum replicas:**
For enterprise deployments, run a minimum of 2 pod replicas behind RunPod's load balancer:
```
Min replicas: 2
Max replicas: 10 (for autoscaling)
Scale trigger: CPU > 70% for 60 seconds
```

### Redis (Upstash) HA

Rate limiting and session management depend on Upstash Redis. Configure with:

```
Tier: Production (Multi-region replication)
Primary region: ap-southeast-1 (Singapore — closest to UAE)
Read replicas: us-east-1, eu-west-1
Eviction policy: allkeys-lru
Max memory: 1 GB minimum
TLS: Required (already enforced in middleware)
```

Environment variables that must be set in Vercel:
```
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

If Upstash Redis is unreachable, the middleware circuit breaker (`REL-017`) automatically falls back to in-memory rate limiting. This means rate limits will not be shared across serverless instances, but the service will NOT go down.

---

## Load Balancing Configuration

### Frontend Load Balancing

Vercel manages all frontend load balancing automatically. The CDN distributes requests based on geographic proximity to the three configured regions (`iad1`, `dub1`, `sin1`).

For custom domain configuration:

```
DNS Configuration (at your DNS provider):
A     nexusad.ai    →   76.76.21.21   (Vercel)
CNAME www           →   cname.vercel-dns.com
```

SSL/TLS is provisioned automatically by Vercel via Let's Encrypt. No manual certificate management is required for the primary domain.

### Backend Load Balancing (RunPod)

When running multiple backend replicas, configure RunPod's internal load balancer:

```yaml
# RunPod Pod Configuration
load_balancer:
  algorithm: round_robin          # Options: round_robin, least_connections, ip_hash
  health_check:
    path: /health
    interval: 15s
    timeout: 5s
    healthy_threshold: 2
    unhealthy_threshold: 3
  sticky_sessions: false          # Stateless backend — sticky not needed
  connection_draining:
    enabled: true
    timeout: 30s                  # Allow in-flight SSE streams to complete
```

**Important:** The `/api/v1/chat` endpoint uses Server-Sent Events (SSE) for streaming. Ensure your load balancer does NOT buffer responses and has a minimum timeout of 120 seconds for streaming connections.

```
Proxy read timeout:    120s  (for SSE chat streams)
Proxy connect timeout: 10s
Keep-alive timeout:    75s
```

### API Proxy Layer

The Next.js proxy at `/api/proxy/[...path]/route.ts` adds the following headers to every proxied request:

```
Authorization: Bearer <session-token>
X-User-Id: <userId>               (extracted from JWT)
Content-Type: <forwarded>
```

The backend trusts `X-User-Id` from the proxy. The proxy is the security boundary — no external traffic should ever reach the backend directly.

**Recommended network topology:**
```
nexusad.ai (public) → Vercel Proxy → RunPod (private network only)
```

Restrict RunPod network access to Vercel's IP ranges only (available from Vercel's documentation).

---

## Blue-Green Deployment Strategy

NexusAD uses Vercel's built-in deployment system, which provides blue-green semantics automatically. Each `git push` creates an immutable deployment. Traffic is switched to the new deployment only after a successful build and health check.

### Standard Deployment Flow

```
┌──────────────────────────────────────────────────────────────┐
│ BLUE (current production)                                    │
│ nexad-qcf541qu0-abousader-6045s-projects.vercel.app          │
│ nexusad.ai → BLUE                                            │
└──────────────────────────────────────────────────────────────┘
                        │ git push main
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ GREEN (new deployment, being built)                          │
│ nexad-<new-hash>-abousader-6045s-projects.vercel.app         │
│ Build → Type check → Sentry upload → Health check            │
└──────────────────────────────────────────────────────────────┘
                        │ Build passes
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Alias switch: nexusad.ai → GREEN                             │
│ BLUE remains live (rollback target) for 24 hours             │
└──────────────────────────────────────────────────────────────┘
```

### Deployment Command

The canonical deployment command is:

```bash
cd ~/nexad-live && ./deploy.sh
```

The `deploy.sh` script performs:
1. `npx vercel --prod --json` — builds and deploys to Vercel production
2. Extracts the new deployment URL from the JSON output
3. `npx vercel alias set <url> nexusad.ai` — switches traffic to the new deployment

**Manual verification step (run before alias switch for high-risk deployments):**
```bash
# Get the new deployment URL without switching traffic
npx vercel --prod --json | jq -r '.deployment.url'

# Test the staging URL directly
curl -I https://<new-deployment-url>/api/health

# Check a few critical pages
curl -s https://<new-deployment-url>/ | grep -c "NexusAD"

# Only then switch the alias
npx vercel alias set <new-deployment-url> nexusad.ai
```

### Environment Variable Management

Production environment variables are managed in the Vercel dashboard. They are NOT stored in any repository file.

Required variables for production:
```
BACKEND_API_URL          = https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1
CSRF_HMAC_SECRET         = <min 32 chars — rotate quarterly>
SESSION_SECRET           = <min 32 chars — rotate quarterly>
GOOGLE_CLIENT_ID         = <OAuth client ID>
GOOGLE_CLIENT_SECRET     = <OAuth client secret>
JWT_SECRET               = <min 32 chars — rotate quarterly>
UPSTASH_REDIS_REST_URL   = <Upstash endpoint>
UPSTASH_REDIS_REST_TOKEN = <Upstash token>
NEXT_PUBLIC_SENTRY_DSN   = <Sentry DSN>
SENTRY_AUTH_TOKEN        = <Sentry auth token for source map upload>
SENTRY_ORG               = <Sentry org slug>
SENTRY_PROJECT           = nexad
STRICT_SECURITY_MODE     = true
NODE_OPTIONS             = --max-http-header-size=65536
```

**Any change to environment variables requires a new deployment to take effect.**

### Zero-Downtime Backend Deployments

For backend deployments on RunPod:

1. Start the new pod version alongside the existing pod
2. Wait for the new pod health check to return 200
3. Switch RunPod's routing to the new pod
4. Monitor error rates for 10 minutes
5. Terminate the old pod if stable; keep it running if errors appear

---

## Rollback Procedures

### Frontend Rollback (< 2 minutes)

Vercel keeps all previous deployments permanently. To roll back:

```bash
# List recent deployments
npx vercel ls --prod

# Roll back to a specific deployment URL
npx vercel alias set <previous-deployment-url> nexusad.ai
```

Or from the Vercel dashboard:
1. Go to nexusad.ai project → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → Promote to Production

**RTO for frontend rollback: under 2 minutes**

### Backend Rollback

RunPod supports container image versioning. Tag every production image:

```bash
# Tag current image before deploying
docker tag sovereign-ai:latest sovereign-ai:$(date +%Y%m%d-%H%M%S)

# To roll back — restart pod with previous image tag
runpodctl update pod <pod-id> --image sovereign-ai:<previous-tag>
```

If no tagged image is available, restore from the last known-good RunPod pod snapshot.

**RTO for backend rollback: 5–15 minutes** (depends on image pull time)

### Database / State Rollback

The backend maintains encrypted vaults using AES-256-GCM. For data rollback:

1. Stop all write operations to the affected vault
2. Restore from the most recent backup (see Disaster Recovery Plan)
3. Verify vault integrity using the Merkle proof endpoint: `GET /api/v1/vault/shards`
4. Re-run any failed transactions from the audit log: `GET /api/v1/compliance/audit-trail/{userId}`

### Rollback Decision Criteria

| Metric | Threshold | Action |
|--------|-----------|--------|
| HTTP 5xx error rate | > 1% over 5 minutes | Immediate rollback |
| p99 latency | > 10 seconds | Investigate, then rollback if not fixed in 15 min |
| Auth failure rate | > 5% over 2 minutes | Immediate rollback |
| Chat SSE failure rate | > 2% over 5 minutes | Rollback backend |
| Sentry error spike | > 10x baseline | Immediate rollback |

---

## Health Check Configuration

### Frontend Health Check

```
URL:    https://nexusad.ai/api/health
Method: GET
Expected status: 200
Expected body: { "status": "ok" }
Interval: 30 seconds
Timeout: 10 seconds
```

If this endpoint does not exist, create it at `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() })
}
```

### Backend Health Check

```
URL:    https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health
Method: GET
Expected status: 200
Interval: 15 seconds
Timeout: 5 seconds
```

The backend `/health` endpoint returns the system status including AI provider connectivity. A 200 response indicates all core systems are operational.

### Upstash Redis Health Check

The middleware automatically detects Redis unavailability via the circuit breaker pattern (`REL-017`). No external probe is required. However, you can verify Redis health with:

```bash
curl -X POST \
  https://your-upstash-url.upstash.io \
  -H "Authorization: Bearer <token>" \
  -d '["PING"]'
# Expected: ["OK","PONG"]
```

### Synthetic Monitoring (Recommended)

Set up synthetic monitoring for these critical user journeys every 5 minutes:

| Journey | URL | Expected |
|---------|-----|----------|
| Landing page loads | `https://nexusad.ai` | 200, < 3s |
| Login page loads | `https://nexusad.ai/login` | 200 |
| Backend health | `/health` (RunPod) | 200 |
| API proxy reachable | `/api/proxy/health` | 200 or 404 (not 500) |

Use Vercel's built-in uptime monitoring or an external service (Datadog Synthetics, Checkly, or UptimeRobot) to run these checks from UAE-region nodes for accurate latency measurement.

---

*Next document: [02-DISASTER-RECOVERY-PLAN.md](./02-DISASTER-RECOVERY-PLAN.md)*
