import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { TelemetryOverviewResponse, TelemetryEventItem } from '../../types/admin';
import { TelemetryHeroCards } from './TelemetryHeroCards';
import { TelemetryCharts } from './TelemetryCharts';
import { TelemetryLiveStreamTable } from './TelemetryLiveStreamTable';
import { QueryDetailDrawer } from '../Drawers/QueryDetailDrawer';

interface TelemetryTabProps {
  data: TelemetryOverviewResponse | null;
  loading: boolean;
}

export const TelemetryTab: React.FC<TelemetryTabProps> = ({ data, loading }) => {
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 bg-white rounded-2xl border border-slate-200/90 lg:col-span-2 p-5 space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-48 bg-slate-100 rounded" />
          </div>
          <div className="h-72 bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-44 bg-slate-100 rounded-full mx-auto w-44" />
          </div>
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
    <div className="space-y-6 lg:space-y-8">
      {/* 4 Thẻ Hero KPIs */}
      <TelemetryHeroCards data={d} />

      {/* Biểu đồ Xu Hướng 7 Ngày & Phân Bổ Ý Định Lâm Sàng */}
      <TelemetryCharts data={d} />

      {/* Bảng Nhật Ký Telemetry Live Stream kèm Bộ Lọc */}
      <TelemetryLiveStreamTable
        events={d.recent_events || []}
        onSelectEvent={setSelectedEvent}
      />

      {/* Drawer Thanh Tra Chi Tiết Truy Vấn (Query Inspector Drawer) */}
      <QueryDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};
