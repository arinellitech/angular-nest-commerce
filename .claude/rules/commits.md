# Commits and progress

- One commit per completed slice, Conventional Commits with scope: `feat(api): checkout with idempotency key`, `feat(storefront): cart page`, `chore: …`, `test: …`, `docs: …`.
- Before committing: quality gates green in the app(s) you touched, `api/docs/api.md` and `storefront/src/app/core/api/types.ts` updated if the contract changed, generated SQL in `api/drizzle/` committed with the schema change.
- Append one line to `.claude/progress.md` per finished prompt: `- 2026-10-23 · PROMPT 02 done · cart endpoints + SignalStore · 18 tests`. The SessionStart hook shows the tail of this file so the next session knows where we are.
- Never `git push`, never deploy to production, never run `drizzle-kit push`/`db:reset` against anything but the local database without being asked in the current conversation.
