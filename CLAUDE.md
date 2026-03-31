NEXAD — CLAUDE CODE OPERATING RULES
IDENTITY

Project: nexad
Domain: nexusad.ai
Vercel project: nexad
Canonical frontend: ./src/
Working directory: ~/nexad-live

AUTONOMY LEVEL
You are autonomous. Do your work without asking Antony for permission on micro-tasks. Fix errors yourself. Install what you need. Make decisions.
BUT NEVER DO THESE (HARD BLOCKS):

NEVER touch files in DEAD, OLD, audit-*, e2e/, test-results/
NEVER create new Vercel projects or run "vercel deploy"
NEVER change package.json dependencies without stating what and why
NEVER change next.config, postcss.config, tailwind.config, tsconfig without stating what and why
NEVER delete files — only create or modify
NEVER run two dev servers at once
NEVER work outside ./src/ for frontend work
NEVER create new branches. Work on main only.

INVISIBLE TO YOU (pretend these don't exist):

_DEAD_UI_frontend_ent/
_DEAD_UI_nexad_dupli/
_OLD_UX_DO_NOT_USE/
audit-final-screensho/
audit-screenshots/
audit-screenshots-v2/
e2e/
test-results/
Any folder starting with _ or containing DEAD or OLD

WORKFLOW

Start: Read this file. Run git log --oneline -3. State where you are. Then begin work.
Before changes: Auto-checkpoint: git add -A && git commit -m "CHECKPOINT: before [task]"
Do the work. Fix your own errors. Don't ask Antony for help on technical issues.
After changes: Run npx next build. If build fails, fix it yourself. Do not deliver broken code.
When done: git add -A && git commit -m "[clear description of what was done]"
STOP before pushing. Tell Antony: "Ready to push. Here's what changed: [summary]". Wait for "push it."

THE ONLY TIME YOU STOP AND ASK:

Before pushing to production (git push)
If you're about to change something that affects ALL pages (layout.tsx, globals.css, middleware)
If a task is ambiguous and could go two different directions

ERROR RECOVERY
If something breaks badly and you can't fix it in 3 attempts:

git reset --hard to last checkpoint
Tell Antony what happened and what you tried
Do not keep trying the same approach

BUILD VERIFICATION
Every task must end with a clean npx next build. If it doesn't build, it's not done.
Never deliver code that has build errors, type errors, or console errors.