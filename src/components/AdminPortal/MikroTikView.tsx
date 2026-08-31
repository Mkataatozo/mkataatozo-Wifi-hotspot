import React, { useState, useEffect } from 'react';
import {
  Router,
  Cpu,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Code,
  ShieldCheck,
  Globe,
  Sliders,
  Terminal,
  Plus,
  Radio,
  MapPin,
  Trash2,
  Edit3,
  Signal,
  Users,
  Activity,
  Layers,
  Search,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { MikroTikRouter, AccessPointInfo } from '../../types.js';

export const MikroTikView: React.FC = () => {
  const [routers, setRouters] = useState<MikroTikRouter[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'routers' | 'add' | 'script' | 'diagnostics'>('routers');
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<{ id: string; success: boolean; message: string; latencyMs?: number } | null>(null);
  const [routerScript, setRouterScript] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [diagnostics, setDiagnostics] = useState<any[]>([]);

  // AP Management Modal State
  const [apModalRouter, setApModalRouter] = useState<MikroTikRouter | null>(null);
  const [newApForm, setNewApForm] = useState<{
    name: string;
    locationArea: string;
    brand: string;
    macAddress: string;
    ipAddress: string;
  }>({
    name: '',
    locationArea: '',
    brand: 'MikroTik cAP',
    macAddress: '',
    ipAddress: '',
  });

  // Add Router Form State
  const [newRouterForm, setNewRouterForm] = useState({
    name: '',
    location: '',
    siteCode: '',
    model: 'MikroTik RB941-2nD (hAP lite)',
    host: '192.168.88.1',
    apiPort: 8728,
    username: 'admin',
    password: '',
    serverName: 'hotspot-site',
    notes: '',
    isDemoMode: false,
  });

  // Edit Router State
  const [editingRouter, setEditingRouter] = useState<MikroTikRouter | null>(null);

  const fetchRouters = async () => {
    setIsLoading(true);
    try {
      const [routersRes, diagRes] = await Promise.all([
        fetch('/api/admin/routers').catch(() => null),
        fetch('/api/admin/payment-diagnostics').catch(() => null),
      ]);

      if (routersRes && routersRes.ok && routersRes.headers.get('content-type')?.includes('application/json')) {
        const data = await routersRes.json();
        setRouters(data);
        if (data.length > 0 && !selectedRouterId) {
          setSelectedRouterId(data[0].id);
        }
      }

      if (diagRes && diagRes.ok && diagRes.headers.get('content-type')?.includes('application/json')) {
        const diagData = await diagRes.json();
        setDiagnostics(diagData);
      }
    } catch (err) {
      console.error('Failed to load routers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScriptForRouter = async (routerId: string) => {
    try {
      const res = await fetch(`/api/admin/routers/${routerId}/script`);
      if (res.ok) {
        const data = await res.json();
        setRouterScript(data.script);
      }
    } catch (err) {
      console.error('Failed to fetch script:', err);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    if (selectedRouterId) {
      fetchScriptForRouter(selectedRouterId);
    }
  }, [selectedRouterId]);

  const handlePingRouter = async (routerId: string) => {
    setIsPinging(routerId);
    setPingResult(null);
    try {
      const res = await fetch(`/api/admin/routers/${routerId}/test`, { method: 'POST' });
      const data = await res.json();
      setPingResult({
        id: routerId,
        success: data.success,
        message: data.message || (data.success ? 'Router connected & responsive' : 'Connection failed'),
        latencyMs: data.latencyMs,
      });
      // Refresh list to update status
      fetchRouters();
    } catch (err) {
      setPingResult({
        id: routerId,
        success: false,
        message: 'Network socket timeout / unreachable',
      });
    } finally {
      setIsPinging(null);
    }
  };

  const handleCreateRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouterForm.name || !newRouterForm.host) {
      alert('Please provide router name and Host/IP address');
      return;
    }

    try {
      const res = await fetch('/api/admin/routers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRouterForm),
      });

      if (res.ok) {
        const created = await res.json();
        setRouters([...routers, created]);
        setSelectedRouterId(created.id);
        setActiveTab('routers');
        setNewRouterForm({
          name: '',
          location: '',
          siteCode: '',
          model: 'MikroTik RB941-2nD (hAP lite)',
          host: '192.168.88.1',
          apiPort: 8728,
          username: 'admin',
          password: '',
          serverName: 'hotspot-site',
          notes: '',
          isDemoMode: true,
        });
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save router');
    }
  };

  const handleUpdateRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRouter) return;

    try {
      const res = await fetch(`/api/admin/routers/${editingRouter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRouter),
      });

      if (res.ok) {
        const updated = await res.json();
        setRouters(routers.map((r) => (r.id === updated.id ? updated : r)));
        setEditingRouter(null);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update router');
    }
  };

  const handleDeleteRouter = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove router site "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/routers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRouters(routers.filter((r) => r.id !== id));
        if (selectedRouterId === id && routers.length > 1) {
          setSelectedRouterId(routers.filter((r) => r.id !== id)[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAccessPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apModalRouter || !newApForm.name) return;

    try {
      const res = await fetch(`/api/admin/routers/${apModalRouter.id}/access-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApForm),
      });

      if (res.ok) {
        const createdAp = await res.json();
        const updatedRouter = {
          ...apModalRouter,
          accessPoints: [...(apModalRouter.accessPoints || []), createdAp],
        };
        setApModalRouter(updatedRouter);
        setRouters(routers.map((r) => (r.id === updatedRouter.id ? updatedRouter : r)));
        setNewApForm({
          name: '',
          locationArea: '',
          brand: 'MikroTik cAP',
          macAddress: '',
          ipAddress: '',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccessPoint = async (routerId: string, apId: string) => {
    try {
      const res = await fetch(`/api/admin/routers/${routerId}/access-points/${apId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (apModalRouter && apModalRouter.id === routerId) {
          const updated = {
            ...apModalRouter,
            accessPoints: (apModalRouter.accessPoints || []).filter((ap) => ap.id !== apId),
          };
          setApModalRouter(updated);
        }
        setRouters(
          routers.map((r) => {
            if (r.id === routerId) {
              return {
                ...r,
                accessPoints: (r.accessPoints || []).filter((ap) => ap.id !== apId),
              };
            }
            return r;
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(routerScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Aggregated network stats
  const totalAPs = routers.reduce((acc, r) => acc + (r.accessPoints?.length || 0), 0);
  const totalActiveClients = routers.reduce((acc, r) => acc + (r.activeUsersCount || 0), 0);
  const onlineRoutersCount = routers.filter((r) => r.status === 'connected').length;
  const totalNetworkRevenue = routers.reduce((acc, r) => acc + (r.totalRevenueTzs || 0), 0);

  const filteredRouters = routers.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q) ||
      r.siteCode.toLowerCase().includes(q) ||
      r.host.includes(q)
    );
  });

  return (
    <div className="space-y-6" id="multi-router-management-hub">
      {/* Top Banner & Multi-Site KPI Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Router className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">Multi-Site Hotspot & MikroTik Network Hub</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {routers.length} Sites Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized cloud controller for multiple MikroTik routers, branches & distributed Access Points
              </p>
            </div>
          </div>

          {/* Tab Switcher & Quick Add */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('routers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'routers' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Routers & APs ({routers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'add' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Add Router Site</span>
              </button>
              <button
                onClick={() => setActiveTab('script')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'script' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                <Code className="w-3.5 h-3.5 text-blue-600" />
                <span>Script Generator</span>
              </button>
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'diagnostics' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Payment & USSD Inspector</span>
              </button>
            </div>

            <button
              onClick={fetchRouters}
              disabled={isLoading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              title="Refresh all routers"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Hotspot Locations</span>
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">{routers.length}</span>
              <span className="text-[11px] font-bold text-emerald-600">({onlineRoutersCount} Online)</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Connected Access Points</span>
              <Radio className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">{totalAPs}</span>
              <span className="text-[11px] text-slate-500">cAP / UniFi / Omada</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Active Hotspot Clients</span>
              <Users className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">{totalActiveClients}</span>
              <span className="text-[11px] text-emerald-600 font-bold">Live Sessions</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Aggregated Revenue</span>
              <Activity className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-700">TZS {totalNetworkRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: ROUITERS & ACCESS POINTS LIST */}
      {activeTab === 'routers' && (
        <div className="space-y-4">
          {/* Search bar & filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Site Name, Location, Site Code (e.g. TZ-KK-01), or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span>Showing {filteredRouters.length} of {routers.length} branch locations</span>
            </div>
          </div>

          {/* Router Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRouters.map((router) => {
              const isSelected = selectedRouterId === router.id;
              const isThisPinging = isPinging === router.id;

              return (
                <div
                  key={router.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-2xs ${
                    isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header: Site Code & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-900 text-white font-mono">
                            {router.siteCode || 'SITE'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {router.isDemoMode ? 'Auto-Sync / Demo' : 'Live TCP API'}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 mt-2">{router.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{router.location}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-700 uppercase">
                          {router.status || 'Connected'}
                        </span>
                      </div>
                    </div>

                    {/* Router Specs Box */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Router Hardware:</span>
                        <span className="font-semibold text-slate-800">{router.model || 'MikroTik RB941-2nD'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Host IP / API Port:</span>
                        <span className="font-mono font-bold text-slate-900">{router.host}:{router.apiPort || 8728}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Uptime / CPU Load:</span>
                        <span className="font-mono text-slate-700">{router.uptime || '7d+'} • {router.cpuLoad || 12}% CPU</span>
                      </div>
                    </div>

                    {/* Access Points Section */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                        <span className="flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-blue-600" />
                          <span>Access Points ({router.accessPoints?.length || 0})</span>
                        </span>
                        <button
                          onClick={() => setApModalRouter(router)}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Manage APs</span>
                        </button>
                      </div>

                      {router.accessPoints && router.accessPoints.length > 0 ? (
                        <div className="space-y-1.5">
                          {router.accessPoints.map((ap) => (
                            <div
                              key={ap.id}
                              className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{ap.name}</span>
                                <span className="text-[11px] text-slate-500 ml-1.5">({ap.locationArea})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">
                                  {ap.brand}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                                  <Users className="w-2.5 h-2.5" />
                                  {ap.connectedClients || 0}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                          No external APs registered yet.
                        </div>
                      )}
                    </div>

                    {/* Revenue & Client Metric */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Clients</span>
                        <span className="font-black text-slate-900 text-sm">{router.activeUsersCount || 0} online</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Revenue</span>
                        <span className="font-black text-emerald-700 text-sm">
                          TZS {(router.totalRevenueTzs || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => handlePingRouter(router.id)}
                      disabled={isThisPinging}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Test TCP Socket Ping"
                    >
                      <RefreshCw className={`w-3 h-3 ${isThisPinging ? 'animate-spin text-emerald-600' : ''}`} />
                      <span>{isThisPinging ? 'Pinging...' : 'Ping'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRouterId(router.id);
                        setActiveTab('script');
                      }}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Generate RouterOS Script"
                    >
                      <Code className="w-3 h-3" />
                      <span>Script</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingRouter(router)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit router settings"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRouter(router.id, router.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete router"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Ping Toast / Result Notification */}
          {pingResult && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs ${
                pingResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {pingResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{pingResult.message}</span>
                {pingResult.latencyMs !== undefined && (
                  <span className="font-mono px-1.5 py-0.5 rounded bg-white text-slate-800 text-[11px] border">
                    {pingResult.latencyMs}ms
                  </span>
                )}
              </div>
              <button
                onClick={() => setPingResult(null)}
                className="text-slate-400 hover:text-slate-600 text-xs ml-4"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD NEW ROUTER / SITE */}
      {activeTab === 'add' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs max-w-3xl mx-auto">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Add New MikroTik Router / Hotspot Site</h3>
              <p className="text-xs text-slate-500">
                Connect a new MikroTik RB941, hEX, or CCR router to expand your hotspot business to another branch
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateRouter} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Site / Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Site 4 - Posta Ferry Lounge"
                  value={newRouterForm.name}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location / Physical Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kivukoni Ferry Terminal, Dar es Salaam"
                  value={newRouterForm.location}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Site Code (Tag)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TZ-PF-04"
                  value={newRouterForm.siteCode}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, siteCode: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Router Hardware Model
                </label>
                <select
                  value={newRouterForm.model}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, model: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="MikroTik RB941-2nD (hAP lite)">MikroTik RB941-2nD (hAP lite)</option>
                  <option value="MikroTik hEX RB750Gr3">MikroTik hEX RB750Gr3</option>
                  <option value="MikroTik RB951Ui-2HnD">MikroTik RB951Ui-2HnD</option>
                  <option value="MikroTik hAP ac2 / ac3">MikroTik hAP ac2 / ac3</option>
                  <option value="MikroTik CCR2004 / CCR1009">MikroTik Cloud Core (CCR)</option>
                  <option value="Other RouterOS Device">Other RouterOS Device</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hotspot Server Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. hotspot-posta"
                  value={newRouterForm.serverName}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, serverName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Router Host IP / DDNS <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.88.1 or site4.sn.mynetname.net"
                  value={newRouterForm.host}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, host: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  RouterOS API Port
                </label>
                <input
                  type="number"
                  placeholder="8728"
                  value={newRouterForm.apiPort}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, apiPort: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  API Username
                </label>
                <input
                  type="text"
                  placeholder="admin"
                  value={newRouterForm.username}
                  onChange={(e) => setNewRouterForm({ ...newRouterForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                API Password
              </label>
              <input
                type="password"
                placeholder="Enter router admin password (or leave empty if no password set)"
                value={newRouterForm.password}
                onChange={(e) => setNewRouterForm({ ...newRouterForm, password: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Site Notes & Installation Details
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Connected to Airtel 4G Fiber, 2 UniFi APs placed at counter & parking area."
                value={newRouterForm.notes}
                onChange={(e) => setNewRouterForm({ ...newRouterForm, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('routers')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save & Register Router Site</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: MULTI-SITE SCRIPT GENERATOR */}
      {activeTab === 'script' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">MikroTik RouterOS Setup Script Generator</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Copy and paste this script directly into your MikroTik Terminal to configure API, Hotspot, and Walled Garden for PlusPesa
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Site Selector */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>Select Site:</span>
                <select
                  value={selectedRouterId}
                  onChange={(e) => setSelectedRouterId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.siteCode})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCopyScript}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Setup Script</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Terminal Guide */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-950 space-y-1.5">
            <span className="font-extrabold flex items-center gap-1 text-emerald-900">
              <Terminal className="w-3.5 h-3.5" />
              <span>How to Apply to MikroTik:</span>
            </span>
            <ol className="list-decimal list-inside space-y-1 text-emerald-900/90 font-medium pl-1">
              <li>Open <strong>Winbox</strong> or SSH into your MikroTik router (e.g. {routers.find(r => r.id === selectedRouterId)?.host || '192.168.88.1'}).</li>
              <li>Click on <strong>New Terminal</strong> in Winbox.</li>
              <li>Click the <strong>Copy Setup Script</strong> button above and paste it into the Terminal window.</li>
              <li>Press <strong>Enter</strong> — your Hotspot, API port (8728), and PlusPesa Walled Garden rules will be active immediately.</li>
            </ol>
          </div>

          {/* Script Display Code Block */}
          <div className="relative">
            <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 leading-relaxed max-h-[480px]">
              <code>{routerScript}</code>
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: LIVE PAYMENT & USSD DIAGNOSTIC INSPECTOR */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Live Payment & USSD Push Inspector</h3>
                <p className="text-xs text-slate-500">
                  Real-time diagnostics for mobile money payments, PlusPesa API responses, and USSD prompt delivery
                </p>
              </div>
            </div>

            {/* USSD Push Knowledge Box */}
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>How USSD Push works with PlusPesa & MikroTik:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                <li>
                  <strong>Does USSD Push require MikroTik connection first?</strong> No! The USSD Push is sent directly by PlusPesa and telecom networks (Vodacom, Tigo, Airtel, Halotel) to the customer&apos;s phone.
                </li>
                <li>
                  <strong>Why might the USSD prompt not show on phone?</strong>
                  <span className="block pl-4 mt-0.5 text-slate-700">
                    1. Ensure you entered your <strong>Public Key and Secret Key</strong> in <em>Admin &gt; Settings &gt; PlusPesa Gateway</em>.<br />
                    2. Check that your PlusPesa account on <code>admin.pluspesa.com</code> has an active subscription/float balance.<br />
                    3. Ensure you test with a real Tanzanian SIM card number (e.g. 0754..., 0655...).
                  </span>
                </li>
                <li>
                  <strong>What does MikroTik do?</strong> Once PlusPesa confirms the user entered their PIN and the payment succeeds, this central portal instantly talks to the MikroTik router via API to authorize internet access for the customer.
                </li>
              </ul>
            </div>
          </div>

          {/* Diagnostic Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Payment & USSD Requests</h4>
              <button
                onClick={fetchRouters}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Logs</span>
              </button>
            </div>

            {diagnostics.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {diagnostics.map((diag) => (
                  <div key={diag.id} className="p-4 hover:bg-slate-50 transition-colors space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            diag.success
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {diag.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                        <span className="font-mono font-bold text-slate-800">{diag.provider}</span>
                        {diag.phoneNumber && (
                          <span className="text-slate-600">Phone: {diag.phoneNumber}</span>
                        )}
                        {diag.amountTzs && (
                          <span className="font-bold text-emerald-700">TZS {diag.amountTzs.toLocaleString()}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(diag.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-slate-700 font-medium">{diag.message}</p>

                    {diag.rawResponse && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer font-mono">
                          View Raw PlusPesa Response Payload
                        </summary>
                        <pre className="mt-1.5 p-2 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono overflow-x-auto">
                          {JSON.stringify(diag.rawResponse, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No payment requests recorded yet. When a customer initiates a payment on the portal, live logs will appear here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* AP MANAGEMENT MODAL */}
      {apModalRouter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Manage Access Points for {apModalRouter.name}
                </h3>
                <p className="text-xs text-slate-500">Site Code: {apModalRouter.siteCode} • {apModalRouter.location}</p>
              </div>
              <button
                onClick={() => setApModalRouter(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* List of current APs */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {apModalRouter.accessPoints && apModalRouter.accessPoints.length > 0 ? (
                apModalRouter.accessPoints.map((ap) => (
                  <div
                    key={ap.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{ap.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                          {ap.brand}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5">Area: {ap.locationArea}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">{ap.connectedClients || 0} Clients</span>
                      <button
                        onClick={() => handleDeleteAccessPoint(apModalRouter.id, ap.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete AP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  No access points added yet for this router site.
                </div>
              )}
            </div>

            {/* Form to Add New AP */}
            <form onSubmit={handleAddAccessPoint} className="pt-3 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add New Access Point</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="AP Name (e.g. AP3 - 2nd Floor)"
                  value={newApForm.name}
                  onChange={(e) => setNewApForm({ ...newApForm, name: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-medium"
                />

                <input
                  type="text"
                  placeholder="Floor / Area (e.g. Dining Area)"
                  value={newApForm.locationArea}
                  onChange={(e) => setNewApForm({ ...newApForm, locationArea: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newApForm.brand}
                  onChange={(e) => setNewApForm({ ...newApForm, brand: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="MikroTik cAP">MikroTik cAP</option>
                  <option value="Ubiquiti UniFi">Ubiquiti UniFi</option>
                  <option value="TP-Link Omada">TP-Link Omada</option>
                  <option value="Ruijie Reyee">Ruijie Reyee</option>
                  <option value="Aruba Instant On">Aruba Instant On</option>
                  <option value="Grandstream">Grandstream</option>
                  <option value="Generic AP">Generic AP / Repeater</option>
                </select>

                <input
                  type="text"
                  placeholder="AP IP or MAC (Optional)"
                  value={newApForm.ipAddress}
                  onChange={(e) => setNewApForm({ ...newApForm, ipAddress: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Access Point</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROUTER MODAL */}
      {editingRouter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Edit Router Site: {editingRouter.name}</h3>
              <button
                onClick={() => setEditingRouter(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRouter} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Site Name</label>
                  <input
                    type="text"
                    required
                    value={editingRouter.name}
                    onChange={(e) => setEditingRouter({ ...editingRouter, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Site Code</label>
                  <input
                    type="text"
                    value={editingRouter.siteCode}
                    onChange={(e) => setEditingRouter({ ...editingRouter, siteCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={editingRouter.location}
                  onChange={(e) => setEditingRouter({ ...editingRouter, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Host IP / DDNS</label>
                  <input
                    type="text"
                    required
                    value={editingRouter.host}
                    onChange={(e) => setEditingRouter({ ...editingRouter, host: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">API Port</label>
                  <input
                    type="number"
                    value={editingRouter.apiPort}
                    onChange={(e) => setEditingRouter({ ...editingRouter, apiPort: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRouter(null)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
