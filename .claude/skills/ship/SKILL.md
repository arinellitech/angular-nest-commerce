---
name: ship
description: Close a slice — run all quality gates, update docs/progress, and create a conventional commit. Use when a prompt from PROMPTS.md is finished.
argument-hint: "[prompt number and one-line summary, e.g. '02 cart endpoints + store']"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git *), Bash(npm *), Bash(npx *), Bash(node *), Bash(docker compose *)
---
Ship slice: **$ARGUMENTS**

1. Determine which apps changed: `git status --porcelain`.
2. Quality gates for each changed app:
   - api: `cd api && npm run lint && npm run typecheck && npm test && npm run test:e2e`
   - storefront: `cd storefront && npm run lint:fix && npm run typecheck && npm test && npm run build`
   Fix failures before continuing. Never skip or delete a failing test to make this pass.
3. Contract check: if `api/src/**/*.mappers.ts` or DTOs changed, confirm `api/docs/api.md` and `storefront/src/app/core/api/types.ts` reflect it. If `api/src/database/schema.ts` changed, confirm a new file exists in `api/drizzle/`.
4. Append one line to `.claude/progress.md`: `- <YYYY-MM-DD> · PROMPT <nn> done · <summary> · <n> tests`.
5. Update the "Status" table in `README.md` (mark the prompt as done).
6. Stage everything except `.env*` and commit with a Conventional Commit message whose scope is `api`, `storefront` or `repo`, body listing the endpoints/pages added. Do not push.

Print the commit hash and the one-line summary at the end.
