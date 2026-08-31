/**
 * HotspotTZ - Automated Time-Based Wi-Fi Hotspot Management System
 * Optimized for MikroTik RB941 & Tanzania Mobile Payment Gateways (TZS)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  Ticket,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Smartphone,
  PhoneCall,
  KeyRound,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

import {
  TimePackage,
  HotspotSession,
  HotspotSettings,
  AdminUser,
} from './types.js';
import { translations } from './translations.js';

// Customer Components
import { Header } from './components/CustomerPortal/Header.js';
import { PackageCard } from './components/CustomerPortal/PackageCard.js';
import { PaymentChoiceModal } from './components/CustomerPortal/PaymentChoiceModal.js';
import { MobilePaymentModal } from './components/CustomerPortal/MobilePaymentModal.js';
import { CashVoucherModal } from './components/CustomerPortal/CashVoucherModal.js';
import { ActiveSessionDashboard } from './components/CustomerPortal/ActiveSessionDashboard.js';
import { HelpModal } from './components/CustomerPortal/HelpModal.js';

// Admin Components
import { AdminLayout, AdminTab } from './components/AdminPortal/AdminLayout.js';
import { AdminLoginModal } from './components/AdminPortal/AdminLoginModal.js';
import { DashboardView } from './components/AdminPortal/DashboardView.js';
import { PackagesView } from './components/AdminPortal/PackagesView.js';
import { VouchersView } from './components/AdminPortal/VouchersView.js';
import { CustomersView } from './components/AdminPortal/CustomersView.js';
import { PaymentsView } from './components/AdminPortal/PaymentsView.js';
import { MikroTikView } from './components/AdminPortal/MikroTikView.js';
import { ReportsView } from './components/AdminPortal/ReportsView.js';
import { AuditLogsView } from './components/AdminPortal/AuditLogsView.js';
import { SettingsView } from './components/AdminPortal/SettingsView.js';

export default function App() {
  // Global & Language State
  const [lang, setLang] = useState<'en' | 'sw'>('sw'); // Default to Kiswahili for Tanzania
  const t = translations[lang];

  // Customer Portal State with Tanzanian Default Packages
  const [packages, setPackages] = useState<TimePackage[]>([
    {
      id: 'pkg-1h',
      name: '1 Hour (Saa 1)',
      durationMinutes: 60,
      durationValue: 1,
      durationUnit: 'hours',
      priceTzs: 300,
      description: 'Saa moja ya intaneti yenye kasi ya juu bila kikomo cha GB',
      status: 'active',
      popular: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pkg-3h',
      name: '3 Hours (Saa 3)',
      durationMinutes: 180,
      durationValue: 3,
      durationUnit: 'hours',
      priceTzs: 500,
      description: 'Masaa matatu ya kufanya kazi, muziki na mitandao ya kijamii',
      status: 'active',
      popular: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pkg-12h',
      name: '12 Hours (Nusu Siku)',
      durationMinutes: 720,
      durationValue: 12,
      durationUnit: 'hours',
      priceTzs: 1000,
      description: 'Nusu siku nzima ya intaneti kwa biashara na ofisini',
      status: 'active',
      popular: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pkg-24h',
      name: '24 Hours (Siku 1)',
      durationMinutes: 1440,
      durationValue: 24,
      durationUnit: 'hours',
      priceTzs: 2000,
      description: 'Siku nzima ya intaneti bila kikomo kwa vifaa vyako vyote',
      status: 'active',
      popular: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pkg-7d',
      name: '7 Days (Wiki 1)',
      durationMinutes: 10080,
      durationValue: 7,
      durationUnit: 'days',
      priceTzs: 10000,
      description: 'Kifurushi cha wiki nzima kwa matumizi endelevu',
      status: 'active',
      popular: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [currentSession, setCurrentSession] = useState<HotspotSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [clientInfo, setClientInfo] = useState<{ mac: string; ip: string } | null>({
    mac: 'D4:CA:6D:88:12:44',
    ip: '192.168.88.240',
  });
  const [settings, setSettings] = useState<HotspotSettings>({
    businessName: 'HotspotTZ Wi-Fi',
    hotspotName: 'MikroTik RB941 Node',
    currency: 'TZS',
    adminPhoneNumber: '0754 123 456',
    supportWhatsApp: '255754123456',
    supportMessage: 'Kwa msaada wa kujiunga na intaneti, wasiliana na msimamizi wetu.',
    requirePhoneForVoucher: false,
    sessionCheckIntervalSeconds: 15,
  });

  // Modal Triggers
  const [selectedPackage, setSelectedPackage] = useState<TimePackage | null>(null);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  // Admin View State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>('customer');

  // Fetch Public Portal Data
  const loadPortalData = useCallback(async () => {
    setIsLoadingPortal(true);
    try {
      const [pkgsRes, statusRes] = await Promise.all([
        fetch('/api/packages').catch(() => null),
        fetch('/api/status').catch(() => null),
      ]);

      if (pkgsRes && pkgsRes.ok) {
        const contentType = pkgsRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const pkgsData = await pkgsRes.json();
          if (Array.isArray(pkgsData) && pkgsData.length > 0) {
            setPackages(pkgsData);
          }
        }
      }

      if (statusRes && statusRes.ok) {
        const contentType = statusRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const statusData = await statusRes.json();
          if (statusData.hotspotSettings) {
            setSettings(statusData.hotspotSettings);
          }
          if (statusData.clientInfo) {
            setClientInfo(statusData.clientInfo);
          }
          if (statusData.authenticated && statusData.session) {
            setCurrentSession(statusData.session);
            setRemainingSeconds(statusData.remainingSeconds || 0);
          } else {
            setCurrentSession(null);
            setRemainingSeconds(0);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load portal status:', err);
    } finally {
      setIsLoadingPortal(false);
    }
  }, []);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Handle Package Selection
  const handleSelectPackage = (pkg: TimePackage) => {
    setSelectedPackage(pkg);
    setIsChoiceModalOpen(true);
  };

  // Switch to Mobile Payment
  const handleChooseMobile = () => {
    setIsChoiceModalOpen(false);
    setIsMobileModalOpen(true);
  };

  // Switch to Cash / Voucher Payment
  const handleChooseCash = () => {
    setIsChoiceModalOpen(false);
    setIsCashModalOpen(true);
  };

  // Handle Direct Cash Voucher Button (from top banner)
  const handleDirectVoucherClick = () => {
    setSelectedPackage(null);
    setIsCashModalOpen(true);
  };

  // Handle Successful Connection
  const handleSessionActivated = (session: HotspotSession) => {
    setIsChoiceModalOpen(false);
    setIsMobileModalOpen(false);
    setIsCashModalOpen(false);
    setCurrentSession(session);

    const rem = Math.max(0, Math.floor((new Date(session.expiryTime).getTime() - Date.now()) / 1000));
    setRemainingSeconds(rem);
  };

  // Handle Disconnect
  const handleSessionDisconnected = () => {
    setCurrentSession(null);
    setRemainingSeconds(0);
    loadPortalData();
  };

  // Admin Login
  const handleAdminLoginSuccess = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    setIsAdminLoggedIn(true);
    setViewMode('admin');
  };

  // Admin Logout
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setCurrentAdmin(null);
    setViewMode('customer');
  };

  // ================= ADMIN VIEW =================
  if (viewMode === 'admin' && isAdminLoggedIn && currentAdmin) {
    return (
      <AdminLayout
        currentTab={adminTab}
        setTab={setAdminTab}
        admin={currentAdmin}
        onLogout={handleAdminLogout}
        onGoToCustomerPortal={() => setViewMode('customer')}
        lang={lang}
        setLang={setLang}
      >
        {adminTab === 'dashboard' && <DashboardView />}
        {adminTab === 'packages' && <PackagesView />}
        {adminTab === 'vouchers' && <VouchersView />}
        {adminTab === 'customers' && <CustomersView />}
        {adminTab === 'payments' && <PaymentsView />}
        {adminTab === 'mikrotik' && <MikroTikView />}
        {adminTab === 'reports' && <ReportsView />}
        {adminTab === 'audit' && <AuditLogsView />}
        {adminTab === 'settings' && <SettingsView />}
      </AdminLayout>
    );
  }

  // ================= CUSTOMER PORTAL VIEW =================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white" id="hotspot-app-root">
      {/* Sticky Header */}
      <Header
        lang={lang}
        setLang={setLang}
        businessName={settings.businessName}
        hotspotName={settings.hotspotName}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onOpenAdmin={() => {
          if (isAdminLoggedIn) {
            setViewMode('admin');
          } else {
            setIsAdminLoginOpen(true);
          }
        }}
        onRefresh={loadPortalData}
        isLoading={isLoadingPortal}
      />

      {/* Main View: Active "MY INTERNET" Dashboard OR Captive Portal Package Selection */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {currentSession ? (
          /* ============= STATE A: AUTHENTICATED "MY INTERNET" DASHBOARD ============= */
          <ActiveSessionDashboard
            session={currentSession}
            initialRemainingSeconds={remainingSeconds}
            lang={lang}
            onRenew={() => {
              setCurrentSession(null);
            }}
            onDisconnect={handleSessionDisconnected}
            onOpenHelp={() => setIsHelpModalOpen(true)}
            adminPhone={settings.adminPhoneNumber}
            supportWhatsApp={settings.supportWhatsApp}
          />
        ) : (
          /* ============= STATE B: CAPTIVE PORTAL PACKAGE SELECTION ============= */
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            {/* Hero Greeting & Quick Voucher Entry Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1.5 max-w-lg">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'sw' ? 'Mtandao wa Kasi wa Wi-Fi' : 'High-Speed Wi-Fi Hotspot'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    {t.heroTitle}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {t.heroSubtitle}
                  </p>
                </div>

                {/* Quick Cash Voucher Button */}
                <div className="shrink-0">
                  <button
                    onClick={handleDirectVoucherClick}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
                    id="btn-direct-voucher-entry"
                  >
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>{t.haveVoucherButton}</span>
                  </button>
                </div>
              </div>

              {/* Detected Device Connection Info Bar */}
              {clientInfo && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-3">
                    <span>IP: <strong className="text-slate-800">{clientInfo.ip}</strong></span>
                    <span>MAC: <strong className="text-slate-800">{clientInfo.mac}</strong></span>
                  </div>
                  <span className="text-emerald-700 font-semibold font-sans">
                    {lang === 'sw' ? '● Tayari kuunganishwa na MikroTik RB941' : '● Ready to authorize on MikroTik RB941'}
                  </span>
                </div>
              )}
            </div>

            {/* Packages Section Heading */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">{t.packagesTitle}</h3>
                <p className="text-xs text-slate-500">{t.packagesSubtitle}</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                TZS Currency
              </span>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {packages
                .filter((p) => p.status === 'active')
                .map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    lang={lang}
                    onSelect={handleSelectPackage}
                  />
                ))}
            </div>

            {/* Bottom Help & Payment Information Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{t.lipaKwaSimu}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {lang === 'sw'
                      ? 'Lipa kwa M-Pesa, Tigo Pesa, Airtel Money au HaloPesa. Intaneti inafunguka papo hapo.'
                      : 'Pay instantly with M-Pesa, Tigo Pesa, Airtel Money, or HaloPesa with automatic activation.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{t.lipaCash}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {lang === 'sw'
                      ? `Lipa fedha taslimu kwa msimamizi (${settings.adminPhoneNumber}) kisha weka namba ya vocha.`
                      : `Pay cash directly to our administrator (${settings.adminPhoneNumber}) and enter the voucher code.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 mt-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800">{settings.businessName}</span>
            <span>•</span>
            <span>MikroTik RB941 Automatic Hotspot</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              {t.helpSupport}
            </button>
            <span>•</span>
            <button
              onClick={() => {
                if (isAdminLoggedIn) setViewMode('admin');
                else setIsAdminLoginOpen(true);
              }}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              {t.adminLogin}
            </button>
          </div>
        </div>
      </footer>

      {/* ================= MODALS ================= */}

      {/* 1. Payment Choice Modal (Lipa Kwa Simu vs Lipa Cash) */}
      {isChoiceModalOpen && selectedPackage && (
        <PaymentChoiceModal
          pkg={selectedPackage}
          lang={lang}
          onClose={() => setIsChoiceModalOpen(false)}
          onChooseMobile={handleChooseMobile}
          onChooseCash={handleChooseCash}
        />
      )}

      {/* 2. Mobile Payment Modal */}
      {isMobileModalOpen && selectedPackage && (
        <MobilePaymentModal
          pkg={selectedPackage}
          lang={lang}
          onClose={() => setIsMobileModalOpen(false)}
          onBack={() => {
            setIsMobileModalOpen(false);
            setIsChoiceModalOpen(true);
          }}
          onSuccess={handleSessionActivated}
        />
      )}

      {/* 3. Cash Voucher Modal */}
      {isCashModalOpen && (
        <CashVoucherModal
          pkg={selectedPackage}
          adminPhone={settings.adminPhoneNumber}
          lang={lang}
          onClose={() => setIsCashModalOpen(false)}
          onBack={() => {
            setIsCashModalOpen(false);
            if (selectedPackage) setIsChoiceModalOpen(true);
          }}
          onSuccess={handleSessionActivated}
        />
      )}

      {/* 4. Help & Support Modal */}
      {isHelpModalOpen && (
        <HelpModal
          lang={lang}
          adminPhone={settings.adminPhoneNumber}
          supportWhatsApp={settings.supportWhatsApp}
          businessName={settings.businessName}
          supportMessage={settings.supportMessage}
          onClose={() => setIsHelpModalOpen(false)}
        />
      )}

      {/* 5. Admin Login Modal */}
      {isAdminLoginOpen && (
        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onLoginSuccess={handleAdminLoginSuccess}
        />
      )}
    </div>
  );
}
