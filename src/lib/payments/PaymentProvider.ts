// src/lib/payments/PaymentProvider.ts

export interface PaymentProvider {
  id: string;
  displayName: string;
  logoUrl?: string;
  /**
   * Initiate a payment for a given product/amount. Returns a promise that resolves to a payment session or order id.
   */
  createPayment(options: PaymentCreateOptions): Promise<PaymentSession>;
  /**
   * Capture/confirm a payment after user approval. Returns a promise that resolves to the final status.
   */
  capturePayment(sessionId: string, options?: any): Promise<PaymentResult>;
  /**
   * Optionally, handle webhooks for this provider.
   */
  handleWebhook?(req: any, res: any): Promise<void>;
}

export interface PaymentCreateOptions {
  userId: string;
  amount: number;
  currency: string;
  productType: 'coins' | 'troll_pass' | 'premium';
  packageId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentSession {
  sessionId: string;
  provider: string;
  approvalUrl?: string;
  raw?: any;
}

export interface PaymentResult {
  success: boolean;
  provider: string;
  transactionId?: string;
  error?: string;
  raw?: any;
}
