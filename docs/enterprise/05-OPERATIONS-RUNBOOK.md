# NexusAD Operations Runbook
**Version:** 2.0.0
**Classification:** INTERNAL — ENGINEERING / OPERATIONS
**Last Updated:** 2026-03-31

---

## Table of Contents

1. [On-Call Responsibilities](#on-call-responsibilities)
2. [Daily Checks](#daily-checks)
3. [Weekly Maintenance](#weekly-maintenance)
4. [Monthly Audits](#monthly-audits)
5. [Incident Response Procedures](#incident-response-procedures)
6. [Escalation Matrix](#escalation-matrix)

---

## On-Call Responsibilities

On-call engineers are responsible for maintaining NexusAD service availability during their rotation. The on-call shift is 7 days, rotating weekly.

**On-call expectations:**
- Acknowledge PagerDuty/alert within 15 minutes
- Assess severity and begin triage within 30 minutes
- Resolve P0 incidents within 1 hour or escalate
- Post incident summary within 24 hours of resolution
- Handoff any open issues to the next on-call at shift end

**Before your on-call shift starts:**
- Ensure you have access to Vercel dashboard
- Ensure you have RunPod CLI (`runpodctl`) installed and authenticated
- Ensure you have the Upstash console login
- Ensure you have the Sentry dashboard access
- Review any open incidents or known issues from the previous shift

---

## Daily Checks

Perform these checks every morning before starting other work. They take approximately 15 minutes.

### 1. Service Status Check (5 min)

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== NexusAD Daily Health Check ==="
echo "Date: $(date -u)"

# Frontend health
echo ""
echo "--- Frontend (nexusad.ai) ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://nexusad.ai)
echo "Status: $STATUS (expected: 200)"

# API proxy health
echo ""
echo "--- API Proxy ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://nexusad.ai/api/health 2>/dev/null || echo "N/A")
echo "Status: $STATUS"

# Backend health
echo ""
echo "--- Backend (RunPod) ---"
HEALTH=$(curl -s https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health)
echo "Response: $HEALTH"

# Latency check
echo ""
echo "--- Latency (TTFB) ---"
TTFB=$(curl -s -o /dev/null -w "%{time_starttransfer}" https://nexusad.ai)
echo "Frontend TTFB: ${TTFB}s (target: < 0.5s)"

echo ""
echo "=== Check Complete ==="
```

Pass/fail criteria:
- Frontend HTTP 200: PASS
- Backend health 200: PASS
- TTFB < 0.5s: PASS
- Any non-200 or TTFB > 1s: INVESTIGATE

### 2. Error Rate Check (3 min)

Open Sentry → NexusAD project → Issues:
- [ ] Zero new Critical or High severity issues since yesterday
- [ ] Error rate is within 2x of the 7-day average
- [ ] No new authentication-related errors (SEC-XXX codes)

If new Critical issues exist: triage immediately. Do not defer.

### 3. Deployment Status (2 min)

```bash
# Verify the latest deployment is healthy
npx vercel ls --prod | head -5

# Confirm nexusad.ai is pointing to the latest deployment
npx vercel inspect nexusad.ai | grep "Current"
```

Expected: The latest deployment shows "Ready" status and nexusad.ai points to it.

### 4. Upstash Redis Check (2 min)

Open Upstash console → Dashboard:
- [ ] Database is "Active" (green status)
- [ ] Memory usage < 80% of limit
- [ ] No error spikes in the last 24 hours

### 5. Backup Verification (3 min)

```bash
# Verify yesterday's vault backup was created
aws s3 ls s3://nexusad-backups/vault/ | tail -3

# The most recent backup should be < 26 hours old
# If the latest backup is older than 26 hours: INVESTIGATE
```

---

## Weekly Maintenance

Perform on the first working day of each week. Takes approximately 60 minutes.

### Week 1 — Security Review

**Duration:** 60 min

```bash
# 1. Run npm audit
cd ~/nexad-live
npm audit --audit-level=moderate

# Document any new vulnerabilities found
# Fix all Critical and High before end of week
# Log Moderate as tech debt for next sprint

# 2. Check security headers
curl -I https://nexusad.ai 2>/dev/null | grep -E "^(X-Frame|X-Content|Strict-Transport|Content-Security|Cross-Origin)"

# Verify these are ALL present:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# Content-Security-Policy: [nonce-based policy]
# Cross-Origin-Opener-Policy: same-origin
# Cross-Origin-Embedder-Policy: credentialless

# 3. Review security event logs (last 7 days)
# In your log aggregator, run:
# SELECT code, COUNT(*) FROM logs
# WHERE level = 'security' AND timestamp > NOW() - INTERVAL 7 DAY
# GROUP BY code ORDER BY count DESC;
# Flag any code appearing > 100 times — may indicate an attack pattern

# 4. Review failed authentication attempts
# SELECT ip, COUNT(*) as attempts
# FROM logs WHERE code = 'SEC-006' AND timestamp > NOW() - INTERVAL 7 DAY
# GROUP BY ip ORDER BY attempts DESC LIMIT 10;
# Any IP with > 20 failed attempts: add to Vercel Firewall blocklist
```

### Week 2 — Performance Review

**Duration:** 45 min

```bash
# 1. Pull Vercel Analytics for the past week
# Dashboard: vercel.com → nexad project → Analytics
# Record these metrics (for trend tracking):
# - p50 and p99 TTFB
# - FCP, LCP, INP, CLS (Core Web Vitals)
# - Total requests and bandwidth
# - Error rate by status code

# 2. Run load test against staging
# (Create a staging environment if not yet done)
k6 run --vus 25 --duration 120s performance/load-test.js
# Target: p99 < 500ms, zero errors

# 3. Check chat performance metrics in Sentry
# Filter by: transaction.name = "chat.stream"
# Record: p50, p75, p95 latency by mode (fast, standard, thinking, pro)

# 4. Review top slow API routes
# In Sentry → Performance → Transactions:
# Sort by p99 latency, note any route > 1s
```

### Week 3 — Dependency Updates

**Duration:** 90 min

```bash
# 1. Check for security updates
npm outdated

# 2. Update patch versions (safe — no behavior change)
npm update --save

# 3. Review minor/major version updates manually
# Pay attention to:
# - next (major framework — test thoroughly)
# - @sentry/nextjs (security monitoring — test carefully)
# - @upstash/ratelimit, @upstash/redis (critical for rate limiting)

# 4. After any update: full build and test
npm run build
# Fix any TypeScript errors before proceeding

# 5. Commit changes
git add package.json package-lock.json
git commit -m "chore: weekly dependency updates $(date +%Y-%m-%d)"

# 6. Deploy to verify no regressions
./deploy.sh
```

**DO NOT update the following without extensive testing:**
- `next` major version (currently 16.x) — requires full QA cycle
- `react` / `react-dom` — major version changes break APIs
- `typescript` major version — may introduce new breaking errors

### Week 4 — Capacity and Cost Review

**Duration:** 30 min

```
1. Vercel usage review:
   - Go to Vercel → Settings → Usage
   - Check: Function invocations, Bandwidth, Edge requests
   - Compare to previous month
   - Flag any > 20% increase for investigation

2. RunPod cost review:
   - Check RunPod billing dashboard
   - Cost per user = total RunPod cost / active users
   - Target: < $0.50/user/month

3. Upstash cost review:
   - Check Upstash dashboard → Billing
   - Review daily command count trend

4. AI provider cost review (via backend):
   GET /api/v1/compliance/cost-breakdown/{userId}
   - Review token usage by model
   - Identify most expensive use cases
   - Consider caching for repeated queries

5. Document findings in monthly report
```

---

## Monthly Audits

Performed on the last Friday of each month. Takes 3–4 hours.

### Audit 1 — Full Security Audit

```bash
# 1. Run OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://nexusad.ai \
  -r /tmp/zap-report-$(date +%Y%m).html
# Review all Medium and above findings

# 2. Run SSL/TLS scan
ssllabs-scan nexusad.ai --grade
# Expected: A+. If grade drops, investigate certificate or header changes.

# 3. Run dependency CVE check
dependency-check --project nexusad \
  --scan ./node_modules \
  --format HTML \
  --out ./security-reports/dc-$(date +%Y%m).html

# 4. Review access controls
# Check: are all API endpoints still properly protected?
# Test: unauthenticated request to /api/proxy/* should return 401
curl -s -o /dev/null -w "%{http_code}" https://nexusad.ai/api/proxy/vault/info
# Expected: 401 or 403

# 5. Verify PII scrubbing is working
# Send a test message with fake UAE ID through chat
# Check Sentry breadcrumbs: the UAE ID should show as [EMIRATES_ID]

# 6. Secret rotation check
# Review the secret rotation log: /Users/antonybousader/Desktop/BRAIN/security/SECRET-ROTATION-LOG.md
# Any secret older than 90 days: schedule rotation this month
```

### Audit 2 — Compliance Audit

```bash
# 1. Download compliance summary for all active users
# For each enterprise user:
curl -s "$BACKEND_URL/api/v1/compliance/summary/{userId}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool

# 2. Verify audit trail is complete (no gaps)
curl -s "$BACKEND_URL/api/v1/compliance/audit-trail/{userId}" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: continuous entries covering the full month

# 3. Check data retention compliance
curl -s "$BACKEND_URL/api/v1/compliance/retention-policies" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Verify retention policies are configured per customer agreements

# 4. Review data handling report
curl -s -X POST "$BACKEND_URL/api/v1/compliance/data-handling-report" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period": "last_30_days"}' | python3 -m json.tool

# 5. Verify vault deletion certificates are valid
# For any documents deleted this month, verify the Merkle proof:
curl -s "$BACKEND_URL/api/v1/vault/prove-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "<doc-id>"}'
```

### Audit 3 — DR Test

Refer to `02-DISASTER-RECOVERY-PLAN.md` for the DR test schedule and procedures. At minimum, perform one of the following tests each month:
- Frontend rollback drill
- Backend restore from backup

Document the test results and any improvements in `/Users/antonybousader/Desktop/BRAIN/security/DR-TEST-LOG.md`.

### Monthly Report Template

Produce a monthly report covering:

```markdown
# NexusAD Monthly Operations Report — [MONTH YEAR]

## Executive Summary
[2-3 sentence summary: uptime, key incidents, major improvements]

## Availability
- Uptime: XX.XX%
- Total downtime: X min
- Incidents: X (P0: X, P1: X, P2: X)

## Security
- Vulnerabilities found: X (Critical: 0, High: X, Medium: X)
- Security scans: PASS/FAIL
- Secret rotations: [list what was rotated]
- Pen test findings: [if pen test was run]

## Performance
- p50 TTFB: Xms (target: < 200ms)
- LCP: Xs (target: < 2.5s)
- Chat p50 latency: Xs
- No SLO breaches / [list SLO breaches]

## Compliance
- Audit trail: COMPLETE
- Data retention: COMPLIANT
- DR test: PASSED/FAILED

## Cost
- Vercel: $X (Δ X% from last month)
- RunPod: $X (Δ X%)
- Upstash: $X (Δ X%)
- Total: $X

## Next Month Priorities
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]
```

---

## Incident Response Procedures

### Incident Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|---------|
| P0 — Critical | Full service outage or data breach | 15 min | nexusad.ai down, backend unreachable, confirmed data breach |
| P1 — High | Significant feature degradation | 30 min | Chat failing > 5% of requests, auth broken, vault inaccessible |
| P2 — Medium | Minor degradation | 2 hours | Slow response, partial feature failure, elevated error rate |
| P3 — Low | Non-impacting issue | Next business day | Minor UI bug, low-priority error in logs |

### P0 Incident Response (First 30 Minutes)

```
0:00 — Alert received (PagerDuty / Sentry / user report)
      ACTION: Acknowledge the alert immediately

0:05 — Initial triage
      QUESTIONS:
      - Is the frontend down? (curl https://nexusad.ai)
      - Is the backend down? (curl https://.../health)
      - Is it affecting all users or some users?
      - What changed in the last 2 hours? (check Vercel deployments)

0:10 — Notify stakeholders
      - Post in #incidents Slack channel: "P0 INCIDENT OPEN — [description]"
      - If > 5 min old and not resolved, notify engineering lead

0:15 — Mitigation attempt
      ORDERED BY LIKELIHOOD:
      1. Was there a recent deployment? → Roll back immediately (< 2 min)
         npx vercel alias set <previous-url> nexusad.ai
      2. Is the backend down? → Restart RunPod pod
         runpodctl restart <pod-id>
      3. Is Redis down? → Service degrades gracefully, no action needed
      4. Is it a Vercel outage? → Check status.vercel.com, wait

0:30 — Status update
      - Post update in #incidents: "Status: [resolved/mitigated/investigating]"
      - If not resolved: escalate to next tier (see Escalation Matrix)
```

### P1 Incident Response

```
0:00 — Alert received
      ACTION: Acknowledge within 30 minutes

0:15 — Triage
      - Identify affected endpoints and user impact
      - Check Sentry for error details
      - Check recent deployments

0:30 — Mitigation or escalation
      - Apply known fix (rollback, restart, config change)
      - If no obvious fix: escalate to engineering lead

1:00 — Resolution or workaround
      - Either resolve the issue or implement a workaround
      - Communicate status to affected users via status page

4:00 — Root cause analysis
      - Write a brief RCA document
      - Document in incident log
```

### Post-Incident Process

Every P0 and P1 incident requires a post-mortem within 48 hours:

```markdown
# Incident Post-Mortem — [INCIDENT-ID]

## Summary
[1-2 sentences: what happened, how long, impact]

## Timeline
- [TIME]: [Event]
- [TIME]: [Event]
- [TIME]: Resolved

## Root Cause
[Clear explanation of what caused the incident]

## Contributing Factors
[What made it worse or harder to detect]

## Impact
- Users affected: X
- Duration: X minutes
- Data affected: None / [description]

## What Went Well
[Things the team did right during the incident]

## What Went Wrong
[Things that delayed detection or resolution]

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| [Fix root cause] | [Name] | [Date] |
| [Add monitoring] | [Name] | [Date] |
| [Update runbook] | [Name] | [Date] |
```

### Common Issues and Fixes

**Issue: "Service temporarily unavailable" on chat**
```bash
# 1. Check backend health
curl https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health

# 2. If backend is down, restart pod
runpodctl restart <pod-id>

# 3. If backend shows a specific AI provider failure:
# This is handled by the backend's smart routing — it will failover automatically
# No manual action needed; confirm by trying a chat request after 30 seconds
```

**Issue: "Session expired" errors for all users**
```bash
# This indicates either:
# A) Redis is down (rate limiting + session tracking affected)
# B) SESSION_SECRET was rotated without grace period
# C) A new deployment changed the session cookie name

# Check Redis status first:
curl -X POST "$UPSTASH_URL" \
  -H "Authorization: Bearer $UPSTASH_TOKEN" \
  -d '["PING"]'

# If Redis is down: sessions fall back to cookie-only validation
# Users may need to log in again — this is acceptable behavior

# If it's a deployment issue: check the git log for recent changes to middleware.ts
git log --oneline -10 -- src/middleware.ts
```

**Issue: Build fails on Vercel**
```bash
# Pull the error from Vercel logs
npx vercel logs --prod | tail -50

# Common causes:
# 1. TypeScript errors — run locally: npx tsc --noEmit
# 2. Missing environment variable — check Vercel dashboard
# 3. Node version mismatch — check package.json engines: >=20 <23

# Fix the error locally, then redeploy:
./deploy.sh
```

**Issue: CSRF token errors in production**
```bash
# Check if CSRF_HMAC_SECRET is set and > 32 chars
vercel env ls | grep CSRF

# If missing or too short:
# 1. Generate a new secret
openssl rand -base64 48 | tr -d '='
# 2. Set in Vercel
vercel env add CSRF_HMAC_SECRET
# 3. Redeploy
./deploy.sh
```

**Issue: High rate limit errors (429s)**
```bash
# Check which endpoints are being rate-limited
# In Sentry, filter by: transaction.status = "resource_exhausted"
# Or in log aggregator:
# SELECT ip, path, COUNT(*) FROM logs WHERE code = 'SEC-022' GROUP BY ip, path

# If legitimate users are being rate-limited (not an attack):
# Increase rate limits in src/middleware.ts (requires deployment)
# Consult Performance Tuning Guide for safe limits

# If it's an attack pattern:
# Add attacker IPs to Vercel Firewall blocklist
vercel firewall --add-rule "block ip X.X.X.X"
```

---

## Escalation Matrix

### Primary Contacts

| Role | Name | Contact | When to Escalate |
|------|------|---------|-----------------|
| Founder / CEO | Antony Bousader | Direct message | Vision decisions, confirmed data breach, P0 > 30 min unresolved, cost > $1,000 unexpected |
| On-Call Engineer | Rotation | PagerDuty | All P0 and P1 incidents |

### Third-Party Support Escalation

| Service | Support Contact | SLA | When to Contact |
|---------|-----------------|-----|----------------|
| Vercel | support.vercel.com / Enterprise support channel | 1 hour (Enterprise) | Vercel infrastructure issue, billing dispute, firewall needed |
| RunPod | support@runpod.io | Best effort | Pod hardware failure, network issue, persistent storage corruption |
| Upstash | support@upstash.com | Business hours | Redis data loss, replication failure, billing |
| Sentry | sentry.io/support | Business hours | Data loss, quota issues, integration problems |
| Google (OAuth) | Google Cloud Support | Business hours | OAuth credentials revoked, consent screen issues |

### Escalation Triggers

**Escalate to CEO immediately when:**
- Confirmed or suspected data breach (any user data exposed)
- Complete service outage lasting > 30 minutes with no fix in sight
- Unexpected infrastructure cost > $1,000 in a single day
- A security vulnerability is found that requires taking the service offline
- A decision would change the product direction or user experience

**Escalate to Vercel support when:**
- Vercel status.vercel.com shows active incident affecting nexusad.ai
- Deployment consistently fails with no obvious code error
- nexusad.ai domain or SSL certificate is having issues
- Billing anomaly on Vercel account

**Escalate to RunPod support when:**
- Backend pod is unreachable and restart does not fix it
- Persistent volume data appears corrupted
- Network connectivity to the pod is intermittently dropping
- Pod refuses to start with no clear log error

### Communication Templates

**Internal status page update (post in #status Slack channel):**
```
[P0 OPEN] nexusad.ai is experiencing [issue].
Impact: [what users see]
Started: [UTC time]
Team: [who is investigating]
ETA: [estimated resolution time or "investigating"]
```

**User-facing status message (post on status page):**
```
We are currently experiencing [issue] affecting [feature/service].
Our team is actively working on a resolution.
Expected resolution: [time] or "We will update within 30 minutes."
We apologize for the inconvenience.
```

**Resolution notification:**
```
[RESOLVED] The earlier issue with [service] has been resolved.
Duration: [start] to [end] ([X] minutes)
Impact: [users affected]
Root cause: [brief explanation]
We apologize for the disruption and are working to prevent recurrence.
```

---

## Quick Reference

### Deployment Commands
```bash
# Standard production deploy
cd ~/nexad-live && ./deploy.sh

# Emergency rollback to previous deployment
npx vercel alias set <previous-url> nexusad.ai

# List recent deployments
npx vercel ls --prod
```

### Health Check Commands
```bash
# Frontend
curl -I https://nexusad.ai

# Backend
curl https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health

# Redis (Upstash)
curl -X POST "$UPSTASH_REDIS_REST_URL" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -d '["PING"]'
```

### Key URLs
| Resource | URL |
|----------|-----|
| Production site | https://nexusad.ai |
| Vercel dashboard | https://vercel.com/abousader-6045s-projects/nexad |
| Vercel status | https://status.vercel.com |
| Backend health | https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health |
| Backend API docs | https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/openapi.json |
| Sentry | https://sentry.io → NexusAD project |
| Upstash | https://console.upstash.com |
| RunPod | https://www.runpod.io/console/pods |

---

*Previous: [04-PERFORMANCE-TUNING-GUIDE.md](./04-PERFORMANCE-TUNING-GUIDE.md)*
*Enterprise Documentation Index: [00-INDEX.md](./00-INDEX.md)*
