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
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Zap className="w-6 h-6 animate-spin text-teal-600" />
        <span className="text-sm">Đang tổng hợp dữ liệu Telemetry thời gian thực...</span>
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
