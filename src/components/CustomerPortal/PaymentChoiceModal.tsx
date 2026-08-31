import React from 'react';
import { Smartphone, Banknote, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { TimePackage } from '../../types.js';
import { translations } from '../../translations.js';

interface PaymentChoiceModalProps {
  pkg: TimePackage;
  lang: 'en' | 'sw';
  onClose: () => void;
  onChooseMobile: () => void;
  onChooseCash: () => void;
}

export const PaymentChoiceModal: React.FC<PaymentChoiceModalProps> = ({
  pkg,
  lang,
  onClose,
  onChooseMobile,
  onChooseCash,
}) => {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        id="payment-choice-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              {pkg.name} • TZS {pkg.priceTzs.toLocaleString()}
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{t.paymentChoiceTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            id="btn-close-payment-choice"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="mt-4 space-y-3">
          {/* 1. LIPA KWA SIMU (Primary) */}
          <button
            onClick={onChooseMobile}
            className="w-full text-left p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 transition-all group flex items-start justify-between gap-3 shadow-2xs"
            id="btn-choose-lipa-kwa-simu"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-base">{t.lipaKwaSimu}</span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-600 text-white rounded">
                    {lang === 'sw' ? 'KIOTOMATIKI' : 'AUTOMATIC'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t.lipaKwaSimuDesc}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-slate-500">
                  <span>M-Pesa</span> • <span>Tigo Pesa</span> • <span>Airtel</span> • <span>HaloPesa</span>
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-600 shrink-0 group-hover:translate-x-1 transition-transform mt-2" />
          </button>

          {/* 2. LIPA CASH (Secondary / Voucher) */}
          <button
            onClick={onChooseCash}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-50 transition-all group flex items-start justify-between gap-3"
            id="btn-choose-lipa-cash"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base">{t.lipaCash}</span>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t.lipaCashDesc}</p>
                <span className="inline-block mt-2 text-[11px] font-medium text-slate-500">
                  {lang === 'sw' ? 'Vocha inahitajika' : 'Requires cash voucher from manager'}
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 shrink-0 group-hover:translate-x-1 transition-transform mt-2" />
          </button>
        </div>

        {/* Security / MikroTik Guarantee Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{lang === 'sw' ? 'Malipo Salama • Unganisho la Haraka na MikroTik' : 'Secure Payment • Instant MikroTik Authorization'}</span>
        </div>
      </div>
    </div>
  );
};
