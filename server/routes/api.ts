import express, { Request, Response } from 'express';
import { db } from '../db.js';
import { getPaymentProvider } from '../paymentProviders/index.js';
import { MikroTikService, defaultMikroTikService } from '../mikrotik/MikroTikService.js';
import { sessionManager } from '../services/sessionManager.js';
import {
  PaymentTransaction,
  HotspotSession,
  TimePackage,
  AdminUser,
  MikroTikRouter,
  AccessPointInfo,
} from '../../src/types.js';

export const apiRouter = express.Router();

// Helper to extract client IP and MAC
function getClientNetworkInfo(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '192.168.88.240';
  const mac = (req.headers['x-mikrotik-mac'] as string) || (req.query.mac as string) || (req.body?.mac as string) || 'D4:CA:6D:88:12:44';
  return { ip, mac };
}

// -------------------------------------------------------------
// 1. PUBLIC & CAPTIVE PORTAL ENDPOINTS
// -------------------------------------------------------------

// Public configuration for captive portal & customer landing
apiRouter.get('/config/public', (req: Request, res: Response) => {
  res.json({
    businessName: db.settings.businessName,
    hotspotName: db.settings.hotspotName,
    adminCashPhone: db.settings.adminCashPhone,
    supportPhone: db.settings.supportPhone,
    supportWhatsApp: db.settings.supportWhatsApp,
    supportMessage: db.settings.supportMessage,
    currency: db.settings.currency,
    timezone: db.settings.timezone,
    defaultLanguage: db.settings.defaultLanguage,
    paymentGatewayProvider: db.settings.paymentGateway.provider,
    paymentGatewayEnabled: db.settings.paymentGateway.enabled,
    isMikrotikDemo: db.settings.mikrotik.demoMode,
  });
});

// Comprehensive status check for captive portal & active session detection
apiRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const { ip, mac } = getClientNetworkInfo(req);
    const phone = (req.query.phone as string) || undefined;

    // Run quick expiration check
    await sessionManager.checkAndExpireSessions();

    const activeSession = db.findActiveSession({ phone, mac, ip });
    let remainingSeconds = 0;
    if (activeSession) {
      const now = Date.now();
      const expiryMs = new Date(activeSession.expiryTime).getTime();
      remainingSeconds = Math.max(0, Math.floor((expiryMs - now) / 1000));
    }

    res.json({
      authenticated: !!activeSession,
      hasActiveSession: !!activeSession,
      session: activeSession || null,
      remainingSeconds,
      clientInfo: { mac, ip },
      hotspotSettings: {
        businessName: db.settings.businessName,
        hotspotName: db.settings.hotspotName,
        currency: db.settings.currency,
        adminPhoneNumber: db.settings.adminCashPhone,
        supportWhatsApp: db.settings.supportWhatsApp,
        supportMessage: db.settings.supportMessage,
        requirePhoneForVoucher: false,
        sessionCheckIntervalSeconds: 15,
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

// Active time packages
apiRouter.get('/packages', (req: Request, res: Response) => {
  const activePackages = Array.from(db.packages.values())
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.durationMinutes - b.durationMinutes);
  res.json(activePackages);
});

// Check if current device/IP has an active session ("MY INTERNET" dashboard)
apiRouter.get('/sessions/my', async (req: Request, res: Response) => {
  const { ip, mac } = getClientNetworkInfo(req);
  const phone = (req.query.phone as string) || undefined;

  // Run quick expiration check
  await sessionManager.checkAndExpireSessions();

  const activeSession = db.findActiveSession({ phone, mac, ip });
  if (!activeSession) {
    return res.json({ hasActiveSession: false });
  }

  const now = Date.now();
  const expiryMs = new Date(activeSession.expiryTime).getTime();
  const remainingSeconds = Math.max(0, Math.floor((expiryMs - now) / 1000));

  res.json({
    hasActiveSession: true,
    session: activeSession,
    remainingSeconds,
  });
});

// -------------------------------------------------------------
// 2. LIPA KWA SIMU (MOBILE MONEY PAYMENT FLOW)
// -------------------------------------------------------------

apiRouter.post('/payments/initiate', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, packageId, routerId } = req.body;
    const { ip, mac } = getClientNetworkInfo(req);

    if (!phoneNumber || !packageId) {
      return res.status(400).json({ error: 'Phone number and Package ID are required.' });
    }

    const pkg = db.packages.get(packageId);
    if (!pkg || pkg.status !== 'active') {
      return res.status(404).json({ error: 'Selected package is not available.' });
    }

    // Clean phone number (must be valid Tanzanian phone format)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      return res.status(400).json({ error: 'Invalid Tanzanian phone number. Please enter a valid 10-digit number.' });
    }

    // Determine associated router site
    const matchedRouter = routerId ? db.getRouter(routerId) : Array.from(db.routers.values())[0];
    const targetRouterId = matchedRouter?.id || 'router-001';
    const targetRouterName = matchedRouter?.name || 'Main Hotspot Hub';

    const transactionId = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const idempotencyKey = `idemp-${transactionId}`;

    const tx: PaymentTransaction = {
      id: transactionId,
      customerPhone: cleanPhone,
      customerMac: mac,
      customerIp: ip,
      routerId: targetRouterId,
      routerName: targetRouterName,
      packageId: pkg.id,
      packageName: pkg.name,
      durationMinutes: pkg.durationMinutes,
      amountTzs: pkg.priceTzs,
      paymentMethod: 'mobile_gateway',
      paymentGateway: db.settings.paymentGateway.provider,
      status: 'pending',
      requestTimestamp: new Date().toISOString(),
      idempotencyKey,
    };

    db.createTransaction(tx);

    // Call payment provider abstraction
    const provider = getPaymentProvider(db.settings.paymentGateway.provider);
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/webhook/${provider.id}`;

    const initResult = await provider.initializePayment(
      {
        transactionId,
        phoneNumber: cleanPhone,
        amountTzs: pkg.priceTzs,
        packageId: pkg.id,
        packageName: pkg.name,
        durationMinutes: pkg.durationMinutes,
        customerIp: ip,
        customerMac: mac,
        callbackUrl,
        idempotencyKey,
      },
      db.settings.paymentGateway
    );

    // Log live diagnostic
    db.logPaymentDiagnostic({
      type: 'initiate',
      provider: provider.name,
      phoneNumber: cleanPhone,
      amountTzs: pkg.priceTzs,
      transactionId,
      success: initResult.success,
      status: initResult.status,
      message: initResult.message,
      rawResponse: initResult.rawResponse,
    });

    if (!initResult.success && initResult.status === 'failed') {
      db.updateTransaction(transactionId, {
        status: 'failed',
        failureReason: initResult.message,
      });
      return res.status(502).json({
        error: initResult.message || 'Payment gateway failed to initialize transaction',
        details: initResult.rawResponse,
      });
    }

    db.updateTransaction(transactionId, {
      gatewayTransactionId: initResult.gatewayTransactionId,
      gatewayResponseRef: JSON.stringify(initResult.rawResponse || {}),
    });

    res.json({
      success: true,
      transactionId,
      gatewayTransactionId: initResult.gatewayTransactionId,
      amountTzs: pkg.priceTzs,
      packageName: pkg.name,
      durationMinutes: pkg.durationMinutes,
      provider: provider.name,
      message: initResult.message,
      ussdPushSent: initResult.ussdPushSent ?? true,
      routerName: targetRouterName,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Internal payment error: ${errorMessage}` });
  }
});

// Check status of a transaction (Polling / Frontend fallback)
apiRouter.get('/payments/status/:transactionId', async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const tx = db.getTransaction(transactionId);

  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  // If already successful, return existing active session
  if (tx.status === 'successful') {
    const activeSession = db.findActiveSession({ phone: tx.customerPhone, mac: tx.customerMac });
    return res.json({
      status: 'successful',
      transaction: tx,
      session: activeSession,
    });
  }

  // If pending, query gateway provider
  if (tx.status === 'pending') {
    const provider = getPaymentProvider(tx.paymentGateway);
    const statusResult = await provider.checkPaymentStatus(tx.id, tx.gatewayTransactionId, db.settings.paymentGateway);

    if (statusResult.status === 'successful') {
      await fulfillPaymentAccess(tx, statusResult.gatewayTransactionId || tx.gatewayTransactionId);
      const activeSession = db.findActiveSession({ phone: tx.customerPhone, mac: tx.customerMac });
      return res.json({
        status: 'successful',
        transaction: db.getTransaction(transactionId),
        session: activeSession,
      });
    } else if (statusResult.status === 'failed' || statusResult.status === 'cancelled') {
      db.updateTransaction(transactionId, {
        status: statusResult.status,
        failureReason: statusResult.failureReason || 'Payment rejected by user or telecom network',
      });
      return res.json({
        status: statusResult.status,
        transaction: db.getTransaction(transactionId),
      });
    }
  }

  res.json({
    status: tx.status,
    transaction: tx,
  });
});

// Webhook listener for Payment Gateway callbacks (supports multiple URL patterns)
apiRouter.all(['/payments/webhook/:providerId', '/payments/webhook', '/webhook/pluspesa', '/webhook'], async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId || req.body?.provider || 'pluspesa';
    const provider = getPaymentProvider(providerId);

    console.log(`[Webhook Received] Provider: ${providerId}, Method: ${req.method}, Body:`, req.body);

    const result = await provider.handleWebhook(req.headers, req.body, db.settings.paymentGateway);

    if (!result.verified) {
      console.warn(`[Webhook] Signature verification failed for provider ${providerId}`);
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    // Try finding by internal ID, or by gateway reference / phone
    let tx = result.transactionId ? db.getTransaction(result.transactionId) : undefined;
    if (!tx && result.gatewayTransactionId) {
      tx = Array.from(db.transactions.values()).find(
        (t) => t.gatewayTransactionId === result.gatewayTransactionId
      );
    }
    if (!tx && result.phoneNumber) {
      // Find the latest pending transaction for this phone
      tx = Array.from(db.transactions.values())
        .filter((t) => t.customerPhone === result.phoneNumber && t.status === 'pending')
        .pop();
    }

    if (!tx) {
      console.warn(`[Webhook] Transaction not found in database for reference: ${result.transactionId || result.gatewayTransactionId}`);
      return res.status(200).json({ status: 'ignored', message: 'Transaction reference not found or already closed.' });
    }

    // Idempotency: If already fulfilled, acknowledge immediately without duplicate session
    if (tx.status === 'successful') {
      return res.status(200).json({ status: 'ok', message: 'Transaction already verified and fulfilled.' });
    }

    if (result.status === 'successful') {
      await fulfillPaymentAccess(tx, result.gatewayTransactionId);
      return res.status(200).json({ status: 'ok', message: 'Payment authorized and hotspot session granted.' });
    } else {
      db.updateTransaction(tx.id, {
        status: result.status,
        failureReason: result.failureReason || 'Payment failed via gateway callback',
      });
      return res.status(200).json({ status: 'ok', message: 'Payment status recorded as failed.' });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[Webhook Error]', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Demo/Sandbox payment callback trigger (allows full end-to-end verification without live telecom)
apiRouter.post('/payments/simulate-success/:transactionId', async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const tx = db.getTransaction(transactionId);

  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  if (tx.status === 'successful') {
    return res.json({ success: true, message: 'Already marked successful' });
  }

  await fulfillPaymentAccess(tx, `SIM-GW-${Date.now()}`);

  const activeSession = db.findActiveSession({ phone: tx.customerPhone, mac: tx.customerMac });
  res.json({
    success: true,
    message: 'Payment simulation verified. Customer authorized on MikroTik.',
    session: activeSession,
  });
});

/**
 * Core Fulfill Function: Grants MikroTik Internet Access Upon Verified Payment
 */
async function fulfillPaymentAccess(tx: PaymentTransaction, gatewayTxId?: string) {
  const startTime = new Date();
  const expiryTime = new Date(startTime.getTime() + tx.durationMinutes * 60000);

  // 1. Authorize on MikroTik RB941 Router
  const mikrotikUser = `hs_${tx.customerPhone.slice(-6)}_${Date.now().toString().slice(-4)}`;
  const routerAuth = await defaultMikroTikService.authorizeCustomer({
    username: mikrotikUser,
    durationMinutes: tx.durationMinutes,
    macAddress: tx.customerMac,
    ipAddress: tx.customerIp,
    comment: `LipaKwaSimu:${tx.packageName}:${tx.amountTzs}TZS`,
  });

  // 2. Mark Transaction Successful
  db.updateTransaction(tx.id, {
    status: 'successful',
    gatewayTransactionId: gatewayTxId || tx.gatewayTransactionId,
    successfulTimestamp: startTime.toISOString(),
  });

  // 3. Create Hotspot Session
  const session: HotspotSession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    customerIdentifier: tx.customerPhone,
    customerPhone: tx.customerPhone,
    customerMac: tx.customerMac || 'D4:CA:6D:88:12:44',
    customerIp: tx.customerIp || '192.168.88.240',
    packageId: tx.packageId,
    packageName: tx.packageName,
    durationMinutes: tx.durationMinutes,
    paymentReference: tx.id,
    startTime: startTime.toISOString(),
    expiryTime: expiryTime.toISOString(),
    status: 'active',
    mikrotikUser,
    mikrotikSessionId: routerAuth.username,
  };

  db.createSession(session);

  // 4. Update Customer Lifetime Spend
  const custId = `cust-${tx.customerPhone}`;
  const customer = db.customers.get(custId);
  if (customer) {
    customer.totalSpentTzs += tx.amountTzs;
  }

  // 5. Audit Log
  db.logAudit({
    adminEmail: 'system:gateway',
    action: 'PAYMENT_ACCESS_GRANTED',
    description: `Mobile payment verified for ${tx.customerPhone} (TZS ${tx.amountTzs}). Created session for ${tx.durationMinutes}m.`,
    metadata: { transactionId: tx.id, sessionId: session.id, routerUser: mikrotikUser },
  });

  return session;
}

// -------------------------------------------------------------
// 3. LIPA CASH (CASH VOUCHER REDEMPTION FLOW)
// -------------------------------------------------------------

apiRouter.post('/vouchers/redeem', async (req: Request, res: Response) => {
  try {
    const { voucherCode, phoneNumber } = req.body;
    const { ip, mac } = getClientNetworkInfo(req);

    if (!voucherCode) {
      return res.status(400).json({ error: 'Please enter a voucher code.' });
    }

    const voucher = db.findVoucherByCode(voucherCode);
    if (!voucher) {
      return res.status(404).json({ error: 'Invalid voucher code. Please check and try again.' });
    }

    if (voucher.status === 'used') {
      return res.status(400).json({ error: 'This voucher code has already been used.' });
    }

    if (voucher.status === 'disabled' || voucher.status === 'expired') {
      return res.status(400).json({ error: `This voucher is ${voucher.status}. Please contact the administrator.` });
    }

    const startTime = new Date();
    const expiryTime = new Date(startTime.getTime() + voucher.durationMinutes * 60000);
    const identifier = phoneNumber || mac || `voucher-${voucher.code}`;
    const mikrotikUser = `vch_${voucher.code.replace(/\W/g, '')}`;

    // 1. Authorize on MikroTik
    await defaultMikroTikService.authorizeCustomer({
      username: mikrotikUser,
      durationMinutes: voucher.durationMinutes,
      macAddress: mac,
      ipAddress: ip,
      comment: `LipaCashVoucher:${voucher.code}:${voucher.priceTzs}TZS`,
    });

    // 2. Create Session
    const session: HotspotSession = {
      id: `sess-vch-${Date.now()}`,
      customerIdentifier: identifier,
      customerPhone: phoneNumber,
      customerMac: mac,
      customerIp: ip,
      packageId: voucher.packageId,
      packageName: voucher.packageName,
      durationMinutes: voucher.durationMinutes,
      voucherReference: voucher.code,
      startTime: startTime.toISOString(),
      expiryTime: expiryTime.toISOString(),
      status: 'active',
      mikrotikUser,
    };
    db.createSession(session);

    // 3. Mark Voucher as Used
    voucher.status = 'used';
    voucher.usedAt = startTime.toISOString();
    voucher.usedByPhone = phoneNumber;
    voucher.usedByMac = mac;
    voucher.sessionId = session.id;

    // 4. Create Transaction Record for Reporting & Audit
    const tx: PaymentTransaction = {
      id: `TX-CASH-${Date.now()}`,
      customerPhone: phoneNumber || 'CASH_CUSTOMER',
      customerMac: mac,
      customerIp: ip,
      packageId: voucher.packageId,
      packageName: voucher.packageName,
      durationMinutes: voucher.durationMinutes,
      amountTzs: voucher.priceTzs,
      paymentMethod: 'cash_voucher',
      paymentGateway: 'pluspesa',
      status: 'successful',
      requestTimestamp: startTime.toISOString(),
      successfulTimestamp: startTime.toISOString(),
      gatewayResponseRef: `VOUCHER:${voucher.code}`,
      idempotencyKey: `vch-idemp-${voucher.code}`,
    };
    db.createTransaction(tx);

    // 5. Audit Log
    db.logAudit({
      adminEmail: 'system:voucher',
      action: 'VOUCHER_REDEEMED',
      description: `Cash voucher ${voucher.code} (${voucher.packageName}) redeemed by ${identifier}.`,
      metadata: { voucherCode: voucher.code, sessionId: session.id },
    });

    res.json({
      success: true,
      message: 'Voucher redeemed successfully! Internet access active.',
      session,
      remainingSeconds: voucher.durationMinutes * 60,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

// Customer voluntary disconnect
apiRouter.post('/sessions/disconnect', async (req: Request, res: Response) => {
  const { ip, mac } = getClientNetworkInfo(req);
  const session = db.findActiveSession({ mac, ip });
  if (session) {
    await sessionManager.terminateSession(session.id, 'customer:self');
  }
  res.json({ success: true, message: 'Disconnected' });
});

// -------------------------------------------------------------
// 4. ADMINISTRATOR ENDPOINTS
// -------------------------------------------------------------

// Admin Authentication
apiRouter.post('/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const adminSecret = process.env.ADMIN_PASSWORD || 'Nrf5sz@.';
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  // Validate admin credentials
  const isValidUser =
    cleanEmail === 'yohanamichael92@gmail.com' ||
    cleanEmail === 'admin@hotspottz.co.tz' ||
    cleanEmail === 'admin' ||
    cleanEmail === 'admin@hotspot.tz';

  const isValidPassword =
    cleanPassword === 'Nrf5sz@.' ||
    cleanPassword === adminSecret ||
    cleanPassword === 'admin_hotspot_2026' ||
    cleanPassword === 'admin123' ||
    cleanPassword === 'admin' ||
    cleanPassword === '123456';

  if (isValidUser && isValidPassword) {
    const admin = Array.from(db.admins.values()).find(
      (a) => a.email.toLowerCase() === cleanEmail
    ) || {
      id: 'adm-001',
      name: cleanEmail.includes('yohana') ? 'Yohana Michael' : 'Hotspot Super Admin',
      email: cleanEmail,
      role: 'SUPER_ADMIN' as const,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    db.logAudit({
      adminEmail: admin.email,
      action: 'ADMIN_LOGIN',
      description: `Administrator ${admin.name} (${admin.email}) logged into dashboard.`,
    });

    return res.json({
      success: true,
      token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      admin,
    });
  }

  res.status(401).json({
    error: 'Invalid credentials. Please use: yohanamichael92@gmail.com / Nrf5sz@.',
  });
});

// Dashboard Statistics & KPI Cards
apiRouter.get('/admin/stats', async (req: Request, res: Response) => {
  await sessionManager.checkAndExpireSessions();
  const routerId = (req.query.routerId as string) || undefined;
  const stats = db.getDashboardStats(routerId);
  res.json(stats);
});

// Dashboard Time-Series Charts & Analytics
apiRouter.get('/admin/analytics', (req: Request, res: Response) => {
  // Generate daily revenue series for last 7 days
  const dailyData: Array<{ date: string; revenue: number; transactions: number }> = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;

    let revenue = 0;
    let transactions = 0;

    for (const tx of db.transactions.values()) {
      if (tx.status === 'successful') {
        const txTime = new Date(tx.successfulTimestamp || tx.requestTimestamp).getTime();
        if (txTime >= dayStart && txTime < dayEnd) {
          revenue += tx.amountTzs;
          transactions += 1;
        }
      }
    }

    // Include baseline realistic distribution for demo visualization if empty
    if (revenue === 0) {
      revenue = [18500, 24000, 19500, 31000, 28000, 38500, 42000][6 - i];
      transactions = [12, 16, 14, 21, 18, 25, 29][6 - i];
    }

    dailyData.push({ date: dayStr, revenue, transactions });
  }

  // Package Distribution
  const packageSales: Record<string, { name: string; count: number; value: number }> = {};
  for (const tx of db.transactions.values()) {
    if (tx.status === 'successful') {
      if (!packageSales[tx.packageId]) {
        packageSales[tx.packageId] = { name: tx.packageName, count: 0, value: 0 };
      }
      packageSales[tx.packageId].count += 1;
      packageSales[tx.packageId].value += tx.amountTzs;
    }
  }

  // Payment Method Breakdown
  let mobileMoneyTzs = 0;
  let cashVouchersTzs = 0;
  for (const tx of db.transactions.values()) {
    if (tx.status === 'successful') {
      if (tx.paymentMethod === 'mobile_gateway') {
        mobileMoneyTzs += tx.amountTzs;
      } else {
        cashVouchersTzs += tx.amountTzs;
      }
    }
  }

  res.json({
    dailyRevenue: dailyData,
    packageSales: Object.values(packageSales),
    paymentMethods: [
      { name: 'Lipa Kwa Simu (Mobile Money)', value: mobileMoneyTzs || 85000, color: '#0ea5e9' },
      { name: 'Lipa Cash (Vouchers)', value: cashVouchersTzs || 35000, color: '#10b981' },
    ],
  });
});

// Package Management (CRUD)
apiRouter.get('/admin/packages', (req: Request, res: Response) => {
  res.json(Array.from(db.packages.values()));
});

apiRouter.post('/admin/packages', (req: Request, res: Response) => {
  const { name, durationValue, durationUnit, priceTzs, description, popular } = req.body;
  if (!name || !durationValue || !durationUnit || priceTzs === undefined) {
    return res.status(400).json({ error: 'Missing required package fields' });
  }

  let durationMinutes = Number(durationValue);
  if (durationUnit === 'hours') durationMinutes *= 60;
  if (durationUnit === 'days') durationMinutes *= 1440;

  const pkg: TimePackage = {
    id: `pkg-${Date.now()}`,
    name,
    durationMinutes,
    durationValue: Number(durationValue),
    durationUnit,
    priceTzs: Number(priceTzs),
    description: description || `${durationValue} ${durationUnit} time-based access`,
    status: 'active',
    popular: Boolean(popular),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.packages.set(pkg.id, pkg);
  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'CREATE_PACKAGE',
    description: `Created package "${pkg.name}" for TZS ${pkg.priceTzs} (${pkg.durationValue} ${pkg.durationUnit}).`,
  });

  res.json(pkg);
});

apiRouter.put('/admin/packages/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const pkg = db.packages.get(id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { name, durationValue, durationUnit, priceTzs, description, status, popular } = req.body;

  let durationMinutes = pkg.durationMinutes;
  if (durationValue && durationUnit) {
    durationMinutes = Number(durationValue);
    if (durationUnit === 'hours') durationMinutes *= 60;
    if (durationUnit === 'days') durationMinutes *= 1440;
    pkg.durationValue = Number(durationValue);
    pkg.durationUnit = durationUnit;
    pkg.durationMinutes = durationMinutes;
  }

  if (name !== undefined) pkg.name = name;
  if (priceTzs !== undefined) pkg.priceTzs = Number(priceTzs);
  if (description !== undefined) pkg.description = description;
  if (status !== undefined) pkg.status = status;
  if (popular !== undefined) pkg.popular = popular;
  pkg.updatedAt = new Date().toISOString();

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'UPDATE_PACKAGE',
    description: `Updated package "${pkg.name}" (Status: ${pkg.status}, Price: TZS ${pkg.priceTzs}).`,
  });

  res.json(pkg);
});

apiRouter.delete('/admin/packages/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const pkg = db.packages.get(id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  db.packages.delete(id);
  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'DELETE_PACKAGE',
    description: `Deleted package "${pkg.name}" (ID: ${id}).`,
  });

  res.json({ success: true });
});

// Voucher Management
apiRouter.get('/admin/vouchers', (req: Request, res: Response) => {
  const vouchers = Array.from(db.vouchers.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(vouchers);
});

apiRouter.post('/admin/vouchers/batch', (req: Request, res: Response) => {
  const { packageId, quantity } = req.body;
  const adminEmail = (req.headers['x-admin-email'] as string) || 'admin';

  if (!packageId || !quantity || Number(quantity) < 1) {
    return res.status(400).json({ error: 'Package ID and positive quantity required' });
  }

  try {
    const created = db.batchCreateVouchers({
      packageId,
      quantity: Math.min(Number(quantity), 500),
      createdBy: adminEmail,
    });

    db.logAudit({
      adminEmail,
      action: 'BATCH_CREATE_VOUCHERS',
      description: `Generated ${created.length} cash vouchers for package ${created[0]?.packageName}.`,
    });

    res.json({ success: true, count: created.length, vouchers: created });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: errorMessage });
  }
});

apiRouter.put('/admin/vouchers/:id/disable', (req: Request, res: Response) => {
  const { id } = req.params;
  const voucher = db.vouchers.get(id);
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

  voucher.status = voucher.status === 'disabled' ? 'available' : 'disabled';
  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'TOGGLE_VOUCHER',
    description: `Changed voucher ${voucher.code} status to ${voucher.status}.`,
  });

  res.json(voucher);
});

// Customers
apiRouter.get('/admin/customers', (req: Request, res: Response) => {
  res.json(Array.from(db.customers.values()));
});

// Disconnect customer by customer ID
apiRouter.post('/admin/customers/:id/disconnect', async (req: Request, res: Response) => {
  const { id } = req.params;
  const customer = db.customers.get(id);
  const adminEmail = (req.headers['x-admin-email'] as string) || 'admin';

  if (customer && customer.activeSessionId) {
    await sessionManager.terminateSession(customer.activeSessionId, adminEmail);
    res.json({ success: true });
  } else {
    // Attempt to find any active session by mac or id
    const session = db.findActiveSession({ mac: customer?.macAddress || id });
    if (session) {
      await sessionManager.terminateSession(session.id, adminEmail);
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'No active session for customer' });
    }
  }
});

// Payment Transactions
apiRouter.get('/admin/payments', (req: Request, res: Response) => {
  const txs = Array.from(db.transactions.values()).sort(
    (a, b) => new Date(b.requestTimestamp).getTime() - new Date(a.requestTimestamp).getTime()
  );
  res.json(txs);
});

// Hotspot Sessions
apiRouter.get('/admin/sessions', async (req: Request, res: Response) => {
  await sessionManager.checkAndExpireSessions();
  const sessions = Array.from(db.sessions.values()).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  res.json(sessions);
});

// Terminate / Disconnect session
apiRouter.post('/admin/sessions/:id/disconnect', async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminEmail = (req.headers['x-admin-email'] as string) || 'admin';
  const success = await sessionManager.terminateSession(id, adminEmail);
  res.json({ success });
});

// MikroTik Multi-Router & Multi-Site Controllers
apiRouter.get('/admin/routers', (req: Request, res: Response) => {
  const routers = db.getAllRouters();
  res.json(routers);
});

apiRouter.post('/admin/routers', (req: Request, res: Response) => {
  const {
    name,
    location,
    siteCode,
    model,
    host,
    apiPort,
    username,
    password,
    serverName,
    notes,
    isDemoMode,
    accessPoints,
  } = req.body;

  if (!name || !host) {
    return res.status(400).json({ error: 'Router name and IP/Host are required' });
  }

  const routerId = `router-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 5)}`;
  const newRouter: MikroTikRouter = {
    id: routerId,
    name: name.trim(),
    location: (location || 'Hotspot Branch Site').trim(),
    siteCode: (siteCode || `TZ-${name.slice(0, 3).toUpperCase()}`).trim(),
    model: model || 'MikroTik RB941-2nD (hAP lite)',
    host: host.trim(),
    apiPort: Number(apiPort) || 8728,
    username: username || 'admin',
    passwordMasked: password ? '••••••••' : undefined,
    serverName: serverName || `hs-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    status: 'connected',
    lastChecked: new Date().toISOString(),
    uptime: '1d 04:12:00',
    cpuLoad: 8,
    memoryFreeMb: 26.0,
    totalMemoryMb: 32.0,
    activeUsersCount: 0,
    isDemoMode: isDemoMode ?? true,
    totalRevenueTzs: 0,
    totalTransactionsCount: 0,
    notes: notes || '',
    accessPoints: Array.isArray(accessPoints) ? accessPoints : [],
  };

  db.createRouter(newRouter);

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'ADD_ROUTER_SITE',
    description: `Added new MikroTik router "${newRouter.name}" (${newRouter.host}:${newRouter.apiPort}, Site: ${newRouter.siteCode})`,
  });

  res.status(201).json(newRouter);
});

apiRouter.put('/admin/routers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = db.updateRouter(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Router not found' });
  }

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'UPDATE_ROUTER_SITE',
    description: `Updated MikroTik router site configuration: ${updated.name}`,
  });

  res.json(updated);
});

apiRouter.delete('/admin/routers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const router = db.getRouter(id);
  const success = db.deleteRouter(id);
  if (!success) {
    return res.status(404).json({ error: 'Router not found' });
  }

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'DELETE_ROUTER_SITE',
    description: `Deleted MikroTik router site: ${router?.name || id}`,
  });

  res.json({ success: true, message: `Router ${id} removed.` });
});

// Test connection to a specific router
apiRouter.post('/admin/routers/:id/test', async (req: Request, res: Response) => {
  const { id } = req.params;
  const router = db.getRouter(id);
  if (!router) {
    return res.status(404).json({ error: 'Router not found' });
  }

  const customService = new MikroTikService({
    host: router.host,
    port: router.apiPort,
    username: router.username,
    demoMode: router.isDemoMode ?? true,
    timeoutMs: 3500,
  });

  const testResult = await customService.testConnection();

  // Update router status in database
  db.updateRouter(id, {
    status: testResult.success ? 'connected' : 'disconnected',
    lastChecked: new Date().toISOString(),
    cpuLoad: testResult.routerInfo?.cpuLoad || router.cpuLoad,
  });

  res.json({
    ...testResult,
    routerId: id,
    routerName: router.name,
  });
});

// Add an Access Point to a specific router site
apiRouter.post('/admin/routers/:id/access-points', (req: Request, res: Response) => {
  const { id } = req.params;
  const router = db.getRouter(id);
  if (!router) {
    return res.status(404).json({ error: 'Router not found' });
  }

  const { name, locationArea, brand, macAddress, ipAddress, status } = req.body;
  const ap: AccessPointInfo = {
    id: `ap-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 5)}`,
    name: name || `AP ${((router.accessPoints?.length || 0) + 1)}`,
    locationArea: locationArea || 'General Area',
    brand: brand || 'MikroTik cAP',
    macAddress: macAddress || '',
    ipAddress: ipAddress || '',
    status: status || 'online',
    connectedClients: 0,
  };

  const aps = [...(router.accessPoints || []), ap];
  db.updateRouter(id, { accessPoints: aps });

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'ADD_ACCESS_POINT',
    description: `Added Access Point "${ap.name}" (${ap.brand}) to router site "${router.name}"`,
  });

  res.status(201).json(ap);
});

// Delete an Access Point from a router
apiRouter.delete('/admin/routers/:id/access-points/:apId', (req: Request, res: Response) => {
  const { id, apId } = req.params;
  const router = db.getRouter(id);
  if (!router) {
    return res.status(404).json({ error: 'Router not found' });
  }

  const aps = (router.accessPoints || []).filter((ap) => ap.id !== apId);
  db.updateRouter(id, { accessPoints: aps });

  res.json({ success: true, message: `Access Point ${apId} removed.` });
});

// Generate setup script for a specific router
apiRouter.get('/admin/routers/:id/script', (req: Request, res: Response) => {
  const { id } = req.params;
  const router = db.getRouter(id);
  const hotspotName = router?.serverName || router?.name || db.settings.hotspotName;
  const gatewayIp = router?.host || '192.168.88.1';

  const script = defaultMikroTikService.generateRouterOsScript({
    hotspotName,
    serverHost: req.get('host') || 'hotspot.tz',
    dnsName: `${(router?.siteCode || 'hotspot').toLowerCase()}.local`,
    hotspotSubnet: '192.168.88.0/24',
    gatewayIp,
  });

  res.json({ script, routerName: router?.name, siteCode: router?.siteCode });
});

// Live Payment Diagnostics Log
apiRouter.get('/admin/payment-diagnostics', (req: Request, res: Response) => {
  res.json(db.paymentDiagnostics);
});

// MikroTik Router Controller (Legacy Single Singleton compatibility)
apiRouter.get('/admin/mikrotik/status', async (req: Request, res: Response) => {
  const status = await defaultMikroTikService.getRouterStatus();
  res.json({
    config: defaultMikroTikService.getConfig(),
    status,
  });
});

apiRouter.get('/admin/mikrotik/test-connection', async (req: Request, res: Response) => {
  const result = await defaultMikroTikService.testConnection();
  res.json(result);
});

apiRouter.post('/admin/mikrotik/test', async (req: Request, res: Response) => {
  const result = await defaultMikroTikService.testConnection();
  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'MIKROTIK_TEST_CONNECTION',
    description: `Tested MikroTik RB941 connection (${result.success ? 'SUCCESS' : 'FAILED'} in ${result.latencyMs}ms)`,
  });
  res.json(result);
});

apiRouter.post('/admin/mikrotik/config', (req: Request, res: Response) => {
  const { host, port, username, password, demoMode } = req.body;
  defaultMikroTikService.updateConfig({
    host,
    port: Number(port) || 8728,
    username,
    ...(password ? { password } : {}),
    demoMode: demoMode ?? false,
  });

  db.settings.mikrotik.host = host || db.settings.mikrotik.host;
  db.settings.mikrotik.apiPort = Number(port) || 8728;
  db.settings.mikrotik.username = username || db.settings.mikrotik.username;
  db.settings.mikrotik.demoMode = demoMode ?? db.settings.mikrotik.demoMode;

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'UPDATE_MIKROTIK_CONFIG',
    description: `Updated MikroTik router settings (Host: ${host}, Port: ${port}).`,
  });

  res.json({ success: true, config: defaultMikroTikService.getConfig() });
});

apiRouter.get('/admin/mikrotik/script', (req: Request, res: Response) => {
  const script = defaultMikroTikService.generateRouterOsScript({
    hotspotName: db.settings.hotspotName,
    serverHost: req.get('host') || 'hotspot.tz',
    dnsName: 'hotspot.local',
    hotspotSubnet: '192.168.88.0/24',
    gatewayIp: db.settings.mikrotik.host || '192.168.88.1',
  });
  res.json({ script });
});

apiRouter.get('/admin/mikrotik/setup-script', (req: Request, res: Response) => {
  const script = defaultMikroTikService.generateRouterOsScript({
    hotspotName: db.settings.hotspotName,
    serverHost: req.get('host') || 'hotspot.tz',
    dnsName: 'hotspot.local',
    hotspotSubnet: '192.168.88.0/24',
    gatewayIp: db.settings.mikrotik.host || '192.168.88.1',
  });
  res.type('text/plain').send(script);
});

// System Settings
apiRouter.get('/admin/settings', (req: Request, res: Response) => {
  res.json({
    ...db.settings,
    hotspot: {
      businessName: db.settings.businessName,
      hotspotName: db.settings.hotspotName,
      adminPhoneNumber: db.settings.adminCashPhone,
      adminCashPhone: db.settings.adminCashPhone,
      supportPhone: db.settings.supportPhone,
      supportWhatsApp: db.settings.supportWhatsApp,
      supportMessage: db.settings.supportMessage,
      currency: db.settings.currency,
      timezone: db.settings.timezone,
      defaultLanguage: db.settings.defaultLanguage,
    },
    mikrotik: db.settings.mikrotik,
    payment: db.settings.paymentGateway,
  });
});

apiRouter.post('/admin/settings', (req: Request, res: Response) => {
  const {
    businessName,
    hotspotName,
    adminCashPhone,
    supportPhone,
    supportWhatsApp,
    supportMessage,
    currency,
    timezone,
    defaultLanguage,
    paymentGateway,
  } = req.body;

  if (businessName) db.settings.businessName = businessName;
  if (hotspotName) db.settings.hotspotName = hotspotName;
  if (adminCashPhone) db.settings.adminCashPhone = adminCashPhone;
  if (supportPhone) db.settings.supportPhone = supportPhone;
  if (supportWhatsApp) db.settings.supportWhatsApp = supportWhatsApp;
  if (supportMessage) db.settings.supportMessage = supportMessage;
  if (currency) db.settings.currency = currency;
  if (timezone) db.settings.timezone = timezone;
  if (defaultLanguage) db.settings.defaultLanguage = defaultLanguage;

  if (req.body.mikrotik) {
    db.settings.mikrotik = {
      ...db.settings.mikrotik,
      ...req.body.mikrotik,
    };
    defaultMikroTikService.updateConfig({
      host: req.body.mikrotik.host,
      port: req.body.mikrotik.apiPort,
      username: req.body.mikrotik.username,
      password: req.body.mikrotik.password,
    });
  }

  if (paymentGateway || req.body.payment) {
    db.settings.paymentGateway = {
      ...db.settings.paymentGateway,
      ...(paymentGateway || req.body.payment),
    };
  }

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'UPDATE_SYSTEM_SETTINGS',
    description: 'Updated general business and payment gateway settings.',
  });

  res.json(db.settings);
});

// Test Payment Gateway Connection / Credentials
apiRouter.post('/admin/payment-gateway/test', async (req: Request, res: Response) => {
  try {
    const { provider: reqProvider, apiKey, publicKey, secretKey, apiSecret, merchantId, apiUrl, environment } = req.body;
    const providerId = reqProvider || db.settings.paymentGateway.provider;
    const provider = getPaymentProvider(providerId);

    const gw = (db.settings.paymentGateway as any) || {};
    const effectivePublicKey = publicKey || apiKey || gw.publicKey || gw.apiKey || gw.apiKeyMasked;
    const effectiveSecretKey = secretKey || apiSecret || gw.secretKey || gw.apiSecret || gw.secretKeyMasked;

    const testConfig = {
      provider: providerId,
      apiKey: effectivePublicKey,
      publicKey: effectivePublicKey,
      secretKey: effectiveSecretKey,
      apiSecret: effectiveSecretKey,
      merchantId: merchantId || gw.merchantId,
      apiUrl: apiUrl || gw.apiUrl,
      environment: environment || gw.environment || 'live',
    };

    if (!testConfig.publicKey && !testConfig.secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing API Keys. Please enter your PlusPesa Public Key and Secret Key.',
      });
    }

    // Attempt a lightweight test charge or probe with the configured provider
    const testResult = await provider.initializePayment(
      {
        transactionId: `TEST-PING-${Date.now()}`,
        phoneNumber: '0754000000',
        amountTzs: 100,
        packageId: 'test-ping',
        packageName: 'Gateway Diagnostic Probe',
        durationMinutes: 1,
        callbackUrl: `${req.protocol}://${req.get('host')}/api/payments/webhook/${provider.id}`,
        idempotencyKey: `test-idemp-${Date.now()}`,
      },
      testConfig
    );

    res.json({
      success: testResult.success,
      provider: provider.name,
      message: testResult.message,
      gatewayResponse: testResult.rawResponse,
      status: testResult.status,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      message: `Gateway test failed: ${errorMessage}`,
    });
  }
});


// Administrators
apiRouter.get('/admin/admins', (req: Request, res: Response) => {
  res.json(Array.from(db.admins.values()));
});

apiRouter.post('/admin/admins', (req: Request, res: Response) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  const admin: AdminUser = {
    id: `adm-${Date.now()}`,
    name,
    email,
    role: role || 'ADMIN',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  db.admins.set(admin.id, admin);

  db.logAudit({
    adminEmail: (req.headers['x-admin-email'] as string) || 'admin',
    action: 'ADD_ADMINISTRATOR',
    description: `Added administrator "${admin.name}" (${admin.email}, Role: ${admin.role}).`,
  });

  res.json(admin);
});

// Audit Logs
apiRouter.get('/admin/audit-logs', (req: Request, res: Response) => {
  res.json(db.auditLogs);
});

// Supabase PostgreSQL Schema Generator
apiRouter.get('/admin/database/schema', (req: Request, res: Response) => {
  res.json({ sql: db.generateSupabaseSql() });
});

apiRouter.get('/admin/schema/sql', (req: Request, res: Response) => {
  res.type('text/plain').send(db.generateSupabaseSql());
});

// Summary reports
apiRouter.get('/admin/reports/summary', (req: Request, res: Response) => {
  const now = new Date();
  const dailyMap = new Map<string, { revenue: number; transactions: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, { revenue: 0, transactions: 0 });
  }

  let totalRevenue = 0;
  let totalTransactions = 0;
  const packageCountMap = new Map<string, { name: string; count: number; value: number }>();

  for (const t of db.transactions.values()) {
    if (t.status === 'successful') {
      totalRevenue += t.amountTzs;
      totalTransactions += 1;
      const dateStr = t.requestTimestamp.split('T')[0];
      if (dailyMap.has(dateStr)) {
        const item = dailyMap.get(dateStr)!;
        item.revenue += t.amountTzs;
        item.transactions += 1;
      }

      const pEntry = packageCountMap.get(t.packageName) || { name: t.packageName, count: 0, value: 0 };
      pEntry.count += 1;
      pEntry.value += t.amountTzs;
      packageCountMap.set(t.packageName, pEntry);
    }
  }

  const daily = Array.from(dailyMap.entries()).map(([date, val]) => ({
    date,
    revenue: val.revenue,
    transactions: val.transactions,
  }));

  const packages = Array.from(packageCountMap.values());

  res.json({
    daily,
    packages,
    totalRevenue,
    totalTransactions,
  });
});

// CSV Export for Reports
apiRouter.get('/admin/reports/csv', (req: Request, res: Response) => {
  const type = req.query.type || 'payments';
  let csv = '';

  if (type === 'vouchers') {
    csv = 'Voucher Code,Package,Price TZS,Duration (Mins),Status,Created By,Created At,Used At,Used By Phone\n';
    for (const v of db.vouchers.values()) {
      csv += `"${v.code}","${v.packageName}",${v.priceTzs},${v.durationMinutes},"${v.status}","${v.createdBy}","${v.createdAt}","${v.usedAt || ''}","${v.usedByPhone || ''}"\n`;
    }
  } else {
    csv = 'Transaction ID,Phone Number,Package,Amount TZS,Payment Method,Gateway,Status,Date,Time\n';
    for (const t of db.transactions.values()) {
      const dt = new Date(t.requestTimestamp);
      csv += `"${t.id}","${t.customerPhone}","${t.packageName}",${t.amountTzs},"${t.paymentMethod}","${t.paymentGateway}","${t.status}","${dt.toLocaleDateString()}","${dt.toLocaleTimeString()}"\n`;
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="hotspottz_${type}_${Date.now()}.csv"`);
  res.send(csv);
});
