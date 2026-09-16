import {
  PaymentProvider,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentStatusResponse,
  WebhookResult,
  PaymentProviderConfig,
} from './PaymentProvider.js';

/**
 * ClickPesa Payment Gateway Provider
 *
 * Built against ClickPesa's official CORE API documentation:
 *   Base URL : https://api.clickpesa.com/third-parties
 *   Auth     : POST /generate-token with `client-id` + `api-key` headers
 *              -> { success, token }   (token ALREADY includes "Bearer ")
 *              JWT is valid for 1 hour.
 *   Initiate : POST /payments/initiate-ussd-push-request
 *              body { amount, currency, orderReference, phoneNumber }
 *   Status   : GET  /payments/{orderReference}  -> array of payment objects
 *
 * Why ClickPesa matters for this business: it accepts collections from
 * TZS 500 across all networks (M-Pesa, Tigo, Airtel, Halotel), whereas
 * PlusPesa only reliably pushes sub-1000 amounts on Airtel.
 */
export class ClickPesaProvider implements PaymentProvider {
  readonly id = 'clickpesa';
  readonly name = 'ClickPesa';

  /** Cached JWT, keyed by clientId so multiple accounts never collide. */
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  private getBaseUrl(config: PaymentProviderConfig): string {
    const raw = config.clickpesa?.apiUrl || 'https://api.clickpesa.com/third-parties';
    let base = raw.replace(/\/$/, '');
    // Be forgiving if only the host was entered in Settings.
    if (!/\/third-parties$/.test(base)) {
      base = `${base.replace(/\/third-parties.*$/, '')}/third-parties`;
    }
    return base;
  }

  private getCredentials(config: PaymentProviderConfig): { clientId: string; apiKey: string } {
    // Preferred: dedicated clickpesa block. Falls back to the flat fields so a
    // single-gateway setup still works (Client ID in "Public Key",
    // API Key in "Secret Key").
    const clientId = (config.clickpesa?.clientId || config.publicKey || config.merchantId || '').trim();
    const apiKey = (config.clickpesa?.apiKey || config.secretKey || config.apiSecret || '').trim();
    return { clientId, apiKey };
  }

  /** ClickPesa requires 255XXXXXXXXX with no plus sign. */
  private normalizePhone(phone: string): { international: string; local: string } {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) return { international: '255' + clean.substring(1), local: clean };
    if (clean.startsWith('255')) return { international: clean, local: '0' + clean.substring(3) };
    if (clean.length === 9) return { international: '255' + clean, local: '0' + clean };
    return { international: clean, local: clean };
  }

  /**
   * orderReference must be ALPHANUMERIC ONLY and <= 20 characters (a hard
   * mobile-money limit). Our internal IDs look like "TX-1788614765977-75U2",
   * so strip the hyphens and clamp the length. This is also the key used to
   * query status later, so it has to be deterministic.
   */
  public toOrderReference(transactionId: string): string {
    return transactionId.replace(/[^a-zA-Z0-9]/g, '').slice(-20);
  }

  private displayOperator(phone: string): string {
    const { international } = this.normalizePhone(phone);
    const prefix = international.substring(3, 5);
    if (['74', '75', '76'].includes(prefix)) return 'Vodacom M-Pesa';
    if (['71', '65', '67', '77'].includes(prefix)) return 'Tigo Pesa';
    if (['78', '68', '69'].includes(prefix)) return 'Airtel Money';
    if (['62', '61'].includes(prefix)) return 'HaloPesa';
    return 'Mobile Money';
  }

  /**
   * Fetches (and caches) the JWT. ClickPesa tokens live 1 hour; we refresh at
   * 55 minutes so a request never races the expiry.
   */
  private async getToken(config: PaymentProviderConfig): Promise<string> {
    const { clientId, apiKey } = this.getCredentials(config);
    if (!clientId || !apiKey) {
      throw new Error('ClickPesa Client ID and API Key are not configured.');
    }

    const cached = this.tokenCache.get(clientId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const endpoint = `${this.getBaseUrl(config)}/generate-token`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': clientId,
        'api-key': apiKey,
      },
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `ClickPesa auth returned a non-JSON response (HTTP ${res.status}) from ${endpoint}. Check the API Base URL.`
      );
    }

    if (!res.ok || !parsed?.success || !parsed?.token) {
      const msg = parsed?.message || `HTTP ${res.status}`;
      throw new Error(`ClickPesa authentication failed: ${msg}`);
    }

    // NOTE: ClickPesa's token already contains the "Bearer " prefix - do not
    // add another one when using it in the Authorization header.
    const token: string = parsed.token;
    this.tokenCache.set(clientId, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
    return token;
  }

  private authHeader(token: string): string {
    return /^Bearer\s/i.test(token) ? token : `Bearer ${token}`;
  }

  async initializePayment(
    req: PaymentInitiateRequest,
    config: PaymentProviderConfig
  ): Promise<PaymentInitiateResponse> {
    const { international, local } = this.normalizePhone(req.phoneNumber);
    const operator = this.displayOperator(req.phoneNumber);
    const orderReference = this.toOrderReference(req.transactionId);
    const baseUrl = this.getBaseUrl(config);

    const { clientId, apiKey } = this.getCredentials(config);
    if (!clientId || !apiKey) {
      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message:
          'ClickPesa is not configured. Add your Client ID and API Key in Settings > Payment Gateway.',
      };
    }

    try {
      const token = await this.getToken(config);
      const endpoint = `${baseUrl}/payments/initiate-ussd-push-request`;

      const payload = {
        amount: String(req.amountTzs), // ClickPesa expects a string amount
        currency: 'TZS',
        orderReference,
        phoneNumber: international, // 255XXXXXXXXX, no plus sign
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader(token),
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `ClickPesa returned a non-JSON response (HTTP ${res.status}) from ${endpoint}.`,
          rawResponse: { endpoint, status: res.status, rawText: text.substring(0, 300) },
        };
      }

      // A real initiate returns an id plus a PROCESSING/SUCCESS status.
      if (res.ok && parsed?.id && parsed?.status && parsed.status !== 'FAILED') {
        return {
          success: true,
          provider: this.id,
          // Status lookups key off orderReference, so that is what we persist.
          gatewayTransactionId: orderReference,
          status: 'pending',
          message: `USSD push prompt sent to ${local} (${parsed.channel || operator}). Please check your phone and enter your PIN to approve TZS ${req.amountTzs.toLocaleString()}.`,
          ussdPushSent: true,
          rawResponse: { endpoint, orderReference, ...parsed },
        };
      }

      const msg = parsed?.message || `HTTP ${res.status}`;
      let friendly = `ClickPesa Error: ${msg}`;
      if (res.status === 401) {
        friendly = 'ClickPesa authentication failed (invalid or expired token). Verify your Client ID and API Key.';
        this.tokenCache.delete(clientId); // force a fresh token next attempt
      } else if (res.status === 400) {
        friendly = `ClickPesa rejected the request: ${msg}`;
      } else if (res.status === 404) {
        friendly = `ClickPesa: ${msg} - check that Collections are enabled on your account.`;
      } else if (res.status === 409) {
        friendly = `ClickPesa: this order reference was already used. ${msg}`;
      }

      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message: friendly,
        rawResponse: { endpoint, status: res.status, orderReference, response: parsed },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message: errorMsg.startsWith('ClickPesa') ? errorMsg : `Could not reach ClickPesa: ${errorMsg}`,
      };
    }
  }

  async checkPaymentStatus(
    transactionId: string,
    gatewayTxId?: string,
    config: PaymentProviderConfig = {}
  ): Promise<PaymentStatusResponse> {
    const orderReference = gatewayTxId || this.toOrderReference(transactionId);
    const baseUrl = this.getBaseUrl(config);
    const { clientId, apiKey } = this.getCredentials(config);

    if (!clientId || !apiKey) {
      return { success: true, status: 'pending', amountTzs: 0 };
    }

    try {
      const token = await this.getToken(config);
      const statusUrl = `${baseUrl}/payments/${encodeURIComponent(orderReference)}`;
      const res = await fetch(statusUrl, {
        headers: { Authorization: this.authHeader(token) },
      });
      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* not JSON */
      }

      console.log(`[ClickPesa StatusCheck] ${statusUrl} -> HTTP ${res.status}:`, text.substring(0, 400));

      // The endpoint returns an ARRAY of payments for the order reference.
      const record = Array.isArray(parsed) ? parsed[0] : parsed;

      if (res.ok && record?.status) {
        let status: 'pending' | 'successful' | 'failed' | 'cancelled' = 'pending';
        if (record.status === 'SUCCESS' || record.status === 'SETTLED') status = 'successful';
        else if (record.status === 'FAILED') status = 'failed';

        return {
          success: true,
          status,
          gatewayTransactionId: record.id || orderReference,
          amountTzs: Number(record.collectedAmount) || 0,
          paidAt: record.updatedAt || new Date().toISOString(),
          failureReason: record.message,
          rawResponse: record,
        };
      }

      // 404 simply means the push hasn't produced a payment record yet.
      if (res.status !== 404) {
        console.warn(`[ClickPesa StatusCheck] Unexpected response for ${orderReference}:`, text.substring(0, 300));
      }
    } catch (err) {
      console.error(`[ClickPesa StatusCheck] Request failed for ${orderReference}:`, err);
    }

    return { success: true, status: 'pending', amountTzs: 0 };
  }

  async handleWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
    _config: PaymentProviderConfig
  ): Promise<WebhookResult> {
    const data: any = (body as any).data || body;
    const rawStatus = String(data.status || '').toUpperCase();

    const status: 'successful' | 'failed' | 'cancelled' =
      rawStatus === 'SUCCESS' || rawStatus === 'SETTLED' ? 'successful' : 'failed';

    return {
      // ClickPesa webhooks are verified by IP whitelisting rather than a
      // signature header, so we don't claim cryptographic verification here.
      verified: false,
      transactionId: String(data.orderReference || ''),
      gatewayTransactionId: String(data.id || data.paymentReference || data.orderReference || ''),
      status,
      amountTzs: Number(data.collectedAmount) || 0,
      phoneNumber: String(data.paymentPhoneNumber || ''),
      failureReason: data.message ? String(data.message) : undefined,
      rawPayload: body,
    };
  }
}
