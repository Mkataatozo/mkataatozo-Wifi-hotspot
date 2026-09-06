import React, { useState } from 'react';
import {
  KeyRound,
  X,
  ArrowLeft,
  PhoneCall,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { TimePackage, HotspotSession } from '../../types.js';
import { translations } from '../../translations.js';

interface CashVoucherModalProps {
  pkg?: TimePackage | null;
  adminPhone: string;
  lang: 'en' | 'sw';
  onClose: () => void;
  onBack: () => void;
  onSuccess: (session: HotspotSession) => void;
  clientMac?: string;
  clientIp?: string;
}

export const CashVoucherModal: React.FC<CashVoucherModalProps> = ({
  pkg,
  adminPhone,
  lang,
  onClose,
  onBack,
  onSuccess,
  clientMac,
  clientIp,
}) => {
  const t = translations[lang];
  const [voucherCode, setVoucherCode] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = voucherCode.trim();
    if (!cleanCode) {
      setErrorMessage(lang === 'sw' ? 'Weka namba ya vocha.' : 'Please enter a voucher code.');
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherCode: cleanCode,
          phoneNumber: customerPhone || undefined,
          mac: clientMac,
          ip: clientIp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.voucherError);
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(data.session);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        id="cash-voucher-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              title={t.back}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              {pkg && (
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {pkg.name} • TZS {pkg.priceTzs.toLocaleString()}
                </span>
              )}
              <h3 className="text-lg font-bold text-slate-900">{t.cashPaymentTitle}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            id="btn-close-cash-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="font-bold text-slate-900 text-lg">{t.voucherSuccess}</h4>
            <p className="text-xs text-slate-600">
              {lang === 'sw' ? 'Intaneti imefunguliwa!' : 'Connected! Redirecting to dashboard...'}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Step 1: Admin Contact Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-[11px] font-extrabold">1</span>
                <span>{t.cashPaymentStep1}</span>
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold">{t.adminPhone}</div>
                    <div className="text-sm font-extrabold text-slate-900 font-mono">{adminPhone}</div>
                  </div>
                </div>
                <a
                  href={`tel:${adminPhone.replace(/\s+/g, '')}`}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
                >
                  {t.callNow}
                </a>
              </div>
            </div>

            {/* Step 2: Voucher Input Form */}
            <form onSubmit={handleRedeemVoucher} className="space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-[11px] font-extrabold">2</span>
                <span>{t.cashPaymentStep2}</span>
              </div>

              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="TZ-941-8X2A"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold tracking-wider focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white text-sm uppercase"
                    id="input-voucher-code"
                  />
                </div>
              </div>

              {/* Sample Voucher Quick Fill for Tester */}
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Sample vouchers:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVoucherCode('TZ-941-8X2A')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-mono text-[10px] text-slate-700 font-semibold"
                  >
                    3 Hrs: TZ-941-8X2A
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherCode('TZ-941-4K9P')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-mono text-[10px] text-slate-700 font-semibold"
                  >
                    1 Hr: TZ-941-4K9P
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isValidating || !voucherCode}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-sm"
                id="btn-submit-voucher"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.validatingVoucher}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>{t.connectWithVoucher}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          <span>Server-Side Single-Use Voucher Validation</span>
        </div>
      </div>
    </div>
  );
};
