import {
  PaymentProvider,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentStatusResponse,
  WebhookResult,
  PaymentProviderConfig,
} from './PaymentProvider.ts';
import { ClickPesaProvider } from './ClickPesaProvider.ts';
import { PlusPesaProvider } from './PlusPesaProvider.ts';

/**
 * Smart Router - automatically picks the best mobile money gateway for each
 * payment, and falls back to the other one if the first fails.
 *
 * Why this exists (real network constraints, not theory):
 *   - ClickPesa  : collects from TZS 500 on ALL networks
 *                  (M-Pesa, Tigo, Airtel, Halotel).
 *   - PlusPesa   : amounts under TZS 1000 only push reliably on Airtel.
 *
 * So the routing rules are:
 *   amount >= 500  -> ClickPesa first (works on every network),
 *                     PlusPesa as automatic fallback.
 *   amount <  500  -> PlusPesa only, and only on Airtel. Any other network
 *                     is rejected up front with a clear message instead of a
 *                     silent failure, so the customer is told to use Airtel
 *                     or buy a cash voucher.
 *
 * Only gateways that actually have credentials configured are ever used.
 */
export class SmartRouterProvider implements PaymentProvider {
  readonly id = 'auto';
  readonly name = 'Auto (ClickPesa + PlusPesa)';

  private clickpesa = new ClickPesaProvider();
  private pluspesa = new PlusPesaProvider();

  /** ClickPesa's minimum collection amount. */
  private static readonly CLICKPESA_MIN_TZS = 500;
  /** Below this, PlusPesa only works on Airtel. */
  private static readonly PLUSPESA_SUB_LIMIT_TZS = 1000;

  private normalizePhone(phone: string): { international: string; local: string } {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) return { international: '255' + clean.substring(1), local: clean };
    if (clean.startsWith('255')) return { international: clean, local: '0' + clean.substring(3) };
    if (clean.length === 9) return { international: '255' + clean, local: '0' + clean };
    return { international: clean, local: clean };
  }

  private isAirtel(phone: string): boolean {
    const { international } = this.normalizePhone(phone);
    const prefix = international.substring(3, 5);
    return ['78', '68', '69'].includes(prefix);
  }

  private clickPesaConfigured(config: PaymentProviderConfig): boolean {
    if (config.clickpesa?.enabled === false) return false;
    const clientId = config.clickpesa?.clientId || '';
    const apiKey = config.clickpesa?.apiKey || '';
    return Boolean(clientId.trim() && apiKey.trim());
  }

  private plusPesaConfigured(config: PaymentProviderConfig): boolean {
    if (config.pluspesa?.enabled === false) return false;
    const publicKey = config.pluspesa?.publicKey || config.publicKey || config.apiKey || '';
    const secretKey = config.pluspesa?.secretKey || config.secretKey || config.apiSecret || '';
    return Boolean(publicKey.trim() && secretKey.trim());
  }

  /**
   * Builds the config object each underlying provider expects, pulling from
   * its own dedicated block so the two gateways never overwrite each other.
   */
  private configFor(providerId: string, config: PaymentProviderConfig): PaymentProviderConfig {
    if (providerId === 'clickpesa') {
      return {
        ...config,
        clickpesa: config.clickpesa,
        publicKey: config.clickpesa?.clientId,
        secretKey: config.clickpesa?.apiKey,
        apiUrl: config.clickpesa?.apiUrl,
      };
    }
    return {
      ...config,
      publicKey: config.pluspesa?.publicKey || config.publicKey || config.apiKey,
      secretKey: config.pluspesa?.secretKey || config.secretKey || config.apiSecret,
      apiUrl: config.pluspesa?.apiUrl || config.apiUrl,
    };
  }

  /** Decides the ordered list of gateways to try for this specific payment. */
  private routeFor(
    req: PaymentInitiateRequest,
    config: PaymentProviderConfig
  ): { order: PaymentProvider[]; blockedReason?: string } {
    const hasClick = this.clickPesaConfigured(config);
    const hasPlus = this.plusPesaConfigured(config);
    const airtel = this.isAirtel(req.phoneNumber);

    if (req.amountTzs >= SmartRouterProvider.CLICKPESA_MIN_TZS) {
      const order: PaymentProvider[] = [];
      if (hasClick) order.push(this.clickpesa);
      // PlusPesa is a valid fallback here only if the amount is safe for this
      // network (>= 1000, or any amount on Airtel).
      const plusViable = req.amountTzs >= SmartRouterProvider.PLUSPESA_SUB_LIMIT_TZS || airtel;
      if (hasPlus && plusViable) order.push(this.pluspesa);
      return { order };
    }

    // Under TZS 500: ClickPesa can't take it, so it's PlusPesa-on-Airtel only.
    if (!airtel) {
      return {
        order: [],
        blockedReason:
          `Kwa kifurushi hiki (TZS ${req.amountTzs.toLocaleString()}), kulipa kwa simu kunapatikana kwa Airtel Money pekee. ` +
          `Tafadhali tumia namba ya Airtel au nunua vocha kwa wakala wetu.`,
      };
    }
    return { order: hasPlus ? [this.pluspesa] : [] };
  }

  async initializePayment(
    req: PaymentInitiateRequest,
    config: PaymentProviderConfig
  ): Promise<PaymentInitiateResponse> {
    const { order, blockedReason } = this.routeFor(req, config);

    if (blockedReason) {
      return { success: false, provider: this.id, status: 'failed', message: blockedReason };
    }

    if (order.length === 0) {
      return {
        success: false,
        provider: this.id,
        status: 'failed',
        message:
          'No mobile money gateway is configured for this amount. Add ClickPesa or PlusPesa credentials in Settings > Payment Gateway.',
      };
    }

    const attempts: Array<{ provider: string; message: string }> = [];

    for (const provider of order) {
      const result = await provider.initializePayment(req, this.configFor(provider.id, config));

      if (result.success) {
        // Report the gateway that actually handled it, so status polling and
        // webhooks are routed back to the same one.
        return {
          ...result,
          provider: provider.id,
          rawResponse: { ...(result.rawResponse || {}), routedBy: this.id, previousAttempts: attempts },
        };
      }

      attempts.push({ provider: provider.id, message: result.message });
      console.warn(`[SmartRouter] ${provider.name} failed, trying next gateway. Reason: ${result.message}`);
    }

    return {
      success: false,
      provider: this.id,
      status: 'failed',
      message: `All payment gateways failed. ${attempts.map((a) => `${a.provider}: ${a.message}`).join(' | ')}`,
      rawResponse: { attempts },
    };
  }

  async checkPaymentStatus(
    transactionId: string,
    gatewayTxId?: string,
    config: PaymentProviderConfig = {}
  ): Promise<PaymentStatusResponse> {
    // Should not normally be reached - transactions record the real gateway id
    // at initiate time. Kept as a safety net: ask both, prefer a settled answer.
    for (const provider of [this.clickpesa, this.pluspesa]) {
      const result = await provider.checkPaymentStatus(
        transactionId,
        gatewayTxId,
        this.configFor(provider.id, config)
      );
      if (result.status !== 'pending') return result;
    }
    return { success: true, status: 'pending', amountTzs: 0 };
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
    config: PaymentProviderConfig
  ): Promise<WebhookResult> {
    // ClickPesa payloads carry an orderReference; PlusPesa uses external_id.
    const data: any = (body as any).data || body;
    const looksLikeClickPesa = Boolean(data.orderReference) && !data.external_id;
    const provider = looksLikeClickPesa ? this.clickpesa : this.pluspesa;
    return provider.handleWebhook(headers, body, this.configFor(provider.id, config));
  }
}
