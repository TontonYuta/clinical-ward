import React from 'react';
import { Zap, ShieldCheck, CircleDollarSign, Clock, Database, TrendingUp } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-4">
      {/* KPI 1: Cache Hit */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tỷ lệ Cache Hit</span>
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
          {d.cache_hit_rate_pct}%
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between gap-1 pt-0.5 border-t border-slate-100">
          <span>Phục vụ tức thì 0ms</span>
          <span className="text-2xs font-mono text-slate-400">
            ({d.exact_hits} exact · {d.semantic_hits} vector)
          </span>
        </div>
      </div>

      {/* KPI 2: BHYT Bảo toàn */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">BHYT bảo toàn</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CircleDollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-emerald-700 tracking-tight font-mono tabular-nums whitespace-nowrap">
          {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')} <span className="text-base font-bold text-emerald-600">₫</span>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between gap-1 pt-0.5 border-t border-slate-100">
          <span>Thẩm định BHYT</span>
          <span className="text-2xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
            {d.bhyt_audited} ca đạt chuẩn
          </span>
        </div>
      </div>

      {/* KPI 3: Token tiêu thụ & tiết kiệm */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Token tiết kiệm</span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
          {(d.tokens_consumed / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400 font-sans">tokens phục vụ</span>
        </div>
        <div className="text-xs text-teal-700 font-medium flex items-center justify-between gap-1 pt-0.5 border-t border-slate-100">
          <span className="truncate">Tiết kiệm ngân sách</span>
          <span className="text-2xs font-mono font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded whitespace-nowrap">
            {Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} ₫
          </span>
        </div>
      </div>

      {/* KPI 4: Độ trễ P95 & An toàn Dược */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Độ trễ P95</span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
          {d.p95_latency_ms} <span className="text-xs font-normal text-slate-400 font-sans">ms</span>
        </div>
        <div className="text-xs text-slate-600 font-medium flex items-center justify-between gap-1 pt-0.5 border-t border-slate-100">
          <span className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            Kiểm soát lâm sàng
          </span>
          <span className="text-2xs font-mono font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
            Chặn {d.ddi_blocks_count} DDI
          </span>
        </div>
      </div>
    </div>
  );
};
