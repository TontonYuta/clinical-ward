import React from 'react';
import { Zap, ShieldCheck, CircleDollarSign, Clock, Database } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-4">
      {/* KPI 1 */}
      <div className="p-4 lg:p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Tỷ lệ Cache Hit</span>
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
            <Zap className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
          {d.cache_hit_rate_pct}%
        </div>
        <div className="text-xs text-slate-600 font-medium flex items-center justify-between pt-0.5 flex-wrap gap-1">
          <span>Cache hit: {d.cache_hit_rate_pct}%</span>
          <span className="text-2xs text-slate-400 font-mono">
            (Exact: {d.exact_hits} · Vector: {d.semantic_hits})
          </span>
        </div>
      </div>

      {/* KPI 2 */}
      <div className="p-4 lg:p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">BHYT bảo toàn</span>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <CircleDollarSign className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
          {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')} đ
        </div>
        <div className="text-xs text-slate-500 font-medium pt-0.5">
          {d.bhyt_audited} ca kê đơn &amp; thẩm định BHYT
        </div>
      </div>

      {/* KPI 3 */}
      <div className="p-4 lg:p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Token tiết kiệm</span>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <Database className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
          {(d.tokens_consumed / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">tokens nhà cung cấp báo</span>
        </div>
        <div className="text-xs text-blue-700 font-medium pt-0.5">
          {Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} đ tiết kiệm đã xác nhận
        </div>
      </div>

      {/* KPI 4 */}
      <div className="p-4 lg:p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Độ trễ P95</span>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
            <Clock className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
          {d.p95_latency_ms} <span className="text-xs font-normal text-slate-400">ms</span>
        </div>
        <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          <span>Chặn {d.ddi_blocks_count} ca DDI · {d.guardrail_blocks_count} cảnh báo</span>
        </div>
      </div>
    </div>
  );
};
