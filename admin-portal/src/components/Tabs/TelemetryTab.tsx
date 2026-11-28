import React, { useState } from 'react';
import { Zap, Activity, Coins, Sparkles } from 'lucide-react';
import { TelemetryOverviewResponse, TelemetryEventItem, BudgetCapResponse } from '../../types/admin';
import { TelemetryHeroCards } from './TelemetryHeroCards';
import { TelemetryCharts } from './TelemetryCharts';
import { TelemetryLiveStreamTable } from './TelemetryLiveStreamTable';
import { BudgetCapTab } from './BudgetCapTab';
import { QueryDetailDrawer } from '../Drawers/QueryDetailDrawer';

interface TelemetryTabProps {
  data: TelemetryOverviewResponse | null;
  loading: boolean;
  budget?: BudgetCapResponse | null;
  onRefreshBudget?: () => void;
}

export const TelemetryTab: React.FC<TelemetryTabProps> = ({
  data,
  loading,
  budget = null,
  onRefreshBudget = () => {},
}) => {
  const [subView, setSubView] = useState<'live' | 'budget'>('live');
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEventItem | null>(null);

  if (loading && !data) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-pulse">
        <div className="flex items-center gap-2 p-3 bg-teal-50/80 border border-teal-200 rounded-xl text-teal-800 text-xs sm:text-sm">
          <Zap className="w-4 h-4 animate-spin text-teal-600 shrink-0" />
          <span>Đang đồng bộ dữ liệu Telemetry thời gian thực từ máy chủ API...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const d = data || {
    total_queries: 0,
    cache_hit_rate_pct: 0.0,
    exact_hits: 0,
    semantic_hits: 0,
    tokens_consumed: 0,
    tokens_saved: 0,
    cost_saved_vnd: 0,
    p95_latency_ms: 0.0,
    bhyt_audited: 0,
    bhyt_rejection_saved_vnd: 0,
    ddi_blocks_count: 0,
    guardrail_blocks_count: 0,
    recent_events: [],
    intent_distribution: [],
    timeline_trend: []
  };

  return (
    <div className="space-y-6">
      {/* Sub-view switcher (Teal underline standard, scrollable on mobile) */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSubView('live')}
          className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
            subView === 'live'
              ? 'border-teal-700 text-teal-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Vận hành &amp; Nhật ký</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('budget')}
          className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
            subView === 'budget'
              ? 'border-teal-700 text-teal-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Hạn mức ngân sách Token</span>
        </button>
      </div>

      {subView === 'live' ? (
        <>
          {/* 4 Thẻ Hero KPIs */}
          <TelemetryHeroCards data={d} />

          {/* Biểu đồ Xu Hướng 7 Ngày & Phân Bổ Ý Định Lâm Sàng */}
          <TelemetryCharts data={d} />

          {/* Khuyến nghị bổ sung Dược Thư từ Fallback Queries nếu có */}
          {d.top_unindexed_fallback_queries && d.top_unindexed_fallback_queries.length > 0 && (
            <div className="p-3 sm:px-4 sm:py-3.5 bg-white rounded-lg border border-indigo-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      Đề Xuất Mở Rộng Dược Thư Nội Viện (Từ Web Fallback)
                    </h3>
                    <p className="text-2xs text-slate-500">
                      Các hoạt chất/truy vấn lâm sàng chưa có trong Dược thư Quốc gia V nội viện đã kích hoạt tìm kiếm ngoài
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-2xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {d.top_unindexed_fallback_queries.length} câu hỏi cần nạp chuyên khảo
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-md overflow-hidden text-xs">
                {d.top_unindexed_fallback_queries.slice(0, 5).map((q, idx) => (
                  <div key={idx} className="p-2.5 flex items-start justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-medium text-slate-800 break-words flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                        <span>{q.query}</span>
                      </div>
                      <div className="text-2xs text-slate-500 pl-3">
                        {q.recommendation}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-bold bg-slate-100 text-slate-700 shrink-0" title="Tần suất truy vấn">
                      {q.count} lượt
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bảng Nhật Ký Telemetry Live Stream kèm Bộ Lọc */}
          <TelemetryLiveStreamTable
            events={d.recent_events || []}
            onSelectEvent={setSelectedEvent}
          />
        </>
      ) : (
        <BudgetCapTab budget={budget} onRefresh={onRefreshBudget} />
      )}

      {/* Drawer Thanh Tra Chi Tiết Truy Vấn (Query Inspector Drawer) */}
      <QueryDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};
