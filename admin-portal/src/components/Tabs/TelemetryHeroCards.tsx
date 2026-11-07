import React from 'react';
import { Zap, ShieldCheck, CircleDollarSign, Clock, Database, ArrowUpRight } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {/* KPI 1 */}
      <div className="p-5 lg:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs lg:text-sm font-bold uppercase tracking-wider">Tỷ Lệ Cache Hit</span>
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
            <Zap className="w-5 h-5" />
          </div>
        </div>
        <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
          {d.cache_hit_rate_pct}%
        </div>
        <div className="text-xs lg:text-sm text-emerald-700 font-medium flex items-center gap-1.5 pt-1">
          <ArrowUpRight className="w-4 h-4 shrink-0" />
          <span>Tiết kiệm ~{((d.tokens_saved / (d.tokens_consumed + d.tokens_saved || 1)) * 100).toFixed(0)}% chi phí API</span>
        </div>
      </div>

      {/* KPI 2 */}
      <div className="p-5 lg:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs lg:text-sm font-bold uppercase tracking-wider">Tiền BHYT Cứu Được</span>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <CircleDollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="text-3xl lg:text-4xl font-extrabold text-emerald-700 tracking-tight font-mono">
          {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')} đ
        </div>
        <div className="text-xs lg:text-sm text-slate-500 font-medium pt-1">
          Từ {d.bhyt_audited} ca thẩm định CPOE & thay thế thuốc
        </div>
      </div>

      {/* KPI 3 */}
      <div className="p-5 lg:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs lg:text-sm font-bold uppercase tracking-wider">Token Đã Tiết Kiệm</span>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
            <Database className="w-5 h-5" />
          </div>
        </div>
        <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
          {(d.tokens_saved / 1000).toFixed(1)}k <span className="text-sm font-normal text-slate-400">tokens</span>
        </div>
        <div className="text-xs lg:text-sm text-blue-700 font-medium pt-1">
          ~{Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} đ quy đổi API Google
        </div>
      </div>

      {/* KPI 4 */}
      <div className="p-5 lg:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs lg:text-sm font-bold uppercase tracking-wider">Độ Trễ P95 & An Toàn</span>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
          {d.p95_latency_ms} <span className="text-sm font-normal text-slate-400">ms</span>
        </div>
        <div className="text-xs lg:text-sm text-slate-600 font-medium flex items-center gap-1.5 pt-1">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Chặn {d.ddi_blocks_count} ca DDI & {d.guardrail_blocks_count} vi phạm</span>
        </div>
      </div>
    </div>
  );
};
