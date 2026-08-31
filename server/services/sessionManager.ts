import { db } from '../db.js';
import { defaultMikroTikService } from '../mikrotik/MikroTikService.js';

/**
 * Session Manager & Automatic Expiration Daemon
 * Periodically scans active sessions and automatically disconnects expired users on MikroTik
 */
export class SessionManager {
  private timer: NodeJS.Timeout | null = null;
  private checkIntervalMs = 15000; // Check every 15 seconds

  constructor() {
    this.startDaemon();
  }

  public startDaemon() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkAndExpireSessions().catch((err) => {
        console.error('[SessionManager] Error checking session expirations:', err);
      });
    }, this.checkIntervalMs);
  }

  public stopDaemon() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Scan all sessions, detect expired sessions, terminate on MikroTik, and update database
   */
  public async checkAndExpireSessions(): Promise<number> {
    const now = Date.now();
    let expiredCount = 0;

    for (const session of db.sessions.values()) {
      if (session.status === 'active') {
        const expiryTimeMs = new Date(session.expiryTime).getTime();
        if (expiryTimeMs <= now) {
          // Session has expired!
          session.status = 'expired';
          expiredCount++;

          // Disconnect on MikroTik router
          try {
            await defaultMikroTikService.disconnectCustomer({
              username: session.mikrotikUser,
              macAddress: session.customerMac,
              ipAddress: session.customerIp,
            });
            await defaultMikroTikService.expireUser(session.mikrotikUser);
          } catch (err) {
            console.error(`[SessionManager] Failed to disconnect MikroTik session for ${session.customerIdentifier}:`, err);
          }

          // Update customer record
          const custId = session.customerPhone ? `cust-${session.customerPhone}` : `cust-${session.customerMac}`;
          const customer = db.customers.get(custId);
          if (customer && customer.activeSessionId === session.id) {
            customer.activeSessionId = null;
          }

          db.logAudit({
            adminEmail: 'system@hotspottz.co.tz',
            action: 'SESSION_AUTO_EXPIRED',
            description: `Session ${session.id} for ${session.customerIdentifier} expired after ${session.durationMinutes} minutes. Router access revoked.`,
            metadata: {
              sessionId: session.id,
              packageName: session.packageName,
              startTime: session.startTime,
              expiryTime: session.expiryTime,
            },
          });
        }
      }
    }

    return expiredCount;
  }

  /**
   * Manually terminate an active session (Admin disconnect)
   */
  public async terminateSession(sessionId: string, adminEmail: string = 'admin'): Promise<boolean> {
    const session = db.sessions.get(sessionId);
    if (!session || session.status !== 'active') return false;

    session.status = 'disconnected';

    // Terminate on MikroTik
    await defaultMikroTikService.disconnectCustomer({
      username: session.mikrotikUser,
      macAddress: session.customerMac,
      ipAddress: session.customerIp,
    });

    const custId = session.customerPhone ? `cust-${session.customerPhone}` : `cust-${session.customerMac}`;
    const customer = db.customers.get(custId);
    if (customer && customer.activeSessionId === session.id) {
      customer.activeSessionId = null;
    }

    db.logAudit({
      adminEmail,
      action: 'ADMIN_FORCE_DISCONNECT',
      description: `Administrator forcibly disconnected customer ${session.customerIdentifier} (Session: ${session.id})`,
      metadata: { sessionId: session.id },
    });

    return true;
  }
}

export const sessionManager = new SessionManager();
