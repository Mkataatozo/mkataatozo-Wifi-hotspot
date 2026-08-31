/**
 * Payment Provider Abstraction Layer
 * Allows swapping between Airpay, Crespay, Generic Tanzanian Gateway, etc.
 */

export interface PaymentInitiateRequest {
  transactionId: string;
  phoneNumber: string; // e.g. "0754123456" or "255754123456"
  amountTzs: number;
  packageId: string;
  packageName: string;
  durationMinutes: number;
  customerIp?: string;
  customerMac?: string;
  callbackUrl: string;
  idempotencyKey: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  gatewayTransactionId?: string;
  provider: string;
  status: 'pending' | 'successful' | 'failed';
  message: string;
  checkoutUrl?: string;
  ussdPushSent?: boolean;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentStatusResponse {
  success: boolean;
  status: 'pending' | 'successful' | 'failed' | 'cancelled';
  gatewayTransactionId?: string;
  amountTzs: number;
  paidAt?: string;
  failureReason?: string;
  rawResponse?: Record<string, unknown>;
}

export interface WebhookResult {
  verified: boolean;
  transactionId: string;
  gatewayTransactionId?: string;
  status: 'successful' | 'failed' | 'cancelled';
  amountTzs: number;
  phoneNumber?: string;
  failureReason?: string;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProviderConfig {
  apiKey?: string;
  publicKey?: string;
  secretKey?: string;
  apiSecret?: string;
  merchantId?: string;
  apiUrl?: string;
  webhookSecret?: string;
  environment?: 'sandbox' | 'live';
  enabled?: boolean;
}

export interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  
  /**
   * Initialize a mobile money payment prompt (USSD Push / STK / Web checkout)
   */
  initializePayment(req: PaymentInitiateRequest, config: PaymentProviderConfig): Promise<PaymentInitiateResponse>;
  
  /**
   * Query gateway for latest status of a transaction
   */
  checkPaymentStatus(transactionId: string, gatewayTxId?: string, config?: PaymentProviderConfig): Promise<PaymentStatusResponse>;
  
  /**
   * Verify and parse incoming webhook / callback payload from the payment gateway
   */
  handleWebhook(headers: Record<string, string | string[] | undefined>, body: Record<string, unknown>, config: PaymentProviderConfig): Promise<WebhookResult>;
}
