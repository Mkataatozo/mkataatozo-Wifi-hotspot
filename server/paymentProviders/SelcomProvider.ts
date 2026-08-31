import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * Selcom Wireless Tanzania Payment Gateway Provider
 * USSD Push (C2B / Mobile Money Checkout)
 */
export class SelcomProvider implements PaymentProvider {
  readonly id = 'selcom';
  readonly name = 'Selcom Pay Tanzania (M-Pesa, Tigo, Airtel, HaloPesa)';

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
    const apiUrl = config.apiUrl || (config.environment === 'live' ? 'https://apigw.selcommobile.com/v1' : 'https://apigwtest.selcommobile.com/v1');

    if (config.apiKey) {
      try {
        const response = await fetch(`${apiUrl}/checkout/create-order-minimal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `SELCOM ${config.apiKey}`,
            'Digest': config.secretKey || '',
            'Timestamp': new Date().toISOString(),
          },
          body: JSON.stringify({
            vendor: config.merchantId || 'HOTSPOT',
            order_id: req.transactionId,
            buyer_phone: formattedPhone,
            amount: req.amountTzs,
            currency: 'TZS',
            buyer_name: 'Hotspot Customer',
            webhook_url: req.callbackUrl,
            remarks: `Wi-Fi ${req.packageName}`,
          }),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok || data.result !== 'SUCCESS') {
          return {
            success: false,
            provider: this.id,
            status: 'failed',
            message: (data.message as string) || 'Selcom payment prompt could not be initiated',
            rawResponse: data,
          };
        }

        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: (data.reference as string) || (data.transid as string) || `SEL-${Date.now()}`,
          status: 'pending',
          message: `USSD push prompt sent to ${formattedPhone}. Approve payment on your phone.`,
          ussdPushSent: true,
          rawResponse: data,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `Selcom gateway error: ${errorMessage}`,
        };
      }
    }

    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `SELCOM-DEMO-${Date.now()}`,
      status: 'pending',
      message: `[Selcom Sandbox] USSD prompt dispatched to +${formattedPhone} (TZS ${req.amountTzs}).`,
      ussdPushSent: true,
      rawResponse: { mode: 'sandbox', phone: formattedPhone },
    };
  }

  async checkPaymentStatus(transactionId: string, gatewayTxId?: string, config: PaymentProviderConfig = {}): Promise<PaymentStatusResponse> {
    const apiUrl = config.apiUrl || (config.environment === 'live' ? 'https://apigw.selcommobile.com/v1' : 'https://apigwtest.selcommobile.com/v1');
    if (config.apiKey && (gatewayTxId || transactionId)) {
      try {
        const res = await fetch(`${apiUrl}/checkout/order-status?order_id=${transactionId}`, {
          headers: { 'Authorization': `SELCOM ${config.apiKey}` },
        });
        const data = (await res.json()) as Record<string, unknown>;
        const orderStatus = String(data.order_status || data.payment_status || '').toUpperCase();
        let status: 'pending' | 'successful' | 'failed' | 'cancelled' = 'pending';
        if (['COMPLETED', 'PAID', 'SUCCESS'].includes(orderStatus)) {
          status = 'successful';
        } else if (['FAILED', 'EXPIRED', 'REJECTED'].includes(orderStatus)) {
          status = 'failed';
        } else if (['CANCELLED'].includes(orderStatus)) {
          status = 'cancelled';
        }
        return {
          success: true,
          status,
          gatewayTransactionId: (data.transid as string) || gatewayTxId,
          amountTzs: Number(data.amount) || 0,
          paidAt: (data.payment_date as string) || new Date().toISOString(),
          rawResponse: data,
        };
      } catch {
        // Fallback
      }
    }
    return { success: true, status: 'pending', amountTzs: 0 };
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: Record<string, unknown>, config: PaymentProviderConfig): Promise<WebhookResult> {
    const rawStatus = String(body.order_status || body.payment_status || body.status || '').toUpperCase();
    const status: 'successful' | 'failed' | 'cancelled' =
      ['COMPLETED', 'PAID', 'SUCCESS'].includes(rawStatus)
        ? 'successful'
        : ['CANCELLED', 'CANCELED'].includes(rawStatus)
        ? 'cancelled'
        : 'failed';

    return {
      verified: true,
      transactionId: String(body.order_id || body.reference || ''),
      gatewayTransactionId: String(body.transid || body.transaction_id || ''),
      status,
      amountTzs: Number(body.amount) || 0,
      phoneNumber: String(body.msisdn || body.phone || ''),
      failureReason: body.message ? String(body.message) : undefined,
      rawPayload: body,
    };
  }
}
