# R2 — Home como vitrine + imagens reais no seed

> Modelo: **Sonnet 5.5** · esforço: **high** — muito markup e pouca lógica; inclui um ajuste pequeno de seed/API.

```
Objetivo: a home deve vender produtos, não explicar a arquitetura. Trocar o hero técnico por uma vitrine real e trocar as imagens placeholder por imagens de produto plausíveis. Use a skill /storefront-feature para o storefront e /api-feature para o que tocar na API.

Escopo (API):
- Seed: trocar `picsum.photos` por URLs públicas estáveis de imagens de produto com fundo claro (ex.: Unsplash com parâmetros de corte `?w=1200&h=1200&fit=crop`), uma por produto do seed, coerentes com a categoria (teclado, mouse, fone…). Guardar a lista em `api/src/database/seed/images.ts` para o PROMPT 06/08 reaproveitar ao subir para o Storage. Adicionar o host em `storefront/angular.json → security.allowedHosts` e no `preconnect` do `index.html` (remover o de picsum).
- Categorias ganham `image_url` (nullable) no schema + migration + seed + `CategoryResource` + `docs/api.md` + `types.ts`.
- `GET /products` aceita `sort=best_selling` (ordenar por soma de `order_items.quantity` de pedidos `paid`, desempate por `published_at`); documentar. Para o seed sem pedidos, o resultado cai no desempate, e tudo bem.
- Newsletter: tabela `newsletter_subscribers (email unique, created_at)`, `POST /newsletter {email}` → 201 (ou 200 se já existe, idempotente), `@Throttle(5/min)`. e2e: cria, repete, e-mail inválido → 422.

Escopo (storefront — /):
- Hero: grid de 2 colunas no desktop (texto + imagem do produto em destaque, usando o primeiro item de `sort=newest` com `compare_at_price` ou o primeiro da lista), headline de oferta e CTA "Ver ofertas"; empilhado no mobile. Imagem com `priority`. Nada de "headless", "SSR", "webhook" no texto; esse pitch vai para o footer ("Sobre o projeto") e para o README.
- Barra de benefícios logo abaixo do hero (4 itens com ícone: frete, Pix, troca em 7 dias, compra segura); vira carrossel horizontal por `overflow-x: auto` + `scroll-snap` no mobile.
- Seções de produto com `ProductCard`: "Ofertas" (produtos com `compare_at_price`, ordenados por maior desconto — filtro no client sobre `per_page: 24` é aceitável), "Novidades" (já existe), "Mais vendidos" (`sort=best_selling`). Cada seção com título, link "Ver todos" e grade de 4 (desktop) / scroll horizontal com snap (mobile). Extrair `features/home/product-shelf.ts` (input: título, link, resource).
- "Compre por categoria": cards com `image_url` (fallback para gradiente da marca + ícone), nome e contagem; grade 2/3/6 colunas.
- Faixa editorial/banner secundário (imagem + texto) entre as seções, conteúdo em `environment.ts`.
- Newsletter no fim da home (Signal Forms, `POST /newsletter`, estados sucesso/erro/duplicado). Reusar o mesmo componente no footer (R1 deixou o campo só visual).
- SEO: `og:title`, `og:description`, `og:image` (hero) e `twitter:card` na home; JSON-LD `Organization` + `WebSite` com `SearchAction` apontando para `/products?search={search_term_string}`.

Testes: `product-shelf.spec.ts` (título, link, skeleton, erro); `newsletter-form.spec.ts` (422 mapeado no campo, sucesso); API e2e da newsletter e do `sort=best_selling`.

Critérios de aceite: view-source da home mostra hero, as três seções com produtos e categorias com imagem (SSR); LCP é a imagem do hero com `fetchpriority=high`; nenhuma referência a picsum no repositório; newsletter funciona ponta a ponta e repetir o e-mail não dá erro; `docs/api.md` e `types.ts` atualizados; gates verdes nos dois apps.
Finalize com /ship R2 "home como vitrine + imagens reais + newsletter".
```
