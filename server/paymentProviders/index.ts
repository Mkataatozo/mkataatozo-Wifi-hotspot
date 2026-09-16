import { PaymentProvider, PaymentProviderConfig } from './PaymentProvider.ts';
import { PlusPesaProvider } from './PlusPesaProvider.ts';
import { ClickPesaProvider } from './ClickPesaProvider.ts';
import { SmartRouterProvider } from './SmartRouterProvider.ts';

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

export * from './PaymentProvider.ts';
export * from './PlusPesaProvider.ts';
export * from './ClickPesaProvider.ts';
export * from './SmartRouterProvider.ts';
