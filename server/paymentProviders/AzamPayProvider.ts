import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * AzamPay Payment Gateway Provider
 * Supports Tanzania M-Pesa, Airtel Money, Tigo Pesa, HaloPesa
 */
export class AzamPayProvider implements PaymentProvider {
  readonly id = 'azampay';
  readonly name = 'AzamPay Tanzania (M-Pesa, Tigo, Airtel, HaloPesa)';

  private normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '255' + clean.substring(1);
    } else if (!clean.startsWith('255') && clean.length === 9) {
      clean = '255' + clean;
    }
    return clean;
  }

  private detectOperator(phone: string): string {
    const clean = this.normalizePhone(phone);
    const prefix = clean.substring(3, 5); // 255XX...
    if (['74', '75', '76'].includes(prefix)) return 'Vodacom';
    if (['71', '65', '67', '77'].includes(prefix)) return 'Tigo';
    if (['78', '68', '69'].includes(prefix)) return 'Airtel';
    if (['62', '61'].includes(prefix)) return 'Halotel';
    return 'Vodacom';
  }

  async initializePayment(req: PaymentInitiateRequest, config: PaymentProviderConfig): Promise<PaymentInitiateResponse> {
    const formattedPhone = this.normalizePhone(req.phoneNumber);
    const providerOperator = this.detectOperator(formattedPhone);
    const apiUrl = config.apiUrl || (config.environment === 'live' ? 'https://checkout.azampay.co.tz' : 'https://sandbox.azampay.co.tz');

    if (config.apiKey) {
      try {
        const response = await fetch(`${apiUrl}/azampay/mno/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            'X-Vendor-ID': config.merchantId || '',
          },
          body: JSON.stringify({
            accountNumber: formattedPhone,
            amount: String(req.amountTzs),
            currency: 'TZS',
            externalId: req.transactionId,
            provider: providerOperator,
            additionalProperties: {
              package: req.packageName,
              callbackUrl: req.callbackUrl,
            },
          }),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok || data.success === false) {
          return {
            success: false,
            provider: this.id,
            status: 'failed',
            message: (data.message as string) || (data.errorMessage as string) || 'AzamPay rejected checkout request',
            rawResponse: data,
          };
        }

        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: (data.transactionId as string) || (data.reference as string) || `AZAM-${Date.now()}`,
          status: 'pending',
          message: `USSD push prompt sent to ${formattedPhone} (${providerOperator}). Tafadhali weka PIN kukamilisha malipo.`,
          ussdPushSent: true,
          rawResponse: data,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `Could not reach AzamPay servers: ${errorMessage}`,
        };
      }
    }

    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `AZAM-DEMO-${Date.now()}`,
      status: 'pending',
      message: `[AzamPay Sandbox] USSD prompt initiated for +${formattedPhone} (${providerOperator}) - TZS ${req.amountTzs}.`,
      ussdPushSent: true,
      rawResponse: { mode: 'sandbox', phone: formattedPhone, operator: providerOperator },
    };
  }

  async checkPaymentStatus(transactionId: string, gatewayTxId?: string, config: PaymentProviderConfig = {}): Promise<PaymentStatusResponse> {
    const apiUrl = config.apiUrl || (config.environment === 'live' ? 'https://checkout.azampay.co.tz' : 'https://sandbox.azampay.co.tz');
    if (config.apiKey && (gatewayTxId || transactionId)) {
      try {
        const res = await fetch(`${apiUrl}/azampay/transactions/status?reference=${gatewayTxId || transactionId}`, {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
        });
        const data = (await res.json()) as Record<string, unknown>;
        const statusStr = String(data.status || data.transactionStatus || '').toLowerCase();
        let status: 'pending' | 'successful' | 'failed' | 'cancelled' = 'pending';
        if (['success', 'successful', 'completed', 'paid'].includes(statusStr)) {
          status = 'successful';
        } else if (['failed', 'rejected', 'error'].includes(statusStr)) {
          status = 'failed';
        }
        return {
          success: true,
          status,
          gatewayTransactionId: (data.transactionId as string) || gatewayTxId,
          amountTzs: Number(data.amount) || 0,
          paidAt: (data.transactionDate as string) || new Date().toISOString(),
          rawResponse: data,
        };
      } catch {
        // Fallback
      }
    }
    return { success: true, status: 'pending', amountTzs: 0 };
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: Record<string, unknown>, config: PaymentProviderConfig): Promise<WebhookResult> {
    const rawStatus = String(body.status || body.transactionStatus || '').toLowerCase();
    const status: 'successful' | 'failed' | 'cancelled' =
      ['success', 'successful', 'completed', 'paid'].includes(rawStatus)
        ? 'successful'
        : ['cancelled', 'canceled'].includes(rawStatus)
        ? 'cancelled'
        : 'failed';

    return {
      verified: true,
      transactionId: String(body.externalId || body.reference || body.transactionId || ''),
      gatewayTransactionId: String(body.transactionId || body.reference || ''),
      status,
      amountTzs: Number(body.amount) || 0,
      phoneNumber: String(body.msisdn || body.accountNumber || ''),
      failureReason: body.message ? String(body.message) : undefined,
      rawPayload: body,
    };
  }
}
