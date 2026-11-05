# R5 — Carrinho e checkout de loja profissional

> Modelo: **Opus 5.5** · esforço: **high** — fluxo de dinheiro; altera layout do checkout e o stepper existente. Não tocar na idempotência nem na reserva de estoque.

```
Objetivo: aumentar ticket médio e conversão no carrinho e reduzir abandono no checkout com os padrões que lojas grandes usam, mantendo o contrato do checkout intacto. Use a skill /storefront-feature; mudanças pequenas de API via /api-feature.

Escopo (API):
- `CartResource` ganha `free_shipping: { threshold: Money, remaining: Money, reached: boolean }` calculado a partir de `SHIPPING_FREE_THRESHOLD_CENTS` (R3) e do subtotal com desconto. Documentar e tipar.
- `GET /cart/suggestions?limit=4`: produtos publicados em estoque, das categorias dos itens do carrinho, excluindo os já presentes; fallback `best_selling`. Documentar e tipar.
- `POST /cart/shipping {postal_code}` grava o CEP no carrinho e o `shipping` dos totais passa a vir do `ShippingCalculator` (R3) para aquele CEP; sem CEP, mantém a opção padrão. Checkout pré-preenche o CEP do carrinho. Documentar e tipar; e2e: totais mudam após informar CEP de outra região.

Escopo (/cart):
- Barra de progresso para frete grátis no topo da lista: "Faltam R$ 42,00 para frete grátis" → "Você ganhou frete grátis!" (`role="progressbar"` com `aria-valuenow`, animação de largura respeitando reduced motion).
- Remover com desfazer: ao remover, snackbar "Item removido · Desfazer" por 6s; o `CartStore` mantém o último item removido e recoloca com `addItem` ao desfazer.
- "Salvar para depois": move o item para favoritos (R4) e remove do carrinho; link inverso nos favoritos já existe ("Mover para o carrinho").
- `shipping-estimator` (R3) no resumo, com o CEP lembrado; ao calcular chama `POST /cart/shipping` e os totais atualizam.
- Shelf "Complete seu pedido" com `GET /cart/suggestions` abaixo da lista (reusar `product-shelf`, cards com adicionar rápido).
- Resumo: linha "no Pix: R$ X" em destaque, cupom em `MatExpansionPanel` fechado por padrão ("Tem um cupom?"), selos de pagamento/segurança abaixo do botão.
- Mobile: resumo fixo no rodapé com total + "Finalizar compra" (expande para ver as linhas), lista rola acima.

Escopo (/checkout):
- Layout próprio: duas colunas no desktop (formulário à esquerda, resumo à direita, sticky) e no mobile um "Resumo do pedido · R$ X" colapsável no topo com miniaturas, quantidades e totais; header reduzido do R1.
- Passo 0 "Identificação": "Já tem conta? Entrar" (link para /login, placeholder até o PROMPT 05) ou "Continuar como convidado" com e-mail; ao avançar o e-mail entra no formulário de dados. Com o 05 no lugar, usuários logados pulam este passo.
- Máscaras ao digitar em CPF (000.000.000-00), telefone ((00) 00000-0000) e CEP (00000-000) com diretiva própria em `shared/forms/mask.ts` que grava o valor sem máscara no form (Signal Forms); testes da diretiva.
- Pagamento: Pix selecionado e expandido com explicação de "QR Code na próxima tela, válido por 30 min"; Cartão e Boleto como opções desabilitadas com rótulo "Em breve" (não remover do DOM: mostra que é uma loja). `payment_method` continua `pix`.
- Revisão: cada bloco com "Alterar" (já existe), itens com miniatura, totais, CEP e prazo estimado da opção de frete escolhida; checkbox "Li e aceito os Termos e a Política de privacidade" obrigatório (links para as páginas do R6).
- Confiança: rodapé do checkout com cadeado "Ambiente seguro", CNPJ fictício e links de privacidade/trocas; nenhum link para o catálogo além do logo.
- Erros: 422 do checkout continuam mapeados por campo; erro de estoque no checkout mostra qual item e botão "Voltar ao carrinho" com o item destacado (`fragment` na URL + `scrollIntoView`).

Testes: `free-shipping-bar.spec.ts`; `mask.directive.spec.ts`; `cart.store.spec.ts` (desfazer remoção); `checkout-page.spec.ts` (passo de identificação, termos obrigatórios, opções desabilitadas); API e2e novos.

Critérios de aceite: carrinho de R$ 150 com limite de R$ 199 mostra "Faltam R$ 49,00"; remover e desfazer devolve o item com a mesma quantidade; informar CEP no carrinho muda o frete e o mesmo valor aparece no checkout e no pedido criado; checkout em 390px mostra resumo colapsado e header reduzido; reenviar o mesmo Idempotency-Key continua devolvendo o mesmo pedido (teste existente verde); gates verdes; docs e tipos atualizados.
Finalize com /ship R5 "carrinho com frete grátis e cross-sell + checkout de loja".
```
