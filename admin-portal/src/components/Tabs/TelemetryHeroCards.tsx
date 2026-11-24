import React from 'react';
import { Zap, ShieldCheck, Coins, Timer, Globe } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* KPI 1: Cache Hit */}
      <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3 sm:p-5 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate">Tỷ lệ Cache Hit</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
              {d.cache_hit_rate_pct}%
            </span>
            <span className="inline-flex items-center text-[10px] sm:text-3xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              +{(d.exact_hits + d.semantic_hits).toLocaleString()}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[11px] sm:text-2xs text-slate-500 flex items-center gap-1 truncate">
          <span>Tiết kiệm</span>
          <strong className="text-slate-700 font-mono font-medium">{(d.tokens_saved / 1000).toFixed(1)}k tokens</strong>
        </p>
      </div>

      {/* KPI 2: BHYT Bảo toàn */}
      <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3 sm:p-5 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate">BHYT bảo toàn</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline gap-1">
            <span className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums truncate">
              {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500 font-sans">₫</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] sm:text-2xs text-slate-500 flex items-center gap-1 truncate">
          <span>Đã kiểm</span>
          <strong className="text-slate-700 font-mono font-medium">{d.bhyt_audited.toLocaleString()} ca</strong>
        </p>
      </div>

      {/* KPI 3: Token tiêu thụ & chi phí */}
      <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3 sm:p-5 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate">Tokens phục vụ</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
              {(d.tokens_consumed / 1000).toFixed(1)}k
            </span>
            <span className="text-xs font-medium text-slate-400 font-mono">tokens</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] sm:text-2xs text-slate-500 flex items-center gap-1 truncate">
          <span>Tiết kiệm</span>
          <strong className="text-slate-700 font-mono font-medium">{Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} ₫</strong>
        </p>
      </div>

      {/* KPI 4: Độ trễ P95 (SLA) */}
      <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3 sm:p-5 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate">Độ trễ P95 (SLA)</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
              {d.p95_latency_ms}
            </span>
            <span className="text-xs font-medium text-slate-400 font-mono">ms</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] sm:text-2xs text-slate-500 flex items-center gap-1 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
          <span className="text-emerald-700 font-medium">SLA Chuẩn</span>
          <span className="text-slate-400">(&lt;500ms)</span>
        </p>
      </div>

      {/* Thanh Thông Tin Leo Thang Nguồn & Tìm Kiếm Web Fallback */}
      <div className="col-span-2 lg:col-span-4 bg-white border border-slate-200/90 rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
              <span>Tỷ lệ leo thang nguồn:</span>
              <span className="text-emerald-700 font-mono font-bold">
                {d.internal_pharmacopoeia_ratio_pct ?? 100}% Dược Thư (0₫)
              </span>
              <span className="text-slate-400">vs</span>
              <span className="text-indigo-700 font-mono font-bold">
                {d.web_fallback_ratio_pct ?? 0}% Web Fallback
              </span>
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              Ưu tiên tra cứu Dược thư Quốc gia Việt Nam V nội viện; tự động tìm kiếm Serper khi thuốc chưa lập chuyên khảo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-2xs font-mono border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Lượt search hôm nay:</span>
            <span className="px-1.5 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {d.web_search_queries_today || 0} queries
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Độ trễ TB:</span>
            <span className="text-slate-700 font-bold" title="Độ trễ trung bình của Serper API">
              T<sub className="font-sans">serper</sub> {d.avg_serper_latency_ms || 0}ms
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-700 font-bold" title="Độ trễ trung bình của LLM Gemini">
              T<sub className="font-sans">llm</sub> {d.avg_llm_latency_ms || 0}ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
