# NexusAD Disaster Recovery Plan
**Version:** 2.0.0
**Classification:** INTERNAL — ENGINEERING / OPERATIONS
**Last Updated:** 2026-03-31

---

## Table of Contents

1. [Recovery Objectives](#recovery-objectives)
2. [Backup Procedures](#backup-procedures)
3. [Failover Procedures](#failover-procedures)
4. [Data Restoration Steps](#data-restoration-steps)
5. [Scenario Playbooks](#scenario-playbooks)
6. [DR Test Schedule](#dr-test-schedule)

---

## Recovery Objectives

These are the binding SLA commitments for NexusAD Enterprise deployments.

| Tier | Component | RTO | RPO | Priority |
|------|-----------|-----|-----|----------|
| P0 — Critical | Authentication service | 15 min | 0 (stateless) | Highest |
| P0 — Critical | Chat / AI routing | 15 min | N/A (stateless) | Highest |
| P1 — High | User vault (encrypted data) | 1 hour | 1 hour | High |
| P1 — High | Session store (Redis) | 30 min | 15 min | High |
| P2 — Medium | Butler feed / notifications | 4 hours | 4 hours | Medium |
| P2 — Medium | Billing records | 2 hours | 30 min | Medium |
| P3 — Low | Audit logs | 8 hours | 24 hours | Low |
| P3 — Low | Analytics / Sentry | 24 hours | 24 hours | Low |

**Definitions:**
- **RTO (Recovery Time Objective):** The maximum time the system can be down before recovery must be complete.
- **RPO (Recovery Point Objective):** The maximum amount of data loss acceptable, measured in time.

---

## Backup Procedures

### Frontend — Vercel

The frontend has **no persistent state**. Every deployment is immutable and permanently stored on Vercel. No additional backup is needed.

All previous deployments are accessible via:
```bash
npx vercel ls --prod
```

Vercel retains deployment history indefinitely on Pro/Enterprise plans.

### Backend — Vault Data (Critical — P1)

The backend stores encrypted vault documents on the RunPod persistent volume at `/workspace/vault/`.

**Automated daily backup procedure:**

```bash
#!/bin/bash
# vault-backup.sh — run daily via cron at 02:00 UTC
# Schedule: 0 2 * * * /workspace/scripts/vault-backup.sh

set -euo pipefail

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/workspace/backups/vault"
VAULT_DIR="/workspace/vault"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Create compressed, encrypted backup
tar -czf "$BACKUP_DIR/vault-$DATE.tar.gz" "$VAULT_DIR"

# Upload to S3-compatible storage (use AWS S3, Cloudflare R2, or Backblaze B2)
aws s3 cp "$BACKUP_DIR/vault-$DATE.tar.gz" \
  "s3://nexusad-backups/vault/vault-$DATE.tar.gz" \
  --sse AES256

# Verify upload succeeded
aws s3 ls "s3://nexusad-backups/vault/vault-$DATE.tar.gz"

echo "Backup completed: vault-$DATE.tar.gz"

# Clean up local backups older than 7 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

# Clean up remote backups older than 30 days
aws s3 ls "s3://nexusad-backups/vault/" | \
  awk '{print $4}' | \
  while read file; do
    file_date=$(echo "$file" | grep -oP '\d{8}')
    if [[ $(date -d "$file_date" +%s) -lt $(date -d "-${RETENTION_DAYS} days" +%s) ]]; then
      aws s3 rm "s3://nexusad-backups/vault/$file"
    fi
  done
```

**Backup verification (run after every backup):**
```bash
# Verify backup integrity
tar -tzf "$BACKUP_DIR/vault-$DATE.tar.gz" > /dev/null && echo "INTEGRITY: OK" || echo "INTEGRITY: FAILED"

# Verify upload to S3
aws s3api head-object \
  --bucket nexusad-backups \
  --key "vault/vault-$DATE.tar.gz" \
  --query 'ContentLength'
```

### Redis — Session Store (P1)

Upstash Redis provides automatic persistence and point-in-time recovery in the Production tier.

**Upstash backup configuration:**
```
Persistence mode: AOF (Append-Only File) — every write is persisted
Backup frequency: Every 1 hour (Upstash managed)
Backup retention: 7 days
Cross-region replication: Enabled (primary + 2 replicas)
```

**Manual Redis export (for additional safety before major deployments):**
```bash
# Export current Redis state
redis-cli -u "$UPSTASH_REDIS_REST_URL" --no-auth-warning BGSAVE

# Download the dump file from Upstash dashboard or API
curl -X POST "$UPSTASH_REDIS_REST_URL/export" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -o "redis-backup-$(date +%Y%m%d).rdb"
```

### Database — Structured Records (P2)

The backend uses a structured database for billing records, user profiles, and audit logs. Apply the following backup policy:

```
Backup type:       Full daily + incremental hourly
Full backup time:  03:00 UTC daily
Retention:         30 days (daily), 7 days (hourly)
Storage:           S3-compatible with AES-256 encryption
Backup testing:    Monthly restore drill (see DR Test Schedule)
```

**Backup monitoring — alert if backup does not complete within 30 minutes:**
```
Alert: backup-failure
Condition: no S3 object created with today's date by 02:45 UTC
Action: page on-call engineer
```

---

## Failover Procedures

### Scenario 1 — Frontend Vercel Outage

**Detection:** Vercel status page (status.vercel.com) shows incident, or synthetic monitoring returns non-200 for > 3 checks.

**Steps:**
1. Check https://www.vercel-status.com — identify affected region(s)
2. If single-region outage: Vercel automatically routes to other regions. No action needed.
3. If full Vercel outage (rare — < 0.01% annual probability):
   a. Build and deploy to a secondary platform (Netlify, AWS Amplify, or Cloudflare Pages)
   b. Update DNS to point `nexusad.ai` to the secondary platform
   c. DNS TTL is 60 seconds — full propagation in ~5 minutes globally

**Secondary deployment (pre-build and keep ready):**
```bash
# Build for static export (fallback mode — no SSR)
npm run build
# Deploy to Cloudflare Pages as fallback
npx wrangler pages publish .next/static --project-name nexusad-fallback
```

### Scenario 2 — RunPod Backend Outage

**Detection:** `/health` endpoint returns non-200 for 3 consecutive checks (45 seconds), or Sentry shows spike in 5xx errors from proxy.

**Steps:**

**Immediate (0–5 minutes):**
1. SSH into RunPod pod: `runpodctl ssh <pod-id>`
2. Check process status: `ps aux | grep python` or `ps aux | grep uvicorn`
3. Check logs: `tail -n 100 /workspace/logs/app.log`
4. Attempt restart: `supervisorctl restart nexusad-backend` or `systemctl restart nexusad`

**If restart fails (5–15 minutes):**
1. Create a new RunPod pod from the last known-good image
2. Attach the existing persistent volume (vault data is preserved)
3. Wait for health check to pass
4. Update `BACKEND_API_URL` in Vercel environment variables if the RunPod URL changed
5. Trigger a Vercel redeployment: `npx vercel --prod`

**If persistent volume is corrupted (15–60 minutes):**
1. Create a new RunPod pod with a fresh volume
2. Restore vault data from the most recent S3 backup (see Data Restoration Steps)
3. Verify data integrity using the Merkle proof system
4. Update Vercel environment variables
5. Redeploy frontend

### Scenario 3 — Redis Outage

**Detection:** Structured log shows `[WARN][SEC-023] Redis circuit breaker open` or rate-limit errors spike.

**Impact:** Rate limiting falls back to in-memory (per-instance). Session timeouts may not be enforced across instances. Service remains operational.

**Steps:**
1. Check Upstash status at https://status.upstash.com
2. If Upstash is down: service continues with degraded rate limiting. No immediate action needed.
3. If Upstash does not recover within 2 hours:
   a. Provision a new Upstash Redis instance
   b. Update `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel
   c. Redeploy: `npx vercel --prod`
   d. Note: All active sessions will be invalidated. Users must log in again.

### Scenario 4 — Total Region Failure

**Definition:** Both Vercel and RunPod in a region are unavailable.

**Steps:**
1. Vercel automatically shifts traffic to remaining healthy regions (iad1, dub1, sin1 are all independent)
2. For RunPod: provision a replacement pod in a different RunPod data center
3. Restore vault data from S3 backup
4. Update `BACKEND_API_URL` in Vercel environment variables
5. Expected recovery time: 1–2 hours

### Communication During Outage

**Internal escalation:**
```
0–5 min:    On-call engineer investigates
5–15 min:   Engineering lead notified
15–30 min:  CEO / Founder notified
30+ min:    Customer communication initiated
```

**Customer status page message template:**
```
We are aware of an issue affecting [service]. Our engineering team is
actively investigating. We will provide an update within 30 minutes.
Estimated restoration: [time].
Incident started: [UTC time].
```

---

## Data Restoration Steps

### Restoring Vault Data from S3 Backup

```bash
#!/bin/bash
# restore-vault.sh

set -euo pipefail

BACKUP_DATE=${1:-"latest"}   # Pass a specific date or "latest"
RESTORE_DIR="/workspace/vault_restore"
VAULT_DIR="/workspace/vault"

# Find the backup to restore
if [ "$BACKUP_DATE" = "latest" ]; then
  BACKUP_FILE=$(aws s3 ls "s3://nexusad-backups/vault/" \
    | sort | tail -1 | awk '{print $4}')
else
  BACKUP_FILE="vault-${BACKUP_DATE}.tar.gz"
fi

echo "Restoring from: $BACKUP_FILE"

# Download backup
mkdir -p "$RESTORE_DIR"
aws s3 cp "s3://nexusad-backups/vault/$BACKUP_FILE" "$RESTORE_DIR/"

# Verify integrity
tar -tzf "$RESTORE_DIR/$BACKUP_FILE" > /dev/null
echo "Backup integrity: OK"

# Stop backend service before restoration
supervisorctl stop nexusad-backend

# Create a snapshot of current vault before overwriting
if [ -d "$VAULT_DIR" ]; then
  tar -czf "/workspace/backups/pre-restore-snapshot-$(date +%Y%m%d-%H%M%S).tar.gz" "$VAULT_DIR"
fi

# Extract backup to vault directory
tar -xzf "$RESTORE_DIR/$BACKUP_FILE" -C /workspace/

echo "Vault restored successfully from $BACKUP_FILE"

# Restart backend
supervisorctl start nexusad-backend

# Wait for health check
sleep 10
curl -f https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health && \
  echo "Backend is healthy" || echo "WARNING: Health check failed"

# Verify vault data integrity via Merkle proofs
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1/vault/shards" \
  | python3 -m json.tool
```

### Restoring User Sessions from Redis Backup

```bash
# If Upstash has point-in-time recovery enabled:
# 1. Go to Upstash console → Your database → Backups
# 2. Select the restore point (up to RPO of 15 minutes)
# 3. Click "Restore" — Upstash handles the restoration

# For manual restoration from an exported RDB file:
redis-cli -u "$NEW_UPSTASH_URL" --no-auth-warning \
  --pipe < redis-backup-YYYYMMDD.rdb
```

### Verifying Data Integrity Post-Restoration

After restoring any data, run these verification steps:

```bash
# 1. Check vault shard distribution
curl -s "$BACKEND_URL/api/v1/vault/shards" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Verify a known document still exists (use a test document ID)
curl -s "$BACKEND_URL/api/v1/vault/document/$TEST_DOC_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Check audit log for gaps (should show continuous entries)
curl -s "$BACKEND_URL/api/v1/compliance/audit-trail/$TEST_USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Test sovereignty score (should return valid score)
curl -s "$BACKEND_URL/api/v1/sovereignty/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Run end-to-end chat test
curl -s -X POST "$BACKEND_URL/api/v1/chat" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "mode": "standard"}' | head -c 100
```

---

## Scenario Playbooks

### Playbook: Compromised API Key

**Trigger:** Security alert or suspicious API usage detected.

```
1. IMMEDIATELY revoke the compromised key:
   POST /api/v1/security/rotate-keys (if available)
   OR: Revoke from the RunPod environment variables

2. Invalidate all active sessions:
   redis-cli FLUSHDB  (WARNING: logs out ALL users)
   OR selectively delete affected user sessions:
   redis-cli KEYS "session:*" | xargs redis-cli DEL

3. Review security audit log:
   GET /api/v1/security/audit-log/{userId}

4. Generate new secrets:
   openssl rand -base64 48  (for CSRF_HMAC_SECRET, JWT_SECRET, SESSION_SECRET)

5. Update Vercel environment variables

6. Redeploy frontend: npx vercel --prod

7. Document the incident in the security log
```

### Playbook: DDoS Attack

**Trigger:** Request volume > 10x baseline, or Vercel rate-limit warnings.

```
1. Vercel's DDoS protection activates automatically for volumetric attacks

2. If attack is targeting specific endpoints:
   - Tighten rate limits in middleware.ts (session-specific limits)
   - Enable STRICT_SECURITY_MODE=true if not already set

3. If attack bypasses Vercel:
   - Enable Vercel Firewall (Enterprise feature)
   - Add IP block rules for attacking subnets
   - Consider enabling Cloudflare as an additional layer in front of Vercel

4. If backend is targeted directly:
   - Verify backend is NOT publicly accessible (should only accept Vercel IPs)
   - If exposed, add IP allowlist in RunPod network settings

5. After attack subsides:
   - Review access logs for patterns
   - Update rate limit configs if needed
   - Document attack vectors
```

### Playbook: Data Breach Suspicion

```
1. IMMEDIATELY notify CEO/Founder

2. Isolate affected systems:
   - Take backend offline temporarily if breach is confirmed
   - Revoke all active sessions

3. Assess scope using audit trail:
   GET /api/v1/compliance/audit-trail/{userId}

4. Preserve evidence:
   - Download all audit logs before any remediation
   - Take snapshots of all systems as-is

5. Engage incident response:
   - Legal team notified within 1 hour
   - UAE TDRA notification within 72 hours (if UAE user data is affected)
   - GDPR notification within 72 hours (if EU user data is affected)

6. Remediate:
   - Patch the vulnerability
   - Rotate all secrets
   - Force password reset for affected users

7. Post-incident report within 7 days
```

---

## DR Test Schedule

| Test | Frequency | Owner | Last Tested | Next Due |
|------|-----------|-------|-------------|----------|
| Frontend rollback drill | Monthly | Engineering | — | 2026-04-30 |
| Backend restore from backup | Monthly | Engineering | — | 2026-04-30 |
| Redis failover simulation | Quarterly | Engineering | — | 2026-06-30 |
| Full DR simulation (all systems) | Semi-annual | CTO + Engineering | — | 2026-09-30 |
| Communication protocol drill | Quarterly | Engineering + CEO | — | 2026-06-30 |

**Test Documentation:** Every DR test must produce a written report within 48 hours covering:
- What was tested
- What worked
- What failed
- What was improved
- Updated RTO/RPO measurements (actual vs. target)

---

*Previous: [01-DEPLOYMENT-GUIDE.md](./01-DEPLOYMENT-GUIDE.md)*
*Next: [03-SECURITY-HARDENING-GUIDE.md](./03-SECURITY-HARDENING-GUIDE.md)*
