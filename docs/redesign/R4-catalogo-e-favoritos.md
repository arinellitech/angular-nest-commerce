# R4 — Catálogo com ações rápidas e favoritos

> Modelo: **Sonnet 5.5** · esforço: **high** — cards, badges e um SignalStore novo com persistência local.

```
Objetivo: deixar a listagem com cara de marketplace (ações no card, badges, grid/lista, banner de categoria) e criar favoritos persistidos localmente, prontos para sincronizar com o usuário no PROMPT 05. Use a skill /storefront-feature.

Escopo (ProductCard — `shared/ui/product-card.ts`):
- Badges sobre a imagem: "-NN%" (reusar `discountPercent`), "Novo" (publicado há ≤ 14 dias; receber `now` por input para ser testável e seguro no SSR), "Esgotado" (já existe). Máximo de dois badges, com prioridade definida.
- Botão de favorito (coração) no canto superior direito, sempre visível no touch e no hover/focus no desktop; `aria-pressed`, não navega para a PDP (`stopPropagation` + `preventDefault`).
- Ação rápida "Adicionar" aparecendo no hover/focus-within no desktop (barra na base da imagem) e como botão pequeno abaixo do preço no mobile; usa `CartStore.addItem(id, 1)` e abre o mini-cart; estado "Adicionando…" e erro de estoque em tooltip/snackbar. Produtos esgotados mostram "Avise-me" desabilitado (texto "em breve").
- Estrelas + contagem a partir de `product.rating` (R3), oculto se `count === 0`.
- Variante `layout="list"`: imagem à esquerda, nome, categoria, trecho da descrição (2 linhas), preço e ações à direita.

Escopo (/products):
- Toggle grid/lista (`MatButtonToggle`, persistido em localStorage, padrão grid) e seletor "por página" (12/24/48) no `MatPaginator` (`hidePageSize=false`), refletido na URL como `per_page`.
- Substituir o paginator por "Carregar mais" + indicador "Mostrando X de Y" (manter o `MatPaginator` só como fallback sem JS? Não: SSR renderiza a primeira página com links `<a rel="next">` para `?page=2` escondidos para crawlers, e o botão "Carregar mais" acumula páginas no client via `linkedSignal`). Preservar URL com `page` ao recarregar.
- Banner de categoria quando `category` está no filtro: imagem (`image_url` do R2), nome, descrição (adicionar `description` nullable em `categories` se não existir — schema, migration, seed, docs, types) e chips das subcategorias.
- Empty state com shelf "Populares" (`sort=best_selling`, 4 itens) além do texto atual.
- Facet "Avaliação" (4+ estrelas) e "Com desconto" como checkboxes na sidebar/bottom sheet. Precisa de `min_rating=4` e `on_sale=true` em `GET /products` (SQL e Meilisearch: indexar `rating_average` e `on_sale`); documentar e tipar.
- Scroll restoration: ao voltar da PDP para a lista, restaurar a posição e a quantidade de páginas carregadas (`withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })` + estado de páginas em `history.state`).

Escopo (favoritos):
- `features/wishlist/wishlist.store.ts` (SignalStore): `ids: number[]`, `toggle(id)`, `has(id)`, `count`, persistido em localStorage (`withStorageSync` próprio, só no browser; no SSR o estado é vazio e o botão renderiza não-pressionado). Deixar um `syncWith(remote)` documentado como ponto de encaixe do PROMPT 05.
- Página `/favorites` (RenderMode.Client): grade de `ProductCard` carregando por `GET /products?ids=1,2,3` (adicionar o filtro `ids` na API; máximo 50; documentar e tipar), estado vazio com CTA, "Mover todos para o carrinho".
- Header: badge de contagem no ícone de favoritos (R1 deixou o ícone).

Testes: `product-card.spec.ts` (badges, favorito não navega, adicionar rápido); `wishlist.store.spec.ts` (toggle, persistência, SSR sem storage); `product-list.spec.ts` (carregar mais acumula, toggle de layout); API e2e para `ids`, `min_rating`, `on_sale`.

Critérios de aceite: favoritar na lista reflete na PDP e no badge do header e sobrevive a um reload; "Carregar mais" acumula resultados mantendo a URL compartilhável; `?category=perifericos` mostra o banner com subcategorias; cards em 390px têm alvo de toque ≥ 44px para favorito e adicionar; gates verdes nos dois apps; docs e tipos atualizados.
Finalize com /ship R4 "catálogo com ações rápidas + favoritos".
```
