import React from 'react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryChartsProps {
  data: TelemetryOverviewResponse;
}

const INTENT_LABEL_MAP: Record<string, string> = {
  CLINICAL_CASE_CLARIFICATION: 'Hội chẩn & Phân tích ca bệnh',
  CLINICAL_AI_CONSULTATION: 'Tư vấn phác đồ dược lâm sàng',
  MEDICATION_LOOKUP_CLARIFICATION: 'Tra cứu Dược thư Quốc gia (ĐDVN V)',
  DDI_INTERACTION_CHECK: 'Thẩm định tương tác thuốc (DDI)',
  BHYT_REGULATION_QUERY: 'Kiểm tra chỉ định & Xuất toán BHYT',
  DOSAGE_CALCULATION: 'Hiệu chỉnh liều theo chức năng thận',
  ADVERSE_DRUG_REACTION: 'Cảnh báo phản ứng có hại (ADR)',
  GENERAL_MEDICAL_QUERY: 'Tra cứu thông tin y khoa tổng quát',
};

function formatIntentLabel(raw: string): string {
  if (INTENT_LABEL_MAP[raw]) return INTENT_LABEL_MAP[raw];
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ data: d }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Biểu đồ Cột: Chiếm 7/12 cột */}
      <div className="lg:col-span-7 p-3 sm:px-4 sm:py-3.5 bg-white rounded-lg border border-slate-200/90 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Xu hướng Token (7 ngày qua)</h2>
            <p className="text-xs text-slate-500 mt-0.5">So sánh Token tiêu thụ API và Token tiết kiệm qua Cache &amp; RAG</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-600"></span> Tiết kiệm
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-300"></span> Tiêu thụ
            </span>
          </div>
        </div>

        {/* Khung biểu đồ với lưới ngang (Grid lines) */}
        <div className="relative pt-6 pb-2">
          {/* Đường lưới định mức (Reference grid) */}
          <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none opacity-40">
            <div className="border-b border-dashed border-slate-200 w-full flex justify-end pr-1">
              <span className="text-3xs font-mono text-slate-400 -mt-2.5">30k</span>
            </div>
            <div className="border-b border-dashed border-slate-200 w-full flex justify-end pr-1">
              <span className="text-3xs font-mono text-slate-400 -mt-2.5">20k</span>
            </div>
            <div className="border-b border-dashed border-slate-200 w-full flex justify-end pr-1">
              <span className="text-3xs font-mono text-slate-400 -mt-2.5">10k</span>
            </div>
            <div className="border-b border-slate-200 w-full flex justify-end pr-1">
              <span className="text-3xs font-mono text-slate-400 -mt-2.5">0k</span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 sm:gap-3 px-2 sm:px-4 relative z-10">
            {d.timeline_trend.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Chưa ghi nhận giao dịch Token nào trong 7 ngày qua
              </div>
            ) : (
              d.timeline_trend.map((t, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-36">
                    {/* Cột Tiết Kiệm (Teal) */}
                    <div
                      style={{ height: `${Math.min(100, Math.max(t.saved_k > 0 ? 8 : 2, (t.saved_k / 30) * 100))}%` }}
                      className="w-3.5 sm:w-4.5 bg-teal-600 group-hover:bg-teal-700 rounded-t-[3px] transition-all cursor-pointer shadow-2xs"
                      title={`Tiết kiệm: ${t.saved_k}k tokens (${t.date})`}
                    />
                    {/* Cột Tiêu Thụ (Slate) */}
                    <div
                      style={{ height: `${Math.min(100, Math.max(t.consumed_k > 0 ? 8 : 2, (t.consumed_k / 30) * 100))}%` }}
                      className="w-3.5 sm:w-4.5 bg-slate-300 group-hover:bg-slate-400 rounded-t-[3px] transition-all cursor-pointer"
                      title={`Tiêu thụ: ${t.consumed_k}k tokens (${t.date})`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{t.day}</span>
                  <span className="text-3xs text-slate-400 font-mono hidden sm:inline">{t.date}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Thanh Phân Bổ Nghiệp Vụ Lâm Sàng: Chiếm 5/12 cột */}
      <div className="lg:col-span-5 p-3 sm:px-4 sm:py-3.5 bg-white rounded-lg border border-slate-200/90 space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Phân bổ nghiệp vụ lâm sàng</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tần suất các chủ đề tra cứu y khoa thực tế</p>
        </div>

        <div className="space-y-3.5 pt-1">
          {d.intent_distribution.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Chưa có dữ liệu hội thoại nào được ghi nhận
            </div>
          ) : (
            d.intent_distribution.map((it, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-800 truncate pr-2" title={it.intent}>
                    {formatIntentLabel(it.intent)}
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {it.pct}% <span className="text-slate-400 font-normal">({it.count})</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${Math.max(3, it.pct)}%`, backgroundColor: it.color || '#0d9488' }}
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
