import net from 'net';
import { RouterOSAPI } from 'node-routeros';

export interface MikroTikConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  timeoutMs?: number;
  demoMode?: boolean;
}

export interface RouterInfo {
  connected: boolean;
  model: string;
  version: string;
  cpuLoad: number;
  freeMemoryMb: number;
  totalMemoryMb: number;
  uptime: string;
  activeHotspotUsers: number;
  identity: string;
  message?: string;
  lastChecked: string;
}

export interface HotspotActiveUser {
  id: string;
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  timeLeft?: string;
}

/**
 * MikroTik RouterOS API Service for RB941 / RouterBOARD devices.
 * Handles Hotspot User Creation, Active Session Management, Time Limiting & Disconnection.
 *
 * Uses the real RouterOS binary API protocol (via node-routeros) over TCP port 8728
 * (or 8729 for api-ssl). Falls back to a clearly-labelled simulation ONLY when
 * demoMode is explicitly enabled or no password has been configured yet - it never
 * silently pretends success for a configured real router.
 */
export class MikroTikService {
  private config: MikroTikConfig;
  private lastStatus: RouterInfo;

  constructor(config?: Partial<MikroTikConfig>) {
    this.config = {
      host: config?.host || process.env.MIKROTIK_HOST || '192.168.88.1',
      port: Number(config?.port || process.env.MIKROTIK_PORT || 8728),
      username: config?.username || process.env.MIKROTIK_USERNAME || 'admin',
      password: config?.password ?? process.env.MIKROTIK_PASSWORD ?? '',
      timeoutMs: config?.timeoutMs || 8000,
      // Only simulate when explicitly asked to, or when no password has been set at all
      // (a real RouterOS API login with a blank password will fail anyway on any
      // properly secured router, so there's nothing real to attempt yet).
      demoMode: config?.demoMode ?? !(config?.password || process.env.MIKROTIK_PASSWORD),
    };

    this.lastStatus = {
      connected: false,
      model: 'MikroTik RB941-2nD (hAP lite)',
      version: 'Unknown',
      cpuLoad: 0,
      freeMemoryMb: 0,
      totalMemoryMb: 0,
      uptime: 'Unknown',
      activeHotspotUsers: 0,
      identity: 'HotspotTZ-RB941',
      lastChecked: new Date().toISOString(),
    };
  }

  public updateConfig(newConfig: Partial<MikroTikConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Re-evaluate demoMode whenever config changes, unless explicitly overridden.
    if (newConfig.demoMode === undefined && newConfig.password !== undefined) {
      this.config.demoMode = !newConfig.password;
    }
  }

  public getConfig(): MikroTikConfig {
    return { ...this.config, password: this.config.password ? '••••••••' : '' };
  }

  private async withConnection<T>(fn: (api: RouterOSAPI) => Promise<T>): Promise<T> {
    const api = new RouterOSAPI({
      host: this.config.host,
      user: this.config.username,
      password: this.config.password || '',
      port: this.config.port,
      timeout: Math.ceil((this.config.timeoutMs || 8000) / 1000),
    });
    try {
      await api.connect();
      const result = await fn(api);
      return result;
    } finally {
      try {
        await api.close();
      } catch {
        // ignore close errors - connection may already be gone
      }
    }
  }

  private demoRouterInfo(connected: boolean, message?: string): RouterInfo {
    this.lastStatus = {
      connected,
      model: 'MikroTik RB941-2nD (hAP lite)',
      version: 'RouterOS v7.14.3',
      cpuLoad: Math.floor(8 + Math.random() * 15),
      freeMemoryMb: Number((22.0 + Math.random() * 4).toFixed(1)),
      totalMemoryMb: 32.0,
      uptime: '18d 14:02:11',
      activeHotspotUsers: 3,
      identity: 'HotspotTZ-Gateway',
      lastChecked: new Date().toISOString(),
      message: message || '[DEMO MODE - no MikroTik password configured yet] Simulated response, not a real router.',
    };
    return this.lastStatus;
  }

  /**
   * Test network connection AND authenticate to the MikroTik router.
   * Only returns success:true if the real RouterOS API login actually succeeded.
   */
  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string; routerInfo: RouterInfo }> {
    const startTime = Date.now();

    if (this.config.demoMode) {
      const info = this.demoRouterInfo(true);
      return {
        success: true,
        latencyMs: Date.now() - startTime + 12,
        message: info.message || 'Demo mode active',
        routerInfo: info,
      };
    }

    try {
      const routerInfo = await this.withConnection(async (api) => {
        const [resource] = await api.write('/system/resource/print');
        const [identity] = await api.write('/system/identity/print');
        const activeUsers = await api.write('/ip/hotspot/active/print');

        const info: RouterInfo = {
          connected: true,
          model: (resource?.['board-name'] as string) || 'MikroTik',
          version: (resource?.version as string) || 'Unknown',
          cpuLoad: Number(resource?.['cpu-load']) || 0,
          freeMemoryMb: Number(resource?.['free-memory']) / (1024 * 1024) || 0,
          totalMemoryMb: Number(resource?.['total-memory']) / (1024 * 1024) || 0,
          uptime: (resource?.uptime as string) || 'Unknown',
          activeHotspotUsers: activeUsers.length,
          identity: (identity?.name as string) || 'MikroTik',
          message: `Connected and authenticated successfully to ${this.config.host}:${this.config.port}`,
          lastChecked: new Date().toISOString(),
        };
        return info;
      });

      this.lastStatus = routerInfo;
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: routerInfo.message || 'Connected',
        routerInfo,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastStatus.connected = false;
      this.lastStatus.message = `Real connection failed: ${errorMsg}`;
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `Could not connect/authenticate to MikroTik at ${this.config.host}:${this.config.port}: ${errorMsg}. Verify: IP is reachable, API service is enabled (/ip service enable api), and username/password are correct.`,
        routerInfo: this.lastStatus,
      };
    }
  }

  /**
   * Authorize a customer on the MikroTik Hotspot.
   * Creates (or refreshes) a user in /ip/hotspot/user with a strict time limit (limit-uptime).
   */
  async authorizeCustomer(params: {
    username: string;
    password?: string;
    durationMinutes: number;
    macAddress?: string;
    ipAddress?: string;
    profile?: string;
    comment?: string;
  }): Promise<{ success: boolean; username: string; limitUptime: string; message: string }> {
    const limitUptime = this.formatDurationToRouterOS(params.durationMinutes);
    const pass = params.password || params.username;
    const profile = params.profile || 'default';
    const comment = params.comment || `HotspotTZ:${params.durationMinutes}m:${new Date().toISOString()}`;

    if (this.config.demoMode) {
      console.log(`[MikroTik DEMO] Would authorize user: ${params.username}, Limit-Uptime: ${limitUptime}, MAC: ${params.macAddress || 'any'}`);
      return {
        success: true,
        username: params.username,
        limitUptime,
        message: `[DEMO MODE] User ${params.username} would be authorized for ${params.durationMinutes} minutes (${limitUptime}). No real router configured yet.`,
      };
    }

    try {
      await this.withConnection(async (api) => {
        // If a user with this name already exists (e.g. a returning customer), remove
        // it first so the time limit and usage counters start completely fresh.
        const existing = await api.write('/ip/hotspot/user/print', [`?name=${params.username}`]);
        if (existing.length > 0 && existing[0]['.id']) {
          await api.write('/ip/hotspot/user/remove', [`=.id=${existing[0]['.id']}`]);
        }

        const addParams = [
          `=name=${params.username}`,
          `=password=${pass}`,
          `=limit-uptime=${limitUptime}`,
          `=profile=${profile}`,
          `=comment=${comment}`,
        ];
        if (params.macAddress) addParams.push(`=mac-address=${params.macAddress}`);

        await api.write('/ip/hotspot/user/add', addParams);
      });

      console.log(`[MikroTik] Authorized user: ${params.username}, Limit-Uptime: ${limitUptime}, MAC: ${params.macAddress || 'any'}`);
      return {
        success: true,
        username: params.username,
        limitUptime,
        message: `User ${params.username} successfully authorized on MikroTik Hotspot for ${params.durationMinutes} minutes (${limitUptime}).`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[MikroTik] Failed to authorize user ${params.username}:`, errorMsg);
      return {
        success: false,
        username: params.username,
        limitUptime,
        message: `Failed to authorize ${params.username} on the real router: ${errorMsg}`,
      };
    }
  }

  /**
   * Terminate active connection for a customer on the router.
   */
  async disconnectCustomer(identifier: { username?: string; macAddress?: string; ipAddress?: string }): Promise<{ success: boolean; message: string }> {
    const label = identifier.username || identifier.macAddress || identifier.ipAddress || 'unknown';

    if (this.config.demoMode) {
      console.log(`[MikroTik DEMO] Would disconnect session: ${JSON.stringify(identifier)}`);
      return { success: true, message: `[DEMO MODE] Active session for ${label} would be terminated.` };
    }

    try {
      await this.withConnection(async (api) => {
        let query: string | null = null;
        if (identifier.username) query = `?user=${identifier.username}`;
        else if (identifier.macAddress) query = `?mac-address=${identifier.macAddress}`;
        else if (identifier.ipAddress) query = `?address=${identifier.ipAddress}`;

        if (!query) throw new Error('No username, MAC, or IP address provided to identify the session.');

        const active = await api.write('/ip/hotspot/active/print', [query]);
        for (const entry of active) {
          if (entry['.id']) {
            await api.write('/ip/hotspot/active/remove', [`=.id=${entry['.id']}`]);
          }
        }
      });

      console.log(`[MikroTik] Disconnected customer session: ${label}`);
      return { success: true, message: `Active session for ${label} terminated on MikroTik.` };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to disconnect ${label}: ${errorMsg}` };
    }
  }

  /**
   * Expire / Disable a user from the hotspot users list once their time is up.
   */
  async expireUser(username: string): Promise<{ success: boolean; message: string }> {
    if (this.config.demoMode) {
      console.log(`[MikroTik DEMO] Would disable expired user: ${username}`);
      return { success: true, message: `[DEMO MODE] User ${username} would be expired and disabled.` };
    }

    try {
      await this.withConnection(async (api) => {
        const existing = await api.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (existing.length > 0 && existing[0]['.id']) {
          await api.write('/ip/hotspot/user/set', [`=.id=${existing[0]['.id']}`, '=disabled=yes']);
        }
        // Also drop any currently-active session for this user immediately.
        const active = await api.write('/ip/hotspot/active/print', [`?user=${username}`]);
        for (const entry of active) {
          if (entry['.id']) {
            await api.write('/ip/hotspot/active/remove', [`=.id=${entry['.id']}`]);
          }
        }
      });

      console.log(`[MikroTik] Disabled expired user account: ${username}`);
      return { success: true, message: `User ${username} expired and disabled on MikroTik RB941.` };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to expire ${username}: ${errorMsg}` };
    }
  }

  /**
   * Query router status and health.
   */
  async getRouterStatus(): Promise<RouterInfo> {
    if (this.config.demoMode) {
      return this.demoRouterInfo(true);
    }
    const result = await this.testConnection();
    return result.routerInfo;
  }

  /**
   * Raw TCP reachability probe (does NOT authenticate) - useful as a quick first check
   * before attempting a full API login, e.g. to distinguish "wrong IP/unreachable"
   * from "reachable but bad credentials".
   */
  async pingPort(): Promise<{ reachable: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(this.config.timeoutMs || 4000);
      socket.on('connect', () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs: latency, message: `Port ${this.config.port} is open on ${this.config.host}.` });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: this.config.timeoutMs || 4000, message: `Timed out reaching ${this.config.host}:${this.config.port}.` });
      });
      socket.on('error', (err) => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - startTime, message: `Socket error: ${err.message}` });
      });
      socket.connect(this.config.port, this.config.host);
    });
  }

  /**
   * Helper: Convert duration in minutes to RouterOS time format (e.g. 90m -> "01:30:00")
   */
  private formatDurationToRouterOS(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:00`;
  }

  /**
   * Generate Production-Ready MikroTik RouterOS Script for RB941 Hotspot Setup
   */
  public generateRouterOsScript(settings: {
    hotspotName: string;
    serverHost: string;
    dnsName: string;
    hotspotSubnet: string;
    gatewayIp: string;
    apiPassword: string;
    /** The IP the RouterOS API should be reachable from - your VPS's Tailscale
     * address once the tunnel is set up. Leave blank to skip the restriction
     * (not recommended once you're online for real). */
    allowedApiSourceIp?: string;
  }): string {
    const poolEnd = settings.hotspotSubnet.replace(/\.0\/24$/, '.254');
    const poolStart = settings.hotspotSubnet.replace(/\.0\/24$/, '.10');
    const apiFirewallLine = settings.allowedApiSourceIp
      ? `add chain=input protocol=tcp dst-port=8728 src-address=${settings.allowedApiSourceIp} action=accept comment="Allow HotspotTZ server API access"\nadd chain=input protocol=tcp dst-port=8728 action=drop comment="Block all other API access"`
      : `# NOTE: no allowedApiSourceIp was set - API is reachable from anywhere on this\n# router's local network. Once your Tailscale tunnel is set up, re-generate this\n# script with allowedApiSourceIp set to lock this down.`;

    return `# ====================================================================
# HOTSPOT TZ - MIKROTIK RB941 (hAP lite) COMPLETE SETUP SCRIPT
# RouterOS Version: v6.x / v7.x Compatible
# Generated for: ${settings.hotspotName}
# ====================================================================
#
# BEFORE RUNNING THIS: this script assumes a stock/default RB941 configuration
# already provides: a "bridge" interface with IP ${settings.gatewayIp} assigned,
# a DHCP server + NAT masquerade for internet sharing, and WAN internet already
# working. If you reset the router to "none" configuration instead of the
# default, those need to be set up first - ask if you get stuck here.
# ====================================================================

# 1. Enable RouterOS API Service for HotspotTZ Management, with a real password
/ip service enable api
/ip service set api port=8728
/user set [find name=admin] password="${settings.apiPassword}"

# 1b. Restrict who can reach the API (important once this router has any
# internet-facing exposure)
/ip firewall filter
${apiFirewallLine}

# 2. Create the IP pool the hotspot server hands out addresses from
/ip pool
add name=hs-pool ranges=${poolStart}-${poolEnd}

# 3. Configure Hotspot User Profile (Time-based session handling)
/ip hotspot profile
add dns-name="${settings.dnsName}" hotspot-address=${settings.gatewayIp} \\
    html-directory=hotspot login-by=http-chap,http-pap,mac-cookie name=HotspotTZ-Profile \\
    rate-limit=""

# 4. Configure Hotspot Server on bridge/wlan interface
/ip hotspot
add address-pool=hs-pool disabled=no interface=bridge name="${settings.hotspotName}" profile=HotspotTZ-Profile

# 5. Configure Walled Garden (Allows unauthenticated customers to reach ONLY
# the portal server and payment gateway - nothing else. The hotspot's own
# redirect mechanism handles capturing traffic automatically; no extra
# broad allow-rule is needed or safe here.)
/ip hotspot walled-garden
add dst-host="${settings.serverHost}" comment="HotspotTZ Central Portal Server"
add dst-host="*.pluspesa.com" comment="PlusPesa Mobile Money Gateway"
add dst-host="app.pluspesa.com" comment="PlusPesa API"
add dst-host="*.googleapis.com" comment="Google Fonts / Assets"
add dst-host="*.gstatic.com" comment="Google Static CDN"

# 6. Set session timeout check interval
/ip hotspot user profile
set [find default=yes] keepalive-timeout=2m idle-timeout=5m status-autorefresh=1m

# ====================================================================
# END OF MIKROTIK RB941 SETUP SCRIPT
# ====================================================================`;
  }
}

export const defaultMikroTikService = new MikroTikService();
