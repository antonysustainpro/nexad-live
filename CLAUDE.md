ABSOLUTE RULES — READ THIS EVERY SESSION
PROJECT: nexad (Vercel project serving nexusad.ai)
CANONICAL FRONTEND: ./src/
DEPLOY TARGET: nexusad.ai via Vercel project "nexad"
NEVER deploy via "vercel deploy" manually. NEVER create new Vercel projects. NEVER touch any DEAD* or OLD* folders. NEVER run two Claude Code sessions on frontend.
SESSION START: 1. Read this file 2. git status && git log --oneline -3 3. Report to Antony. Do NOTHING until given a task.
BEFORE ANY CHANGE: git add -A && git commit -m "CHECKPOINT: before [task]" — Tell Antony the checkpoint hash.
AFTER ANY CHANGE: 1. npx next build 2. npx next start 3. WAIT for Antony to say "looks good" 4. Only then commit 5. Only push when Antony says "push it"
IF SOMETHING BREAKS: STOP. Do not fix. Show git log --oneline -10. Wait for Antony.
NEVER push without approval. NEVER edit outside ./src/ for UI work. NEVER delete without showing diff. NEVER install packages without asking.
