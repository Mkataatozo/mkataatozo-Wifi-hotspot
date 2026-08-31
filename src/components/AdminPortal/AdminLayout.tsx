import React from 'react';
import {
  LayoutDashboard,
  Clock,
  Ticket,
  Users,
  CreditCard,
  Router,
  BarChart3,
  ScrollText,
  Settings,
  LogOut,
  ExternalLink,
  Globe,
  Wifi,
  ShieldAlert,
} from 'lucide-react';
import { AdminUser } from '../../types.js';
import { translations } from '../../translations.js';

export type AdminTab =
  | 'dashboard'
  | 'packages'
  | 'vouchers'
  | 'customers'
  | 'payments'
  | 'mikrotik'
  | 'reports'
  | 'audit'
  | 'settings';

interface AdminLayoutProps {
  currentTab: AdminTab;
  setTab: (tab: AdminTab) => void;
  admin: AdminUser;
  onLogout: () => void;
  onGoToCustomerPortal: () => void;
  lang: 'en' | 'sw';
  setLang: (l: 'en' | 'sw') => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setTab,
  admin,
  onLogout,
  onGoToCustomerPortal,
  lang,
  setLang,
  children,
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'packages', label: t.packages, icon: Clock },
    { id: 'vouchers', label: t.vouchers, icon: Ticket },
    { id: 'customers', label: t.customers, icon: Users },
    { id: 'payments', label: t.payments, icon: CreditCard },
    { id: 'mikrotik', label: 'Routers & APs', icon: Router },
    { id: 'reports', label: t.reports, icon: BarChart3 },
    { id: 'audit', label: t.auditLogs, icon: ScrollText },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900" id="admin-portal-root">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex shrink-0 flex-col justify-between border-r border-slate-800">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                <Wifi className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm leading-tight">HotspotTZ Admin</h1>
                <p className="text-[10px] text-emerald-400 font-mono">Multi-Site Controller</p>
              </div>
            </div>
          </div>

          {/* Nav List */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as AdminTab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  id={`admin-nav-${item.id}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & links */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Return to Customer Portal */}
          <button
            onClick={onGoToCustomerPortal}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </span>
            <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-mono">LIVE</span>
          </button>

          {/* Current Admin & Logout */}
          <div className="p-2.5 bg-slate-950 rounded-xl flex items-center justify-between text-xs">
            <div className="truncate pr-2">
              <div className="font-bold text-white truncate">{admin.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{admin.role}</div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Navbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 capitalize">
              {navItems.find((n) => n.id === currentTab)?.label || 'Dashboard'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              TZS (Tanzanian Shilling)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'en' ? 'SW 🇹🇿' : 'EN 🇬🇧'}</span>
            </button>

            {/* Customer Portal Quick Link */}
            <button
              onClick={onGoToCustomerPortal}
              className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Hotspot Portal</span>
            </button>
          </div>
        </div>

        {/* Tab View Container */}
        <div className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
};
