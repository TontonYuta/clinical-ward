import React, { useState } from 'react';
import { Zap, Activity, Coins } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Sub-view switcher */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubView('live')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            subView === 'live'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Vận hành &amp; Nhật ký</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('budget')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            subView === 'budget'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Hạn mức ngân sách Token</span>
        </button>
      </div>

      {subView === 'live' ? (
        <>
          {/* 4 Thẻ Hero KPIs */}
          <TelemetryHeroCards data={d} />

          {/* Biểu đồ Xu Hướng 7 Ngày & Phân Bổ Ý Định Lâm Sàng */}
          <TelemetryCharts data={d} />

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
