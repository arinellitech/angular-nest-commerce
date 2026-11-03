import { httpResource } from '@angular/common/http';

/** https://viacep.com.br — `erro` comes back (as `true` or `"true"`) for an unknown CEP. */
export interface ViaCepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean | 'true';
}

/**
 * Address lookup by CEP. Idle until `cep` yields 8 digits. Talks to ViaCEP
 * directly (CORS-enabled); the API interceptor leaves foreign hosts alone, so
 * the cart token never leaves for a third party. Call in an injection context.
 */
export function viaCepResource(cep: () => string | undefined) {
  return httpResource<ViaCepAddress>(() => {
    const digits = cep();
    return digits && /^\d{8}$/.test(digits)
      ? `https://viacep.com.br/ws/${digits}/json/`
      : undefined;
  });
}

export function isViaCepMiss(address: ViaCepAddress): boolean {
  return address.erro === true || address.erro === 'true';
}
