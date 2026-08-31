import React from 'react';
import { PhoneCall, MessageSquare, X, ShieldCheck, Wifi, MapPin } from 'lucide-react';
import { translations } from '../../translations.js';

interface HelpModalProps {
  lang: 'en' | 'sw';
  adminPhone: string;
  supportWhatsApp?: string;
  businessName: string;
  supportMessage: string;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  lang,
  adminPhone,
  supportWhatsApp,
  businessName,
  supportMessage,
  onClose,
}) => {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4"
        id="help-modal"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.helpSupport}</h3>
              <p className="text-[11px] text-slate-500">{businessName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {supportMessage}
        </p>

        <div className="space-y-2.5">
          {/* Call Administrator */}
          <a
            href={`tel:${adminPhone.replace(/\s+/g, '')}`}
            className="w-full p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-300">{lang === 'sw' ? 'Msimamizi wa Kituo' : 'Hotspot Administrator'}</div>
                <div className="text-sm font-bold font-mono">{adminPhone}</div>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-white/10 text-white rounded-md text-xs font-bold">
              {t.callNow}
            </span>
          </a>

          {/* WhatsApp Support */}
          {supportWhatsApp && (
            <a
              href={`https://wa.me/${supportWhatsApp.replace(/\D/g, '')}?text=Habari,%20nahitaji%20msaada%20wa%20Hotspot%20Wi-Fi`}
              target="_blank"
              rel="noreferrer"
              className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-xs font-semibold text-emerald-100">WhatsApp</div>
                  <div className="text-sm font-bold font-mono">+{supportWhatsApp}</div>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white/20 text-white rounded-md text-xs font-bold">
                {t.whatsappNow}
              </span>
            </a>
          )}
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'sw' ? 'Jinsi ya Kuunganishwa' : 'How To Connect'}</span>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-500">
            <li>{lang === 'sw' ? 'Chagua kifurushi cha muda unachotaka.' : 'Choose your preferred time package.'}</li>
            <li>{lang === 'sw' ? 'Lipa kwa simu au lipa cash kwa msimamizi na uweke vocha.' : 'Pay with Mobile Money or pay cash to the admin for a voucher.'}</li>
            <li>{lang === 'sw' ? 'Intaneti itafunguka papo hapo bila kuweka nenosiri.' : 'Internet opens instantly automatically on your device.'}</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
