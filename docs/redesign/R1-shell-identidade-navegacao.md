# R1 — Shell da loja: identidade, menu mobile, mini-cart e footer

> Modelo: **Opus 5.5** · esforço: **high** — muda o layout de todas as páginas, o tema Material e o header renderizado no servidor.

```
Objetivo: transformar o shell do storefront (header, footer, tema) em um shell de loja profissional, sem quebrar SSR, cache na borda nem os testes existentes. Use a skill /storefront-feature.

Escopo (tema e identidade):
- Substituir as ~60 variáveis `--mat-sys-*` sobrescritas à mão em `styles.css` por um tema gerado com `@use '@angular/material' as mat;` + `mat.theme((color: (primary: <paleta emerald>, theme-type: light), typography: 'Inter Variable', density: 0))` em um `styles.scss` (trocar o `styles` do angular.json). Manter o visual atual (emerald + zinc). Dark mode fica para o R7, mas deixe o tema em `color-scheme: light` explícito.
- Logo em SVG inline (componente `shared/ui/brand-logo`, marca "Loja Demo" com um símbolo simples), `favicon.svg` + `apple-touch-icon`, `<meta name="theme-color">`.
- Tokens Tailwind para a marca em `@theme` (`--color-brand-*`) e usar nas classes em vez de `emerald-700` espalhado; manter a paleta igual.

Escopo (header):
- Barra de anúncio fina acima do header (texto configurável em `environment.ts`, ex.: "Frete grátis acima de R$ 199 · Pix com 5% off"), fechável com persistência em localStorage (só no browser).
- Menu mobile: botão hambúrguer (`< md`) abre `MatSidenav` (ou `MatBottomSheet`) com: busca, categorias e subcategorias (`Category.children`, expansível com `MatExpansionPanel`), "Minha conta" (link para /login, placeholder até o PROMPT 05), "Favoritos" (link para /favorites, placeholder até o R4), "Ajuda". Fecha ao navegar; foco volta para o botão.
- Desktop: nav de categorias com dropdown por categoria mostrando as subcategorias em colunas (`MatMenu` ou painel próprio com `cdkOverlay`), acessível por teclado (setas, Esc).
- Ícones à direita: favoritos (badge com contagem, 0 oculto), conta, carrinho. Todos com `aria-label` descritivo.
- Header do checkout: em `/checkout` o header mostra só logo + "Compra segura" (ícone `lock`) + link "Voltar ao carrinho"; sem busca nem categorias. Decida via rota (`data: { layout: 'checkout' }`) lida pelo `Header` com `toSignal(router.events)` ou `inject(ActivatedRoute)` no `App`.

Escopo (mini-cart):
- `features/cart/mini-cart.ts`: `MatSidenav` lateral (direita) ou `MatDialog` posicionado à direita, aberto pelo `CartStore` após `addItem` com sucesso (substitui o snackbar da PDP) e pelo clique no ícone do carrinho quando `count() > 0` (clique com carrinho vazio vai para /cart). Conteúdo: lista com miniatura, nome, quantidade (stepper), remover, subtotal, "Ver carrinho" e "Finalizar compra". Fecha com Esc/overlay; foco gerenciado (`cdkTrapFocus`).
- Estado `miniCartOpen` no `CartStore`; o `addItem` continua retornando `{ ok, error }`.

Escopo (footer):
- Footer de loja em 4 colunas no desktop (acordeão `MatExpansionPanel` no mobile): Institucional (Sobre, Trabalhe conosco, Blog — links para páginas que o R6 cria; até lá apontam para "#" com `aria-disabled`), Ajuda (FAQ, Trocas e devoluções, Prazos de entrega, Contato), Pagamento (ícones SVG inline de Pix, Visa, Mastercard, Boleto — os dois últimos com "em breve"), Redes/Newsletter (campo de e-mail com Signal Forms, só validação visual; o envio real é do R2).
- Linha final: CNPJ fictício, endereço fictício, "Pagamentos em ambiente de teste", links de Privacidade e Termos.

Testes:
- `header.spec.ts`: menu mobile abre/fecha e lista categorias; header do checkout não renderiza busca nem categorias.
- `mini-cart.spec.ts`: abre após `addItem` com sucesso, lista itens, "Finalizar compra" navega para /checkout.
- Atualizar `product-page` specs (snackbar → mini-cart).

Critérios de aceite: em 390px o header tem hambúrguer, logo, carrinho; o menu lista categorias com subcategorias; adicionar na PDP abre o mini-cart com o item; /checkout mostra o header reduzido; HTML do servidor da home continua sem dados do carrinho e com `cache-control: public, s-maxage=300`; `styles.css` não tem mais overrides manuais de `--mat-sys-*`; gates verdes; axe sem violações serious/critical em / e /products.
Finalize com /ship R1 "shell da loja: tema, menu mobile, mini-cart, footer".
```
