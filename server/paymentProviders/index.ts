import { PaymentProvider, PaymentProviderConfig } from './PaymentProvider.js';
import { PlusPesaProvider } from './PlusPesaProvider.js';
import { ClickPesaProvider } from './ClickPesaProvider.js';
import { SmartRouterProvider } from './SmartRouterProvider.js';

const providers: Record<string, PaymentProvider> = {
  pluspesa: new PlusPesaProvider(),
  clickpesa: new ClickPesaProvider(),
  auto: new SmartRouterProvider(),

};

export function getPaymentProvider(providerId?: string): PaymentProvider {
  if (providerId && providers[providerId]) {
    return providers[providerId];
  }
  // Default to the smart router so automatic failover is the norm.
  return providers.auto;
}

export function getAllAvailableProviders(): Array<{ id: string; name: string }> {
  return Object.values(providers).map((p) => ({
    id: p.id,
    name: p.name,
  }));
}

export * from './PaymentProvider.js';
export * from './PlusPesaProvider.js';
export * from './ClickPesaProvider.js';
export * from './SmartRouterProvider.js';
