// src/lib/payments/index.ts
import { CashAppProvider } from './CashAppProvider';
import { PayPalProvider } from './PayPalProvider';
import type { PaymentProvider } from './PaymentProvider';

export const paymentProviders: PaymentProvider[] = [
  CashAppProvider,
  PayPalProvider,
];

export function getPaymentProvider(id: string): PaymentProvider | undefined {
  return paymentProviders.find((p) => p.id === id);
}
