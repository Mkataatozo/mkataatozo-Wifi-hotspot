import React from 'react';
import { Wifi, Globe, PhoneCall, ShieldCheck, RefreshCw } from 'lucide-react';
import { translations } from '../../translations.js';

interface HeaderProps {
  lang: 'en' | 'sw';
  setLang: (l: 'en' | 'sw') => void;
  businessName: string;
  hotspotName: string;
  onOpenHelp: () => void;
  onOpenAdmin: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  businessName,
  hotspotName,
  onOpenHelp,
  onOpenAdmin,
  onRefresh,
  isLoading,
}) => {
  const t = translations[lang];

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs" id="customer-header">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand & Hotspot Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-slate-900 leading-tight text-base sm:text-lg">{businessName}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                MikroTik RB941
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">{hotspotName}</p>
          </div>
        </div>

        {/* Action Controls: Refresh, Help, Language, Admin */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Refresh status */}
          <button
            onClick={onRefresh}
            title="Refresh status"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            id="btn-refresh-portal"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            id="btn-open-help"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t.helpSupport}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            id="btn-toggle-language"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{lang === 'en' ? 'SW 🇹🇿' : 'EN 🇬🇧'}</span>
          </button>

          {/* Admin Login Portal Link */}
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ml-1"
            id="btn-open-admin-portal"
            title="Admin Login"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">{t.adminLogin}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
