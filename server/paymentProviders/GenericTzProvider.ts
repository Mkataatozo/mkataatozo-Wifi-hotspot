import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * Universal Tanzanian Payment Gateway Adapter (GenericTzProvider)
 * Standard REST contract for Tanzania Aggregators (AzamPay, DPO, Selcom, Beem, etc.)
 */
export class GenericTzProvider implements PaymentProvider {
  readonly id = 'generic_tz';
  readonly name = 'Tanzania Mobile Gateway (Universal)';

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
    const apiUrl = config.apiUrl || 'https://api.paymentgateway.co.tz/v1';

    if (config.apiKey) {
      try {
        const response = await fetch(`${apiUrl}/checkout/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            'X-Secret-Key': config.secretKey || '',
            'X-Merchant-Id': config.merchantId || '',
          },
          body: JSON.stringify({
            reference: req.transactionId,
            phone: formattedPhone,
            amount: req.amountTzs,
            currency: 'TZS',
            callback_url: req.callbackUrl,
            package_name: req.packageName,
            duration_minutes: req.durationMinutes,
            idempotency_key: req.idempotencyKey,
          }),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          return {
            success: false,
            provider: this.id,
            status: 'failed',
            message: (data.message as string) || 'Gateway rejected charge request',
            rawResponse: data,
          };
        }

        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: (data.transaction_id as string) || (data.id as string) || `GEN-${Date.now()}`,
          status: 'pending',
          message: 'USSD prompt dispatched to customer phone.',
          ussdPushSent: true,
          rawResponse: data,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `Gateway unreachable: ${errorMessage}`,
        };
      }
    }

    // Default Sandbox mode
    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `TZ-GATEWAY-TX-${Date.now()}`,
      status: 'pending',
      message: `USSD push request created for +${formattedPhone} (TZS ${req.amountTzs.toLocaleString()}).`,
      ussdPushSent: true,
      rawResponse: { mode: 'sandbox', phone: formattedPhone, amount: req.amountTzs },
    };
  }

  async checkPaymentStatus(transactionId: string, gatewayTxId?: string, config: PaymentProviderConfig = {}): Promise<PaymentStatusResponse> {
    const apiUrl = config.apiUrl;
    if (config.apiKey && apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/transactions/status/${transactionId}`, {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
        });
        const data = (await res.json()) as Record<string, unknown>;
        const status = String(data.status || '').toLowerCase() === 'completed' ? 'successful' : 'pending';
        return {
          success: true,
          status,
          gatewayTransactionId: (data.transaction_id as string) || gatewayTxId,
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
    const authHeader = headers['authorization'] || headers['x-webhook-token'];
    let verified = true;
    if (config.webhookSecret && authHeader) {
      verified = String(authHeader).includes(config.webhookSecret);
    }

    const rawStatus = String(body.status || body.event || body.payment_status || '').toLowerCase();
    const status: 'successful' | 'failed' | 'cancelled' =
      ['success', 'successful', 'completed', 'paid', 'charge.successful'].includes(rawStatus)
        ? 'successful'
        : ['cancelled', 'canceled'].includes(rawStatus)
        ? 'cancelled'
        : 'failed';

    return {
      verified,
      transactionId: String(body.reference || body.order_id || body.transactionId || body.client_reference || ''),
      gatewayTransactionId: String(body.gateway_reference || body.transaction_id || body.id || ''),
      status,
      amountTzs: Number(body.amount) || 0,
      phoneNumber: String(body.phone || body.msisdn || ''),
      failureReason: body.error ? String(body.error) : undefined,
      rawPayload: body,
    };
  }
}
