import fs from 'fs';
import path from 'path';
import {
  TimePackage,
  Voucher,
  PaymentTransaction,
  HotspotSession,
  Customer,
  AuditLog,
  SystemSettings,
  AdminUser,
  DashboardStats,
  MikroTikRouter,
  AccessPointInfo,
} from '../src/types.js';

// Settings persist here across server restarts so you don't have to
// re-enter API keys / base URLs every time the process restarts.
// NOTE: this file contains real secrets (payment gateway keys, MikroTik
// password) - make sure server/data/ is in .gitignore.
const SETTINGS_FILE = path.join(process.cwd(), 'server', 'data', 'settings.json');

/**
 * In-Memory & Supabase-Compatible Normalized Data Store for HotspotTZ Multi-Site
 */
class DatabaseStore {
  public packages: Map<string, TimePackage> = new Map();
  public vouchers: Map<string, Voucher> = new Map();
  public transactions: Map<string, PaymentTransaction> = new Map();
  public sessions: Map<string, HotspotSession> = new Map();
  public customers: Map<string, Customer> = new Map();
  public routers: Map<string, MikroTikRouter> = new Map();
  public auditLogs: AuditLog[] = [];
  public admins: Map<string, AdminUser> = new Map();
  public settings: SystemSettings;
  public paymentDiagnostics: Array<{
    id: string;
    timestamp: string;
    type: 'initiate' | 'status_check' | 'webhook' | 'test';
    provider: string;
    phoneNumber?: string;
    amountTzs?: number;
    transactionId?: string;
    success: boolean;
    status?: string;
    message: string;
    rawResponse?: Record<string, unknown>;
  }> = [];

  constructor() {
    this.settings = {
      businessName: process.env.BUSINESS_NAME || 'HotspotTZ Wi-Fi Business',
      hotspotName: process.env.HOTSPOT_NAME || 'HotspotTZ Central Network',
      adminCashPhone: process.env.ADMIN_CASH_PHONE || '0754 123 456',
      supportPhone: process.env.SUPPORT_PHONE || '0754 123 456',
      supportWhatsApp: '255754123456',
      supportMessage: 'Fast & unlimited internet across all hotspot locations. Reach our administrator for connection support or cash vouchers.',
      currency: 'TZS',
      timezone: 'Africa/Dar_es_Salaam',
      defaultLanguage: 'en',
      paymentGateway: {
        provider: 'pluspesa',
        apiKeyMasked: '••••••••••••pluspesa_public',
        secretKeyMasked: '••••••••••••pluspesa_secret',
        merchantId: '',
        apiUrl: 'https://app.pluspesa.com/api/v1',
        webhookUrl: '/api/payments/webhook/pluspesa',
        environment: 'live',
        enabled: true,
      },
      mikrotik: {
        host: process.env.MIKROTIK_HOST || '192.168.88.1',
        apiPort: 8728,
        username: process.env.MIKROTIK_USERNAME || 'admin',
        passwordMasked: '••••••••',
        enabled: true,
        demoMode: true,
      },
    };

    this.loadSettingsFromDisk();
    this.seedInitialData();
  }

  /** Merges any previously-saved settings from disk over the defaults above. */
  private loadSettingsFromDisk() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        this.settings = { ...this.settings, ...saved };
        console.log('[DB] Loaded persisted settings from server/data/settings.json');
      }
    } catch (err) {
      console.error('[DB] Failed to load persisted settings, using defaults:', err);
    }
  }

  /** Call this after any settings mutation so it survives a server restart. */
  public saveSettingsToDisk() {
    try {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to persist settings to disk:', err);
    }
  }

  private seedInitialData() {
    // 0. Multi-Site MikroTik Routers & Connected Access Points
    const initialRouters: MikroTikRouter[] = [
      {
        id: 'router-001',
        name: 'Site 1 - Kariakoo Central Hub',
        location: 'Kariakoo Market, Dar es Salaam',
        siteCode: 'TZ-KK-01',
        model: 'MikroTik RB941-2nD (hAP lite)',
        host: '192.168.88.1',
        apiPort: 8728,
        username: 'admin',
        passwordMasked: '••••••••',
        serverName: 'hotspot-kariakoo',
        status: 'connected',
        lastChecked: new Date().toISOString(),
        uptime: '14d 08:22:15',
        cpuLoad: 12,
        memoryFreeMb: 24.5,
        totalMemoryMb: 32.0,
        activeUsersCount: 18,
        isDemoMode: true,
        totalRevenueTzs: 145000,
        totalTransactionsCount: 112,
        notes: 'Primary hub covering main marketplace stalls and waiting lounge.',
        accessPoints: [
          {
            id: 'ap-001',
            name: 'AP1 - Ground Floor Hall',
            locationArea: 'Entrance & Waiting Lounge',
            brand: 'MikroTik cAP',
            status: 'online',
            connectedClients: 11,
          },
          {
            id: 'ap-002',
            name: 'AP2 - Upper Shopping Deck',
            locationArea: 'Mezzanine Stalls',
            brand: 'Ubiquiti UniFi',
            status: 'online',
            connectedClients: 7,
          },
        ],
      },
      {
        id: 'router-002',
        name: 'Site 2 - Mlimani City Branch',
        location: 'Mwenge / Mlimani, Dar es Salaam',
        siteCode: 'TZ-MC-02',
        model: 'MikroTik hEX RB750Gr3',
        host: '192.168.89.1',
        apiPort: 8728,
        username: 'admin',
        passwordMasked: '••••••••',
        serverName: 'hotspot-mlimani',
        status: 'connected',
        lastChecked: new Date().toISOString(),
        uptime: '28d 14:10:02',
        cpuLoad: 6,
        memoryFreeMb: 215.0,
        totalMemoryMb: 256.0,
        activeUsersCount: 34,
        isDemoMode: true,
        totalRevenueTzs: 285000,
        totalTransactionsCount: 198,
        notes: 'High-traffic shopping wing and food court connection point.',
        accessPoints: [
          {
            id: 'ap-003',
            name: 'AP1 - Food Court Wing',
            locationArea: 'Dining & Seating Area',
            brand: 'Ubiquiti UniFi',
            status: 'online',
            connectedClients: 22,
          },
          {
            id: 'ap-004',
            name: 'AP2 - West Arcade',
            locationArea: 'Walkway & Parking View',
            brand: 'Ruijie Reyee',
            status: 'online',
            connectedClients: 12,
          },
        ],
      },
      {
        id: 'router-003',
        name: 'Site 3 - Sinza Lounge & Cafe',
        location: 'Sinza Mori, Dar es Salaam',
        siteCode: 'TZ-SZ-03',
        model: 'MikroTik RB951Ui-2HnD',
        host: '192.168.90.1',
        apiPort: 8728,
        username: 'admin',
        passwordMasked: '••••••••',
        serverName: 'hotspot-sinza',
        status: 'connected',
        lastChecked: new Date().toISOString(),
        uptime: '7d 02:44:19',
        cpuLoad: 18,
        memoryFreeMb: 94.0,
        totalMemoryMb: 128.0,
        activeUsersCount: 14,
        isDemoMode: true,
        totalRevenueTzs: 92000,
        totalTransactionsCount: 76,
        notes: 'Cafe patrons and evening outdoor seating patio.',
        accessPoints: [
          {
            id: 'ap-005',
            name: 'AP1 - Indoor Lounge',
            locationArea: 'VIP Coffee Bar',
            brand: 'TP-Link Omada',
            status: 'online',
            connectedClients: 9,
          },
          {
            id: 'ap-006',
            name: 'AP2 - Garden Terrace',
            locationArea: 'Outdoor Patio',
            brand: 'MikroTik cAP',
            status: 'online',
            connectedClients: 5,
          },
        ],
      },
    ];

    initialRouters.forEach((r) => this.routers.set(r.id, r));
    // 1. Initial Packages (All 100% Time-Based, TZS Currency)
    const initialPackages: TimePackage[] = [
      {
        id: 'pkg-1h',
        name: '1 Hour Access',
        durationMinutes: 60,
        durationValue: 1,
        durationUnit: 'hours',
        priceTzs: 300,
        description: 'Instant 1-hour fast internet. Perfect for quick browsing and messaging.',
        status: 'active',
        popular: false,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'pkg-3h',
        name: '3 Hours Access',
        durationMinutes: 180,
        durationValue: 3,
        durationUnit: 'hours',
        priceTzs: 500,
        description: '3 hours of continuous connection. Ideal for research and streaming.',
        status: 'active',
        popular: true,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'pkg-6h',
        name: '6 Hours Access',
        durationMinutes: 360,
        durationValue: 6,
        durationUnit: 'hours',
        priceTzs: 1000,
        description: '6 hours daytime or evening access with seamless reconnect.',
        status: 'active',
        popular: false,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'pkg-12h',
        name: '12 Hours Access',
        durationMinutes: 720,
        durationValue: 12,
        durationUnit: 'hours',
        priceTzs: 1500,
        description: 'Half day full coverage for study or remote work sessions.',
        status: 'active',
        popular: false,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'pkg-24h',
        name: '24 Hours (1 Day)',
        durationMinutes: 1440,
        durationValue: 24,
        durationUnit: 'hours',
        priceTzs: 2000,
        description: 'Full 24-hour day access without interruptions.',
        status: 'active',
        popular: true,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'pkg-7d',
        name: '7 Days Weekly Pass',
        durationMinutes: 10080,
        durationValue: 7,
        durationUnit: 'days',
        priceTzs: 10000,
        description: '7 full consecutive days of high-speed Wi-Fi hotspot access.',
        status: 'active',
        popular: false,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
    ];

    initialPackages.forEach((pkg) => this.packages.set(pkg.id, pkg));

    // 2. Initial Sample Cash Vouchers for testing
    const sampleVouchers: Voucher[] = [
      {
        id: 'vch-001',
        code: 'TZ-941-8X2A',
        packageId: 'pkg-3h',
        packageName: '3 Hours Access',
        durationMinutes: 180,
        priceTzs: 500,
        status: 'available',
        createdBy: 'admin@hotspottz.co.tz',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'vch-002',
        code: 'TZ-941-4K9P',
        packageId: 'pkg-1h',
        packageName: '1 Hour Access',
        durationMinutes: 60,
        priceTzs: 300,
        status: 'available',
        createdBy: 'admin@hotspottz.co.tz',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'vch-003',
        code: 'TZ-941-1M7Q',
        packageId: 'pkg-24h',
        packageName: '24 Hours (1 Day)',
        durationMinutes: 1440,
        priceTzs: 2000,
        status: 'available',
        createdBy: 'admin@hotspottz.co.tz',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'vch-004',
        code: 'TZ-941-USED1',
        packageId: 'pkg-3h',
        packageName: '3 Hours Access',
        durationMinutes: 180,
        priceTzs: 500,
        status: 'used',
        createdBy: 'admin@hotspottz.co.tz',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        usedAt: new Date(Date.now() - 40000000).toISOString(),
        usedByPhone: '0754889900',
        usedByMac: 'D4:CA:6D:88:12:44',
      },
    ];

    sampleVouchers.forEach((vch) => this.vouchers.set(vch.id, vch));

    // 3. Initial Admins
    const superAdmin: AdminUser = {
      id: 'adm-001',
      name: 'Yohana Michael (Chief Admin)',
      email: 'yohanamichael92@gmail.com',
      role: 'SUPER_ADMIN',
      status: 'active',
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      lastLogin: new Date().toISOString(),
    };
    const fallbackAdmin: AdminUser = {
      id: 'adm-002',
      name: 'Network Attendant',
      email: 'admin@hotspottz.co.tz',
      role: 'ADMIN',
      status: 'active',
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      lastLogin: new Date(Date.now() - 3600000).toISOString(),
    };
    this.admins.set(superAdmin.id, superAdmin);
    this.admins.set(fallbackAdmin.id, fallbackAdmin);

    // 4. Sample Customers
    const sampleCustomer: Customer = {
      id: 'cust-0754889900',
      phoneNumber: '0754889900',
      macAddress: 'D4:CA:6D:88:12:44',
      lastIp: '192.168.88.245',
      totalSpentTzs: 4500,
      totalSessions: 5,
      status: 'active',
      firstSeen: new Date(Date.now() - 15 * 86400000).toISOString(),
      lastSeen: new Date().toISOString(),
    };
    this.customers.set(sampleCustomer.id, sampleCustomer);

    // 5. Initial Audit Log
    this.auditLogs.push({
      id: 'aud-001',
      adminEmail: 'admin@hotspottz.co.tz',
      action: 'SYSTEM_BOOT',
      description: 'HotspotTZ Core Service initialized with MikroTik RB941 Driver.',
      timestamp: new Date().toISOString(),
    });
  }

  // --- Transactions & Payments ---
  public createTransaction(tx: PaymentTransaction): PaymentTransaction {
    this.transactions.set(tx.id, tx);
    return tx;
  }

  public getTransaction(id: string): PaymentTransaction | undefined {
    return this.transactions.get(id);
  }

  public updateTransaction(id: string, update: Partial<PaymentTransaction>): PaymentTransaction | undefined {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.transactions.set(id, updated);
    return updated;
  }

  // --- Hotspot Sessions ---
  public createSession(session: HotspotSession): HotspotSession {
    this.sessions.set(session.id, session);
    // Update or create customer record
    const custId = session.customerPhone ? `cust-${session.customerPhone}` : `cust-${session.customerMac}`;
    let customer = this.customers.get(custId);
    if (!customer) {
      customer = {
        id: custId,
        phoneNumber: session.customerPhone,
        macAddress: session.customerMac,
        lastIp: session.customerIp,
        totalSpentTzs: 0,
        totalSessions: 0,
        status: 'active',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
    }
    customer.lastSeen = new Date().toISOString();
    customer.lastIp = session.customerIp;
    customer.totalSessions += 1;
    customer.activeSessionId = session.id;
    this.customers.set(custId, customer);

    return session;
  }

  public getSession(id: string): HotspotSession | undefined {
    return this.sessions.get(id);
  }

  public findActiveSession(identifier: { phone?: string; mac?: string; ip?: string }): HotspotSession | undefined {
    const now = new Date().getTime();
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        const isExpired = new Date(session.expiryTime).getTime() <= now;
        if (isExpired) {
          session.status = 'expired';
          continue;
        }

        if (identifier.phone && session.customerPhone === identifier.phone) {
          return session;
        }
        if (identifier.mac && session.customerMac.toLowerCase() === identifier.mac.toLowerCase()) {
          return session;
        }
        if (identifier.ip && session.customerIp === identifier.ip) {
          return session;
        }
      }
    }
    return undefined;
  }

  // --- Vouchers ---
  public findVoucherByCode(code: string): Voucher | undefined {
    const clean = code.trim().toUpperCase();
    for (const vch of this.vouchers.values()) {
      if (vch.code.toUpperCase() === clean) {
        return vch;
      }
    }
    return undefined;
  }

  public batchCreateVouchers(params: {
    packageId: string;
    quantity: number;
    createdBy: string;
  }): Voucher[] {
    const pkg = this.packages.get(params.packageId);
    if (!pkg) throw new Error('Package not found');

    const created: Voucher[] = [];
    for (let i = 0; i < params.quantity; i++) {
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const code = `TZ-${randomNum}-${randomStr}`;
      const id = `vch-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`;
      const voucher: Voucher = {
        id,
        code,
        packageId: pkg.id,
        packageName: pkg.name,
        durationMinutes: pkg.durationMinutes,
        priceTzs: pkg.priceTzs,
        status: 'available',
        createdBy: params.createdBy,
        createdAt: new Date().toISOString(),
      };
      this.vouchers.set(voucher.id, voucher);
      created.push(voucher);
    }
    return created;
  }

  // --- Routers & Multi-Site Management ---
  public getAllRouters(): MikroTikRouter[] {
    return Array.from(this.routers.values());
  }

  public getRouter(id: string): MikroTikRouter | undefined {
    return this.routers.get(id);
  }

  public createRouter(router: MikroTikRouter): MikroTikRouter {
    this.routers.set(router.id, router);
    return router;
  }

  public updateRouter(id: string, update: Partial<MikroTikRouter>): MikroTikRouter | undefined {
    const existing = this.routers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.routers.set(id, updated);
    return updated;
  }

  public deleteRouter(id: string): boolean {
    return this.routers.delete(id);
  }

  // --- Payment Diagnostics Logging ---
  public logPaymentDiagnostic(entry: Omit<DatabaseStore['paymentDiagnostics'][0], 'id' | 'timestamp'>) {
    const item = {
      ...entry,
      id: `diag-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    this.paymentDiagnostics.unshift(item);
    if (this.paymentDiagnostics.length > 200) {
      this.paymentDiagnostics.pop();
    }
    return item;
  }

  // --- Audit Logging ---
  public logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const log: AuditLog = {
      ...entry,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    // Keep last 1000 entries in memory
    if (this.auditLogs.length > 1000) {
      this.auditLogs.pop();
    }
    return log;
  }

  // --- Dashboard Aggregations ---
  public getDashboardStats(routerId?: string): DashboardStats & {
    filteredRouterId?: string;
    totalRoutersCount: number;
    onlineRoutersCount: number;
    totalAccessPointsCount: number;
    perSiteBreakdown: Array<{
      routerId: string;
      routerName: string;
      siteCode: string;
      location: string;
      status: string;
      todayRevenueTzs: number;
      totalRevenueTzs: number;
      activeUsers: number;
      accessPointsCount: number;
    }>;
  } {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todaySalesCount = 0;
    let todayRevenueTzs = 0;
    let monthlyRevenueTzs = 0;

    for (const tx of this.transactions.values()) {
      if (tx.status === 'successful') {
        if (routerId && tx.routerId && tx.routerId !== routerId) {
          continue;
        }
        const txTime = new Date(tx.successfulTimestamp || tx.requestTimestamp).getTime();
        if (txTime >= startOfMonth) {
          monthlyRevenueTzs += tx.amountTzs;
        }
        if (txTime >= startOfToday) {
          todaySalesCount += 1;
          todayRevenueTzs += tx.amountTzs;
        }
      }
    }

    let activeCustomers = 0;
    let onlineCustomers = 0;
    const nowTime = now.getTime();

    for (const session of this.sessions.values()) {
      if (routerId && session.routerId && session.routerId !== routerId) {
        continue;
      }
      if (session.status === 'active') {
        if (new Date(session.expiryTime).getTime() > nowTime) {
          activeCustomers += 1;
          onlineCustomers += 1;
        } else {
          session.status = 'expired';
        }
      }
    }

    let availableVouchersCount = 0;
    let usedVouchersCount = 0;
    let totalVoucherValueTzs = 0;
    let usedVoucherValueTzs = 0;
    let unusedVoucherValueTzs = 0;

    for (const vch of this.vouchers.values()) {
      if (routerId && vch.routerId && vch.routerId !== routerId) {
        continue;
      }
      totalVoucherValueTzs += vch.priceTzs;
      if (vch.status === 'available') {
        availableVouchersCount += 1;
        unusedVoucherValueTzs += vch.priceTzs;
      } else if (vch.status === 'used') {
        usedVouchersCount += 1;
        usedVoucherValueTzs += vch.priceTzs;
      }
    }

    let activePackagesCount = 0;
    for (const p of this.packages.values()) {
      if (p.status === 'active') activePackagesCount += 1;
    }

    // Compute Per-Site Breakdown for all routers
    const perSiteBreakdown = Array.from(this.routers.values()).map((r) => {
      let siteTodayRev = 0;
      let siteTotalRev = r.totalRevenueTzs || 0;

      for (const tx of this.transactions.values()) {
        if (tx.status === 'successful' && tx.routerId === r.id) {
          const txTime = new Date(tx.successfulTimestamp || tx.requestTimestamp).getTime();
          if (txTime >= startOfToday) {
            siteTodayRev += tx.amountTzs;
          }
          siteTotalRev += tx.amountTzs;
        }
      }

      return {
        routerId: r.id,
        routerName: r.name,
        siteCode: r.siteCode || 'SITE',
        location: r.location,
        status: r.status,
        todayRevenueTzs: siteTodayRev,
        totalRevenueTzs: siteTotalRev,
        activeUsers: r.activeUsersCount || 0,
        accessPointsCount: r.accessPoints?.length || 0,
      };
    });

    let totalAPs = 0;
    let onlineRouters = 0;
    for (const r of this.routers.values()) {
      if (r.status === 'connected') onlineRouters += 1;
      totalAPs += r.accessPoints?.length || 0;
    }

    return {
      totalCustomers: this.customers.size,
      activeCustomers,
      onlineCustomers,
      todaySalesCount,
      todayRevenueTzs,
      monthlyRevenueTzs,
      activePackagesCount,
      availableVouchersCount,
      usedVouchersCount,
      totalVoucherValueTzs,
      usedVoucherValueTzs,
      unusedVoucherValueTzs,
      mikrotikStatus: onlineRouters > 0 ? 'connected' : 'disconnected',
      filteredRouterId: routerId,
      totalRoutersCount: this.routers.size,
      onlineRoutersCount: onlineRouters,
      totalAccessPointsCount: totalAPs,
      perSiteBreakdown,
    };
  }

  /**
   * Generates Supabase / PostgreSQL SQL Schema Definition
   */
  public generateSupabaseSql(): string {
    return `-- ====================================================================
-- HOTSPOT TZ - SUPABASE / POSTGRESQL PRODUCTION DATABASE SCHEMA
-- Target Architecture: Normalized Schema with Foreign Keys, Constraints & Indexes
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('SUPER_ADMIN', 'ADMIN')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE,
    mac_address VARCHAR(50) NOT NULL UNIQUE,
    last_ip VARCHAR(50),
    total_spent_tzs BIGINT DEFAULT 0,
    total_sessions INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Packages Table (Strictly Time-Based)
CREATE TABLE IF NOT EXISTS packages (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL,
    duration_value INT NOT NULL,
    duration_unit VARCHAR(50) NOT NULL CHECK (duration_unit IN ('minutes', 'hours', 'days')),
    price_tzs BIGINT NOT NULL CHECK (price_tzs >= 0),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Vouchers Table (For Cash Payments)
CREATE TABLE IF NOT EXISTS vouchers (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    package_id VARCHAR(100) REFERENCES packages(id) ON DELETE CASCADE,
    package_name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL,
    price_tzs BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'used', 'disabled', 'expired')),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_phone VARCHAR(50),
    used_by_mac VARCHAR(50),
    session_id VARCHAR(100)
);

-- 6. Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(100) PRIMARY KEY,
    gateway_transaction_id VARCHAR(255),
    customer_phone VARCHAR(50) NOT NULL,
    customer_mac VARCHAR(50),
    customer_ip VARCHAR(50),
    package_id VARCHAR(100) REFERENCES packages(id),
    package_name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL,
    amount_tzs BIGINT NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('mobile_gateway', 'cash_voucher')),
    payment_gateway VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'cancelled', 'expired')),
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    successful_timestamp TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    gateway_response_ref TEXT,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL
);

-- 7. Hotspot Sessions Table
CREATE TABLE IF NOT EXISTS hotspot_sessions (
    id VARCHAR(100) PRIMARY KEY,
    customer_identifier VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50),
    customer_mac VARCHAR(50) NOT NULL,
    customer_ip VARCHAR(50) NOT NULL,
    package_id VARCHAR(100) REFERENCES packages(id),
    package_name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL,
    payment_reference VARCHAR(100),
    voucher_reference VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected', 'cancelled')),
    mikrotik_user VARCHAR(100) NOT NULL,
    mikrotik_session_id VARCHAR(100),
    bytes_in BIGINT DEFAULT 0,
    bytes_out BIGINT DEFAULT 0
);

-- 8. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(50),
    metadata JSONB
);

-- 9. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    business_name VARCHAR(255) NOT NULL,
    hotspot_name VARCHAR(255) NOT NULL,
    admin_cash_phone VARCHAR(50) NOT NULL,
    support_phone VARCHAR(50) NOT NULL,
    support_whatsapp VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'TZS',
    timezone VARCHAR(100) DEFAULT 'Africa/Dar_es_Salaam',
    default_language VARCHAR(10) DEFAULT 'en',
    payment_gateway_config JSONB,
    mikrotik_config JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_sessions_mac_status ON hotspot_sessions(customer_mac, status);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON hotspot_sessions(expiry_time);
CREATE INDEX IF NOT EXISTS idx_transactions_phone ON payment_transactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON payment_transactions(status);
`;
  }
}

export const db = new DatabaseStore();
