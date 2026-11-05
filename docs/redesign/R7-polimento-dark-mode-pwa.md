# R7 — Polimento: dark mode, transições, PWA e Lighthouse

> Modelo: **Sonnet 5.5** · esforço: **high** — afinação transversal. Suba para **Opus 5.5 · high** se o Lighthouse não atingir a meta depois de duas tentativas.

```
Objetivo: fechar o redesign com os detalhes que fazem a loja parecer acabada: dark mode, transições de página, PWA instalável e desempenho medido. Nada de funcionalidade nova. Use a skill /storefront-feature.

Escopo (tema):
- Dark mode no tema `mat.theme()` do R1 com `theme-type: color-scheme` e `color-scheme: light dark` no `html`; tokens Tailwind da marca com variantes para `dark:` via `@variant dark (&:where([data-theme=dark], [data-theme=dark] *))` e `prefers-color-scheme` como padrão. Toggle no menu de conta/mobile (sol/lua) persistido em localStorage e aplicado antes da hidratação por um `<script>` inline mínimo no `index.html` para não piscar. Revisar todas as páginas: imagens de produto com `mix-blend-multiply` precisam de fundo claro próprio no dark (`bg-white rounded`), badges, skeletons, bordas, snackbar, QR do Pix (manter fundo branco).
- Contraste: rodar axe nos dois temas; corrigir qualquer texto abaixo de AA.

Escopo (movimento):
- `withViewTransitions()` no router com `onViewTransitionCreated` pulando a transição em `prefers-reduced-motion`; `view-transition-name` na imagem do `ProductCard` → imagem principal da PDP (nome por slug) para o efeito de "a imagem voa para a página".
- Micro-interações: badge do carrinho pulsa ao incrementar; estrelas preenchem no hover das avaliações; transição de altura no acordeão do resumo mobile. Todas via CSS/`@starting-style`, nenhuma biblioteca.
- Botão "Voltar ao topo" após 2 telas de rolagem (só browser).

Escopo (PWA e metadados):
- `manifest.webmanifest` (nome, ícones 192/512 maskable gerados do SVG do R1, `theme_color`, `background_color`, `display: standalone`, `start_url: /`), link no `index.html`. Sem service worker (SSR + cache na borda já cobrem; registrar isso em comentário).
- `robots.txt` e `sitemap.xml` servidos pelo `server.ts`: sitemap gerado em runtime a partir de `GET /products?per_page=100` paginado + categorias + páginas institucionais, com cache em memória de 1h. `Disallow` para /cart, /checkout, /orders, /favorites.
- OG/Twitter completos em catálogo (`/products?category=`), PDP (já tem) e institucionais; `canonical` em todas as páginas SSR removendo query params de ordenação/página.

Escopo (desempenho):
- Script `npm run lighthouse` (`@lhci/cli` ou `lighthouse` via Playwright/Chromium já instalado) contra `ng serve --configuration production` em /, /products e uma PDP, mobile emulado. Metas: Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO 100. Registrar os números em `docs/redesign/lighthouse.md`.
- Corrigir o que aparecer: `@defer` em shelves abaixo da dobra, `sizes` corretos, fontes com `font-display: swap` e subset, remover CSS do Material não usado, `preconnect` só para hosts realmente usados, imagens do seed em WebP/AVIF se o host suportar parâmetros.
- Orçamento no `angular.json` (`budgets`): initial ≤ 450 kB, por componente lazy ≤ 120 kB; o build falha acima disso.

Testes: `theme.store.spec.ts` (toggle, persistência, SSR sem storage); spec do sitemap (rotas listadas, `Disallow`); atualizar specs afetados pelo dark mode (nenhuma lógica nova além do store).

Critérios de aceite: alternar o tema não pisca ao recarregar e todas as páginas ficam legíveis no dark; navegar card → PDP anima a imagem (e não anima com reduced motion); `/manifest.webmanifest`, `/robots.txt` e `/sitemap.xml` respondem 200 com conteúdo correto; Lighthouse mobile atinge as metas nas três páginas e os números estão em `docs/redesign/lighthouse.md`; `npm run build` respeita os budgets; gates verdes.
Finalize com /ship R7 "dark mode + view transitions + pwa + lighthouse".
```
