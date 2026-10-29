import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Package, Clock } from 'lucide-react';

interface MetricsCardsProps {
  total: number;
  processed: number;
  success: number;
  review: number;
  failed: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  total,
  processed,
  success,
  review,
  failed,
}) => {
  const pending = Math.max(0, total - processed);
  const successPct = processed > 0 ? Math.round((success / processed) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Products</span>
          <Package className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">catalog items</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {processed} processed ({total > 0 ? Math.round((processed / total) * 100) : 0}%)
        </div>
      </div>

      {/* Verified SUCCESS */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm hover:shadow transition bg-emerald-50/20">
        <div className="flex items-center justify-between text-emerald-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Verified (SUCCESS)</span>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold text-emerald-900">{success}</span>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
            {successPct}%
          </span>
        </div>
        <div className="mt-2 text-xs text-emerald-600">
          All key fields extracted & validated
        </div>
      </div>

      {/* Review Required */}
      <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm hover:shadow transition bg-amber-50/20">
        <div className="flex items-center justify-between text-amber-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Review Required</span>
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold text-amber-900">{review}</span>
          <span className="text-xs text-amber-600">needs check</span>
        </div>
        <div className="mt-2 text-xs text-amber-600">
          Partial match or missing optional field
        </div>
      </div>

      {/* Failed */}
      <div className="bg-white rounded-xl border border-rose-200 p-4 shadow-sm hover:shadow transition bg-rose-50/20">
        <div className="flex items-center justify-between text-rose-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Failed</span>
          <XCircle className="w-5 h-5 text-rose-600" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold text-rose-900">{failed}</span>
          <span className="text-xs text-rose-600">unverified</span>
        </div>
        <div className="mt-2 text-xs text-rose-600">
          Search link provided in audit
        </div>
      </div>

      {/* Pending Queue */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Queue Remaining</span>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold text-slate-900">{pending}</span>
          <span className="text-xs text-slate-500">pending</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {pending === 0 && total > 0 ? 'Queue complete' : 'Waiting in batch'}
        </div>
      </div>
    </div>
  );
};

