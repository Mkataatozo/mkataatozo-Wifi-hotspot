/**
 * Core Types for HotspotTZ Automatic Time-Based Wi-Fi Hotspot Management System
 * Target Hardware: MikroTik RouterBOARD RB941
 * Currency: TZS (Tanzanian Shilling)
 */

export type Role = 'SUPER_ADMIN' | 'ADMIN';

export type PaymentMethod = 'mobile_gateway' | 'cash_voucher';

export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'cancelled' | 'expired';

export type VoucherStatus = 'available' | 'used' | 'disabled' | 'expired';

export type SessionStatus = 'active' | 'expired' | 'disconnected' | 'cancelled';

export type RouterStatus = 'connected' | 'disconnected' | 'error';

export type TimeUnit = 'minutes' | 'hours' | 'days';

export type PaymentGatewayProvider = 'pluspesa' | 'demo';

export interface TimePackage {
  id: string;
  name: string;
  durationMinutes: number;
  durationValue: number;
  durationUnit: TimeUnit;
  priceTzs: number;
  description: string;
  status: 'active' | 'inactive';
  popular?: boolean;
  /** Shown as a warning banner in the mobile payment modal for this specific
   * package - e.g. when an amount is too low for some networks' USSD push. */
  mobilePaymentNotice?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessPointInfo {
  id: string;
  name: string;
  macAddress?: string;
  ipAddress?: string;
  locationArea?: string; // e.g. "Main Hall", "Lounge", "Floor 2 Terrace"
  brand?: 'MikroTik cAP' | 'Ubiquiti UniFi' | 'Ruijie Reyee' | 'TP-Link Omada' | 'Generic AP';
  status: 'online' | 'offline';
  connectedClients: number;
}

export interface MikroTikRouter {
  id: string;
  name: string; // e.g. "Site 1 - Kariakoo Hub"
  location: string; // e.g. "Kariakoo, Dar es Salaam"
  siteCode: string; // e.g. "TZ-SITE-01"
  model: string; // e.g. "MikroTik RB941-2nD (hAP lite)" / "MikroTik hEX RB750Gr3"
  host: string; // IP / DDNS / WireGuard VPN IP
  apiPort: number;
  username: string;
  passwordMasked: string;
  password?: string;
  serverName?: string;
  status: RouterStatus;
  lastChecked?: string;
  uptime?: string;
  cpuLoad?: number;
  memoryFreeMb?: number;
  totalMemoryMb?: number;
  activeUsersCount: number;
  isDemoMode: boolean;
  totalRevenueTzs: number;
  totalTransactionsCount: number;
  accessPoints: AccessPointInfo[];
  notes?: string;
}

export interface Voucher {
  id: string;
  code: string;
  packageId: string;
  packageName: string;
  durationMinutes: number;
  priceTzs: number;
  status: VoucherStatus;
  routerId?: string;
  routerName?: string;
  createdBy: string;
  createdAt: string;
  usedAt?: string | null;
  usedByPhone?: string | null;
  usedByMac?: string | null;
  sessionId?: string | null;
}

export interface PaymentTransaction {
  id: string;
  gatewayTransactionId?: string;
  gatewayReference?: string;
  phoneNumber?: string;
  customerPhone?: string;
  customerMac?: string;
  customerIp?: string;
  routerId?: string;
  routerName?: string;
  siteLocation?: string;
  packageId: string;
  packageName: string;
  durationMinutes: number;
  amountTzs: number;
  paymentMethod: PaymentMethod;
  paymentGateway?: PaymentGatewayProvider;
  gatewayProvider?: string;
  status: PaymentStatus;
  createdAt?: string;
  requestTimestamp: string;
  successfulTimestamp?: string | null;
  failureReason?: string | null;
  gatewayResponseRef?: string | null;
  rawGatewayLog?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface HotspotSession {
  id: string;
  customerIdentifier: string; // phone or MAC address
  customerPhone?: string;
  customerMac: string;
  customerIp: string;
  routerId?: string;
  routerName?: string;
  siteLocation?: string;
  accessPointName?: string;
  packageId: string;
  packageName: string;
  durationMinutes: number;
  paymentReference?: string;
  voucherReference?: string;
  startTime: string;
  expiryTime: string;
  status: SessionStatus;
  mikrotikUser: string;
  mikrotikSessionId?: string;
  bytesIn?: number;
  bytesOut?: number;
}

export interface Customer {
  id: string;
  phoneNumber?: string;
  macAddress: string;
  ipAddress?: string;
  lastIp?: string;
  routerId?: string;
  routerName?: string;
  totalSpentTzs: number;
  totalSessions: number;
  activeSessionId?: string | null;
  currentPackageName?: string;
  sessionExpiry?: string;
  status: 'online' | 'active' | 'disabled';
  firstSeen: string;
  lastSeen: string;
}

export interface MikroTikConfig {
  host: string;
  apiPort: number;
  username: string;
  password?: string;
  serverName?: string;
  walledGarden?: string[];
}

export interface PaymentGatewayConfig {
  provider: PaymentGatewayProvider;
  environment: 'sandbox' | 'live';
  apiKey: string; // Public Key
  publicKey?: string;
  apiSecret?: string; // Secret Key
  secretKey?: string;
  merchantId?: string;
  apiUrl?: string;
  webhookSecret?: string;
  callbackUrl?: string;
}

export interface HotspotSettings {
  businessName: string;
  hotspotName: string;
  currency: string;
  adminPhoneNumber: string;
  supportWhatsApp?: string;
  supportMessage: string;
  requirePhoneForVoucher?: boolean;
  sessionCheckIntervalSeconds?: number;
}

export interface AuditLog {
  id: string;
  adminEmail: string;
  actor?: string;
  action: string;
  details?: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemSettings {
  businessName: string;
  hotspotName: string;
  logoUrl?: string;
  adminCashPhone: string;
  supportPhone: string;
  supportWhatsApp?: string;
  supportMessage: string;
  currency: string;
  timezone: string;
  defaultLanguage: 'en' | 'sw';
  paymentGateway: {
    provider: PaymentGatewayProvider;
    apiKeyMasked: string;
    secretKeyMasked: string;
    merchantId: string;
    apiUrl: string;
    webhookUrl: string;
    environment: 'sandbox' | 'live';
    enabled: boolean;
  };
  mikrotik: {
    host: string;
    apiPort: number;
    username: string;
    passwordMasked: string;
    password?: string;
    enabled: boolean;
    demoMode: boolean;
  };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLogin?: string;
}

export interface CaptivePortalParams {
  mac?: string;
  ip?: string;
  linkLogin?: string;
  linkLoginOnly?: string;
  linkOrig?: string;
  error?: string;
  chapId?: string;
  chapChallenge?: string;
  hostname?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  onlineCustomers: number;
  todaySalesCount: number;
  todayRevenueTzs: number;
  monthlyRevenueTzs: number;
  activePackagesCount: number;
  availableVouchersCount: number;
  usedVouchersCount: number;
  totalVoucherValueTzs: number;
  usedVoucherValueTzs: number;
  unusedVoucherValueTzs: number;
  mikrotikStatus: RouterStatus;
}
