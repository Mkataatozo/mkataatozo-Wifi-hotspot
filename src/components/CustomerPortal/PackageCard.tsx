import React from 'react';
import { Clock, Zap, ArrowRight } from 'lucide-react';
import { TimePackage } from '../../types.js';
import { translations } from '../../translations.js';

interface PackageCardProps {
  pkg: TimePackage;
  lang: 'en' | 'sw';
  onSelect: (pkg: TimePackage) => void;
}

export const PackageCard: React.FC<PackageCardProps> = ({ pkg, lang, onSelect }) => {
  const t = translations[lang];

  // Helper to format duration string
  const formatDuration = (val: number, unit: string) => {
    if (lang === 'sw') {
      if (unit === 'minutes') return `${val} ${t.minutes}`;
      if (unit === 'hours') return `${val} ${t.hours}`;
      if (unit === 'days') return `${val} ${t.days}`;
    }
    return `${val} ${unit.charAt(0).toUpperCase() + unit.slice(1)}`;
  };

  return (
    <div
      className={`relative bg-white rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-150 ${
        pkg.popular
          ? 'border-emerald-500 ring-2 ring-emerald-500/15 shadow-xs'
          : 'border-slate-200 hover:border-slate-300 shadow-2xs'
      }`}
      id={`package-card-${pkg.id}`}
    >
      {pkg.popular && (
        <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase shadow-xs flex items-center gap-1">
          <Zap className="w-3 h-3 fill-current" />
          <span>{t.popular}</span>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-900 font-bold text-lg sm:text-xl">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>{formatDuration(pkg.durationValue, pkg.durationUnit)}</span>
          </div>
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              <span className="text-xs font-semibold text-slate-500 mr-1">TZS</span>
              {pkg.priceTzs.toLocaleString()}
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
          {pkg.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-500">
          {lang === 'sw' ? 'Muda tu • Bila kikomo MB' : 'Time-based • Unlimited speed'}
        </span>
        <button
          onClick={() => onSelect(pkg)}
          className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
            pkg.popular
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
          id={`btn-select-package-${pkg.id}`}
        >
          <span>{t.selectPackage}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
