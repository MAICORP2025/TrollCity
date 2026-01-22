// src/lib/payments/PayPalProvider.ts
import type { PaymentProvider, PaymentCreateOptions, PaymentSession, PaymentResult } from './PaymentProvider';

export const PayPalProvider: PaymentProvider = {
  id: 'paypal',
  displayName: 'PayPal',
  logoUrl: '/img/paypal-logo.svg',

  async createPayment(_options: PaymentCreateOptions): Promise<PaymentSession> {
    // Use Supabase Edge Function endpoint for PayPal order creation
    const endpoint = 'https://yjxpwfalenorzrqxwmtr.functions.supabase.co/paypal-create-order';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          amount: options.amount,
          currency: options.currency,
          userId: options.userId,
          productType: options.productType,
          packageId: options.packageId,
          metadata: options.metadata,
        }),
      });
    } catch (err) {
      console.error('[PayPal] Network error:', err);
      throw new Error('Network error while creating PayPal order. Please try again.');
    }
    let data: any;
    try {
      data = await res.json();
    } catch (err) {
      console.error('[PayPal] Failed to parse response:', err);
      throw new Error('Invalid response from PayPal order API.');
    }
    if (!res.ok) {
      console.error('[PayPal] API error:', data);
      throw new Error(data.error || 'Failed to create PayPal order.');
    }
    if (!data.approvalUrl) {
      console.error('[PayPal] Missing approvalUrl in response:', data);
      throw new Error('PayPal did not return an approval URL. Please try again later or contact support.');
    }
    return {
      sessionId: data.orderId,
      provider: 'paypal',
      approvalUrl: data.approvalUrl,
      raw: data,
    };
  },

  async capturePayment(sessionId: string, _options?: any): Promise<PaymentResult> {
    // Use Supabase Edge Function endpoint for PayPal order capture (if implemented)
    // You may need to deploy a similar function for capture, or handle capture on return_url
    return { success: true, provider: 'paypal', transactionId: sessionId };
  },
};
