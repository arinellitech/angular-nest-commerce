import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import {
  checkoutSchema,
  emptyCheckout,
  mapCheckoutErrors,
  toCheckoutPayload,
  type CheckoutModel,
} from './checkout-form';

function filled(): CheckoutModel {
  return {
    customer: {
      name: 'Ana Souza',
      email: 'ana@example.com',
      document: '529.982.247-25',
      phone: '(11) 98765-4321',
    },
    address: {
      postal_code: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 12',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
  };
}

describe('checkout form', () => {
  const build = (value: CheckoutModel) =>
    form(signal(value), checkoutSchema, { injector: TestBed.inject(Injector) });

  it('accepts a complete Brazilian address and customer', () => {
    expect(build(filled())().valid()).toBe(true);
  });

  it('explains each missing or malformed field', () => {
    const empty = build(emptyCheckout());
    expect(empty.customer.name().errors()[0]?.message).toBe('Informe seu nome completo.');
    expect(empty.address.state().errors()[0]?.message).toBe('Escolha o estado.');

    const model = filled();
    model.customer.document = '529.982.247-24';
    model.customer.phone = '98765-4321';
    model.customer.email = 'ana@';
    model.address.postal_code = '01310-10';
    const wrong = build(model);
    expect(wrong.customer.document().errors()[0]?.message).toBe(
      'CPF inválido. Confira os números.',
    );
    expect(wrong.customer.phone().errors()[0]?.message).toBe('Informe o telefone com DDD.');
    expect(wrong.customer.email().invalid()).toBe(true);
    expect(wrong.address.postal_code().errors()[0]?.message).toBe('O CEP tem 8 dígitos.');
  });

  it('folds the address into line1/line2 and strips punctuation', () => {
    expect(toCheckoutPayload(filled())).toEqual({
      customer: {
        name: 'Ana Souza',
        email: 'ana@example.com',
        document: '52998224725',
        phone: '11987654321',
      },
      shipping_address: {
        line1: 'Avenida Paulista, 1000',
        line2: 'Apto 12 — Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        postal_code: '01310100',
        country: 'BR',
      },
      payment_method: 'pix',
    });

    const noComplement = filled();
    noComplement.address.complement = '  ';
    expect(toCheckoutPayload(noComplement).shipping_address.line2).toBe('Bela Vista');
  });

  it('routes API errors to fields, and the rest to the page', () => {
    expect(
      mapCheckoutErrors({
        'customer.document': 'CPF inválido.',
        'shipping_address.line1': 'Informe o endereço.',
        payment_method: 'Forma de pagamento indisponível.',
      }),
    ).toEqual({
      fields: [
        { path: 'customer.document', message: 'CPF inválido.' },
        { path: 'address.street', message: 'Informe o endereço.' },
      ],
      general: ['Forma de pagamento indisponível.'],
    });
  });
});
