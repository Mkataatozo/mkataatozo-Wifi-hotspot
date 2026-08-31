import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  Database,
  Router,
  CreditCard,
  Building2,
  ShieldCheck,
  Code,
  Copy,
  Check,
  AlertCircle,
  Webhook,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { HotspotSettings, MikroTikConfig, PaymentGatewayConfig } from '../../types.js';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<HotspotSettings | null>(null);
  const [mikrotik, setMikrotik] = useState<MikroTikConfig | null>(null);
  const [payment, setPayment] = useState<PaymentGatewayConfig | null>(null);
  const [sqlSchema, setSqlSchema] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'business' | 'mikrotik' | 'gateway' | 'database'>('business');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    gatewayResponse?: any;
    provider?: string;
  } | null>(null);
  const [isTestingGateway, setIsTestingGateway] = useState(false);

  const getWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/payments/webhook/pluspesa`;
    }
    return 'https://your-hotspot-domain.com/api/payments/webhook/pluspesa';
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleTestGateway = async () => {
    if (!payment) return;
    setIsTestingGateway(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/payment-gateway/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `Network error reaching gateway test endpoint: ${msg}`,
      });
    } finally {
      setIsTestingGateway(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const [setRes, sqlRes] = await Promise.all([
        fetch('/api/admin/settings').catch(() => null),
        fetch('/api/admin/database/schema').catch(() => null),
      ]);
      
      if (setRes && setRes.ok && setRes.headers.get('content-type')?.includes('application/json')) {
        const setData = await setRes.json();
        if (setData.hotspot) setSettings(setData.hotspot);
        if (setData.mikrotik) setMikrotik(setData.mikrotik);
        if (setData.payment) setPayment(setData.payment);
      } else {
        // Fallback default state
        setSettings({
          businessName: 'HotspotTZ Wi-Fi',
          hotspotName: 'MikroTik RB941 Node',
          currency: 'TZS',
          adminPhoneNumber: '0754 123 456',
          supportWhatsApp: '255754123456',
          supportMessage: 'Kwa msaada wa kujiunga na intaneti, wasiliana na msimamizi wetu.',
          requirePhoneForVoucher: false,
          sessionCheckIntervalSeconds: 15,
        });
        setMikrotik({
          host: '192.168.88.1',
          apiPort: 8728,
          username: 'admin',
          serverName: 'hotspot1',
        });
        setPayment({
          provider: 'pluspesa',
          environment: 'live',
          apiKey: '',
          publicKey: '',
          apiSecret: '',
          secretKey: '',
          apiUrl: 'https://admin.pluspesa.com/api',
        });
      }

      if (sqlRes && sqlRes.ok && sqlRes.headers.get('content-type')?.includes('application/json')) {
        const sqlData = await sqlRes.json();
        if (sqlData.sql) setSqlSchema(sqlData.sql);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !mikrotik || !payment) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotspot: settings,
          mikrotik,
          payment,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  if (!settings || !mikrotik || !payment) {
    return <div className="py-10 text-center text-slate-500 text-xs">Loading configuration settings...</div>;
  }

  return (
    <div className="space-y-6" id="system-settings-view">
      {/* Tab Navigation */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveTab('business')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'business' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Hotspot & Support</span>
        </button>

        <button
          onClick={() => setActiveTab('mikrotik')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'mikrotik' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Router className="w-4 h-4" />
          <span>MikroTik RB941 Router</span>
        </button>

        <button
          onClick={() => setActiveTab('gateway')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'gateway' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Mobile Payment Gateway</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'database' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Supabase / PostgreSQL SQL</span>
        </button>
      </div>

      {/* Main Settings Form */}
      {activeTab !== 'database' ? (
        <form onSubmit={handleSave} className="space-y-6">
          {/* TAB 1: Business & Customer Support */}
          {activeTab === 'business' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Hotspot Identity & Administrator Contact</h3>
              <p className="text-xs text-slate-500">
                These details are shown on the Captive Portal, Cash Voucher screen, and customer Help modals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    value={settings.businessName}
                    onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hotspot Node Name</label>
                  <input
                    type="text"
                    required
                    value={settings.hotspotName}
                    onChange={(e) => setSettings({ ...settings, hotspotName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Phone (Cash & Voucher Contact)
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.adminPhoneNumber}
                    onChange={(e) => setSettings({ ...settings, adminPhoneNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Displayed on Cash Payment screen</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Support WhatsApp (Optional)</label>
                  <input
                    type="text"
                    value={settings.supportWhatsApp || ''}
                    onChange={(e) => setSettings({ ...settings, supportWhatsApp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Support Message</label>
                  <textarea
                    rows={2}
                    value={settings.supportMessage}
                    onChange={(e) => setSettings({ ...settings, supportMessage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MikroTik Controller */}
          {activeTab === 'mikrotik' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900">MikroTik RouterOS API Settings</h3>
              <p className="text-xs text-slate-500">
                Credentials used by the server-side MikroTik service to bind active sessions on TCP port 8728.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Router IP / Host</label>
                  <input
                    type="text"
                    required
                    value={mikrotik.host}
                    onChange={(e) => setMikrotik({ ...mikrotik, host: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">RouterOS API Port</label>
                  <input
                    type="number"
                    required
                    value={mikrotik.apiPort}
                    onChange={(e) => setMikrotik({ ...mikrotik, apiPort: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">API Username</label>
                  <input
                    type="text"
                    required
                    value={mikrotik.username}
                    onChange={(e) => setMikrotik({ ...mikrotik, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">API Password</label>
                  <input
                    type="password"
                    value={mikrotik.password}
                    onChange={(e) => setMikrotik({ ...mikrotik, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hotspot Server Name</label>
                  <input
                    type="text"
                    value={mikrotik.serverName}
                    onChange={(e) => setMikrotik({ ...mikrotik, serverName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Payment Gateway Configuration - PlusPesa */}
          {activeTab === 'gateway' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active Gateway
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">PlusPesa Gateway (admin.pluspesa.com)</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Automated Tanzania Mobile Money USSD Push (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa). Authenticates with your PlusPesa Public Key and Secret Key.
                  </p>
                </div>
                <a
                  href="https://admin.pluspesa.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline shrink-0"
                >
                  Open admin.pluspesa.com ↗
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    PlusPesa Public Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payment.publicKey || payment.apiKey || ''}
                    placeholder="e.g. pk_live_... or Public Key"
                    onChange={(e) =>
                      setPayment({
                        ...payment,
                        apiKey: e.target.value,
                        publicKey: e.target.value,
                        provider: 'pluspesa',
                      })
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Public Key from your admin.pluspesa.com account.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    PlusPesa Secret Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={payment.secretKey || payment.apiSecret || ''}
                    placeholder="•••••••••••••••• (Secret Key)"
                    onChange={(e) =>
                      setPayment({
                        ...payment,
                        apiSecret: e.target.value,
                        secretKey: e.target.value,
                        provider: 'pluspesa',
                      })
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Secret Key used for secure server-side transaction signing.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Processing Mode</label>
                  <select
                    value={payment.environment}
                    onChange={(e) => setPayment({ ...payment, environment: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="live">Live Production (Sends Real USSD Push to Customer Phones)</option>
                    <option value="sandbox">Sandbox / Demo (Simulated Mode)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      PlusPesa API Base URL / Endpoint
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      (Nginx 404 means the path/subdomain needs adjusting)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={payment.apiUrl || 'https://admin.pluspesa.com/api'}
                    placeholder="e.g. https://admin.pluspesa.com/api or https://api.pluspesa.com/api"
                    onChange={(e) => setPayment({ ...payment, apiUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:ring-2 focus:ring-slate-900"
                  />
                  
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[11px] text-slate-500 font-medium">Quick Presets:</span>
                    {[
                      { label: 'Admin API (v1)', url: 'https://admin.pluspesa.com/api/v1' },
                      { label: 'Direct API Subdomain', url: 'https://api.pluspesa.com/api' },
                      { label: 'Standard API', url: 'https://admin.pluspesa.com/api' },
                      { label: 'Root Domain API', url: 'https://pluspesa.com/api' },
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setPayment({ ...payment, apiUrl: preset.url })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition-colors ${
                          payment.apiUrl === preset.url
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    💡 If your PlusPesa merchant documentation gives a specific URL (for example: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">https://admin.pluspesa.com/api/v1/c2b</code>), paste it here directly. The engine will automatically prioritize your exact endpoint.
                  </p>
                </div>

                {/* Webhook URL for PlusPesa Merchant Dashboard */}
                <div className="sm:col-span-2 p-4 bg-slate-900 text-white rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-white">Your PlusPesa Webhook / Callback URL</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyWebhook}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? 'Copied to Clipboard!' : 'Copy Webhook URL'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
                    {getWebhookUrl()}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    👉 <strong>How to use:</strong> Go to <a href="https://admin.pluspesa.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold inline-flex items-center gap-0.5">admin.pluspesa.com <ExternalLink className="w-2.5 h-2.5" /></a> &gt; <em>API Settings / Webhooks</em> &gt; Paste this Webhook URL into the <strong>Callback / Instant Payment Notification (IPN) URL</strong> field. Whenever a customer enters their PIN on Vodacom/Tigo/Airtel/Halotel, PlusPesa posts real-time confirmation directly to this URL to instantly turn on their internet.
                  </p>
                </div>
              </div>

              {/* Diagnostic Test Button */}
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Verify PlusPesa Keys</h4>
                    <p className="text-[11px] text-slate-600">
                      Send a diagnostic ping to admin.pluspesa.com using your Public Key & Secret Key.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestGateway}
                    disabled={isTestingGateway || (!payment.apiKey && !payment.publicKey && !payment.secretKey)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isTestingGateway ? (
                      <span>Testing PlusPesa Keys...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Test PlusPesa Connection</span>
                      </>
                    )}
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.gatewayResponse && (
                      <pre className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-lg text-[10px] overflow-x-auto font-mono">
                        {JSON.stringify(testResult.gatewayResponse, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Submit button bar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            {saveSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configuration saved successfully!</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400">Click save to persist changes to the runtime store.</span>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* TAB 4: Supabase / PostgreSQL SQL Schema Tab */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Production PostgreSQL / Supabase Schema</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ready to deploy on Supabase or Neon PostgreSQL. Includes normalized tables, indexes, and RLS rules.
              </p>
            </div>
            <button
              onClick={handleCopySql}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
            </button>
          </div>

          <div className="relative bg-slate-950 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto max-h-96">
            <pre className="whitespace-pre">{sqlSchema}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
