import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Wifi,
  Clock,
  Phone,
  Power,
  RefreshCw,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Customer } from '../../types.js';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDisconnect = async (customerId: string) => {
    if (confirm('Disconnect this customer session from MikroTik?')) {
      setDisconnectingId(customerId);
      try {
        await fetch(`/api/admin/customers/${customerId}/disconnect`, { method: 'POST' });
        fetchCustomers();
      } catch (err) {
        console.error(err);
      } finally {
        setDisconnectingId(null);
      }
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.macAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phoneNumber && c.phoneNumber.includes(searchQuery)) ||
      (c.ipAddress && c.ipAddress.includes(searchQuery)) ||
      (c.currentPackageName && c.currentPackageName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6" id="customers-manager-view">
      {/* Top filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search MAC, phone, IP, package..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900 focus:bg-white"
          />
        </div>

        <button
          onClick={fetchCustomers}
          disabled={isLoading}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Customers</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">Device & MAC</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Current IP</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active Plan</th>
                <th className="py-3 px-4">Session Expiry</th>
                <th className="py-3 px-4">Total Spent</th>
                <th className="py-3 px-4 text-right">MikroTik Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                        <Wifi className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">{cust.macAddress}</span>
                        <span className="text-[10px] text-slate-400">Total sessions: {cust.totalSessions}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                    {cust.phoneNumber || <span className="text-slate-400">Cash Customer</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{cust.ipAddress || '—'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        cust.status === 'online'
                          ? 'bg-emerald-100 text-emerald-800'
                          : cust.status === 'active'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          cust.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      {cust.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {cust.currentPackageName || <span className="text-slate-400 font-normal">None</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {cust.sessionExpiry ? (
                      new Date(cust.sessionExpiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-950">
                    TZS {cust.totalSpentTzs.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {cust.status === 'online' ? (
                      <button
                        onClick={() => handleDisconnect(cust.id)}
                        disabled={disconnectingId === cust.id}
                        className="px-2.5 py-1 text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                      >
                        <Power className="w-3 h-3" />
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
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
