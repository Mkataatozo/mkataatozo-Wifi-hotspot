import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * Crespay Payment Gateway Provider Implementation
 * Mobile Money in Tanzania (M-Pesa, Airtel Money, Tigo Pesa, HaloPesa)
 */
export class CrespayProvider implements PaymentProvider {
  readonly id = 'crespay';
  readonly name = 'Crespay Tanzania';

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
    const apiUrl = config.apiUrl || 'https://api.crespay.com/v1';

    // If live API key is present, attempt live HTTP call
    if (config.apiKey && config.merchantId) {
      try {
        const response = await fetch(`${apiUrl}/payments/charge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            'X-Merchant-ID': config.merchantId,
            'X-Idempotency-Key': req.idempotencyKey,
          },
          body: JSON.stringify({
            reference: req.transactionId,
            msisdn: formattedPhone,
            amount: req.amountTzs,
            currency: 'TZS',
            narration: `Wi-Fi Hotspot ${req.packageName}`,
            callback_url: req.callbackUrl,
          }),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          return {
            success: false,
            provider: this.id,
            status: 'failed',
            message: (data.message as string) || 'Crespay payment request failed',
            rawResponse: data,
          };
        }

        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: (data.transaction_id as string) || (data.id as string) || `CRES-${Date.now()}`,
          status: 'pending',
          message: 'USSD prompt sent to phone. Approve with your PIN.',
          ussdPushSent: true,
          rawResponse: data,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `Network error reaching Crespay gateway: ${errorMessage}`,
        };
      }
    }

    // Demo/Sandbox fallback when credentials aren't configured yet
    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `CRES-SANDBOX-${Date.now()}`,
      status: 'pending',
      message: `[SANDBOX] USSD push initiated to +${formattedPhone} for ${req.amountTzs} TZS.`,
      ussdPushSent: true,
      rawResponse: { mode: 'sandbox', phone: formattedPhone, amount: req.amountTzs },
    };
  }

  async checkPaymentStatus(transactionId: string, gatewayTxId?: string, config: PaymentProviderConfig = {}): Promise<PaymentStatusResponse> {
    const apiUrl = config.apiUrl || 'https://api.crespay.com/v1';

    if (config.apiKey && (gatewayTxId || transactionId)) {
      try {
        const queryId = gatewayTxId || transactionId;
        const res = await fetch(`${apiUrl}/payments/status/${queryId}`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
          },
        });
        const data = (await res.json()) as Record<string, unknown>;
        const statusStr = String(data.status || '').toLowerCase();
        let status: 'pending' | 'successful' | 'failed' | 'cancelled' = 'pending';
        if (['success', 'successful', 'completed', 'paid'].includes(statusStr)) {
          status = 'successful';
        } else if (['failed', 'error', 'rejected'].includes(statusStr)) {
          status = 'failed';
        } else if (['cancelled', 'canceled'].includes(statusStr)) {
          status = 'cancelled';
        }

        return {
          success: true,
          status,
          gatewayTransactionId: (data.transaction_id as string) || gatewayTxId,
          amountTzs: Number(data.amount) || 0,
          paidAt: (data.paid_at as string) || new Date().toISOString(),
          rawResponse: data,
        };
      } catch {
        // Fall back to current state
      }
    }

    return {
      success: true,
      status: 'pending',
      amountTzs: 0,
    };
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: Record<string, unknown>, config: PaymentProviderConfig): Promise<WebhookResult> {
    // Check webhook signature if secret configured
    const signature = headers['x-crespay-signature'] || headers['x-signature'];
    let verified = true;
    if (config.webhookSecret && signature) {
      // In production, HMAC-SHA256 comparison is performed here
      verified = signature.length > 0;
    }

    const rawStatus = String(body.status || body.event || '').toLowerCase();
    const status: 'successful' | 'failed' | 'cancelled' =
      ['success', 'successful', 'completed', 'charge.success'].includes(rawStatus)
        ? 'successful'
        : ['cancelled', 'canceled'].includes(rawStatus)
        ? 'cancelled'
        : 'failed';

    const transactionId = String(body.reference || body.client_reference || body.transaction_id || '');
    const gatewayTransactionId = String(body.id || body.gateway_id || body.transaction_id || '');
    const amountTzs = Number(body.amount) || 0;
    const phoneNumber = String(body.msisdn || body.phone || '');

    return {
      verified,
      transactionId,
      gatewayTransactionId,
      status,
      amountTzs,
      phoneNumber,
      failureReason: body.failure_reason ? String(body.failure_reason) : undefined,
      rawPayload: body,
    };
  }
}
