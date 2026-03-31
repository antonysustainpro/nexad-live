# Backend Token Limit Fix Required

## Current Issue
The RunPod backend has a hardcoded limit of 2048 tokens, causing chat to fail with:
```
max_tokens 4096 exceeds tier limit of 2048
```

## Frontend Fix Applied
Updated `/src/lib/api.ts` line 284:
```typescript
max_tokens: request.max_tokens || 2048  // Was 4096
```

## Backend Fix Needed
The backend at `https://4ljj3bdk1x0vhv-9000.proxy.runpod.net` needs to be updated to support unlimited tokens.

### Quick Fix (Paste in RunPod Terminal)
```bash
cd /workspace/sovereign-enhancer && find . -name "*.py" -exec sed -i 's/2048/128000/g' {} \; && pkill -f uvicorn && sleep 2 && nohup uvicorn api.main:app --host 0.0.0.0 --port 9000 > /tmp/backend.log 2>&1 &
```

### Proper Fix
1. SSH into RunPod pod
2. Find files with token limits:
   ```bash
   grep -r "tier limit of 2048" /workspace/sovereign-enhancer --include="*.py"
   ```
3. Update the limit validation in the backend code
4. Restart the backend service

## Files to Update on Backend
Look for:
- Token limit validation in chat endpoints
- User tier/subscription checks
- Any hardcoded 2048 values related to max_tokens

## Testing
After fix, this should work:
```bash
curl -X POST https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1/chat \
  -H "X-API-Key: b152cd92ab2275fd019a895bcc8241bfc80db1edd96e3e4370cbba2caf0d3861" \
  -d '{"messages": [{"role": "user", "content": "test"}], "max_tokens": 128000}'
```