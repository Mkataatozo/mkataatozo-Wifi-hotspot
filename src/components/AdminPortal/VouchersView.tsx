import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { Voucher, TimePackage } from '../../types.js';

export const VouchersView: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [packages, setPackages] = useState<TimePackage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used' | 'disabled'>('all');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Batch generate form state
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchVouchers = async () => {
    try {
      const [vchRes, pkgRes] = await Promise.all([
        fetch('/api/admin/vouchers'),
        fetch('/api/admin/packages'),
      ]);
      const vchData = await vchRes.json();
      const pkgData = await pkgRes.json();
      setVouchers(vchData);
      setPackages(pkgData);
      if (pkgData.length > 0 && !selectedPackageId) {
        setSelectedPackageId(pkgData[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/vouchers/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackageId,
          quantity: batchQuantity,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsGenerateModalOpen(false);
        fetchVouchers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleVoucher = async (id: string) => {
    try {
      await fetch(`/api/admin/vouchers/${id}/disable`, { method: 'PUT' });
      fetchVouchers();
    } catch (err) {
      console.error(err);
    }
  };

  const copyVoucherCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Voucher Summary Metrics (Calculated dynamically from DB)
  const totalCount = vouchers.length;
  const totalValue = vouchers.reduce((acc, v) => acc + v.priceTzs, 0);
  const usedCount = vouchers.filter((v) => v.status === 'used').length;
  const usedValue = vouchers.filter((v) => v.status === 'used').reduce((acc, v) => acc + v.priceTzs, 0);
  const availableCount = vouchers.filter((v) => v.status === 'available').length;
  const availableValue = vouchers.filter((v) => v.status === 'available').reduce((acc, v) => acc + v.priceTzs, 0);

  const filteredVouchers = vouchers.filter((v) => {
    const matchesSearch =
      v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.usedByPhone && v.usedByPhone.includes(searchQuery));
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" id="vouchers-manager-view">
      {/* Voucher Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 block">Total Created</span>
          <span className="text-xl font-black text-slate-900">{totalCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 block">Total Value</span>
          <span className="text-sm font-extrabold text-slate-900">TZS {totalValue.toLocaleString()}</span>
        </div>
        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
          <span className="text-[11px] font-bold text-emerald-700 block">Available</span>
          <span className="text-xl font-black text-emerald-900">{availableCount}</span>
        </div>
        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
          <span className="text-[11px] font-bold text-emerald-700 block">Available Value</span>
          <span className="text-sm font-extrabold text-emerald-900">TZS {availableValue.toLocaleString()}</span>
        </div>
        <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 block">Used</span>
          <span className="text-xl font-black text-slate-800">{usedCount}</span>
        </div>
        <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 block">Used Value</span>
          <span className="text-sm font-extrabold text-slate-800">TZS {usedValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, package, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', 'available', 'used', 'disabled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/admin/reports/csv?type=vouchers"
            download
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV Export</span>
          </a>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print Cards</span>
          </button>

          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            id="btn-generate-vouchers"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Vouchers</span>
          </button>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">Voucher Code</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Used Details</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVouchers.map((vch) => (
                <tr key={vch.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-slate-900 text-sm tracking-wider">
                        {vch.code}
                      </span>
                      <button
                        onClick={() => copyVoucherCode(vch.code, vch.id)}
                        className="text-slate-400 hover:text-slate-700 p-1"
                        title="Copy Code"
                      >
                        {copiedId === vch.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{vch.packageName}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">TZS {vch.priceTzs.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-600">{vch.durationMinutes} mins</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        vch.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : vch.status === 'used'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {vch.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {new Date(vch.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-[11px]">
                    {vch.usedAt ? (
                      <div>
                        <span className="block font-medium">Used: {new Date(vch.usedAt).toLocaleTimeString()}</span>
                        <span className="font-mono text-[10px] text-slate-400">{vch.usedByPhone || vch.usedByMac || 'Cash Customer'}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {vch.status !== 'used' && (
                      <button
                        onClick={() => handleToggleVoucher(vch.id)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                          vch.status === 'available'
                            ? 'text-rose-700 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {vch.status === 'available' ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Generator Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Generate Cash Vouchers Batch</h3>
            <form onSubmit={handleGenerateBatch} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Time Package</label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — TZS {pkg.priceTzs.toLocaleString()} ({pkg.durationValue} {pkg.durationUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity of Vouchers</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">Generates unique, collision-free codes (e.g. TZ-941-8X2A).</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isGenerating ? 'Generating...' : `Generate ${batchQuantity} Vouchers`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Vouchers Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Printable Cash Voucher Slips</h3>
                <p className="text-xs text-slate-500">Available vouchers ready to hand to cash customers</p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {vouchers
                .filter((v) => v.status === 'available')
                .slice(0, 18)
                .map((v) => (
                  <div key={v.id} className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 text-center space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">HOTSPOT TZ WI-FI</div>
                    <div className="text-xs font-bold text-slate-900">{v.packageName}</div>
                    <div className="text-sm font-mono font-black text-slate-950 py-1 bg-white rounded border border-slate-200 tracking-wider">
                      {v.code}
                    </div>
                    <div className="text-[10px] font-bold text-slate-600">Price: TZS {v.priceTzs.toLocaleString()}</div>
                    <div className="text-[9px] text-slate-400">Connect to Wi-Fi & Enter code</div>
                  </div>
                ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slips</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
