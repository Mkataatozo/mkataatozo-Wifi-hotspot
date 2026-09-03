import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';
import crypto from 'crypto';

/**
 * PlusPesa Payment Gateway Provider (admin.pluspesa.com)
 * Runs on the "Dalipay" Collections & Disbursements API.
 * Auth: X-Public-Key / X-Secret-Key headers.
 * Base URL: https://admin.pluspesa.com/api/v1
 * Docs confirmed from the official Dalipay Python SDK source (Neurotech-HQ/dalipay-python-sdk).
 */
export class PlusPesaProvider implements PaymentProvider {
  readonly id = 'pluspesa';
  readonly name = 'PlusPesa (app.pluspesa.com)';

  private normalizePhone(phone: string): { international: string; local: string } {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      return { international: '255' + clean.substring(1), local: clean };
    } else if (clean.startsWith('255')) {
      return { international: clean, local: '0' + clean.substring(3) };
    } else if (clean.length === 9) {
      return { international: '255' + clean, local: '0' + clean };
    }
    return { international: clean, local: clean };
  }

  /** Maps a phone number to the exact provider enum the Dalipay API expects. */
  private detectApiProvider(phone: string): 'Mpesa' | 'Tigo' | 'Airtel' | 'Halopesa' | 'Azampesa' | null {
    const { international } = this.normalizePhone(phone);
    const prefix = international.substring(3, 5); // 255XX...
    if (['74', '75', '76'].includes(prefix)) return 'Mpesa';       // Vodacom M-Pesa
    if (['71', '65', '67', '77'].includes(prefix)) return 'Tigo';   // Tigo Pesa
    if (['78', '68', '69'].includes(prefix)) return 'Airtel';       // Airtel Money
    if (['62', '61'].includes(prefix)) return 'Halopesa';           // HaloPesa
    return null; // e.g. 073/TTCL - not supported by any mobile money provider
  }

  private displayOperator(apiProvider: string | null): string {
    switch (apiProvider) {
      case 'Mpesa': return 'Vodacom M-Pesa';
      case 'Tigo': return 'Tigo Pesa';
      case 'Airtel': return 'Airtel Money';
      case 'Halopesa': return 'HaloPesa';
      default: return 'Tanzania Mobile Money';
    }
  }

  private getBaseUrl(config: PaymentProviderConfig): string {
    let base = (config.apiUrl || 'https://app.pluspesa.com/api/v1').replace(/\/$/, '');
    // Be forgiving of old/incorrect values saved in Settings (e.g. the
    // wrong admin.pluspesa.com host, or a base missing /v1).
    base = base.replace('admin.pluspesa.com', 'app.pluspesa.com');
    if (!/\/v1$/.test(base)) {
      base = base.replace(/\/api$/, '/api/v1');
      if (!/\/api\/v1$/.test(base)) base = `${base}/api/v1`;
    }
    return base;
  }

  async initializePayment(req: PaymentInitiateRequest, config: PaymentProviderConfig): Promise<PaymentInitiateResponse> {
    const { local } = this.normalizePhone(req.phoneNumber);
    const publicKey = (config.publicKey || config.apiKey || '').trim();
    const secretKey = (config.secretKey || config.apiSecret || '').trim();
    const baseUrl = this.getBaseUrl(config);

    const apiProvider = this.detectApiProvider(req.phoneNumber);
    const operator = this.displayOperator(apiProvider);

    if (!publicKey || !secretKey) {
      // No real keys configured at all - simulate so the flow is testable end-to-end.
      return {
        success: true,
        provider: this.id,
        gatewayTransactionId: `PLUSPESA-SANDBOX-${Date.now()}`,
        status: 'pending',
        message: `[PlusPesa Sandbox] USSD prompt initiated for ${local} (${operator}) - TZS ${req.amountTzs.toLocaleString()}.`,
        ussdPushSent: true,
        rawResponse: { mode: 'sandbox', reason: 'no public/secret key configured' },
      };
    }

    if (!apiProvider) {
      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message: `Could not determine a supported mobile money provider for ${local}. This number's prefix (e.g. TTCL/073) is not on Tigo, Airtel, Halopesa, Azampesa, or M-Pesa. Ask the customer for a different number.`,
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Public-Key': publicKey,
        'X-Secret-Key': secretKey,
      };

      const payload = {
        account_number: local,               // local format e.g. 0712345678, per Dalipay docs
        amount: req.amountTzs,
        currency: 'TZS',
        provider: apiProvider,                // Tigo | Airtel | Halopesa | Azampesa | Mpesa
        external_id: req.transactionId.slice(0, 30), // max 30 chars per Dalipay docs
      };

      const endpoint = `${baseUrl}/collections`;
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
      const text = await res.text();

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `PlusPesa returned a non-JSON response (HTTP ${res.status}) from ${endpoint}. This usually means the base URL is still wrong.`,
          rawResponse: { endpoint, status: res.status, rawText: text.substring(0, 300) },
        };
      }

      if (res.ok && parsed?.success && parsed?.data?.uuid) {
        const data = parsed.data;
        return {
          success: true,
          provider: this.id,
          gatewayTransactionId: data.uuid,
          status: 'pending',
          message: `USSD push prompt sent to ${local} (${operator}). Please check your phone and enter your PIN to approve TZS ${req.amountTzs.toLocaleString()}.`,
          ussdPushSent: true,
          rawResponse: { endpoint, ...data },
        };
      }

      // Map known Dalipay error codes to clear messages.
      const msg = parsed?.message || `HTTP ${res.status}`;
      let friendly = `PlusPesa Gateway Error: ${msg}`;
      if (res.status === 401) friendly = `PlusPesa Authentication Failed: Invalid Public/Secret Key. Verify them on admin.pluspesa.com > API Keys.`;
      else if (res.status === 402) friendly = `PlusPesa: Insufficient balance/limit on your merchant account. ${msg}`;
      else if (res.status === 403) friendly = `PlusPesa: Forbidden - IP not whitelisted or KYC required. ${msg}`;
      else if (res.status === 400) friendly = `PlusPesa: Invalid request - ${msg}`;

      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message: friendly,
        rawResponse: { endpoint, status: res.status, response: parsed },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message: `Could not connect to PlusPesa servers: ${errorMsg}`,
      };
    }
  }

  async checkPaymentStatus(
    transactionId: string,
    gatewayTxId?: string,
    config: PaymentProviderConfig = {}
  ): Promise<PaymentStatusResponse> {
    const publicKey = (config.publicKey || config.apiKey || '').trim();
    const secretKey = (config.secretKey || config.apiSecret || '').trim();
    const baseUrl = this.getBaseUrl(config);

    if (!publicKey || !secretKey || !gatewayTxId) {
      return { success: true, status: 'pending', amountTzs: 0 };
    }

    try {
      const headers: Record<string, string> = {
        'X-Public-Key': publicKey,
        'X-Secret-Key': secretKey,
      };

      const res = await fetch(`${baseUrl}/collections/${encodeURIComponent(gatewayTxId)}/status`, { headers });
      const parsed: any = await res.json().catch(() => null);

      if (res.ok && parsed?.success && parsed?.data) {
        const data = parsed.data;
        let status: 'pending' | 'successful' | 'failed' | 'cancelled' = 'pending';
        if (data.status === 'success') status = 'successful';
        else if (data.status === 'failed') status = 'failed';

        return {
          success: true,
          status,
          gatewayTransactionId: data.uuid || gatewayTxId,
          amountTzs: Number(data.amount) || 0,
          paidAt: data.updated_at || new Date().toISOString(),
          rawResponse: data,
        };
      }
    } catch {
      // fall through to pending
    }

    return { success: true, status: 'pending', amountTzs: 0 };
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
    config: PaymentProviderConfig,
    rawBody?: string
  ): Promise<WebhookResult> {
    const callbackSecret = (config as any).callbackSecret || '';
    const signature = String(headers['x-signature'] || '');

    let verified = false;
    if (callbackSecret && signature && rawBody) {
      const expected = crypto.createHmac('sha256', callbackSecret).update(rawBody).digest('hex');
      try {
        verified = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        verified = false;
      }
    }

    const event = String((body as any).event || '');
    const data = (body as any).data || {};
    const status: 'successful' | 'failed' | 'cancelled' =
      event === 'collection.success' || data.status === 'success' ? 'successful' : 'failed';

    return {
      verified,
      transactionId: String(data.external_id || ''),
      gatewayTransactionId: String(data.uuid || data.reference || ''),
      status,
      amountTzs: Number(data.amount) || 0,
      phoneNumber: '',
      failureReason: !verified ? 'Signature verification failed or callbackSecret/rawBody not configured' : undefined,
      rawPayload: body,
    };
  }
}
