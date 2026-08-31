import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  X,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { TimePackage, HotspotSession } from '../../types.js';
import { translations } from '../../translations.js';

interface MobilePaymentModalProps {
  pkg: TimePackage;
  lang: 'en' | 'sw';
  onClose: () => void;
  onBack: () => void;
  onSuccess: (session: HotspotSession) => void;
}

export const MobilePaymentModal: React.FC<MobilePaymentModalProps> = ({
  pkg,
  lang,
  onClose,
  onBack,
  onSuccess,
}) => {
  const t = translations[lang];
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'input' | 'waiting_approval' | 'verifying' | 'success' | 'failed'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling interval
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMessage(
        lang === 'sw'
          ? 'Tafadhali weka namba sahihi ya simu (mfano: 0754123456)'
          : 'Please enter a valid 10-digit Tanzanian phone number (e.g. 0754123456)'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          packageId: pkg.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      setTransactionId(data.transactionId);
      setPaymentStep('waiting_approval');
      setStatusMessage(data.message || t.waitingForPin);
      startPollingStatus(data.transactionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll backend status endpoint
  const startPollingStatus = (txId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status/${txId}`);
        const data = await res.json();

        if (data.status === 'successful' && data.session) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStep('success');
          setTimeout(() => {
            onSuccess(data.session);
          }, 1200);
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStep('failed');
          setErrorMessage(data.transaction?.failureReason || t.paymentFailed);
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    }, 2500);
  };

  // Sandbox simulation: Allows verifying callback flow directly in test environments
  const handleSimulatePaymentApproval = async () => {
    if (!transactionId) return;
    setPaymentStep('verifying');
    try {
      const res = await fetch(`/api/payments/simulate-success/${transactionId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.session) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setPaymentStep('success');
        setTimeout(() => {
          onSuccess(data.session);
        }, 1000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        id="mobile-payment-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {paymentStep === 'input' && (
              <button
                onClick={onBack}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                title={t.back}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                {pkg.name} • TZS {pkg.priceTzs.toLocaleString()}
              </span>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{t.mobilePaymentTitle}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            id="btn-close-mobile-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Phone Number Input Form */}
        {paymentStep === 'input' && (
          <form onSubmit={handleInitiatePayment} className="mt-4 space-y-4">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t.mobilePaymentSubtitle}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="input-customer-phone">
                {t.phoneNumberLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <input
                  id="input-customer-phone"
                  type="tel"
                  required
                  autoFocus
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t.phoneNumberPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{t.phoneHelp}</p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !phoneNumber}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-sm"
              id="btn-submit-mobile-pay"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.processingPayment}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>
                    {t.payButton} (TZS {pkg.priceTzs.toLocaleString()})
                  </span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Waiting for USSD Approval & PIN on Phone */}
        {(paymentStep === 'waiting_approval' || paymentStep === 'verifying') && (
          <div className="mt-4 py-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-base">
                {paymentStep === 'verifying' ? t.verifyingTransaction : t.waitingForPin}
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                {statusMessage}
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-md text-[11px] font-mono text-slate-600">
                Ref: {transactionId}
              </div>
            </div>

            {/* Sandbox Quick Simulator trigger */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-left space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                <span>SIMULATION & TEST HELPER</span>
                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[9px]">SANDBOX</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                In sandbox mode without live telecom networks, click below to simulate the customer entering their PIN and the gateway webhook verifying the transaction.
              </p>
              <button
                type="button"
                onClick={handleSimulatePaymentApproval}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
                id="btn-simulate-gateway-approval"
              >
                Approve Payment via Gateway Webhook (Sandbox)
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  setPaymentStep('input');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {paymentStep === 'success' && (
          <div className="mt-4 py-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="font-bold text-slate-900 text-lg">{t.paymentSuccess}</h4>
            <p className="text-xs text-slate-600">
              {lang === 'sw'
                ? 'MikroTik router imethibitisha muunganisho wako. Unaelekezwa kwenye Dashibodi...'
                : 'MikroTik RB941 router authorized your connection. Redirecting to My Internet dashboard...'}
            </p>
          </div>
        )}

        {/* STEP 4: Failed */}
        {paymentStep === 'failed' && (
          <div className="mt-4 py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">{t.paymentFailed}</h4>
              <p className="text-xs text-slate-600 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => setPaymentStep('input')}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
            >
              {lang === 'sw' ? 'Jaribu Tena' : 'Try Again'}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Server-Side Payment Verification • No Voucher Required</span>
        </div>
      </div>
    </div>
  );
};
