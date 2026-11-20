import React from 'react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* KPI 1: Cache Hit */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Tỷ lệ Cache Hit</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {d.cache_hit_rate_pct}%
        </div>
      </div>

      {/* KPI 2: BHYT Bảo toàn */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">BHYT bảo toàn</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400 font-sans">₫</span>
        </div>
      </div>

      {/* KPI 3: Token tiêu thụ & tiết kiệm */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Tokens phục vụ</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {(d.tokens_consumed / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400 font-sans">tokens</span>
        </div>
      </div>

      {/* KPI 4: Độ trễ P95 & An toàn Dược */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Độ trễ P95</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {d.p95_latency_ms} <span className="text-xs font-normal text-slate-400 font-sans">ms</span>
        </div>
      </div>
    </div>
  );
};
