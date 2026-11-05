# Redesign do storefront — de "demo técnica" para loja profissional

Sequência de prompts para o Claude Code focada só em **UI/UX do storefront**. Complementa o `PROMPTS.md` da raiz: mesma convenção (**Objetivo → Escopo → Critérios de aceite**, um `/ship` por prompt) e mesmas regras (`CLAUDE.md`, `storefront/CLAUDE.md`, `.claude/rules/*`).

## Diagnóstico (novembro/2026, após o PROMPT 03)

O que já está bom e **não** deve ser refeito: SSR com cache na borda, skeletons e estados de erro/vazio em todas as páginas, facets e chips no catálogo, Signal Forms no checkout, JSON-LD na PDP, `PriceTag` com compare-at, acessibilidade básica (labels, `aria-*`, foco visível).

O que falta para parecer uma loja de verdade:

| Área | Problema hoje | Resolvido em |
| --- | --- | --- |
| Navegação mobile | Categorias somem abaixo de `md`; não há menu, conta nem favoritos no header | R1 |
| Identidade | Logo em texto, tema Material sobrescrito à mão (~60 variáveis), sem dark mode | R1, R7 |
| Adição ao carrinho | Só um snackbar; sem mini-cart | R1 |
| Footer | Duas linhas de texto; sem institucional, pagamento, ajuda | R1 |
| Home | Hero fala de "webhooks idempotentes"; cards de categoria sem imagem; só "Novidades" | R2 |
| Imagens | `picsum.photos` deixa tudo com cara de placeholder | R2 |
| PDP | Ignora `specs`; sem frete por CEP, relacionados, zoom, selos, sticky mobile | R3 |
| Catálogo | Sem ações rápidas no card, badges, grid/lista, banner de categoria | R4 |
| Favoritos | Não existe | R4 |
| Carrinho | Sem barra de frete grátis, cross-sell, desfazer remoção | R5 |
| Checkout | Header completo distrai; cartão/boleto ausentes em vez de "em breve"; sem máscaras | R5 |
| Pós-compra | Status é um chip; sem timeline, "comprar novamente" | R6 |
| Institucional | Nenhuma página (sobre, trocas, privacidade, FAQ, contato) | R6 |
| Polimento | Sem view transitions, PWA, dark mode, scroll restoration | R7 |

## Ordem e modelo/esforço

| # | Prompt | Modelo | Esforço | Por quê |
| --- | --- | --- | --- | --- |
| R1 | [Shell da loja: identidade, menu mobile, mini-cart, footer](R1-shell-identidade-navegacao.md) | **Opus 5.5** | **high** | Toca o layout de todas as páginas, tema Material e SSR do header; erros aqui se espalham |
| R2 | [Home como vitrine + imagens reais no seed](R2-home-vitrine.md) | **Sonnet 5.5** | **high** | Muito markup, pouca lógica; inclui ajuste de seed na API |
| R3 | [PDP completa](R3-pdp-completa.md) | **Opus 5.5** | **high** | Galeria, frete por CEP, relacionados, sticky bar, SSR + hidratação parcial |
| R4 | [Catálogo e favoritos](R4-catalogo-e-favoritos.md) | **Sonnet 5.5** | **high** | Cards, badges, SignalStore de wishlist com persistência local |
| R5 | [Carrinho e checkout](R5-carrinho-e-checkout.md) | **Opus 5.5** | **high** | Fluxo de dinheiro; layout de checkout próprio e mudanças no stepper |
| R6 | [Pós-compra e páginas institucionais](R6-pos-compra-e-institucional.md) | **Sonnet 5.5** | **medium** | Timeline de status, páginas estáticas prerenderizadas, 404 |
| R7 | [Polimento: dark mode, transições, PWA, Lighthouse](R7-polimento-dark-mode-pwa.md) | **Sonnet 5.5** | **high** | Afinação transversal; subir para Opus high se o Lighthouse travar abaixo da meta |

Troque o modelo com `/model` antes de colar cada prompt (padrão global: Opus 5.5 em `high`).

## Onde encaixar no `PROMPTS.md`

Recomendado: **depois do PROMPT 04** (pagamentos/webhooks) e **antes do PROMPT 05** (auth).

- R6 precisa dos status `paid`/`cancelled`/`expired` chegando pelo webhook para a timeline fazer sentido.
- R1 e R4 deixam os pontos de encaixe prontos para o 05 (ícone de conta no header, wishlist local que será sincronizada com o usuário).
- Nada aqui depende do admin (06) nem do storage (08); R2 troca as imagens do seed por URLs públicas estáveis e o 06/08 só muda a origem.

Se preferir não interromper a sequência principal, rode R1 → R7 inteiros após o PROMPT 05 e, no R1, implemente o menu de conta já ligado ao `AuthStore`.

## Regras que valem para todos os prompts

- Angular Material 22 + Tailwind 4, nada de outra lib de UI ou de carrossel. Animações com CSS/`@angular/animations` não; use transições CSS e View Transitions quando indicado.
- Toda página nova: entrada em `app.routes.ts` (lazy, com `title`) **e** em `app.routes.server.ts`.
- Textos de UI em pt-BR, código em inglês. Sem `TODO`.
- Cada elemento novo precisa funcionar com teclado e passar no axe (`zero violações serious/critical`). Em dúvida, prefira o componente Material ao HTML customizado.
- Imagens sempre com `NgOptimizedImage`, `width`/`height`/`sizes`, e `priority` só no LCP.
- Não alterar o contrato da API sem atualizar `api/docs/api.md` **e** `storefront/src/app/core/api/types.ts` no mesmo commit.
- Ao terminar: `/ship R<n> "<resumo>"` (gates verdes, linha em `.claude/progress.md`, commit convencional). Não faça push sem pedir.

## Prompts utilitários durante o redesign

- `Tire screenshots (Playwright, 390px e 1280px) de /, /products, /products/<slug>, /cart e /checkout e me mostre.` — para revisar visualmente antes do `/ship`.
- `Rode o axe (@axe-core/playwright) na home, PDP e checkout e liste as violações.`
- `Compare o header e o footer com o de uma loja grande (Amazon, Mercado Livre, Kabum) e me diga o que ainda falta.`
