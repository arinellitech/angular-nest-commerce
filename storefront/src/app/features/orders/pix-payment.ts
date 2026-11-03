import { Clipboard } from '@angular/cdk/clipboard';
import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Payment } from '../../core/api/types';
import { QrCode } from '../../shared/ui/qr-code';

/** "29:41", or "1:02:03" past an hour. Never negative. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Pix charge of a pending order: QR code, copy-and-paste code and the time left. */
@Component({
  selector: 'app-pix-payment',
  imports: [MatButtonModule, MatIconModule, QrCode],
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="pix-title"
      class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(6_78_59/0.18)]"
    >
      <div
        class="flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-6"
      >
        <h2 id="pix-title" class="flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <mat-icon class="text-emerald-700" aria-hidden="true">qr_code_2</mat-icon>
          Pague com Pix
        </h2>
        <p class="text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
          {{ payment().amount.formatted }}
        </p>
      </div>

      @if (expired()) {
        <div class="px-5 py-8 text-center sm:px-6" role="status">
          <mat-icon class="text-zinc-500" aria-hidden="true">timer_off</mat-icon>
          <p class="mt-2 font-semibold text-zinc-900">O código Pix expirou</p>
          <p class="mx-auto mt-1 max-w-sm text-sm text-zinc-600">
            Se você já pagou, a confirmação aparece aqui. Se não, os itens voltam para o estoque e
            você pode fazer um novo pedido.
          </p>
        </div>
      } @else {
        <div class="grid gap-6 p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:p-6">
          <app-qr-code
            [value]="code()"
            label="QR Code do Pix"
            class="mx-auto size-52 rounded-lg p-2 text-emerald-950 ring-1 ring-zinc-200 sm:mx-0"
          />

          <div class="flex min-w-0 flex-col">
            <p class="flex items-baseline gap-2 text-sm text-zinc-600">
              <mat-icon class="size-4! self-center text-base!" aria-hidden="true"
                >schedule</mat-icon
              >
              Expira em
              <span
                class="text-lg font-semibold tabular-nums"
                [class.text-zinc-900]="!endingSoon()"
                [class.text-amber-800]="endingSoon()"
                aria-hidden="true"
                >{{ remaining() }}</span
              >
              <span class="sr-only">às {{ deadline() }}</span>
            </p>

            <ol class="mt-4 space-y-1.5 text-sm text-zinc-700">
              <li>1. Abra o app do seu banco e entre na área Pix.</li>
              <li>2. Escaneie o QR Code ou cole o código copia e cola.</li>
              <li>3. Confira o valor de {{ payment().amount.formatted }} e confirme.</li>
            </ol>

            <div class="mt-5">
              <label for="pix-code" class="text-sm font-medium text-zinc-900">
                Pix copia e cola
              </label>
              <div class="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="pix-code"
                  readonly
                  [value]="code()"
                  (focus)="selectAll($event)"
                  class="h-10 w-full min-w-0 truncate rounded-md border sm:flex-1 border-zinc-300 bg-zinc-50 px-3 font-mono text-xs text-zinc-700 focus:outline-2 focus:outline-offset-0 focus:outline-emerald-700"
                />
                <button mat-flat-button type="button" class="shrink-0" (click)="copy()">
                  <mat-icon aria-hidden="true">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
                  {{ copied() ? 'Copiado' : 'Copiar código' }}
                </button>
              </div>
              <p class="sr-only" aria-live="polite">
                {{ copied() ? 'Código Pix copiado.' : '' }}
              </p>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class PixPayment {
  private readonly clipboard = inject(Clipboard);

  readonly payment = input.required<Payment>();

  /** Ticks every second in the browser; frozen at creation time on the server. */
  private readonly now = signal(Date.now());
  protected readonly copied = signal(false);

  protected readonly code = computed(() => this.payment().pix_copy_paste ?? '');
  private readonly expiresAt = computed(() => {
    const at = this.payment().expires_at;
    return at ? new Date(at).getTime() : null;
  });
  private readonly msLeft = computed(() => {
    const at = this.expiresAt();
    return at === null ? Number.POSITIVE_INFINITY : at - this.now();
  });
  protected readonly expired = computed(() => this.msLeft() <= 0);
  protected readonly endingSoon = computed(() => this.msLeft() < 5 * 60_000);
  protected readonly remaining = computed(() => {
    const ms = this.msLeft();
    return Number.isFinite(ms) ? formatRemaining(ms) : '—';
  });
  protected readonly deadline = computed(() => {
    const at = this.expiresAt();
    return at === null ? '' : clock.format(at);
  });

  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const tick = setInterval(() => this.now.set(Date.now()), 1000);
      destroyRef.onDestroy(() => clearInterval(tick));
    });
    destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
  }

  protected copy(): void {
    if (!this.clipboard.copy(this.code())) return;
    this.copied.set(true);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), 2500);
  }

  protected selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }
}
