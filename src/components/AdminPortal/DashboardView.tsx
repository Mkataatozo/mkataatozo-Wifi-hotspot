import React, { useState, useEffect } from 'react';
import {
  Users,
  Wifi,
  DollarSign,
  TrendingUp,
  Clock,
  Ticket,
  CheckCircle,
  Router,
  RefreshCw,
  ArrowUpRight,
  Layers,
  MapPin,
  Radio,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { DashboardStats, MikroTikRouter } from '../../types.js';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [routers, setRouters] = useState<MikroTikRouter[]>([]);
  const [selectedRouterFilter, setSelectedRouterFilter] = useState<string>('all');
  const [analytics, setAnalytics] = useState<{
    dailyRevenue: Array<{ date: string; revenue: number; transactions: number }>;
    packageSales: Array<{ name: string; count: number; value: number }>;
    paymentMethods: Array<{ name: string; value: number; color: string }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async (routerId?: string) => {
    setIsLoading(true);
    try {
      const queryParam = routerId && routerId !== 'all' ? `?routerId=${routerId}` : '';
      const [statsRes, analyticsRes, routersRes] = await Promise.all([
        fetch(`/api/admin/stats${queryParam}`).catch(() => null),
        fetch('/api/admin/analytics').catch(() => null),
        fetch('/api/admin/routers').catch(() => null),
      ]);
      
      if (statsRes && statsRes.ok && statsRes.headers.get('content-type')?.includes('application/json')) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        setStats({
          totalCustomers: 0,
          activeCustomers: 0,
          onlineCustomers: 0,
          todaySalesCount: 0,
          todayRevenueTzs: 0,
          monthlyRevenueTzs: 0,
          activePackagesCount: 0,
          availableVouchersCount: 0,
          usedVouchersCount: 0,
          totalVoucherValueTzs: 0,
          usedVoucherValueTzs: 0,
          unusedVoucherValueTzs: 0,
          mikrotikStatus: 'connected',
        });
      }

      if (routersRes && routersRes.ok && routersRes.headers.get('content-type')?.includes('application/json')) {
        const routersData = await routersRes.json();
        setRouters(routersData);
      }

      if (analyticsRes && analyticsRes.ok && analyticsRes.headers.get('content-type')?.includes('application/json')) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      } else {
        setAnalytics({
          dailyRevenue: [],
          packageSales: [],
          paymentMethods: [
            { name: 'Lipa Kwa Simu (Mobile Money)', value: 0, color: '#0ea5e9' },
            { name: 'Lipa Cash (Vouchers)', value: 0, color: '#10b981' },
          ],
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedRouterFilter);
  }, [selectedRouterFilter]);

  if (isLoading && !stats) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
        Loading Hotspot Analytics & Real-Time Stats...
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Revenue",
      value: `TZS ${(stats?.todayRevenueTzs || 0).toLocaleString()}`,
      sub: `${stats?.todaySalesCount || 0} sales today`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Monthly Revenue',
      value: `TZS ${(stats?.monthlyRevenueTzs || 0).toLocaleString()}`,
      sub: 'Current billing month',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Online Customers',
      value: (stats?.onlineCustomers || 0).toString(),
      sub: `${stats?.activeCustomers || 0} active packages`,
      icon: Wifi,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Total Customers',
      value: (stats?.totalCustomers || 0).toString(),
      sub: 'Unique devices & phones',
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: 'Active Packages',
      value: (stats?.activePackagesCount || 0).toString(),
      sub: 'Time-based plans',
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Available Vouchers',
      value: (stats?.availableVouchersCount || 0).toString(),
      sub: `TZS ${(stats?.unusedVoucherValueTzs || 0).toLocaleString()} stock`,
      icon: Ticket,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Used Vouchers',
      value: (stats?.usedVouchersCount || 0).toString(),
      sub: `TZS ${(stats?.usedVoucherValueTzs || 0).toLocaleString()} redeemed`,
      icon: CheckCircle,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      title: 'MikroTik RB941',
      value: stats?.mikrotikStatus === 'connected' ? 'CONNECTED' : 'STANDBY',
      sub: 'RouterOS API Port 8728',
      icon: Router,
      color: stats?.mikrotikStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600',
      bg: stats?.mikrotikStatus === 'connected' ? 'bg-emerald-50' : 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6" id="admin-dashboard-view">
      {/* Top Banner with Refresh & Site Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Tanzania Wi-Fi Hotspot Performance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time telemetry, mobile money settlements, and active MikroTik multi-site sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Site Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-slate-500">Site:</span>
            <select
              value={selectedRouterFilter}
              onChange={(e) => setSelectedRouterFilter(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Hotspot Sites ({routers.length})</option>
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.siteCode})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchDashboardData(selectedRouterFilter)}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 self-start sm:self-auto shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 truncate">{card.title}</span>
                <div className={`w-7 h-7 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
                  {card.value}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Revenue Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Revenue & Sales Trend (7 Days)</h3>
              <p className="text-xs text-slate-500">TZS collected through Mobile Gateway & Cash Vouchers</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>TZS</span>
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.dailyRevenue || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip
                  formatter={(val: unknown) => {
                    const num = typeof val === 'number' ? val : Number(val);
                    return isNaN(num) ? String(val) : [`TZS ${num.toLocaleString()}`, 'Revenue'];
                  }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Payment Breakdown</h3>
            <p className="text-xs text-slate-500">Lipa Kwa Simu vs Lipa Cash (TZS)</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.paymentMethods || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(analytics?.paymentMethods || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: unknown) => {
                    const num = typeof val === 'number' ? val : Number(val);
                    return isNaN(num) ? String(val) : [`TZS ${num.toLocaleString()}`, 'Value'];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {(analytics?.paymentMethods || []).map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-slate-600 font-medium">{m.name}</span>
                </div>
                <span className="font-bold text-slate-900">TZS {m.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Site Hotspot Nodes & Access Points Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Multi-Site MikroTik Routers & Access Points Overview</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live status, connected Access Points, active client counts, and revenue contribution per site
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {routers.length} Centralized Locations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                <th className="pb-2.5">Site & Code</th>
                <th className="pb-2.5">Location</th>
                <th className="pb-2.5">Router Hardware / IP</th>
                <th className="pb-2.5">Access Points</th>
                <th className="pb-2.5">Active Clients</th>
                <th className="pb-2.5 text-right">Site Revenue</th>
                <th className="pb-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routers.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-900 text-white rounded font-bold">
                        {r.siteCode}
                      </span>
                      <span>{r.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-600">{r.location}</td>
                  <td className="py-3 font-mono text-slate-700">
                    <div>{r.model || 'MikroTik RB941'}</div>
                    <div className="text-[10px] text-slate-400">{r.host}:{r.apiPort}</div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {r.accessPoints?.length || 0} APs
                      </span>
                      {r.accessPoints?.slice(0, 2).map((ap) => (
                        <span key={ap.id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {ap.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {r.activeUsersCount || 0} online
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    TZS {(r.totalRevenueTzs || 0).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ONLINE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
