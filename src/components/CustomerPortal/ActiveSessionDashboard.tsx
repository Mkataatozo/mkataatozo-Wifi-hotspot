import React, { useState, useEffect } from 'react';
import {
  Clock,
  Wifi,
  PhoneCall,
  LogOut,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { HotspotSession } from '../../types.js';
import { translations } from '../../translations.js';

interface ActiveSessionDashboardProps {
  session: HotspotSession;
  initialRemainingSeconds: number;
  lang: 'en' | 'sw';
  onRenew: () => void;
  onDisconnect: () => void;
  onOpenHelp: () => void;
  adminPhone: string;
  supportWhatsApp?: string;
}

export const ActiveSessionDashboard: React.FC<ActiveSessionDashboardProps> = ({
  session,
  initialRemainingSeconds,
  lang,
  onRenew,
  onDisconnect,
  onOpenHelp,
  adminPhone,
  supportWhatsApp,
}) => {
  const t = translations[lang];
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Dynamic live countdown timer
  useEffect(() => {
    setRemainingSeconds(initialRemainingSeconds);
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialRemainingSeconds]);

  // Format seconds to HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Format time of day
  const formatTimeOfDay = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const isExpired = remainingSeconds <= 0;

  const handleDisconnectClick = async () => {
    if (confirm(lang === 'sw' ? 'Je, una uhakika unataka kukata intaneti?' : 'Are you sure you want to disconnect?')) {
      setIsDisconnecting(true);
      try {
        await fetch('/api/sessions/disconnect', { method: 'POST' });
        onDisconnect();
      } catch (err) {
        console.error(err);
      } finally {
        setIsDisconnecting(false);
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 space-y-6" id="my-internet-dashboard">
      {/* Status Hero Card */}
      <div
        className={`rounded-2xl border p-6 sm:p-8 text-center transition-all ${
          isExpired
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{isExpired ? (lang === 'sw' ? 'MUDA UMEISHA' : 'SESSION EXPIRED') : t.myInternetTitle}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {session.packageName}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{t.myInternetSubtitle}</p>

        {/* Big Remaining Countdown Clock */}
        <div className="my-6 py-4 bg-slate-900 rounded-2xl text-white shadow-inner">
          <div className="text-xs uppercase font-bold tracking-widest text-emerald-400 mb-1 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{t.remainingTime}</span>
          </div>
          <div
            className="text-4xl sm:text-5xl font-mono font-black tracking-wider text-emerald-400"
            id="countdown-clock"
          >
            {formatTime(remainingSeconds)}
          </div>
        </div>

        {/* Start & Expiry details */}
        <div className="grid grid-cols-2 gap-3 pt-2 text-left">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 font-semibold block">{t.startTime}</span>
            <span className="text-sm font-bold text-slate-800">{formatTimeOfDay(session.startTime)}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 font-semibold block">{t.expiryTime}</span>
            <span className="text-sm font-bold text-slate-800">{formatTimeOfDay(session.expiryTime)}</span>
          </div>
        </div>

        {/* Expiration Notice or Action */}
        {isExpired ? (
          <div className="mt-6 p-4 bg-rose-100/70 rounded-xl border border-rose-200 text-rose-800 text-xs space-y-3">
            <div className="flex items-center justify-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>{lang === 'sw' ? 'Kifurushi kimeisha. Mtandao umefungwa.' : 'Your time package has expired.'}</span>
            </div>
            <button
              onClick={onRenew}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
            >
              {t.renewPackage}
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={onRenew}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
              id="btn-renew-package"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.renewPackage}</span>
            </button>
            <button
              onClick={handleDisconnectClick}
              disabled={isDisconnecting}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              id="btn-disconnect-session"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.disconnect}</span>
            </button>
          </div>
        )}
      </div>

      {/* Network Diagnostics Info (Device Details) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'sw' ? 'Taarifa za Kifaa Chako' : 'Device Connection Info'}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">MikroTik RouterOS RB941</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">{t.deviceMac}</span>
            <span className="font-mono text-slate-700">{session.customerMac}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">{t.deviceIp}</span>
            <span className="font-mono text-slate-700">{session.customerIp}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Router User</span>
            <span className="font-mono text-slate-700 truncate block">{session.mikrotikUser}</span>
          </div>
        </div>
      </div>

      {/* Help & Support Card */}
      <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{t.helpSupport}</h4>
          <p className="text-xs text-slate-600 mt-0.5">{t.supportMessage}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:${adminPhone.replace(/\s+/g, '')}`}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{t.callNow}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
