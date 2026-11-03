import { email, minLength, required, schema, validate } from '@angular/forms/signals';
import type { CheckoutPayload } from '../../core/api/types';
import { isValidCep, isValidCpf, isValidPhone, onlyDigits } from '../../shared/br-documents';

/**
 * What the customer types. The address is split the way Brazilian forms are
 * (street / number / neighborhood) and folded into the API's line1/line2 on
 * submit.
 */
export interface CheckoutModel {
  customer: { name: string; email: string; document: string; phone: string };
  address: {
    postal_code: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
}

export function emptyCheckout(): CheckoutModel {
  return {
    customer: { name: '', email: '', document: '', phone: '' },
    address: {
      postal_code: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
    },
  };
}

/** Client-side rules; the API applies the same ones and answers 422 if they slip through. */
export const checkoutSchema = schema<CheckoutModel>((path) => {
  required(path.customer.name, { message: 'Informe seu nome completo.' });
  minLength(path.customer.name, 3, { message: 'Informe seu nome completo.' });
  required(path.customer.email, { message: 'Informe seu e-mail.' });
  email(path.customer.email, { message: 'Confira o e-mail: falta algo como @ ou o domínio.' });
  required(path.customer.document, { message: 'Informe seu CPF.' });
  validate(path.customer.document, ({ value }) =>
    value() && !isValidCpf(value())
      ? { kind: 'cpf', message: 'CPF inválido. Confira os números.' }
      : null,
  );
  required(path.customer.phone, { message: 'Informe um telefone.' });
  validate(path.customer.phone, ({ value }) =>
    value() && !isValidPhone(value())
      ? { kind: 'phone', message: 'Informe o telefone com DDD.' }
      : null,
  );

  required(path.address.postal_code, { message: 'Informe o CEP.' });
  validate(path.address.postal_code, ({ value }) =>
    value() && !isValidCep(value()) ? { kind: 'cep', message: 'O CEP tem 8 dígitos.' } : null,
  );
  required(path.address.street, { message: 'Informe a rua.' });
  required(path.address.number, { message: 'Informe o número.' });
  required(path.address.neighborhood, { message: 'Informe o bairro.' });
  required(path.address.city, { message: 'Informe a cidade.' });
  required(path.address.state, { message: 'Escolha o estado.' });
});

export function toCheckoutPayload(model: CheckoutModel): CheckoutPayload {
  const { customer, address } = model;
  const line2 = [address.complement.trim(), address.neighborhood.trim()]
    .filter(Boolean)
    .join(' — ');
  return {
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      document: onlyDigits(customer.document),
      phone: onlyDigits(customer.phone),
    },
    shipping_address: {
      line1: `${address.street.trim()}, ${address.number.trim()}`,
      ...(line2 ? { line2 } : {}),
      city: address.city.trim(),
      state: address.state,
      postal_code: onlyDigits(address.postal_code),
      country: 'BR',
    },
    payment_method: 'pix',
  };
}

/** Form fields an API 422 can point at. */
export type CheckoutFieldPath =
  `customer.${keyof CheckoutModel['customer']}` | `address.${keyof CheckoutModel['address']}`;

const API_FIELDS: Record<string, CheckoutFieldPath> = {
  'customer.name': 'customer.name',
  'customer.email': 'customer.email',
  'customer.document': 'customer.document',
  'customer.phone': 'customer.phone',
  'shipping_address.line1': 'address.street',
  'shipping_address.line2': 'address.complement',
  'shipping_address.city': 'address.city',
  'shipping_address.state': 'address.state',
  'shipping_address.postal_code': 'address.postal_code',
};

/** Splits a 422 `errors` map into messages for form fields and messages for the page. */
export function mapCheckoutErrors(errors: Record<string, string>): {
  fields: { path: CheckoutFieldPath; message: string }[];
  general: string[];
} {
  const fields: { path: CheckoutFieldPath; message: string }[] = [];
  const general: string[] = [];
  for (const [apiField, message] of Object.entries(errors)) {
    const path = API_FIELDS[apiField];
    if (path) fields.push({ path, message });
    else general.push(message);
  }
  return { fields, general };
}
