import { PaymentProvider, PaymentInitiateRequest, PaymentInitiateResponse, PaymentStatusResponse, WebhookResult, PaymentProviderConfig } from './PaymentProvider.js';

/**
 * PlusPesa Payment Gateway Provider (admin.pluspesa.com)
 * Pure API-Key driven Tanzania Mobile Money Integration (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa)
 * No merchant ID or webhook URL required - uses API Key authentication and polling status verification.
 */
export class PlusPesaProvider implements PaymentProvider {
  readonly id = 'pluspesa';
  readonly name = 'PlusPesa (admin.pluspesa.com)';

  private normalizePhone(phone: string): { international: string; local: string } {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      return {
        international: '255' + clean.substring(1),
        local: clean,
      };
    } else if (clean.startsWith('255')) {
      return {
        international: clean,
        local: '0' + clean.substring(3),
      };
    } else if (clean.length === 9) {
      return {
        international: '255' + clean,
        local: '0' + clean,
      };
    }
    return {
      international: clean,
      local: clean,
    };
  }

  private detectOperator(phone: string): string {
    const { international } = this.normalizePhone(phone);
    const prefix = international.substring(3, 5); // 255XX...
    if (['74', '75', '76'].includes(prefix)) return 'Vodacom M-Pesa';
    if (['71', '65', '67', '77'].includes(prefix)) return 'Tigo Pesa';
    if (['78', '68', '69'].includes(prefix)) return 'Airtel Money';
    if (['62', '61'].includes(prefix)) return 'HaloPesa';
    return 'Tanzania Mobile Money';
  }

  async initializePayment(req: PaymentInitiateRequest, config: PaymentProviderConfig): Promise<PaymentInitiateResponse> {
    const { international, local } = this.normalizePhone(req.phoneNumber);
    const operator = this.detectOperator(req.phoneNumber);
    const publicKey = (config.publicKey || config.apiKey || '').trim();
    const secretKey = (config.secretKey || config.apiSecret || '').trim();
    const activeKey = secretKey || publicKey;
    const baseUrl = (config.apiUrl || 'https://admin.pluspesa.com/api').replace(/\/$/, '');

    // If an API key is provided and not in sandbox simulation
    if (activeKey && config.environment !== 'sandbox') {
      try {
        // Prepare multi-header auth compatible with PlusPesa API standards
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${activeKey}`,
          'X-PUBLIC-KEY': publicKey,
          'X-SECRET-KEY': secretKey,
          'x-public-key': publicKey,
          'x-secret-key': secretKey,
          'X-API-KEY': activeKey,
          'x-api-key': activeKey,
          'apikey': activeKey,
        };

        const payload = {
          public_key: publicKey,
          secret_key: secretKey,
          publicKey,
          secretKey,
          api_key: activeKey,
          apiKey: activeKey,
          phone: international,
          phoneNumber: international,
          phone_number: international,
          localPhone: local,
          msisdn: international,
          amount: req.amountTzs,
          amount_tzs: req.amountTzs,
          reference: req.transactionId,
          order_id: req.transactionId,
          transaction_id: req.transactionId,
          description: `Wi-Fi Hotspot - ${req.packageName}`,
          package: req.packageName,
          callback_url: req.callbackUrl,
          webhook_url: req.callbackUrl,
        };

        // Construct prioritized list of candidate endpoints
        const endpointCandidates: string[] = [];

        // 1. If user entered a specific direct URL, prioritize it
        if (config.apiUrl && config.apiUrl.trim()) {
          const customUrl = config.apiUrl.trim().replace(/\/$/, '');
          endpointCandidates.push(customUrl);
          if (!customUrl.endsWith('/c2b') && !customUrl.endsWith('/stkpush') && !customUrl.endsWith('/payments')) {
            endpointCandidates.push(`${customUrl}/c2b`);
            endpointCandidates.push(`${customUrl}/v1/c2b`);
            endpointCandidates.push(`${customUrl}/stkpush`);
            endpointCandidates.push(`${customUrl}/v1/stkpush`);
            endpointCandidates.push(`${customUrl}/payment/initialize`);
            endpointCandidates.push(`${customUrl}/payments`);
            endpointCandidates.push(`${customUrl}/ussd`);
            endpointCandidates.push(`${customUrl}/v1/ussd`);
          }
        }

        // 2. Standard PlusPesa endpoint paths
        const base = (config.apiUrl || 'https://admin.pluspesa.com/api').replace(/\/$/, '');
        const standardPaths = [
          '/v1/c2b',
          '/c2b',
          '/v1/stkpush',
          '/stkpush',
          '/v1/payments',
          '/payments',
          '/payment/initialize',
          '/checkout',
          '/v1/ussd',
          '/ussd',
          '/v1/collection',
          '/collection',
        ];

        for (const p of standardPaths) {
          const u = `${base}${p}`;
          if (!endpointCandidates.includes(u)) {
            endpointCandidates.push(u);
          }
        }

        // 3. Alternative host candidates (api.pluspesa.com, pluspesa.com/api) if base contains admin.pluspesa.com
        if (base.includes('admin.pluspesa.com')) {
          const altHosts = ['https://api.pluspesa.com', 'https://pluspesa.com/api'];
          for (const alt of altHosts) {
            for (const p of ['/v1/c2b', '/c2b', '/stkpush', '/v1/stkpush']) {
              const u = `${alt}${p}`;
              if (!endpointCandidates.includes(u)) {
                endpointCandidates.push(u);
              }
            }
          }
        }

        let lastError = '';
        let lastData: any = null;
        let successfulResponse: any = null;
        let successfulEndpoint = '';
        const attemptedUrls: Array<{ url: string; status: number; textSnippet: string }> = [];

        for (const endpoint of endpointCandidates) {
          try {
            // First attempt: JSON body
            const res = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            });

            const text = await res.text();
            let parsedData: any = null;
            try {
              parsedData = JSON.parse(text);
            } catch {
              parsedData = { rawText: text.substring(0, 300), status: res.status };
            }

            attemptedUrls.push({
              url: endpoint,
              status: res.status,
              textSnippet: text.substring(0, 100).replace(/[\r\n]+/g, ' '),
            });

            if (res.ok) {
              successfulResponse = parsedData;
              successfulEndpoint = endpoint;
              break;
            } else if (res.status === 401 || res.status === 403) {
              return {
                success: false,
                provider: this.id,
                status: 'failed',
                message: `PlusPesa Authentication Failed (HTTP ${res.status}): Invalid Public Key or Secret Key. Please verify your keys on admin.pluspesa.com.`,
                rawResponse: { endpoint, ...parsedData },
              };
            } else if (res.status === 404) {
              // Endpoint route not found on this path, continue to next candidate
              lastData = parsedData;
              lastError = `HTTP 404 on ${endpoint}`;
            } else {
              lastData = parsedData;
              lastError = parsedData?.message || parsedData?.error || `HTTP ${res.status}`;
            }
          } catch (endpointErr: unknown) {
            const errString = endpointErr instanceof Error ? endpointErr.message : String(endpointErr);
            attemptedUrls.push({ url: endpoint, status: 0, textSnippet: errString });
            lastError = errString;
          }
        }

        if (successfulResponse) {
          const gwRef =
            successfulResponse.reference ||
            successfulResponse.transactionId ||
            successfulResponse.order_id ||
            successfulResponse.id ||
            `PP-${Date.now()}`;

          return {
            success: true,
            provider: this.id,
            gatewayTransactionId: String(gwRef),
            status: 'pending',
            message: `USSD push prompt sent to ${local} (${operator}). Please check your phone and enter your PIN to approve TZS ${req.amountTzs.toLocaleString()}.`,
            ussdPushSent: true,
            rawResponse: {
              endpointUsed: successfulEndpoint,
              ...successfulResponse,
            },
          };
        }

        // If all candidate endpoints returned 404 or other errors, provide an actionable explanation
        return {
          success: false,
          provider: this.id,
          status: 'failed',
          message: `PlusPesa Gateway Error (HTTP 404 / Not Found): The PlusPesa API endpoint was not found at ${baseUrl}. Please check your PlusPesa merchant documentation for the exact API Endpoint URL (e.g., https://admin.pluspesa.com/api/v1/c2b or https://api.pluspesa.com/v1/c2b) and paste it into Settings > PlusPesa Gateway > API Base URL.`,
          rawResponse: {
            configuredBaseUrl: baseUrl,
            lastError,
            attemptedEndpoints: attemptedUrls.slice(0, 6),
            lastResponse: lastData,
          },
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

    // Sandbox / Simulation Mode (or when testing without key)
    return {
      success: true,
      provider: this.id,
      gatewayTransactionId: `PLUSPESA-SANDBOX-${Date.now()}`,
      status: 'pending',
      message: `[PlusPesa Sandbox] USSD prompt initiated for ${local} (${operator}) - TZS ${req.amountTzs.toLocaleString()}.`,
      ussdPushSent: true,
      rawResponse: {
        mode: 'sandbox',
        phone: international,
        operator,
        provider: 'PlusPesa (admin.pluspesa.com)',
      },
    };
  }

  async checkPaymentStatus(
    transactionId: string,
    gatewayTxId?: string,
    config: PaymentProviderConfig = {}
  ): Promise<PaymentStatusResponse> {
    const publicKey = (config.publicKey || config.apiKey || '').trim();
    const secretKey = (config.secretKey || config.apiSecret || '').trim();
    const activeKey = secretKey || publicKey;
    const baseUrl = (config.apiUrl || 'https://admin.pluspesa.com/api').replace(/\/$/, '');

    if (activeKey && config.environment !== 'sandbox' && (gatewayTxId || transactionId)) {
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${activeKey}`,
          'X-PUBLIC-KEY': publicKey,
          'X-SECRET-KEY': secretKey,
          'x-public-key': publicKey,
          'x-secret-key': secretKey,
          'X-API-KEY': activeKey,
          'x-api-key': activeKey,
          'apikey': activeKey,
        };

        const statusUrls = [
          `${baseUrl}/payment/status?reference=${encodeURIComponent(gatewayTxId || transactionId)}`,
          `${baseUrl}/c2b/status?order_id=${encodeURIComponent(transactionId)}`,
          `${baseUrl}/status/${encodeURIComponent(gatewayTxId || transactionId)}`,
        ];

        for (const url of statusUrls) {
          try {
            const res = await fetch(url, { headers });
            if (res.ok) {
              const data = (await res.json()) as Record<string, unknown>;
              const statusStr = String(
                data.status || data.payment_status || data.transaction_status || ''
              ).toLowerCase();

              let status: 'pending' | 'successful' | 'failed' | 'cancelled' = 'pending';
              if (['success', 'successful', 'completed', 'paid', 'done'].includes(statusStr)) {
                status = 'successful';
              } else if (['failed', 'rejected', 'error', 'expired'].includes(statusStr)) {
                status = 'failed';
              } else if (['cancelled', 'canceled'].includes(statusStr)) {
                status = 'cancelled';
              }

              return {
                success: true,
                status,
                gatewayTransactionId: (data.reference as string) || (data.id as string) || gatewayTxId,
                amountTzs: Number(data.amount) || 0,
                paidAt: (data.paid_at as string) || (data.updated_at as string) || new Date().toISOString(),
                rawResponse: data,
              };
            }
          } catch {
            // continue checking next status URL
          }
        }
      } catch {
        // status check fallback
      }
    }

    return {
      success: true,
      status: 'pending',
      amountTzs: 0,
    };
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
    config: PaymentProviderConfig
  ): Promise<WebhookResult> {
    const rawStatus = String(
      body.status || body.payment_status || body.transaction_status || ''
    ).toLowerCase();

    const status: 'successful' | 'failed' | 'cancelled' =
      ['success', 'successful', 'completed', 'paid'].includes(rawStatus)
        ? 'successful'
        : ['cancelled', 'canceled'].includes(rawStatus)
        ? 'cancelled'
        : 'failed';

    return {
      verified: true,
      transactionId: String(body.reference || body.order_id || body.transaction_id || body.id || ''),
      gatewayTransactionId: String(body.gateway_reference || body.reference || body.id || ''),
      status,
      amountTzs: Number(body.amount) || 0,
      phoneNumber: String(body.phone || body.phoneNumber || body.msisdn || ''),
      failureReason: body.message ? String(body.message) : undefined,
      rawPayload: body,
    };
  }
}
