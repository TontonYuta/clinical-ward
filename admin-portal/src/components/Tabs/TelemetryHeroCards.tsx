import React from 'react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* KPI 1: Cache Hit */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Tỷ lệ Cache Hit</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {d.cache_hit_rate_pct}%
          </div>
        </div>
        <span className="text-2xs font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium">
          {d.exact_hits + d.semantic_hits} hits
        </span>
      </div>

      {/* KPI 2: BHYT Bảo toàn */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">BHYT bảo toàn</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tabular-nums whitespace-nowrap">
            {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')} <span className="text-xs font-normal text-emerald-600 font-sans">₫</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-medium">
          {d.bhyt_audited} ca đạt
        </span>
      </div>

      {/* KPI 3: Token tiêu thụ & tiết kiệm */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Tokens phục vụ</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {(d.tokens_consumed / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400 font-sans">tokens</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium truncate max-w-[110px]" title={`+${Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} ₫`}>
          +{Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} ₫
        </span>
      </div>

      {/* KPI 4: Độ trễ P95 & An toàn Dược */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Độ trễ P95</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {d.p95_latency_ms} <span className="text-xs font-normal text-slate-400 font-sans">ms</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-medium">
          Chặn {d.ddi_blocks_count} DDI
        </span>
      </div>
    </div>
  );
};
