import React from 'react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryChartsProps {
  data: TelemetryOverviewResponse;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ data: d }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Biểu đồ Cột SVG: Chiếm 7/12 cột */}
      <div className="lg:col-span-7 p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base lg:text-lg font-bold text-slate-900">Xu Hướng Tiết Kiệm Token (7 Ngày Qua)</h2>
            <p className="text-xs lg:text-sm text-slate-500 mt-0.5">So sánh Token tiêu thụ thực tế vs Token tiết kiệm nhờ Cache & Adaptive RAG</p>
          </div>
          <div className="flex items-center gap-4 text-xs lg:text-sm font-medium">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-teal-600"></span> Tiết kiệm</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-slate-300"></span> Tiêu thụ</span>
          </div>
        </div>

        <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-slate-100 px-3">
          {d.timeline_trend.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
              Chưa ghi nhận giao dịch Token nào trong 7 ngày qua
            </div>
          ) : (
            d.timeline_trend.map((t, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1.5 h-40">
                  <div
                    style={{ height: `${Math.min(100, Math.max(t.saved_k > 0 ? 8 : 0, (t.saved_k / 30) * 100))}%` }}
                    className="w-5 bg-teal-600 hover:bg-teal-700 rounded-t-sm transition cursor-pointer"
                    title={`Tiết kiệm: ${t.saved_k}k tokens (${t.date})`}
                  />
                  <div
                    style={{ height: `${Math.min(100, Math.max(t.consumed_k > 0 ? 8 : 0, (t.consumed_k / 30) * 100))}%` }}
                    className="w-5 bg-slate-300 hover:bg-slate-400 rounded-t-sm transition cursor-pointer"
                    title={`Tiêu thụ: ${t.consumed_k}k tokens (${t.date})`}
                  />
                </div>
                <span className="text-xs lg:text-sm font-bold text-slate-600">{t.day}</span>
                <span className="text-3xs text-slate-400 font-mono hidden sm:inline">{t.date}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thanh Phân Bổ Ý Định Lâm Sàng: Chiếm 5/12 cột */}
      <div className="lg:col-span-5 p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base lg:text-lg font-bold text-slate-900">Phân Bổ Ý Định Lâm Sàng</h2>
          <p className="text-xs lg:text-sm text-slate-500 mt-0.5">Tần suất các chủ đề bác sĩ tra cứu thực tế</p>
        </div>

        <div className="space-y-4 pt-1">
          {d.intent_distribution.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Chưa có dữ liệu hội thoại nào được ghi nhận
            </div>
          ) : (
            d.intent_distribution.map((it, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs lg:text-sm">
                  <span className="font-semibold text-slate-800 truncate pr-2">{it.intent}</span>
                  <span className="font-mono font-bold text-slate-900">{it.pct}% ({it.count})</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${it.pct}%`, backgroundColor: it.color }}
                    className="h-full rounded-full transition-all"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
