# NexusAD Security Hardening Guide
**Version:** 2.0.0
**Classification:** CONFIDENTIAL — ENGINEERING / SECURITY
**Last Updated:** 2026-03-31

---

## Table of Contents

1. [Pre-Deployment Security Checklist](#pre-deployment-security-checklist)
2. [Security Architecture Summary](#security-architecture-summary)
3. [Security Scanning Procedures](#security-scanning-procedures)
4. [Penetration Testing Guide](#penetration-testing-guide)
5. [Compliance Verification](#compliance-verification)
6. [Certificate Management](#certificate-management)

---

## Pre-Deployment Security Checklist

Complete every item on this checklist before any production deployment. A deployment MUST NOT proceed if any P0 item is unresolved.

### P0 — MUST PASS (Deployment Blocker)

- [ ] `CSRF_HMAC_SECRET` is set, minimum 32 characters, cryptographically random
- [ ] `JWT_SECRET` is set, minimum 32 characters, cryptographically random
- [ ] `SESSION_SECRET` is set, minimum 32 characters, cryptographically random
- [ ] `STRICT_SECURITY_MODE=true` is set in Vercel environment
- [ ] `NODE_ENV=production` is confirmed in the Vercel build
- [ ] No secrets committed to git: `git log --all -p | grep -E "(SECRET|PASSWORD|TOKEN|KEY)" | grep "^+" | grep -v "process\.env"` returns empty
- [ ] `npx next build` completes with zero TypeScript errors
- [ ] Sentry DSN is configured and source maps are uploaded (not exposed publicly — `deleteSourcemapsAfterUpload: true`)
- [ ] Backend URL (`BACKEND_API_URL`) uses HTTPS, not HTTP
- [ ] All security headers verified (run scan at securityheaders.com post-deploy)

### P1 — SHOULD PASS (Must document exception if not)

- [ ] Upstash Redis is configured for distributed rate limiting
- [ ] Session idle timeout is 15 minutes (`SESSION_IDLE_TIMEOUT = 15 * 60`)
- [ ] Session absolute timeout is 24 hours (`SESSION_ABSOLUTE_TIMEOUT = 24 * 60 * 60`)
- [ ] CSRF token max age is 24 hours or less
- [ ] Request body size limit is 10MB or less (`MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024`)
- [ ] Google OAuth credentials are production credentials (not development)
- [ ] Backend RunPod pod is NOT publicly accessible (only reachable from Vercel IPs)
- [ ] PII scrubbing is active in Sentry (`beforeSend` hook verified)
- [ ] Vercel regions include `dub1` (UAE data sovereignty requirement)
- [ ] `X-Frame-Options: DENY` header is present on all responses
- [ ] `Strict-Transport-Security` header includes `preload` directive

### P2 — BEST PRACTICE (Track as tech debt if skipped)

- [ ] HSTS preload submission is up to date (hstspreload.org)
- [ ] Vercel Firewall rules are configured for geographic restrictions if required
- [ ] Source code has passed ESLint with no security-related warnings
- [ ] npm audit shows zero critical vulnerabilities: `npm audit --audit-level=critical`
- [ ] All npm package overrides in `package.json` are reviewed: `brace-expansion`, `minimatch`
- [ ] Sentry alert rules are configured for security-level log entries
- [ ] Rate limit thresholds are reviewed and appropriate for production load

---

## Security Architecture Summary

NexusAD implements 9 distinct security layers. Understanding all of them is required before making any security-relevant code changes.

### Layer 1 — Network Transport (TLS)
All traffic is HTTPS. The middleware enforces HSTS with a 1-year max-age and `includeSubDomains; preload`. HTTP requests are automatically upgraded by Vercel's edge network.

### Layer 2 — Security Headers
Every response includes the following headers (configured in both `next.config.ts` and `middleware.ts`):

| Header | Value | Protection |
|--------|-------|------------|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Reflected XSS (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | camera/mic/geo/payment/usb disabled | Feature abuse |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Protocol downgrade |
| `Cross-Origin-Opener-Policy` | `same-origin` | Spectre-class attacks |
| `Cross-Origin-Embedder-Policy` | `credentialless` | Cross-origin isolation |
| `Content-Security-Policy` | Nonce-based (middleware) + static fallback | XSS / injection |

### Layer 3 — CSRF Protection (SEC-027)
Double-submit pattern using HMAC-SHA256. Every mutating request (`POST`, `PUT`, `DELETE`, `PATCH`) must include a valid CSRF token. The token is signed with `CSRF_HMAC_SECRET` using the Web Crypto API (Edge Runtime compatible). The token expires after 24 hours.

**Token rotation:** The middleware supports a `CSRF_HMAC_PREVIOUS_SECRET` for zero-downtime secret rotation.

### Layer 4 — Session Management (SEC-026, SEC-028)
Sessions use httpOnly cookies named `nexus-session`. The middleware enforces:
- Idle timeout: 15 minutes of inactivity
- Absolute timeout: 24 hours maximum session length
- Both timeouts are tracked via Redis for accuracy across serverless instances
- In `STRICT_SECURITY_MODE=true`, session expiry results in hard block (not soft warning)

### Layer 5 — Rate Limiting (SEC-022)
Two layers of rate limiting:

**Server-side (Redis-backed):**
- Auth endpoints: 10/min per IP
- Chat endpoints: 20/min per user
- All API routes: configurable per route

**Client-side (token bucket, in-memory):**
- Defined in `src/lib/rate-limiter.ts`
- Prevents runaway client-side loops even if server-side limit is not hit

| Group | Limit (req/min) |
|-------|----------------|
| chat | 10 |
| voice | 6 |
| auth | 5 |
| vault | 20 |
| billing | 5 |
| sovereignty | 15 |
| butler | 15 |
| conversations | 30 |
| search | 10 |
| default | 30 |

### Layer 6 — Anomaly Detection (SEC-030)
The middleware analyzes request patterns and blocks anomalous behavior:
- Unusually high request velocity from a single IP
- Requests with suspicious User-Agent strings
- Repeated authentication failures (exponential backoff lockout — SEC-006)

Account lockout policy: after N consecutive failed auth attempts, the account is locked for an exponentially increasing duration.

### Layer 7 — PII Protection (SEC-105, SEC-112)
All structured logs are sanitized before writing. The following patterns are automatically redacted:

```
Emirates ID:   784-XXXX-XXXXXXX-X
Email:         user@domain.com
UAE mobile:    +971 5X XXX XXXX
UAE landline:  +971 X XXX XXXX
Credit card:   XXXX XXXX XXXX XXXX
UAE IBAN:      AE XX XXX XXXX XXXX XXXX XXXX
Generic IBAN:  Any IBAN format
```

Log sanitization has a maximum recursion depth of 5 and handles circular references to prevent stack overflow (SEC-114).

### Layer 8 — Request Validation (SEC-032)
- Maximum request body size: 10 MB
- File type validation enforced before upload
- Response sanitization against prototype pollution and null bytes

### Layer 9 — Proxy Security (SSRF Protection)
The Next.js proxy (`/api/proxy/[...path]`) implements:
- DNS pinning to prevent SSRF via DNS rebinding
- Host allowlist — only the configured `BACKEND_API_URL` host is permitted
- Response sanitization before forwarding to the browser

---

## Security Scanning Procedures

### Automated Scans (Run on Every PR)

**1. Dependency audit:**
```bash
npm audit --audit-level=moderate
# All critical and high vulnerabilities must be resolved before merge
```

**2. ESLint security rules:**
```bash
npm run lint
# Configured in eslint.config.mjs — includes security-focused rules
```

**3. TypeScript strict mode:**
```bash
npx tsc --noEmit
# Zero type errors required
```

**4. Secret scanning (pre-commit hook — set up with git hooks):**
```bash
# Install gitleaks for secret detection
brew install gitleaks

# Scan the repository
gitleaks detect --source . --verbose

# Configure in .gitleaks.toml:
# Detect: API keys, passwords, tokens, secrets
# Allowlist: process.env references (these are valid)
```

### Weekly Security Scans

**5. OWASP Dependency Check:**
```bash
# Install: https://owasp.org/www-project-dependency-check/
dependency-check --project nexusad \
  --scan ./node_modules \
  --format HTML \
  --out ./security-reports/dependency-check-$(date +%Y%m%d).html

# Review for CVEs with CVSS score >= 7.0
```

**6. HTTP Security Headers Scan:**
```bash
# Using securityheaders.com API or local scanner
curl -s "https://securityheaders.com/?q=nexusad.ai&followRedirects=on" \
  | grep -i "grade"
# Target: Grade A or above
```

**7. TLS/SSL Configuration Scan:**
```bash
# Using ssllabs-scan
ssllabs-scan nexusad.ai --grade
# Target: Grade A+

# Or using testssl.sh
testssl.sh --severity HIGH nexusad.ai
```

### Monthly Security Scans

**8. DAST (Dynamic Application Security Testing):**
```bash
# Using OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://nexusad.ai \
  -r zap-report-$(date +%Y%m).html

# Review all Medium and above findings
```

**9. Container image scan (for RunPod backend):**
```bash
# Using Trivy
trivy image sovereign-ai:latest \
  --severity HIGH,CRITICAL \
  --exit-code 1  # Fail CI if critical vulns found
```

**10. Infrastructure scan:**
```bash
# Verify Vercel security configuration
vercel inspect nexusad.ai --json | jq '.security'

# Verify no ports are exposed on RunPod except 9000
curl -v telnet://4ljj3bdk1x0vhv-9000.proxy.runpod.net:22
# Should be refused
```

---

## Penetration Testing Guide

### Scope

**In scope:**
- `https://nexusad.ai` and all subdomains
- `https://4ljj3bdk1x0vhv-9000.proxy.runpod.net` (requires written authorization from Antony Bousader)
- Authentication flows (login, OAuth, session management)
- All API endpoints accessible via the proxy
- File upload functionality
- SSE streaming endpoints

**Out of scope:**
- Vercel infrastructure (not owned by NexusAD)
- RunPod infrastructure (not owned by NexusAD)
- Third-party AI providers (OpenAI, Anthropic, etc.)
- Other users' data (test with dedicated test accounts only)

### Test Accounts

Before penetration testing, provision dedicated test accounts:
```
Test User 1: pentest-user-1@test.nexusad.ai
Test User 2: pentest-user-2@test.nexusad.ai
Test Admin:  pentest-admin@test.nexusad.ai
```

**Never test with real user accounts or real data.**

### Required Test Cases

#### Authentication Tests (OWASP A07:2021)
```
A01: Test for account enumeration via login response differences
     - Valid user, wrong password vs. nonexistent user
     - Expected: identical response time and message for both

A02: Test for brute-force protection
     - Attempt 10+ failed logins within 1 minute
     - Expected: account lockout with exponential backoff

A03: Test session fixation
     - Obtain a session token pre-login
     - Log in and verify session token rotates
     - Expected: new session token issued on authentication

A04: Test session invalidation on logout
     - Log in, copy session cookie, log out, replay the cookie
     - Expected: 401 Unauthorized

A05: Test CSRF protection
     - Send a POST request without the CSRF token header
     - Expected: 403 Forbidden

A06: Test CSRF token reuse
     - Use a CSRF token twice
     - Expected: second use is rejected (or same token valid within TTL)
```

#### Injection Tests (OWASP A03:2021)
```
B01: SQL Injection — test all user input fields
     Payloads: ' OR '1'='1, 1; DROP TABLE users, 1' UNION SELECT...
     Expected: no database errors, no data exposure

B02: NoSQL Injection
     Payloads: {"$gt": ""}, {"$where": "1==1"}
     Expected: 400 Bad Request, no data exposure

B03: Command Injection — test file upload endpoints
     Payloads: ; ls -la, && cat /etc/passwd, `id`
     Expected: 400 Bad Request, no command execution

B04: Server-Side Template Injection
     Payloads: {{7*7}}, ${7*7}, <%= 7*7 %>
     Expected: literal string output, not evaluated expression

B05: SSRF — test the backend proxy
     Attempt to route requests to internal IPs via the proxy
     Expected: SSRF protection blocks private IP ranges
```

#### Authorization Tests (OWASP A01:2021)
```
C01: Insecure Direct Object Reference (IDOR)
     - Access /api/v1/vault/document/{other-user-id}
     - Expected: 403 Forbidden

C02: Privilege escalation
     - Attempt to call admin endpoints with a regular user token
     - Expected: 403 Forbidden

C03: Horizontal privilege escalation
     - User A attempts to read User B's butler feed
     - Expected: 403 Forbidden

C04: JWT tampering
     - Modify the JWT payload (change userId, role, etc.)
     - Attempt to use the tampered token
     - Expected: 401 Unauthorized
```

#### Business Logic Tests
```
D01: Rate limit bypass
     - Distribute requests across multiple IP addresses
     - Use rotating User-Agent strings
     - Expected: rate limiting still applies per user (not just per IP)

D02: File upload bypass
     - Upload a PHP file renamed as .pdf
     - Upload a file with magic bytes mismatch
     - Expected: file type validation rejects it

D03: Large payload DoS
     - Send a 50MB request body
     - Expected: 413 Payload Too Large (limit is 10MB)

D04: PII leakage in responses
     - Include PII in a chat message (UAE ID, email, credit card)
     - Check if the PII appears in the response body, headers, or logs
     - Expected: PII is scrubbed from all outputs
```

### Reporting Requirements

All penetration test findings must be reported within 5 business days using this severity classification:

| Severity | CVSS Score | Response Time |
|----------|------------|---------------|
| Critical | 9.0–10.0 | Patch within 24 hours |
| High | 7.0–8.9 | Patch within 7 days |
| Medium | 4.0–6.9 | Patch within 30 days |
| Low | 0.1–3.9 | Patch within 90 days |
| Informational | N/A | Track in backlog |

---

## Compliance Verification

### UAE TDRA (Telecommunications and Digital Government Regulatory Authority)

NexusAD stores and processes UAE resident data. The following requirements apply:

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| Data residency | `dub1` Vercel region + UAE-located RunPod pod | `vercel.json` regions array includes `dub1` |
| Encryption at rest | AES-256-GCM vault encryption | Verified via `/api/v1/vault/info` |
| Encryption in transit | TLS 1.2+ enforced | `ssllabs-scan nexusad.ai` shows A+ |
| Access logging | Audit trail at `/api/v1/vault/access-log` | Log entries present for all data access |
| Data deletion | Vault deletion with Merkle proof | `POST /api/v1/vault/prove-delete` works |
| Incident reporting | 72-hour notification requirement | Documented in incident response procedure |

### GDPR (European Users)

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| Data minimization | Only necessary fields collected | Code review of auth flows |
| Right to erasure | `DELETE /api/v1/vault/document/{id}` with proof | Verified in QA |
| Data portability | `POST /api/v1/compliance/export-compliance-data` | Test export works |
| Consent management | Explicit consent at registration | UI review |
| Breach notification | 72-hour notification procedure | Documented in DR plan |
| Privacy by design | PII scrubbing, encryption-first architecture | Code review |

### SOC 2 Type II Readiness

For enterprise customers requiring SOC 2 compliance:

**Trust Service Criteria mapping:**

| Criteria | Control | Evidence |
|----------|---------|---------|
| CC6.1 — Logical access controls | CSRF, session mgmt, RBAC | middleware.ts SEC controls |
| CC6.2 — Authentication | MFA via Google OAuth, session timeouts | Auth flow code |
| CC6.3 — Authorization | RBAC via `src/lib/rbac.ts` | Role definitions |
| CC7.1 — System monitoring | Sentry + structured logging | sentry.*.config.ts |
| CC7.2 — Security incidents | Incident response procedure | This document |
| CC8.1 — Change management | Git-based deployment, build verification | deploy.sh + CLAUDE.md |
| A1.1 — Availability | Vercel 99.99% SLA, circuit breakers | resilience.ts |

---

## Certificate Management

### TLS Certificates (Frontend)

Vercel automatically provisions and renews TLS certificates via Let's Encrypt. No manual action is required.

**Verification:**
```bash
# Check current certificate details
openssl s_client -connect nexusad.ai:443 -servername nexusad.ai \
  </dev/null 2>/dev/null | openssl x509 -noout -dates

# Expected:
# notBefore: [recent date]
# notAfter: [90 days from now — Let's Encrypt default]
```

**If certificate renewal fails (extremely rare with Vercel):**
1. Check Vercel dashboard → Settings → Domains
2. If "Certificate pending" shows for > 24 hours, contact Vercel support
3. As emergency fallback, provision a certificate via Cloudflare in front of Vercel

### RunPod Backend TLS

The RunPod proxy (`proxy.runpod.net`) provides TLS termination automatically. The backend does not need to manage certificates.

**Verification:**
```bash
openssl s_client -connect 4ljj3bdk1x0vhv-9000.proxy.runpod.net:443 \
  </dev/null 2>/dev/null | openssl x509 -noout -dates
```

### Application-Level Secret Rotation

Rotate these secrets quarterly (every 90 days) and immediately after any suspected compromise:

| Secret | Name | Rotation Procedure |
|--------|------|-------------------|
| CSRF HMAC secret | `CSRF_HMAC_SECRET` | 1. Generate new 48-char random secret. 2. Set old secret as `CSRF_HMAC_PREVIOUS_SECRET`. 3. Update `CSRF_HMAC_SECRET`. 4. Deploy. 5. Remove `CSRF_HMAC_PREVIOUS_SECRET` after 24 hours. |
| JWT signing secret | `JWT_SECRET` | 1. Generate new 48-char random secret. 2. Update in Vercel AND RunPod. 3. Deploy both. 4. All existing sessions are invalidated — users must log in again. |
| Session secret | `SESSION_SECRET` | Same as JWT_SECRET procedure. |
| Google OAuth credentials | `GOOGLE_CLIENT_ID/SECRET` | Rotate in Google Cloud Console. Update Vercel env vars. No user impact. |
| Upstash token | `UPSTASH_REDIS_REST_TOKEN` | Rotate in Upstash console. Update Vercel env vars. Deploy. |

**Secret generation command:**
```bash
# Generate a cryptographically secure 48-character secret
openssl rand -base64 48 | tr -d '='
```

**Secret rotation log:** Every secret rotation must be recorded with:
- Date and time of rotation
- Which secret was rotated
- Reason (scheduled / suspected compromise / post-incident)
- Who performed the rotation

Maintain this log at: `/Users/antonybousader/Desktop/BRAIN/security/SECRET-ROTATION-LOG.md`

---

*Previous: [02-DISASTER-RECOVERY-PLAN.md](./02-DISASTER-RECOVERY-PLAN.md)*
*Next: [04-PERFORMANCE-TUNING-GUIDE.md](./04-PERFORMANCE-TUNING-GUIDE.md)*
