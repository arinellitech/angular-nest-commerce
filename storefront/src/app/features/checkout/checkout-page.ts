import { BreakpointObserver } from '@angular/cdk/layout';
import type { StepperOrientation } from '@angular/cdk/stepper';
import {
  Component,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form, submit, type FieldTree } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { map } from 'rxjs';
import type { Order } from '../../core/api/types';
import { isViaCepMiss, viaCepResource } from '../../core/api/viacep.api';
import { BRAZILIAN_STATES, onlyDigits } from '../../shared/br-documents';
import { CartStore } from '../cart/cart.store';
import {
  checkoutSchema,
  emptyCheckout,
  mapCheckoutErrors,
  toCheckoutPayload,
  type CheckoutFieldPath,
} from './checkout-form';
import { CheckoutStore } from './checkout.store';
import { CheckoutSummary } from './checkout-summary';

/** Client-rendered (cart cookie, see app.routes.server.ts). */
@Component({
  selector: 'app-checkout-page',
  imports: [
    RouterLink,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatStepperModule,
    CheckoutSummary,
  ],
  providers: [
    CheckoutStore,
    // Bordered fields, like the rest of the storefront's inputs (cart coupon, search).
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
  ],
  templateUrl: './checkout-page.html',
})
export class CheckoutPage {
  protected readonly cart = inject(CartStore);
  protected readonly checkout = inject(CheckoutStore);
  private readonly router = inject(Router);

  protected readonly states = BRAZILIAN_STATES;
  protected readonly stepper = viewChild(MatStepper);

  protected readonly orientation = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 768px)')
      .pipe(map(({ matches }): StepperOrientation => (matches ? 'horizontal' : 'vertical'))),
    { initialValue: 'vertical' as StepperOrientation },
  );

  protected readonly model = signal(emptyCheckout());
  protected readonly form = form(this.model, checkoutSchema);

  protected readonly detailsValid = computed(
    () => this.form.customer().valid() && this.form.address().valid(),
  );
  /** Why recovering the previous attempt failed (shown with its retry button). */
  protected readonly recoveryMessage = computed(() => {
    const problem = this.checkout.problem();
    return problem && 'message' in problem ? problem.message : '';
  });
  /** Messages from a 422 that do not belong to a field (e.g. payment method). */
  protected readonly generalErrors = signal<string[]>([]);

  // ViaCEP fills street, neighborhood, city and state as soon as the CEP is complete.
  private readonly cepDigits = computed(() => onlyDigits(this.model().address.postal_code));
  protected readonly cepLookup = viaCepResource(this.cepDigits);
  protected readonly cepHint = computed(() => {
    if (this.cepLookup.isLoading()) return 'Buscando endereço…';
    if (this.cepLookup.error())
      return 'Não conseguimos buscar o CEP agora. Preencha o endereço abaixo.';
    const found = this.cepLookup.value();
    if (found && isViaCepMiss(found))
      return 'CEP não encontrado. Confira os números ou preencha o endereço.';
    return '';
  });

  constructor() {
    afterNextRender(async () => {
      // Stock and prices may have moved since the cart page: revalidate on entry.
      await this.cart.refresh();
      // A reload after an unanswered attempt: get that order back instead of the form.
      const recovered = await this.checkout.resume();
      if (recovered?.ok) await this.openOrder(recovered.order, false);
    });

    effect(() => {
      const found = this.cepLookup.value();
      if (!found || isViaCepMiss(found)) return;
      untracked(() =>
        this.model.update((m) => ({
          ...m,
          address: {
            ...m.address,
            street: found.logradouro || m.address.street,
            neighborhood: found.bairro || m.address.neighborhood,
            city: found.localidade || m.address.city,
            state: found.uf || m.address.state,
          },
        })),
      );
    });
  }

  /** Step 1 → 2: show every problem of the step at once and focus the first one. */
  protected continueFromDetails(): void {
    this.form.customer().markAsTouched();
    this.form.address().markAsTouched();
    if (this.detailsValid()) {
      this.stepper()?.next();
      return;
    }
    const first = [
      ...this.form.customer().errorSummary(),
      ...this.form.address().errorSummary(),
    ][0];
    first?.fieldTree().focusBoundControl();
  }

  protected editStep(index: number): void {
    const stepper = this.stepper();
    if (stepper) stepper.selectedIndex = index;
  }

  protected placeOrder(): void {
    this.generalErrors.set([]);
    void submit(this.form, {
      action: async () => {
        const totalShown = this.cart.cart()?.total.amount;
        const result = await this.checkout.place(toCheckoutPayload(this.model()));
        if (result.ok) {
          await this.openOrder(result.order, totalShown !== result.order.total.amount);
          return undefined;
        }
        if (result.problem.kind !== 'fields') return undefined;

        // Back to the data step with the API's messages on the fields.
        const { fields, general } = mapCheckoutErrors(result.problem.errors);
        this.generalErrors.set(general);
        if (fields.length === 0) return undefined;
        this.editStep(0);
        return fields.map(({ path, message }) => ({
          kind: 'server',
          message,
          fieldTree: this.field(path),
        }));
      },
      onInvalid: () => this.editStep(0),
    });
  }

  /** Retry button of the recovery state (cart already converted). */
  protected async retryRecovery(): Promise<void> {
    const recovered = await this.checkout.resume();
    if (recovered?.ok) await this.openOrder(recovered.order, false);
  }

  private openOrder(order: Order, totalChanged: boolean): Promise<boolean> {
    return this.router.navigate(['/orders', order.number], {
      queryParams: { token: order.access_token },
      state: { placed: true, totalChanged },
      replaceUrl: true,
    });
  }

  private field(path: CheckoutFieldPath): FieldTree<string> {
    const { customer, address } = this.form;
    switch (path) {
      case 'customer.name':
        return customer.name;
      case 'customer.email':
        return customer.email;
      case 'customer.document':
        return customer.document;
      case 'customer.phone':
        return customer.phone;
      case 'address.postal_code':
        return address.postal_code;
      case 'address.street':
        return address.street;
      case 'address.number':
        return address.number;
      case 'address.complement':
        return address.complement;
      case 'address.neighborhood':
        return address.neighborhood;
      case 'address.city':
        return address.city;
      case 'address.state':
        return address.state;
    }
  }
}
