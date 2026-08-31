import { PaymentProvider, PaymentProviderConfig } from './PaymentProvider.js';
import { PlusPesaProvider } from './PlusPesaProvider.js';

const providers: Record<string, PaymentProvider> = {
  pluspesa: new PlusPesaProvider(),
};

export function getPaymentProvider(providerId?: string): PaymentProvider {
  if (providerId && providers[providerId]) {
    return providers[providerId];
  }
  return providers.pluspesa;
}

export function getAllAvailableProviders(): Array<{ id: string; name: string }> {
  return Object.values(providers).map(p => ({
    id: p.id,
    name: p.name,
  }));
}

export * from './PaymentProvider.js';
export * from './PlusPesaProvider.js';

