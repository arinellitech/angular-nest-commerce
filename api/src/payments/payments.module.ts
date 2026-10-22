import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { MockGateway } from './mock.gateway.js';
import { PaymentGateway } from './payment-gateway.js';

/**
 * Registry of providers. Add a class here (PROMPT 09: AsaasGateway) and the
 * PAYMENT_PROVIDER env var selects it at boot. Nothing else changes.
 */
const GATEWAYS = {
  mock: MockGateway,
  // asaas: AsaasGateway,
  // pagarme: PagarmeGateway,
  // stripe: StripeGateway,
} as const;

const gatewayProvider: Provider = {
  provide: PaymentGateway,
  inject: [ConfigService, ...Object.values(GATEWAYS)],
  useFactory: (
    config: ConfigService<Env, true>,
    ...instances: PaymentGateway[]
  ) => {
    const wanted = config.get('PAYMENT_PROVIDER', { infer: true });
    const gateway = instances.find((g) => g.name === wanted);
    if (!gateway)
      throw new Error(`Payment provider [${wanted}] is not registered.`);
    return gateway;
  },
};

@Module({
  providers: [...Object.values(GATEWAYS), gatewayProvider],
  exports: [PaymentGateway],
})
export class PaymentsModule {}
