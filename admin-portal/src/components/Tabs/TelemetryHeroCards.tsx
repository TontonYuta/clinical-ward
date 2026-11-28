import React from 'react';
import { Zap, ShieldCheck, Coins, Timer, Globe } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryHeroCardsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryHeroCards: React.FC<TelemetryHeroCardsProps> = ({ data: d }) => {
  const totalQueries = Number(d.total_queries || 0);
  const hasTraffic = totalQueries > 0 || Number(d.p95_latency_ms || 0) > 0;
  const p95 = Number(d.p95_latency_ms || 0);
  const internalRatio = Math.min(100, Math.max(0, Number(d.internal_pharmacopoeia_ratio_pct ?? 100)));
  const webRatio = Math.min(100, Math.max(0, Number(d.web_fallback_ratio_pct ?? 0)));

  const slaMeta = !hasTraffic
    ? { dot: 'bg-slate-300', text: 'text-slate-500', label: 'Chưa có lưu lượng', hint: '' }
    : p95 <= 500
    ? { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Đạt chuẩn SLA', hint: '(<500ms)' }
    : p95 <= 1500
    ? { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Độ trễ trung bình', hint: '(≤1.5s)' }
    : { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Vượt ngưỡng SLA', hint: '(>1.5s)' };

  return (
    <section aria-label="Chỉ số vận hành tổng quan" className="space-y-4">
      {/* 4 Separate Airy Full-Width KPI Cards (matching Clinical Ward Main App) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Cache Hit */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[144px] hover:border-teal-300 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Tỷ lệ Cache Hit
            </span>
            <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums leading-none">
              {hasTraffic ? `${d.cache_hit_rate_pct}%` : '—'}
            </span>
            {hasTraffic && (d.exact_hits + d.semantic_hits) > 0 && (
              <span className="inline-flex items-center text-2xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                +{(d.exact_hits + d.semantic_hits).toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 truncate">
            Tiết kiệm{' '}
            <strong className="text-slate-800 font-mono font-semibold tabular-nums">
              {(Number(d.tokens_saved || 0) / 1000).toFixed(1)}k
            </strong>{' '}
            tokens
          </p>
        </div>

        {/* KPI 2: BHYT Bảo toàn */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[144px] hover:border-teal-300 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              BHYT bảo toàn
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1 min-w-0">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums leading-none truncate">
              {Number(d.bhyt_rejection_saved_vnd || 0).toLocaleString('vi-VN')}
            </span>
            <span className="text-sm font-semibold text-slate-500 shrink-0">₫</span>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 truncate">
            Đã giám định{' '}
            <strong className="text-slate-800 font-mono font-semibold tabular-nums">
              {Number(d.bhyt_audited || 0).toLocaleString('vi-VN')}
            </strong>{' '}
            ca
          </p>
        </div>

        {/* KPI 3: Tokens phục vụ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[144px] hover:border-teal-300 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Tokens phục vụ
            </span>
            <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums leading-none">
              {(Number(d.tokens_consumed || 0) / 1000).toFixed(1)}k
            </span>
            <span className="text-xs font-medium text-slate-500 font-mono">tokens</span>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 truncate">
            Chi phí tiết kiệm{' '}
            <strong className="text-slate-800 font-mono font-semibold tabular-nums">
              {Number(d.cost_saved_vnd || 0).toLocaleString('vi-VN')} ₫
            </strong>
          </p>
        </div>

        {/* KPI 4: Độ trễ P95 (SLA) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[144px] hover:border-teal-300 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Độ trễ P95 (SLA)
            </span>
            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Timer className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight tabular-nums leading-none">
              {hasTraffic ? p95.toLocaleString('vi-VN') : '—'}
            </span>
            {hasTraffic && <span className="text-xs font-medium text-slate-500 font-mono">ms</span>}
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center gap-1.5 truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${slaMeta.dot}`} />
            <span className={`font-medium ${slaMeta.text}`}>{slaMeta.label}</span>
            {slaMeta.hint && <span className="text-slate-400 font-mono">{slaMeta.hint}</span>}
          </p>
        </div>
      </div>

      {/* Full-Width Source Escalation Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs px-5 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0 flex-wrap">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 shrink-0">
            <Globe className="w-4 h-4 text-teal-700" />
            Phân bổ nguồn tra cứu
          </span>

          {/* Proportion bar */}
          <div
            className="hidden sm:flex w-36 h-2 rounded-full bg-slate-100 overflow-hidden shrink-0"
            title={`Nội viện ${internalRatio}% · Web ngoài ${webRatio}%`}
          >
            <div className="bg-teal-600 h-full" style={{ width: `${internalRatio}%` }} />
            <div className="bg-sky-500 h-full" style={{ width: `${webRatio}%` }} />
          </div>

          <div className="flex items-center gap-2.5 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 text-teal-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              {internalRatio}% Dược thư Quốc gia
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              {webRatio}% Tra cứu Web
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5 text-xs font-mono text-slate-600 shrink-0 flex-wrap">
          <span>
            Web hôm nay:{' '}
            <strong className="text-slate-900 tabular-nums">{d.web_search_queries_today || 0}</strong> lượt
          </span>
          <span className="text-slate-300">|</span>
          <span title="Độ trễ trung bình tìm kiếm Web">
            Web <strong className="text-slate-800 tabular-nums">{d.avg_serper_latency_ms || 0}ms</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span title="Độ trễ trung bình tổng hợp AI">
            AI <strong className="text-slate-800 tabular-nums">{d.avg_llm_latency_ms || 0}ms</strong>
          </span>
        </div>
      </div>
    </section>
  );
};
