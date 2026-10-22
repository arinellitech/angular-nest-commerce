# Sequência de prompts para o Claude Code

Cole um prompt por vez, na ordem. Cada prompt termina com `/ship`, que roda os quality gates, atualiza `README.md` + `.claude/progress.md` e faz o commit. Só avance quando o `/ship` anterior imprimir o hash do commit.

Como abrir: `cd angular-nest-commerce && claude` (ver README → "Claude Code" para o modo automático).

Convenção dos prompts: **Objetivo → Escopo → Critérios de aceite**. O Claude Code já conhece as regras (`CLAUDE.md`, `storefront/CLAUDE.md`, `.claude/rules/*`), então os prompts falam só do *que* fazer.

---

## PROMPT 00 — Setup, skills oficiais do Angular e primeiro commit

```
Prepare o ambiente deste starter e valide que tudo roda.

1. Confirme Node >= 22.22.3 (ideal 24 LTS) e Docker. Suba a infra: `docker compose up -d` (postgres, meilisearch, redis, mailpit).
2. API: `cd api && cp .env.example .env && npm run setup` (instala, migra e popula o Postgres local). Rode `npm run lint && npm run typecheck && npm test && npm run test:e2e` — tudo verde. Confirme que `npm run db:generate` NÃO gera uma nova migration (schema e SQL em sincronia).
3. Storefront: `cd storefront && npm install && npm run lint && npm run typecheck && npm test && npm run build`.
4. Instale as skills oficiais do Angular na raiz do repositório: `npx skills add https://github.com/angular/skills` (escolha Claude Code; devem aparecer em .claude/skills/angular-developer e angular-new-app). Confirme que o MCP `angular-cli` do .mcp.json responde (`/mcp`).
5. Suba os dois servidores (`npm run start:dev` na api, `npm start` no storefront), faça GET http://localhost:8000/api/v1/health, abra http://localhost:8000/api/docs (Swagger) e http://localhost:4200 confirmando que a home lista produtos do seed com SSR (view-source mostra os produtos). Derrube os servidores depois.
6. Se algo falhar por versão/ambiente, corrija no projeto (nunca em .env) e me explique o que mudou.
7. `git init`, primeiro commit `chore: starter (nestjs 12 api + angular 22 storefront + claude code config)`.

Critérios de aceite: health 200, Swagger abre, home renderiza produtos no HTML do servidor, todos os gates verdes, skills do Angular instaladas, commit criado.
Finalize com /ship 00 "setup + angular skills".
```

## PROMPT 01 — Busca com Meilisearch e facets

```
Objetivo: trocar a busca SQL por Meilisearch mantendo o contrato de GET /api/v1/products e a assinatura de CatalogService.searchProducts.

Escopo (API):
- `npm i meilisearch`. Módulo `search` com um SearchService (client configurado por MEILISEARCH_HOST/KEY), comando `npm run search:configure` (tsx script) que cria o índice `products` com filterableAttributes (category, price_cents, in_stock), sortableAttributes (price_cents, published_at, name) e typo tolerance; e `npm run search:reindex`.
- Indexação: documento com id, name, sku, description, category {slug,name}, price_cents, in_stock, published (bool), specs achatado. Só produtos publicados+ativos. Reindexar produto ao mudar (hook no service de catálogo; por enquanto chamado pelo seed e pelo reindex).
- CatalogService: com `search`, consulta o Meilisearch (filtros + sort + paginação) e hidrata os produtos do Postgres pelos ids preservando a ordem; sem `search`, mantém a query SQL atual. Resposta ganha `meta.facets` (categorias com contagem e faixa min/max de preço) quando há busca.
- Testes: abstrair o client numa interface e usar um fake em memória nos e2e (não subir Meilisearch nos testes); cobrir busca com typo, filtro de categoria + preço, ordenação e produto não publicado ausente. Manter os testes SQL existentes.

Escopo (storefront):
- /products exibe facets (categorias e faixa de preço) como filtros: sidebar no desktop, `MatBottomSheet`/`MatSidenav` no mobile, refletidos na URL.
- Campo de busca do header com debounce de 300ms (signal + `debounced()` ou rxjs) e sugestões (5 primeiros resultados) com `MatAutocomplete`.

Critérios de aceite: `search=teclado mecanico` com erro de digitação encontra "Teclado Mecânico"; facets corretos; todos os gates verdes; docs/api.md e core/api/types.ts atualizados (Paginated.meta.facets).
Finalize com /ship 01 "busca com meilisearch".
```

## PROMPT 02 — Carrinho (API + SignalStore + página)

```
Objetivo: carrinho de convidado persistido na API, identificado pelo header X-Cart-Token, com cupons.

Escopo (API) — use a skill /api-feature:
- Endpoints planejados em docs/api.md: POST /cart (cria e devolve token no header X-Cart-Token e no body), GET /cart, POST /cart/items {product_id, quantity}, PATCH /cart/items/:id {quantity}, DELETE /cart/items/:id, POST /cart/coupon {code}, DELETE /cart/coupon.
- Guard/decorator `@CurrentCart()`: resolve o carrinho ativo pelo token (ou pelo usuário autenticado quando existir); 404 se inválido/expirado; renova expires_at a cada uso.
- CartService: addItem (soma quantidade se já existe; valida produto publicado e estoque disponível ≥ quantidade; snapshot de preço), updateQuantity, removeItem, applyCoupon (usa isCouponRedeemable), removeCoupon. Totais (subtotal, discount, shipping flat de env, total) calculados no mapper.
- Erros: InsufficientStock → 422 `errors.quantity`; CouponNotApplicable → 422 `errors.code`.
- Testes e2e: fluxo completo, limite de estoque, cupom inválido/expirado/abaixo do mínimo, carrinho expirado, isolamento entre tokens.

Escopo (storefront) — use a skill /storefront-feature:
- `features/cart/cart.store.ts` (NgRx SignalStore): state (cart, loading, error), computed (count, isEmpty), methods (ensureCart, addItem, updateQuantity, removeItem, applyCoupon, removeCoupon, refresh). Token já é tratado pelo interceptor.
- PDP: "Adicionar ao carrinho" chama a store, mostra MatSnackBar com ação "Ver carrinho".
- Header: `matBadge` com a quantidade no ícone.
- Página /cart (RenderMode.Client): lista com controle de quantidade, remover, campo de cupom (Signal Forms), resumo (subtotal, desconto, frete, total), botão "Finalizar compra" → /checkout. Estados: vazio, carregando, erro de estoque inline.
- Testes: store (provideHttpClientTesting) e componente CartSummary.

Critérios de aceite: dois navegadores (tokens diferentes) têm carrinhos independentes; adicionar acima do estoque retorna 422 e a UI mostra a mensagem; cupom BEMVINDO10 aplica 10% acima de R$ 50; gates verdes; docs e tipos atualizados.
Finalize com /ship 02 "carrinho".
```

## PROMPT 03 — Checkout idempotente com reserva de estoque

```
Objetivo: POST /api/v1/checkout transforma o carrinho em pedido, reserva estoque de forma atômica e cria a cobrança (provider mock), com idempotência pelo header Idempotency-Key.

Escopo (API) — /api-feature:
- CheckoutDto: customer {name, email, document (CPF válido — validador custom), phone}, shipping_address {line1, line2?, city, state (UF), postal_code (CEP 8 dígitos), country='BR'}, payment_method (pix|card|boleto — só pix no mock).
- Idempotência: header obrigatório (UUID). Se já existe order com esse idempotency_key → devolve o mesmo pedido com 200 (em vez de 201). Use unique index + `onConflictDoNothing` para a corrida.
- CheckoutService.placeOrder dentro de `db.transaction`: `.for('update')` nos inventories dos produtos do carrinho; re-valida publicação e preço (se mudou, atualiza o snapshot e segue; se saiu do ar, 422); verifica available >= quantity (senão 422 com o produto); incrementa reserved + stock_movements (reserved); recalcula totais com cupom (incrementa uses); cria order (número sequencial ORD-YYYY-NNNNNN via sequence do Postgres, nunca count()), order_items; marca carrinho converted; chama PaymentGateway.charge() e persiste payment. Emite evento `order.placed` (EventEmitter2 de @nestjs/event-emitter).
- Teste de concorrência: dois checkouts concorrentes para o último item — exatamente um sucede. Como o PGlite é single-connection, rode esse teste contra Postgres real (DATABASE_URL) com `describe.skipIf(!process.env.DATABASE_URL)`; mantenha um teste sequencial no PGlite.
- GET /orders/:number: OrderResource com items, totais, status, payment (pix_copy_paste, expires_at). Acesso: dono (auth) OU X-Cart-Token do carrinho de origem OU token assinado na query (para o e-mail). Documente a decisão.
- Listener de order.placed envia e-mail (Nodemailer → Mailpit) com resumo e link assinado.

Escopo (storefront) — /storefront-feature:
- /checkout (RenderMode.Client): `MatStepper` com 1) Dados + endereço (Signal Forms; busca CEP via https://viacep.com.br/ws/{cep}/json/ preenchendo endereço), 2) Pagamento (Pix), 3) Revisão. Gera Idempotency-Key (crypto.randomUUID) uma vez por tentativa e reaproveita em retry.
- /orders/:number: status, itens, totais, QR code do Pix a partir de pix_copy_paste (lib `qrcode`), botão copiar, contador de expiração.
- CartStore limpa após sucesso.

Critérios de aceite: reenviar o mesmo Idempotency-Key devolve o mesmo pedido; estoque reservado aparece em GET /products/:slug (available_quantity cai); e-mail chega no Mailpit; gates verdes; docs/tipos atualizados.
Finalize com /ship 03 "checkout idempotente + reserva de estoque".
```

## PROMPT 04 — Pagamentos, webhooks idempotentes, filas e expiração

```
Objetivo: fechar o ciclo pagamento → confirmação → baixa de estoque, com webhooks seguros, processamento em fila e expiração automática.

Escopo (API) — /api-feature:
- Filas: `@nestjs/bullmq` + Redis (REDIS_URL). Queue `payments` com processor `ProcessWebhookEvent`. Em testes, usar um driver síncrono/fake (abstrair atrás de uma interface `JobDispatcher`).
- POST /api/v1/webhooks/:provider: resolve o gateway; parseWebhook() valida assinatura; insere webhook_events com `onConflictDoNothing` (duplicata → 200 sem reprocessar); enfileira. Sem throttle nessa rota.
- Processor: localiza payment por provider_reference; aplica confirm/fail/refund (cada um idempotente, em transação):
  - confirm: payment confirmed_at, transitionOrder(Paid), inventory reserved -= qty e quantity -= qty, stock_movements (sold), evento order.paid → e-mail.
  - fail/expire: payment failed/expired, transitionOrder(Cancelled), reserved -= qty, stock_movements (released), coupon.uses -= 1.
  - refund: Refunded, não devolve estoque (documentar).
- `@nestjs/schedule`: cron a cada 5 min `orders:expire-unpaid` cancela pedidos pending_payment com payment.expires_at passado, liberando estoque.
- Comando `npm run mock:pay -- ORD-… [--fail]` (tsx script) que dispara o webhook mock localmente (HTTP para a própria API com X-Webhook-Secret).
- Testes: webhook sem assinatura → 401; duplicado → 200 e nenhum efeito; confirmação baixa estoque uma única vez mesmo com 3 entregas; expiração libera estoque; transições inválidas lançam.

Escopo (storefront):
- /orders/:number faz polling a cada 5s enquanto pending_payment (resource com `interval`), troca para "Pago" com animação discreta; "Expirado" com botão de refazer pedido (recria carrinho com os itens).
- Página /dev/pay (só fora de produção, guard por environment) com botão que chama um endpoint local protegido por NODE_ENV!=production, para demonstrar o fluxo em vídeo/README.

Critérios de aceite: fluxo completo local: adicionar → checkout → `npm run mock:pay` → página mostra Pago e estoque baixou; worker rodando junto com a API; gates verdes.
Finalize com /ship 04 "pagamentos + webhooks + filas + expiração".
```

## PROMPT 05 — Autenticação de clientes (JWT) e área do cliente

```
Objetivo: cadastro/login com JWT (access + refresh), histórico de pedidos e merge do carrinho de convidado.

Escopo (API) — /api-feature:
- `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` + `argon2`. POST /auth/register, /auth/login → { access_token (15 min), refresh_token (7 dias, rotativo, hash no banco) }, /auth/refresh, /auth/logout; GET /me; GET /me/orders (paginado). POST /auth/forgot-password e /auth/reset-password com token assinado e e-mail (Mailpit) com link para o storefront (FRONTEND_URL).
- Ao autenticar com X-Cart-Token presente: MergeGuestCart (itens do convidado entram no carrinho do usuário somando quantidades e respeitando estoque; cupom do convidado prevalece se válido). Carrinho de convidado vira abandoned.
- `@Throttle` em login/register (5/min por IP). Guards: JwtAuthGuard; acesso a pedidos só do dono.
- Testes: register/login/refresh/logout, token inválido → 401, merge de carrinho, histórico só do próprio usuário, rate limit.

Escopo (storefront) — /storefront-feature:
- `features/auth/auth.store.ts` (SignalStore: user, tokens em cookie, login/register/logout/refresh), interceptor adiciona Bearer e faz refresh em 401, `canActivate` guard para /account/**.
- Páginas: /login, /register, /forgot-password, /reset-password, /account (dados), /account/orders (lista + link). Menu no header (`MatMenu`) com avatar.
- Checkout pré-preenche customer com o usuário logado.
- Testes: store auth e guard.

Critérios de aceite: convidado adiciona item → faz login → carrinho mantém os itens; /account/orders lista pedidos; reset de senha funciona ponta a ponta via Mailpit; gates verdes.
Finalize com /ship 05 "auth jwt + área do cliente".
```

## PROMPT 06 — Painel admin (segundo app Angular) e imagens no Supabase Storage

```
Objetivo: administração do catálogo e dos pedidos num segundo app Angular no mesmo workspace, e imagens reais em object storage.

Escopo (storefront workspace):
- `cd storefront && npx ng generate application admin --routing --style tailwind --zoneless --ssr=false` (fica em projects/admin). Angular Material com `MatSidenav` + `MatTable` + `MatDialog`. Login de admin separado (guard `admin`).
- Telas: Categorias (árvore), Produtos (CRUD com upload de imagens e ajuste de estoque gerando stock_movement "adjusted"), Cupons, Pedidos (lista + detalhe + ações "Marcar como enviado" (Fulfilled) e "Reembolsar"), Webhooks (lista + reprocessar), Dashboard (pedidos hoje, receita paga, estoque baixo).
- Deploy: segundo projeto na Vercel (Root Directory `storefront`, build `ng build admin`, output `dist/admin/browser`, SPA fallback).

Escopo (API):
- Tabela `admins` + AuthAdmin (JWT com role, nunca reutilizar users). Módulo `admin` com endpoints /api/v1/admin/** protegidos por `AdminGuard`, DTOs e testes.
- Upload: endpoint que gera URL pré-assinada (S3 SDK v3) para o bucket `products` do Supabase Storage (S3-compatible: endpoint https://<ref>.storage.supabase.co/storage/v1/s3, forcePathStyle). ProductImage.url() devolve a URL pública. Em local, `disk=local` salva em ./storage e serve por `express.static`. Documentar no README.

Critérios de aceite: criar produto com imagem pelo admin aparece no storefront; alterar estoque reflete em available_quantity; pedidos pagos aparecem no painel; gates verdes nos dois apps.
Finalize com /ship 06 "admin angular + supabase storage".
```

## PROMPT 07 — E2E (Playwright), acessibilidade e hardening

```
Objetivo: prova de que o fluxo inteiro funciona de ponta a ponta e que a API aguenta produção.

Escopo (storefront):
- `npm i -D @playwright/test @axe-core/playwright` + `playwright.config.ts` (baseURL localhost:4200, webServer sobe `ng serve`; API com DATABASE_DRIVER=pglite + seed de teste sobe por script). Specs em e2e/: catálogo (busca + filtro), carrinho, checkout até a página do pedido, confirmação via webhook mock, login + histórico. Script `npm run e2e`.
- Acessibilidade: axe em home, catálogo, PDP, carrinho, checkout — zero violações serious/critical.

Escopo (API):
- `helmet`, `compression`, `nestjs-pino` (logs JSON com request id), `@nestjs/terminus` no /health (db, redis, meilisearch), graceful shutdown.
- Rate limiting por rota (catálogo 120/min, cart 60/min, checkout 10/min); `Cache-Control: public, s-maxage` + ETag nas rotas de catálogo (interceptor).
- Comando `npm run demo:reset` que recria o seed (para o ambiente de demonstração), bloqueado em produção sem --force.

CI: atualizar .github/workflows/ci.yml com job e2e (sobe API em PGlite e storefront, cache dos browsers do Playwright).

Critérios de aceite: `npm run e2e` verde local e no CI; /health reporta os três checks; gates verdes.
Finalize com /ship 07 "e2e + a11y + hardening".
```

## PROMPT 08 — Deploy: Supabase + Vercel + Fly.io

```
Objetivo: colocar a demo no ar com o mesmo código, sem gambiarra de ambiente.

Escopo:
1. Supabase: usando o MCP do Supabase (ou o dashboard), criar o projeto na região sa-east-1, pegar a connection string do "Session pooler" (porta 5432) para a API (DATABASE_SSL=true). Criar bucket `products` público no Storage e as chaves S3. Rodar `npm run db:migrate && npm run db:seed` contra o Supabase a partir da máquina local.
2. API no Fly.io com o Dockerfile/fly.toml existentes: `fly launch --no-deploy`, `fly secrets set` (DATABASE_URL, DATABASE_SSL, CORS_ALLOWED_ORIGINS com a URL da Vercel, PAYMENT_WEBHOOK_SECRET forte, REDIS_URL do Upstash, MEILISEARCH_* do Meilisearch Cloud, JWT_SECRET), 1 máquina em gru. Alternativa documentada: Railway/Render com o mesmo Dockerfile.
3. Storefront na Vercel: usando o MCP da Vercel ou o CLI, criar o projeto com Root Directory = storefront (vercel.json já define build/output/função SSR), env API_BASE_URL e PUBLIC_API_BASE_URL (URL pública da API no Fly), NG_ALLOWED_HOSTS se houver domínio próprio. Confirmar: HTML do produto vem renderizado do servidor, header `cache-control: public, s-maxage=60` presente, imagens do Supabase carregam.
4. Escrever docs/deploy.md com o passo a passo, variáveis e como rodar `demo:reset` no ambiente de demo. Adicionar badge de status e as URLs no README.
5. Não executar `vercel --prod`, `fly deploy` nem nada em produção sem eu confirmar na conversa; prepare tudo e me peça o ok por etapa.

Critérios de aceite: home e PDP servidas pela Vercel com dados do Supabase; checkout + webhook mock funcionam no ambiente de demo; docs/deploy.md completo.
Finalize com /ship 08 "deploy supabase + vercel + fly".
```

## PROMPT 09 — PSP real: adapter Asaas (sandbox) com feature flag

```
Objetivo: trocar o mock por um PSP brasileiro real sem tocar no checkout.

Escopo (API) — /api-feature:
- `src/payments/asaas.gateway.ts` estendendo PaymentGateway: cria cliente e cobrança Pix via API do Asaas sandbox (https://docs.asaas.com) com `fetch` nativo + retry/backoff e timeout; guarda provider_reference, pix_qr_code (base64) e pix_copy_paste; parseWebhook valida o header asaas-access-token e mapeia PAYMENT_RECEIVED/PAYMENT_CONFIRMED → confirmed, PAYMENT_OVERDUE → expired, PAYMENT_REFUNDED → refunded.
- Registrar em GATEWAYS; variáveis ASAAS_API_KEY, ASAAS_BASE_URL, ASAAS_WEBHOOK_TOKEN em env.ts. PAYMENT_PROVIDER seleciona em runtime.
- Testes: mock de `fetch` (msw ou `vi.stubGlobal`) para charge e mapeamento de todos os eventos; webhook com token inválido → 401; teste de contrato parametrizado que roda contra mock e asaas (fake).
- Documentar em docs/payments.md como cadastrar o webhook no painel sandbox e como testar com cloudflared/ngrok.

Critérios de aceite: com PAYMENT_PROVIDER=asaas e chave sandbox no .env, um checkout gera QR real do Asaas sandbox e o webhook confirma o pedido; com mock, tudo continua funcionando; gates verdes.
Finalize com /ship 09 "asaas sandbox adapter".
```

## PROMPT 10 — Polimento de portfólio

```
Objetivo: fazer o repositório contar a história certa para quem avalia Angular + Node/NestJS.

Escopo:
- README.md final: pitch de 3 linhas, diagrama de arquitetura (Mermaid: Vercel/Angular SSR → API NestJS no Fly → Supabase/Meilisearch/Redis/PSP), decisões de design (integer cents, reserva de estoque com lock + CHECK, idempotência, webhooks idempotentes, state machine, SSR com cache na borda, PGlite nos testes), como rodar em 5 comandos, como testar, URLs da demo, GIF/screenshots (placeholders com nomes de arquivo para eu gravar).
- docs/adr/: 6 ADRs curtos (formato Nygard): 0001 Angular SSR + NestJS headless; 0002 integer cents; 0003 reserva de estoque; 0004 idempotência de checkout e webhooks; 0005 Drizzle + PGlite nos testes; 0006 Supabase + Vercel + Fly.
- Revisar nomes, comentários e mensagens para consistência (pt-BR nas mensagens de usuário, inglês no código). Garantir que não existe TODO/FIXME no código.
- `npm audit` limpo (ou justificado) nos dois apps. Dependabot config para api e storefront.
- Rodar o subagente reviewer no repositório inteiro e corrigir blockers.

Critérios de aceite: README completo, 6 ADRs, zero TODO, audits ok, CI verde.
Finalize com /ship 10 "polimento de portfólio".
```

---

## Prompts utilitários (use quando precisar)

- `/review` — revisão read-only das mudanças atuais antes de commitar.
- `/ship <nn> "<resumo>"` — quality gates + docs + commit.
- `Use o subagente qa para rodar tudo e me dizer o que está quebrado.`
- `Explique, com base em api/docs/api.md e storefront/src/app/core/api/types.ts, onde o contrato está divergindo.`
- `Estou retomando o projeto. Leia .claude/progress.md e me diga qual é o próximo prompt e se o ambiente está pronto.`
