# NEXUSAD CANONICAL PROJECT MAP
**Generated:** 2026-03-31
**Frontend:** nexad-live (nexusad.ai)
**Backend:** RunPod Sovereign AI v2.0.0
**Status:** 95 of 132 endpoints wired

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────────┐
│                 │      │                  │      │                         │
│  nexusad.ai     │─────▶│  Next.js Proxy   │─────▶│  RunPod Backend         │
│  (Vercel)       │      │  /api/proxy/*    │      │  4ljj3bdk1x0vhv-9000   │
│                 │      │                  │      │                         │
└─────────────────┘      └──────────────────┘      └─────────────────────────┘
```

**Security Layers:**
- CSRF protection (HMAC double-submit)
- Session cookies (httpOnly nexus-session)
- SSRF protection (DNS pinning, host whitelist)
- Rate limiting (10/min auth, 20/min chat)
- Response sanitization (prototype pollution, null bytes)

---

## BACKEND CAPABILITIES (132 ENDPOINTS)

### ✅ WIRED DOMAINS (95 endpoints connected)

#### 1. AUTHENTICATION (9/9 endpoints)
| Endpoint | Method | Frontend Route | Usage |
|----------|---------|----------------|--------|
| `/auth/login` | POST | `/api/v1/auth/login` | Email/password login |
| `/auth/register` | POST | `/api/v1/auth/register` | New user signup |
| `/auth/google` | GET | `/api/v1/auth/google` | OAuth initiation |
| `/auth/google/callback` | GET | `/api/v1/auth/google/callback` | OAuth callback |
| `/auth/verify` | POST | `/api/v1/auth/verify` | API key login |
| `/auth/verify-email` | POST | `/api/v1/auth/verify-email` | Email verification |
| `/auth/forgot-password` | POST | `/api/proxy/auth/forgot-password` | Password reset |
| `/auth/logout` | POST | `/api/v1/auth/logout` | Session termination |
| `/auth/session` | POST | `/api/v1/auth/session` | Session token set |

#### 2. CHAT (4/6 endpoints)
| Endpoint | Method | Frontend Function | Usage |
|----------|---------|-------------------|--------|
| `/chat` | POST | `streamChat()` | SSE streaming chat |
| `/chat` | POST | `sendChatMessage()` | Non-streaming chat |
| `/chat/detect-domain` | POST | `detectDomain()` | Domain detection |
| `/chat/fact-check` | POST | `factCheck()` | Claim verification |
| ❌ `/chat/clarify` | POST | - | NOT WIRED |
| ❌ `/chat/multi-model` | POST | - | NOT WIRED |

#### 3. VOICE (4/4 endpoints)
| Endpoint | Method | Frontend Function | Usage |
|----------|---------|-------------------|--------|
| `/voice/transcribe` | POST | `transcribeAudio()` | Audio to text |
| `/voice/speak` | POST | `speak()` | Text to speech |
| `/voice/voices` | GET | `getVoices()` | List available voices |
| `/voice/live` | WS | `createVoiceWebSocket()` | Live voice (NOT USED IN UI) |

#### 4. VAULT (11/11 endpoints)
| Endpoint | Method | Frontend Function | Usage |
|----------|---------|-------------------|--------|
| `/vault/init` | POST | `initVault()` | Initialize vault |
| `/vault/ingest` | POST | `ingestDocument()` | Text ingestion |
| `/vault/upload` | POST | `uploadToVault()` | File upload |
| `/vault/search` | POST | `searchVault()` | Search content |
| `/vault/documents` | GET | `listVaultDocuments()` | List documents |
| `/vault/document/{id}` | GET | `getVaultDocument()` | Get document |
| `/vault/document/{id}` | DELETE | `deleteDocument()` | Delete document |
| `/vault/info` | GET | `getVaultInfo()` | Vault statistics |
| `/vault/shards` | GET | `getShardDistribution()` | Shard map |
| `/vault/prove-delete` | POST | `proveDelete()` | Deletion certificate |
| `/vault/access-log` | GET | `getAccessLog()` | Access history |

#### 5. BILLING (7/7 endpoints)
| Endpoint | Method | Frontend Function | Usage |
|----------|---------|-------------------|--------|
| `/billing/subscription` | GET | `getSubscription()` | Current plan |
| `/billing/usage` | GET | `getUsage()` | Usage metrics |
| `/billing/invoices` | GET | `getInvoices()` | Invoice history |
| `/billing/subscribe` | POST | `subscribe()` | New subscription |
| `/billing/upgrade` | POST | `upgradePlan()` | Upgrade tier |
| `/billing/downgrade` | POST | `downgradePlan()` | Downgrade tier |
| `/billing/cancel` | POST | `cancelSubscription()` | Cancel plan |

#### 6. BUTLER (10/10 endpoints)
| Endpoint | Method | Frontend Function | Usage |
|----------|---------|-------------------|--------|
| `/butler/feed/{userId}` | GET | `getButlerFeed()` | Intelligence feed |
| `/butler/privacy-glass/{userId}` | GET | `getPrivacyGlass()` | Privacy stats |
| `/butler/interact` | POST | `butlerInteract()` | Card interactions |
| `/butler/onboard` | POST | `butlerOnboard()` | Onboarding data |
| `/butler/onboarding-status/{userId}` | GET | `getButlerOnboardingStatus()` | Onboard status |
| `/butler/fetch-now/{userId}` | POST | `triggerButlerRefresh()` | Force refresh |
| `/butler/notifications/{userId}` | GET | `getNotifications()` | Get notifications |
| `/butler/notifications/{id}/read` | PUT | `markNotificationRead()` | Mark read |
| `/butler/notifications/{userId}/read-all` | PUT | `markAllNotificationsRead()` | Mark all read |
| `/butler/notifications/{id}` | DELETE | `dismissNotification()` | Dismiss |

---

### ❌ UNWIRED DOMAINS (37 endpoints available)

#### 1. INTELLIGENCE (6 endpoints - CORE VALUE PROP!)
```typescript
GET  /intelligence/competitors/{userId}     // Competitor analysis
GET  /intelligence/market-data/{userId}     // Market intelligence
GET  /intelligence/uae-cpi                  // UAE inflation data
GET  /intelligence/uae-regulations          // Regulatory updates
GET  /intelligence/uae-realestate           // Real estate data
POST /intelligence/search                   // Smart search
```

#### 2. COMPLIANCE (13 endpoints - ENTERPRISE REQUIREMENT!)
```typescript
GET  /compliance/audit-trail/{userId}              // Full audit log
GET  /compliance/audit-trail/{userId}/download     // PDF audit trail
POST /compliance/request-certificate               // Compliance cert
GET  /compliance/certificates/{certId}/download    // Download cert
GET  /compliance/certificates/{userId}             // List certs
POST /compliance/data-handling-report              // Data report
GET  /compliance/retention-policies                // Retention rules
POST /compliance/retention-apply                   // Apply retention
GET  /compliance/cost-breakdown/{userId}           // Cost analysis
GET  /compliance/summary/{userId}                  // Compliance summary
POST /compliance/acknowledge                       // Acknowledge policy
GET  /compliance/acknowledgments/{userId}          // List acks
POST /compliance/export-compliance-data            // Export all
```

#### 3. CREATIVE (4 endpoints - UNIQUE CAPABILITIES!)
```typescript
POST /creative/generate-image      // AI image generation
POST /creative/generate-3d-model   // 3D model generation
POST /creative/parse-document      // OCR/document parsing
POST /creative/run-replicate       // Custom Replicate models
```

#### 4. EXTENDED CHAT (2 endpoints)
```typescript
POST /chat/clarify      // Refinement flows
POST /chat/multi-model  // Parallel multi-AI queries
```

#### 5. ENHANCED SOVEREIGNTY (5 endpoints)
```typescript
GET  /sovereignty/comparison              // Privacy comparison
POST /sovereignty/generate-report         // Generate report
GET  /sovereignty/report/{reportId}       // Get report
GET  /sovereignty/certificates/{userId}   // List certificates
GET  /sovereignty/certificate/{certId}    // Get certificate
```

#### 6. SECURITY (3 endpoints)
```typescript
GET  /brain/{email}/security-status    // Security check
POST /security/rotate-keys             // Key rotation
GET  /security/audit-log/{userId}      // Security log
```

#### 7. FINANCE (4 endpoints - Functions exist, no UI!)
```typescript
GET /finance/stock/{symbol}       // Stock quotes
GET /finance/forex/{from}/{to}    // Currency rates
GET /finance/crypto/{symbol}      // Crypto prices
GET /finance/search/{keywords}    // Ticker search
```

---

## AUTHENTICATION FLOW (FIXED 2026-03-31)

```
1. User enters credentials
   ↓
2. POST /api/v1/auth/login (Note: Backend only supports Google OAuth currently)
   ↓
3. Backend validates, returns user + token
   ↓
4. Server sets httpOnly cookie: nexus-session
   ↓
5. All API calls include session cookie
   ↓
6. Proxy extracts user ID from token AND adds headers:
   - Authorization: Bearer <token> (for backend validation)
   - X-User-Id: <userId> (extracted from JWT payload if JWT, otherwise backend validates)
   ↓
7. Backend trusts X-User-Id from proxy (proxy is the security boundary)
```

**Authentication Fix Notes:**
- Backend expects `X-User-Id` header from proxy
- Proxy extracts userId from JWT payload (if token is JWT)
- Proxy also sends Authorization header for backend validation
- Email/password login returns 501 - only Google OAuth is implemented

**Google OAuth Flow:**
```
1. User clicks Google button → GET /api/v1/auth/google
2. Redirect to Google consent screen
3. Google redirects to /api/v1/auth/google/callback
4. Backend exchanges code for user info
5. Backend redirects to /auth/callback?token=xxx
6. Frontend sets nexus-session cookie
7. Redirect to dashboard
```

---

## SPECIAL FEATURES

### SSE Streaming Events
The `/chat` endpoint streams these event types:
- `metadata` - Request metadata
- `rag_sources` - RAG document references
- `token` - Content tokens
- `sovereignty` - Privacy metrics
- `phase` - Orchestration phases
- `audit` - Auditor results
- `orchestration_complete` - Phase completion
- `brainstorm` - Brainstorm mode data
- `content` - Main response content
- `ping` - Keep-alive
- `verification` - Fact check results
- `error` - Error messages
- `done` - Stream complete

### Chat Modes
- **standard** - Basic chat
- **fast** - Cerebras + Grok ultrafast (~2-3s)
- **thinking** - Board of Directors debate
- **pro** - McKinsey-grade reports
- **document** - Long-form documents

### File Upload Support
```typescript
// Supported file types (from getAllSupportedExtensions())
Documents: pdf, doc, docx, odt, rtf, txt, md
Spreadsheets: xls, xlsx, ods, csv, tsv
Images: jpg, jpeg, png, gif, bmp, webp, svg, tiff
Audio: mp3, wav, ogg, m4a, aac, flac
Video: mp4, avi, mov, wmv, flv, webm
Archives: zip, tar, gz, rar, 7z
Code: js, py, java, cpp, c, cs, php, rb, go, rs, kt, swift, m, r, scala
Data: json, xml, yaml, yml, toml, sql
```

---

## DEPLOYMENT & OPERATIONS

### Current Deployment
- **Frontend:** nexusad.ai → nexad-qcf541qu0-abousader-6045s-projects.vercel.app
- **Backend:** https://4ljj3bdk1x0vhv-9000.proxy.runpod.net
- **Session fix:** Changed cookie from "session" to "nexus-session"

### Deploy Command
```bash
cd ~/nexad-live && ./deploy.sh
# This will:
# 1. Deploy to Vercel production
# 2. Update nexusad.ai alias automatically
```

### Environment Variables Required
```
BACKEND_API_URL=https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1
CSRF_HMAC_SECRET=<secret>
SESSION_SECRET=<secret>
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-secret>
JWT_SECRET=<jwt-secret>
```

---

## PRIORITY ACTIONS

### 1. Quick Wins (Already have API functions)
- [ ] Add Finance widget - stock/forex/crypto (4 endpoints)
- [ ] Enable WebSocket voice in UI (1 endpoint)
- [ ] Wire chat/clarify for refinements (1 endpoint)
- [ ] Wire chat/multi-model for parallel queries (1 endpoint)

### 2. High Value (CEO/Enterprise features)
- [ ] Build Intelligence Dashboard (6 endpoints)
  - Competitors, market data, regulations
  - This is the CORE VALUE PROP
- [ ] Build Compliance Center (13 endpoints)
  - Audit trails, certificates, retention
  - REQUIRED for enterprise sales

### 3. Differentiation (Unique to NexusAD)
- [ ] Add Creative tools (4 endpoints)
  - Image generation in chat
  - 3D model generation
  - Document OCR/parsing

### 4. Technical Debt
- [ ] Add resilience wrapping to 7 vault/user functions
- [ ] Document the 21 undocumented Brain API endpoints
- [ ] Implement proper WebSocket reconnection UI

---

## FILES TO REFERENCE

### Frontend
- `/src/lib/api.ts` - Main API client (62 functions)
- `/src/lib/billing-api.ts` - Billing API client (7 functions)
- `/src/app/api/proxy/[...path]/route.ts` - Proxy with security
- `/src/app/api/v1/auth/*` - Auth route handlers
- `/src/middleware.ts` - Session validation

### Backend
- OpenAPI spec: https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/openapi.json
- Health check: https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health
- 132 endpoints across 20 domains
- 76 data schemas

### Documentation
- This file: `~/nexad-live/CANONICAL-PROJECT-MAP.md`
- Operating rules: `~/nexad-live/CLAUDE.md`
- Backend analysis: `~/Desktop/BRAIN2/nexusai/BACKEND-API-CAPABILITIES.md`

---

END OF CANONICAL PROJECT MAP