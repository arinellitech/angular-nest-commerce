# R6 — Pós-compra e páginas institucionais

> Modelo: **Sonnet 5.5** · esforço: **medium** — timeline de status, páginas estáticas prerenderizadas e 404 melhor. Depende do PROMPT 04 para os status chegarem pelo webhook.

```
Objetivo: a página do pedido deve contar a história do pedido (timeline) e a loja precisa das páginas que todo e-commerce brasileiro tem por lei ou por costume. Use a skill /storefront-feature.

Escopo (/orders/:number):
- `order-timeline`: etapas Pedido recebido → Pagamento confirmado → Em preparação → Enviado → Entregue, com estado concluído/atual/futuro e data em cada etapa concluída (`placed_at`, `payment.confirmed_at`; as demais ficam "previsto" até o PROMPT 06 trazer `fulfilled`). Pedidos `cancelled`/`expired` mostram a timeline interrompida com o motivo. `<ol>` semântico, ícones `aria-hidden`, texto do estado para leitores de tela.
- Cartão "Entrega": endereço formatado, opção de frete e prazo estimado (R5), "Rastreio disponível após o envio".
- Ações: "Comprar novamente" (recria carrinho com os itens disponíveis via `CartStore`, avisa os que saíram do ar), "Precisa de ajuda?" (link para /ajuda com o número do pedido no fragment), "Imprimir/salvar PDF" (`window.print()` em `afterNextRender`, com `@media print` escondendo header/footer/ações).
- Estado `paid`: bloco de "Próximos passos" com e-mail de confirmação e prazo. Estado `pending_payment`: manter `pix-payment`, adicionar "Como pagar com Pix" em acordeão.

Escopo (páginas institucionais, `features/pages/`):
- Rotas: /sobre, /contato, /ajuda (FAQ com `MatExpansionPanel` e busca local), /trocas-e-devolucoes, /privacidade, /termos, /pagamentos, /entregas. `RenderMode.Prerender` em `app.routes.server.ts`; conteúdo em pt-BR dentro de componentes com template externo (`.html`) — sem Markdown runtime para não adicionar dependência. Textos realistas para uma loja fictícia (nome, CNPJ e endereço fictícios já usados no footer do R1), com aviso discreto "loja de demonstração".
- Layout comum `features/pages/static-page.ts` (título, última atualização, índice lateral no desktop a partir dos `h2`, conteúdo), breadcrumb e JSON-LD `FAQPage` em /ajuda.
- /contato: formulário (nome, e-mail, pedido opcional, mensagem) com Signal Forms enviando para `POST /contact` (API: tabela `contact_messages`, 201, `@Throttle 3/min`, e-mail para a loja via Mailpit; e2e). Documentar e tipar.
- Ligar todos os links do footer (R1) e do checkout (R5) a estas rotas; remover os placeholders `#`.

Escopo (erros):
- 404: busca (reusa `header-search` em modo página), links para categorias e shelf "Populares"; manter `status: 404` no SSR.
- Página de erro genérica (`/erro`) usada pelo `ErrorHandler` global para falhas não tratadas em navegação, com "Tentar novamente" e "Ir para a home"; logar no console no browser.

Testes: `order-timeline.spec.ts` (mapeamento de status → etapas, cancelado); `static-page.spec.ts` (índice gerado dos h2); `contact-form.spec.ts`; API e2e de `POST /contact`; `app.routes.server.ts` com entradas de prerender para todas as rotas novas.

Critérios de aceite: pedido pago mostra duas etapas concluídas com datas; pedido cancelado mostra timeline interrompida; `npm run build` gera HTML estático para as 8 páginas institucionais; /contato envia e o e-mail aparece no Mailpit; nenhum link do footer aponta para "#"; axe sem violações serious/critical em /ajuda e /orders/:number; gates verdes nos dois apps.
Finalize com /ship R6 "timeline do pedido + páginas institucionais + 404".
```
