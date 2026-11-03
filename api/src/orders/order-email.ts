import type { MailMessage } from '../mail/mailer.js';
import { STORE_TIME_ZONE } from './order-number.js';
import type { OrderResource } from './orders.mappers.js';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: STORE_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SummaryRow {
  label: string;
  value: string;
  strong?: boolean;
}

function summaryRows(order: OrderResource): SummaryRow[] {
  const rows: SummaryRow[] = [
    { label: 'Subtotal', value: order.subtotal.formatted },
  ];
  if (order.discount.amount > 0)
    rows.push({
      label: order.coupon ? `Desconto (${order.coupon.code})` : 'Desconto',
      value: `- ${order.discount.formatted}`,
    });
  rows.push({
    label: 'Frete',
    value: order.shipping.amount === 0 ? 'Grátis' : order.shipping.formatted,
  });
  rows.push({ label: 'Total', value: order.total.formatted, strong: true });
  return rows;
}

/** "Recebemos seu pedido" e-mail: summary, Pix code and the signed order link. */
export function renderOrderPlacedEmail(
  order: OrderResource,
  orderUrl: string,
): Omit<MailMessage, 'to'> {
  const firstName = order.customer.name.trim().split(/\s+/)[0] ?? '';
  const pix =
    order.payment?.method === 'pix' ? order.payment.pix_copy_paste : null;
  const expiresAt = order.payment?.expires_at
    ? dateTime.format(new Date(order.payment.expires_at))
    : null;
  const rows = summaryRows(order);

  const text = [
    `Olá, ${firstName}!`,
    '',
    `Recebemos seu pedido ${order.number}.`,
    '',
    ...order.items.map(
      (item) => `- ${item.quantity} × ${item.name}: ${item.total.formatted}`,
    ),
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    ...(pix
      ? [
          expiresAt
            ? `Pague com Pix até ${expiresAt} (horário de Brasília). Código copia e cola:`
            : 'Pague com Pix. Código copia e cola:',
          pix,
          '',
        ]
      : []),
    `Acompanhe seu pedido: ${orderUrl}`,
  ].join('\n');

  const cell = 'padding:6px 0;border-bottom:1px solid #e5e7eb';
  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <p style="margin:0 0 8px">Olá, ${escapeHtml(firstName)}!</p>
    <h1 style="margin:0 0 24px;font-size:20px">Recebemos seu pedido ${escapeHtml(order.number)}</h1>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
      ${order.items
        .map(
          (item) =>
            `<tr><td style="${cell}">${item.quantity} × ${escapeHtml(item.name)}</td><td style="${cell};text-align:right">${escapeHtml(item.total.formatted)}</td></tr>`,
        )
        .join('\n      ')}
      ${rows
        .map((row) => {
          const style = row.strong
            ? 'padding:8px 0;font-weight:700'
            : 'padding:4px 0;color:#475569';
          return `<tr><td style="${style}">${escapeHtml(row.label)}</td><td style="${style};text-align:right">${escapeHtml(row.value)}</td></tr>`;
        })
        .join('\n      ')}
    </table>
    ${
      pix
        ? `<h2 style="margin:24px 0 8px;font-size:16px">Pague com Pix</h2>
    ${expiresAt ? `<p style="margin:0 0 8px;font-size:14px;color:#475569">Válido até ${escapeHtml(expiresAt)} (horário de Brasília).</p>` : ''}
    <p style="margin:0;padding:12px;background:#f1f5f9;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all">${escapeHtml(pix)}</p>`
        : ''
    }
    <p style="margin:32px 0 0">
      <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:12px 20px;background:#047857;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Acompanhar pedido</a>
    </p>
  </div>
</body>
</html>`;

  return {
    subject: `Pedido ${order.number} recebido`,
    text,
    html,
  };
}
