---
name: api-feature
description: Build one API vertical slice in api/ (schema → migration → service → DTO → controller → mapper → tests → docs). Use for "add endpoint", "implement cart/checkout/webhook", or any NestJS feature.
argument-hint: "[feature description, e.g. 'cart endpoints with guest token']"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npm *), Bash(npx *), Bash(node *), Bash(nest *), Bash(docker compose *), mcp__context7__*
---
Implement the API feature: **$ARGUMENTS**

Work inside `api/`. Follow `.claude/rules/api.md`.

## Steps

1. **Context**: read `docs/api.md`, `src/database/schema.ts`, the closest existing module and its tests. Use Context7 for any NestJS 12 / Drizzle 0.45 API you are not 100% sure about.
2. **Schema**: edit `src/database/schema.ts` (tables, relations, CHECK constraints, unique indexes for idempotency). Run `npm run db:generate -- --name <verb_noun>` and review the SQL in `drizzle/`.
3. **Domain**: pure functions for rules (`<context>/<thing>.rules.ts`) with unit tests. Services orchestrate: `db.transaction()` + `.for('update')` where an invariant is at stake; throw `ConflictException` / `UnprocessableEntityException` with `{ message, errors }`.
4. **HTTP**: `dto/*.dto.ts` (class-validator + `@ApiProperty`) → controller (thin, `@ApiTags`) → `*.mappers.ts` for output. Register the module in `app.module.ts`. Keep `/api/v1` prefix (global).
5. **Tests**: `test/<context>.e2e-spec.ts` with `createTestApp()` + `factories(db)` — happy path, 422, 404, and the invariant edge case. Extend `test/helpers/factories.ts` with new factories/states.
6. **Docs**: move endpoints from "Planned" to "Implemented" in `docs/api.md` with the exact JSON shape; tell the user which fields changed in `storefront/src/app/core/api/types.ts`.
7. **Verify**: `npm run lint && npm run typecheck && npm test && npm run test:e2e`. Fix until green.

Finish with: files touched, endpoints, test count, and a ready-to-use `curl` example for each new endpoint.
