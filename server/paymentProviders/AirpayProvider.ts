import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * Airpay Tanzania Payment Gateway Provider Implementation
 */
export class AirpayProvider implements PaymentProvider {
  readonly id = 'airpay';
  readonly name = 'Airpay Tanzania';

  private normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '255' + clean.substring(1);
    }
    return clean;
  }

  async initializePayment(req: PaymentInitiateRequest, config: PaymentProviderConfig): Promise<PaymentInitiateResponse> {
    const formattedPhone = this.normalizePhone(req.phoneNumber);
    const apiUrl = config.apiUrl || 'https://api.airpay.co.tz/v2';

    if (config.apiKey && config.merchantId) {
      try {
        const response = await fetch(`${apiUrl}/checkout/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'x-merchant-id': config.merchantId,
          },
          body: JSON.stringify({
            order_id: req.transactionId,
            phone_number: formattedPhone,
            amount: req.amountTzs,
            currency: 'TZS',
            service: 'HOTSPOT_WIFI',
            package: req.packageName,
            callback_url: req.callbackUrl,
          }),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          return {
            success: false,
            provider: this.id,
            status: 'failed',
            message: (data.error as string) || (data.message as string) || 'Airpay initiation failed',
            rawResponse: data,
          };
        }

        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: (data.reference as string) || (data.airpay_id as string) || `AIRPAY-${Date.now()}`,
          status: 'pending',
          message: 'USSD prompt dispatched to phone.',
          ussdPushSent: true,
          rawResponse: data,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `Airpay service unreachable: ${errorMessage}`,
        };
      }
    }

    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `AIRPAY-SANDBOX-${Date.now()}`,
      status: 'pending',
      message: `[SANDBOX] Airpay push request generated for ${formattedPhone}.`,
      ussdPushSent: true,
      rawResponse: { mode: 'sandbox', phone: formattedPhone, amount: req.amountTzs },
    };
  }

  async checkPaymentStatus(transactionId: string, gatewayTxId?: string, config: PaymentProviderConfig = {}): Promise<PaymentStatusResponse> {
    const apiUrl = config.apiUrl || 'https://api.airpay.co.tz/v2';
    if (config.apiKey && gatewayTxId) {
      try {
        const res = await fetch(`${apiUrl}/orders/status?order_id=${transactionId}&reference=${gatewayTxId}`, {
          headers: { 'x-api-key': config.apiKey },
        });
        const data = (await res.json()) as Record<string, unknown>;
        const isSuccess = data.payment_status === 'SUCCESS';
        return {
          success: true,
          status: isSuccess ? 'successful' : data.payment_status === 'FAILED' ? 'failed' : 'pending',
          gatewayTransactionId: gatewayTxId,
          amountTzs: Number(data.amount) || 0,
          paidAt: (data.completed_at as string) || new Date().toISOString(),
          rawResponse: data,
        };
      } catch {
        // Fallback
      }
    }

    return {
      success: true,
      status: 'pending',
      amountTzs: 0,
    };
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: Record<string, unknown>, config: PaymentProviderConfig): Promise<WebhookResult> {
    const token = headers['x-airpay-token'];
    const verified = config.secretKey ? token === config.secretKey : true;

    const rawStatus = String(body.status || body.payment_status || '').toUpperCase();
    const status: 'successful' | 'failed' | 'cancelled' =
      rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED' ? 'successful' : rawStatus === 'CANCELLED' ? 'cancelled' : 'failed';

    return {
      verified,
      transactionId: String(body.order_id || body.reference || ''),
      gatewayTransactionId: String(body.airpay_id || body.payment_id || ''),
      status,
      amountTzs: Number(body.amount) || 0,
      phoneNumber: String(body.phone_number || ''),
      failureReason: body.error_message ? String(body.error_message) : undefined,
      rawPayload: body,
    };
  }
}
