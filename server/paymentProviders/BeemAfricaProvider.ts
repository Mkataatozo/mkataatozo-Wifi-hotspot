import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * Beem Africa Payment Gateway Provider
 * Mobile Money Checkout (Tanzania, Kenya, Uganda)
 */
export class BeemAfricaProvider implements PaymentProvider {
  readonly id = 'beem';
  readonly name = 'Beem Africa (Tanzania Mobile Money)';

  private normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '255' + clean.substring(1);
    } else if (!clean.startsWith('255') && clean.length === 9) {
      clean = '255' + clean;
    }
    return clean;
  }

  async initializePayment(req: PaymentInitiateRequest, config: PaymentProviderConfig): Promise<PaymentInitiateResponse> {
    const formattedPhone = this.normalizePhone(req.phoneNumber);
    const apiUrl = config.apiUrl || 'https://checkout.beem.africa/v1';

    if (config.apiKey && config.secretKey) {
      try {
        const authString = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');
        const response = await fetch(`${apiUrl}/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`,
          },
          body: JSON.stringify({
            amount: String(req.amountTzs),
            transaction_id: req.transactionId,
            reference_number: req.transactionId,
            mobile: formattedPhone,
            send_sms: true,
            send_receipt: false,
            notify_url: req.callbackUrl,
          }),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok || data.code !== 100) {
          return {
            success: false,
            provider: this.id,
            status: 'failed',
            message: (data.message as string) || 'Beem checkout request failed',
            rawResponse: data,
          };
        }

        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: (data.transaction_id as string) || `BEEM-${Date.now()}`,
          status: 'pending',
          message: `USSD push prompt sent to +${formattedPhone}. Tafadhali weka PIN ya M-Pesa / Tigo / Airtel.`,
          ussdPushSent: true,
          rawResponse: data,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `Beem connection error: ${errorMessage}`,
        };
      }
    }

    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `BEEM-DEMO-${Date.now()}`,
      status: 'pending',
      message: `[Beem Sandbox] Payment prompt initiated for +${formattedPhone} (TZS ${req.amountTzs}).`,
      ussdPushSent: true,
      rawResponse: { mode: 'sandbox', phone: formattedPhone },
    };
  }

  async checkPaymentStatus(transactionId: string, gatewayTxId?: string, config: PaymentProviderConfig = {}): Promise<PaymentStatusResponse> {
    return { success: true, status: 'pending', amountTzs: 0 };
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: Record<string, unknown>, config: PaymentProviderConfig): Promise<WebhookResult> {
    const rawStatus = String(body.status || body.transaction_status || '').toUpperCase();
    const status: 'successful' | 'failed' | 'cancelled' =
      ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID'].includes(rawStatus)
        ? 'successful'
        : ['CANCELLED', 'CANCELED'].includes(rawStatus)
        ? 'cancelled'
        : 'failed';

    return {
      verified: true,
      transactionId: String(body.reference_number || body.transaction_id || ''),
      gatewayTransactionId: String(body.transaction_id || ''),
      status,
      amountTzs: Number(body.amount) || 0,
      phoneNumber: String(body.mobile || body.msisdn || ''),
      failureReason: body.message ? String(body.message) : undefined,
      rawPayload: body,
    };
  }
}
