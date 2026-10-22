# Headless Commerce — Angular 22 + NestJS 12

E-commerce headless de portfólio: storefront **Angular 22** (SSR zoneless, signals, `httpResource`, Signal Forms, cache na borda da Vercel) consumindo uma API **NestJS 12** (Drizzle ORM, PostgreSQL, Swagger, filas, JWT) — catálogo, busca, carrinho com reserva de estoque, checkout idempotente, Pix via webhooks idempotentes, admin — com **PostgreSQL no Supabase**.

> Este repositório é um *starter*: a estrutura, o schema completo (com migration gerada), o contrato HTTP, a configuração do Claude Code e o catálogo já funcionam, com SSR verificado contra a API. As demais fatias são construídas com os prompts de [`PROMPTS.md`](PROMPTS.md), um por vez.

## Stack

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| API | Node · NestJS · Drizzle ORM · pg · PGlite (testes) · class-validator · @nestjs/swagger · @nestjs/throttler · Vitest · oxlint · Prettier | 24 · 12.2 · 0.45 · 8.23 · 0.5 · 0.15 · 12.0 · 6.7 · 5.0 |
| Busca | Meilisearch (prompt 01) | 1.17 |
| Filas | BullMQ + Redis (prompt 04) | 6.x |
| Storefront | Angular · Angular Material · Tailwind · NgRx Signals · TypeScript · Vitest · angular-eslint · Prettier | 22.2 · 22.2 · 4.3 · 22.0 · 6.0 · 5.0 · 22.6 · 3.9 |
| Dados | PostgreSQL (local) / Supabase Postgres (prod) · Redis · Meilisearch · Mailpit | 17 |
| Deploy | Vercel (storefront SSR) · Fly.io (API, Dockerfile) · Supabase (DB + Storage) | — |

## Pré-requisitos

- **Node 24 LTS** (mínimo 22.22.3, exigido pelo Angular 22 e NestJS 12). `fnm install 24 && fnm use 24` ou nodejs.org.
- **Docker** (Postgres, Meilisearch, Redis, Mailpit).
- **Claude Code** — `curl -fsSL https://claude.ai/install.sh | bash` (ou `winget install Anthropic.ClaudeCode`).

Sem PHP, sem Composer: tudo é TypeScript.

## Rodando em 5 comandos

```bash
docker compose up -d
cd api && cp .env.example .env && npm run setup && npm run start:dev    # http://localhost:8000/api/v1 · Swagger em /api/docs
cd ../storefront && npm install && npm start                            # http://localhost:4200
curl -s localhost:8000/api/v1/health | jq
open http://localhost:4200
```

Quality gates:

```bash
cd api && npm run lint && npm run typecheck && npm test && npm run test:e2e
cd storefront && npm run lint:fix && npm run typecheck && npm test && npm run build
```

`npm run test:e2e` na API sobe a aplicação real num **PGlite** (Postgres em WASM, em memória) com as migrations aplicadas — sem Docker. Os 29 testes da API e os 4 do storefront passam no starter.

## Estrutura

```
.
├── api/                           NestJS 12 (ESM, Node 24)
│   ├── src/database/schema.ts     Drizzle — fonte da verdade do banco (CHECK constraints, índices únicos)
│   ├── drizzle/0000_init.sql      migration gerada por drizzle-kit (npm run db:generate)
│   ├── src/catalog/               módulo implementado: categorias e produtos (filtros, paginação, mappers)
│   ├── src/orders/order-status.ts state machine do pedido (transitionOrder)
│   ├── src/payments/              contrato PaymentGateway + MockGateway (Pix fake) + registry por env
│   ├── src/coupons/coupon.rules.ts regras puras de cupom
│   ├── src/common/                money (centavos inteiros), paginação Laravel-like, validação 422, filtro de erros
│   ├── test/                      e2e em PGlite (helpers/app.ts, factories.ts)
│   ├── docs/api.md                contrato HTTP (fonte da verdade, junto com storefront types.ts)
│   └── Dockerfile, fly.toml       deploy em container
├── storefront/                    Angular 22 (zoneless, SSR, Vitest)
│   ├── CLAUDE.md                  best practices oficiais (gerado por `ng new --ai-config claude-code`)
│   ├── src/app/core/api/          types, interceptor (base URL + X-Cart-Token), httpResource factories
│   ├── src/app/core/config/       API_BASE_URL por env var em runtime (REQUEST_CONTEXT → TransferState)
│   ├── src/app/features/          home, catalog (lista + produto), cart (placeholder), not-found
│   ├── src/app/app.routes.server.ts  RenderMode por rota + Cache-Control
│   ├── src/server.ts              Express + AngularNodeAppEngine
│   └── vercel.json, api/index.mjs função serverless que serve o SSR na Vercel
├── .claude/                       configuração do Claude Code (abaixo)
├── .mcp.json                      MCP: angular-cli, context7, supabase, vercel
├── docker-compose.yml             infra local
├── PROMPTS.md                     sequência de prompts
└── CLAUDE.md                      regras do repositório
```

## Claude Code

Abra na raiz do repositório: `cd angular-nest-commerce && claude`.

**Modo automático.** Nas versões atuais (≥ 2.1.283) o modo `auto` já é o padrão em sessões interativas. Se a sessão pedir confirmação a cada comando, inicie com `claude --permission-mode auto` ou, para liberar tudo num repositório descartável, `claude --dangerously-skip-permissions`. Esses dois modos **não podem** ser definidos em `.claude/settings.json` (ignorados em arquivos de projeto desde a 2.1.257); por isso o arquivo do projeto usa `acceptEdits` + allowlist ampla. Para fixar `auto` globalmente: `"permissions": { "defaultMode": "auto" }` em `~/.claude/settings.json`.

| Arquivo | Função |
| --- | --- |
| `CLAUDE.md` | contexto do monorepo, comandos, invariantes (centavos inteiros, estoque, idempotência, state machine, migrations geradas) |
| `storefront/CLAUDE.md` | best practices oficiais do Angular 22 (signals, `@Service`, Signal Forms, control flow, a11y) |
| `.claude/settings.json` | `acceptEdits`, allowlist (npm, npx, ng, nest, docker, git local, vercel/fly/supabase), `ask` para push/deploy/`drizzle-kit push`, `deny` para ler `.env` |
| `.claude/rules/api.md`, `storefront.md` | convenções carregadas só ao tocar `api/**` ou `storefront/**` |
| `.claude/rules/commits.md` | commits convencionais, log em `.claude/progress.md`, nunca push/deploy sem pedir |
| `.claude/agents/` | `nest-backend`, `angular-frontend`, `reviewer` (read-only), `qa` |
| `.claude/skills/` | `/api-feature`, `/storefront-feature`, `/review`, `/ship` |
| `.claude/hooks/` | `session-start.sh` (status + tail do progress), `guard-bash.sh` (bloqueia `rm -rf /`, force push, `cat .env`, `drizzle-kit push`), `format.sh` (Prettier/ESLint no arquivo editado) |
| `.mcp.json` | `angular-cli` (MCP oficial do Angular: `get_best_practices`, `search_documentation`, `find_examples`, dev server), `context7`, `supabase`, `vercel` |

O PROMPT 00 instala também as **skills oficiais do Angular** (`npx skills add https://github.com/angular/skills` → `angular-developer`, `angular-new-app`), que o subagente `angular-frontend` usa.

Variáveis opcionais para os MCPs remotos (exporte antes de abrir o `claude`): `CONTEXT7_API_KEY`, `SUPABASE_PROJECT_REF`.

## Decisões rápidas

- **Drizzle em vez de Prisma.** Schema em TypeScript, SQL explícito (`.for('update')`, `check()`), migrations geradas sem binário e, principalmente, o mesmo código roda em PGlite nos testes. Prisma é igualmente comum com NestJS; a troca é mecânica se preferir.
- **Vercel + Angular SSR.** A Vercel não tem preset nativo para Angular SSR; `vercel.json` serve `dist/storefront/browser` como estático e reescreve o resto para `api/index.mjs`, que reutiliza o `reqHandler` do Express. Alternativa: rodar o SSR no mesmo Fly da API.
- **API no Fly.io** (`gru`), não na Vercel: precisa de worker de filas, cron e conexão persistente com o Postgres. Railway/Render funcionam com o mesmo Dockerfile.
- **Supabase**: connection string do *Session pooler* (5432) com `DATABASE_SSL=true`; Storage S3-compatible para imagens (prompt 06).

## Status

| # | Fatia | Estado |
| --- | --- | --- |
| — | Starter: schema, catálogo, contrato, SSR, Claude Code | ✅ |
| 00 | Setup + skills do Angular + primeiro commit | ⬜ |
| 01 | Busca Meilisearch com facets | ⬜ |
| 02 | Carrinho (API + SignalStore + página) | ⬜ |
| 03 | Checkout idempotente com reserva de estoque | ⬜ |
| 04 | Pagamentos, webhooks idempotentes, filas, expiração | ⬜ |
| 05 | Auth JWT + área do cliente | ⬜ |
| 06 | Admin (segundo app Angular) + Supabase Storage | ⬜ |
| 07 | E2E Playwright + a11y + hardening | ⬜ |
| 08 | Deploy Supabase + Vercel + Fly | ⬜ |
| 09 | PSP real (Asaas sandbox) | ⬜ |
| 10 | Polimento de portfólio (README, ADRs) | ⬜ |

## Licença

MIT.
