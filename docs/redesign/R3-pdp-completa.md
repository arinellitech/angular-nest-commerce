# R3 — PDP completa (página de produto)

> Modelo: **Opus 5.5** · esforço: **high** — várias interações (galeria, frete, sticky bar) coexistindo com SSR e hidratação incremental.

```
Objetivo: a página de produto deve ter tudo que um comprador brasileiro espera: especificações, frete por CEP, galeria com zoom, produtos relacionados, prova social e um botão de compra sempre visível no mobile. Use a skill /storefront-feature; mudanças de API via /api-feature.

Escopo (API):
- `GET /products/:slug/related?limit=8`: mesma categoria (e irmãs, se faltar), publicados, excluindo o próprio; ordenar por `best_selling` depois `newest`. Documentar e tipar.
- `POST /shipping/quote {postal_code, cart_total?}` → `{ options: [{ carrier, service, price: Money, eta_days_min, eta_days_max }] }`. Implementar um `ShippingCalculator` com regras por faixa de CEP (tabela estática em código, por região do primeiro dígito) e frete grátis acima de `SHIPPING_FREE_THRESHOLD_CENTS` (env). O frete flat atual do carrinho passa a usar o mesmo serviço (opção padrão) para os totais não divergirem. e2e: CEP inválido → 422; SP e AM retornam preços/prazos diferentes; frete grátis acima do limite.
- Avaliações: tabela `product_reviews (product_id, author_name, rating 1..5, title, body, created_at, approved bool)`, seed com 2–5 avaliações aprovadas por produto, `GET /products/:slug/reviews?page=` paginado e `ProductResource` ganha `rating: { average (1 casa decimal, como string), count }`. Sem endpoint de criação neste prompt (fica para quando houver auth). Documentar e tipar.

Escopo (storefront — /products/:slug), extrair componentes em `features/catalog/pdp/`:
- `product-gallery`: imagem principal com zoom ao passar o mouse (lupa via `transform-origin` no `mousemove`, desligado em touch), lightbox (`MatDialog` fullscreen com setas/teclado/Esc), thumbnails roláveis com indicador, swipe no mobile (`scroll-snap`). `priority` só na primeira imagem; as demais `loading="lazy"`.
- Bloco de compra: preço (`PriceTag lg`), "no Pix: R$ X (5% off)" (percentual em `environment.ts`; só visual, o desconto real é um cupom/regra futura — deixe claro no código), "ou 10x de R$ Y sem juros" calculado em centavos com `Math.ceil` por parcela e última parcela ajustada (função pura testada em `shared/money.ts`), estoque, stepper, "Adicionar ao carrinho" (abre mini-cart) e "Comprar agora" (adiciona e navega para /checkout). Selos abaixo: Pix, troca em 7 dias, compra segura, nota fiscal.
- `shipping-estimator`: campo CEP (máscara 00000-000, Signal Forms), botão "Calcular", lista de opções com preço e prazo; CEP lembrado em localStorage e preenchido automaticamente na próxima PDP e no carrinho; link "Não sei meu CEP" para os Correios.
- `MatTabGroup` abaixo da dobra: Descrição (`whitespace-pre-line`), Especificações (tabela `<dl>` a partir de `specs`, chaves humanizadas), Avaliações (média com estrelas, distribuição 5→1 em barras, lista paginada com `httpResource`), Entrega e devolução (texto estático). No mobile vira acordeão (`MatExpansionPanel`) — mesma fonte de dados, componente decide pelo `BreakpointObserver`.
- Prova social no topo: estrelas + "(23 avaliações)" com âncora para a aba; "Últimas N unidades" já existe, manter.
- `related-products`: shelf "Quem viu também viu" (reaproveitar `product-shelf` do R2) e "Vistos recentemente" (lista de slugs em localStorage, máximo 8, renderizada só no browser via `@defer (on viewport)`).
- Sticky buy bar no mobile: ao rolar além do botão de compra, fixar no rodapé uma barra com miniatura, preço e "Adicionar"; `IntersectionObserver` em `afterNextRender`; respeita `prefers-reduced-motion`.
- Compartilhar: `navigator.share` quando existir, senão copiar link (snackbar). Favoritar fica como botão desabilitado com tooltip "em breve" até o R4 (ou, se o R4 já rodou, ligado ao `WishlistStore`).
- SEO: JSON-LD `Product` ganha `aggregateRating`, `brand` (se houver em specs) e `offers.shippingDetails` básico; `BreadcrumbList`.

Testes: `installments()` e `pixPrice()` puros; `shipping-estimator.spec.ts` (CEP inválido, resposta renderizada, persistência); `product-gallery.spec.ts` (troca de imagem, teclado no lightbox); PDP spec existente atualizado.

Critérios de aceite: PDP mostra specs, avaliações, frete para um CEP de SP e de AM com valores diferentes, relacionados da mesma categoria; "Comprar agora" chega ao /checkout com o item; sticky bar aparece só no mobile ao rolar; view-source da PDP ainda traz nome, preço, descrição e JSON-LD completo; axe sem violações serious/critical; gates verdes; docs e tipos atualizados.
Finalize com /ship R3 "pdp completa: galeria, frete por cep, specs, avaliações, relacionados".
```
