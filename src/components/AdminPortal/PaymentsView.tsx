import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Download,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Smartphone,
  Banknote,
  RefreshCw,
} from 'lucide-react';
import { PaymentTransaction } from '../../types.js';

export const PaymentsView: React.FC = () => {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phoneNumber && p.phoneNumber.includes(searchQuery)) ||
      p.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.gatewayReference && p.gatewayReference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || p.paymentMethod === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  return (
    <div className="space-y-6" id="payments-manager-view">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference, phone, package..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Methods</option>
            <option value="mobile_gateway">Lipa Kwa Simu (Gateway)</option>
            <option value="cash_voucher">Lipa Cash (Voucher)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/admin/reports/csv?type=payments"
            download
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={fetchPayments}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">Tx ID / Ref</th>
                <th className="py-3 px-4">Customer Phone</th>
                <th className="py-3 px-4">Amount (TZS)</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Method & Gateway</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Idempotency Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-900 block">{tx.id}</span>
                    {tx.gatewayReference && (
                      <span className="text-[10px] text-slate-400 font-mono">Ref: {tx.gatewayReference}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-800">
                    {tx.phoneNumber || <span className="text-slate-400">Cash Customer</span>}
                  </td>
                  <td className="py-3 px-4 font-black text-slate-900 text-sm">
                    TZS {tx.amountTzs.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{tx.packageName}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {tx.paymentMethod === 'mobile_gateway' ? (
                        <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                          <Smartphone className="w-3 h-3" />
                          <span>{tx.gatewayProvider || 'Gateway'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                          <Banknote className="w-3 h-3" />
                          <span>Cash Voucher</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tx.status === 'successful'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tx.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tx.status === 'successful' && <CheckCircle className="w-3 h-3" />}
                      {tx.status === 'pending' && <Clock className="w-3 h-3" />}
                      {tx.status === 'failed' && <XCircle className="w-3 h-3" />}
                      <span>{tx.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                    {tx.idempotencyKey}
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
