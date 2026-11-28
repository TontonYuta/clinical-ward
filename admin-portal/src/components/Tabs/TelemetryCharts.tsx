import React, { useMemo } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface TelemetryChartsProps {
  data: TelemetryOverviewResponse;
}

const INTENT_LABEL_MAP: Record<string, string> = {
  CLINICAL_CASE_CLARIFICATION: 'Hội chẩn & Phân tích ca bệnh',
  CLINICAL_AI_CONSULTATION: 'Tư vấn phác đồ dược lâm sàng',
  MEDICATION_LOOKUP_CLARIFICATION: 'Tra cứu Dược thư Quốc gia',
  DDI_INTERACTION_CHECK: 'Thẩm định tương tác thuốc (DDI)',
  BHYT_REGULATION_QUERY: 'Kiểm tra chỉ định & Xuất toán BHYT',
  DOSAGE_CALCULATION: 'Hiệu chỉnh liều theo chức năng thận',
  ADVERSE_DRUG_REACTION: 'Cảnh báo phản ứng có hại (ADR)',
  GENERAL_MEDICAL_QUERY: 'Tra cứu thông tin y khoa tổng quát',
  GROUNDED_WEB_SEARCH: 'Tra cứu Y văn Web thời gian thực',
  SECURITY_GUARDRAIL_BLOCKED: 'Rào chắn bảo mật & An toàn',
};

function formatIntentLabel(raw: string): string {
  if (INTENT_LABEL_MAP[raw]) return INTENT_LABEL_MAP[raw];
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}

function computeNiceMax(rawMax: number): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 30;
  const steps = [3, 6, 12, 15, 30, 60, 90, 150, 300, 600, 1200, 3000];
  for (const s of steps) {
    if (rawMax <= s) return s;
  }
  return Math.ceil(rawMax / 300) * 300;
}

function formatTickK(val: number): string {
  if (val === 0) return '0';
  return Number.isInteger(val) ? `${val}k` : `${val.toFixed(1)}k`;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ data: d }) => {
  const { yMax, yTicks } = useMemo(() => {
    const peak = (d.timeline_trend || []).reduce(
      (acc, t) => Math.max(acc, Number(t.saved_k || 0), Number(t.consumed_k || 0)),
      0
    );
    const nice = computeNiceMax(peak);
    return {
      yMax: nice,
      yTicks: [nice, (nice * 2) / 3, nice / 3, 0],
    };
  }, [d.timeline_trend]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Biểu đồ Cột: Chiếm 7/12 cột */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[300px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Xu hướng Token (7 ngày qua)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              So sánh Token tiết kiệm qua Cache/RAG và Token tiêu thụ AI
            </p>
          </div>
          <div className="flex items-center gap-3.5 text-2xs font-medium text-slate-600 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-teal-600" />
              Tiết kiệm
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-slate-300" />
              Tiêu thụ
            </span>
          </div>
        </div>

        {/* Chart Area with dedicated Left Y-Axis Gutter (WCAG AA readable, dynamic scale) */}
        <div className="mt-5 flex items-stretch gap-2">
          {/* Left Y-axis labels */}
          <div className="w-9 flex flex-col justify-between text-right pb-7 text-3xs font-mono text-slate-500 tabular-nums select-none shrink-0">
            {yTicks.map((tick, idx) => (
              <span key={idx} className="leading-none">
                {formatTickK(tick)}
              </span>
            ))}
          </div>

          {/* Plot canvas */}
          <div className="relative flex-1 min-w-0">
            {/* Horizontal grid lines */}
            <div className="absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between pointer-events-none">
              {yTicks.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-full border-b ${
                    idx === yTicks.length - 1 ? 'border-slate-200' : 'border-dashed border-slate-200/80'
                  }`}
                />
              ))}
            </div>

            <div className="h-48 flex items-end justify-between gap-1.5 sm:gap-3 px-1 sm:px-2 relative z-10">
              {d.timeline_trend.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 pb-6 text-center">
                  <BarChart3 className="w-5 h-5 text-slate-300" />
                  <p className="text-xs font-medium text-slate-500">
                    Chưa có giao dịch Token trong 7 ngày qua
                  </p>
                  <p className="text-2xs text-slate-400">
                    Biểu đồ tự động cập nhật khi phát sinh truy vấn từ Cổng Bác sĩ
                  </p>
                </div>
              ) : (
                d.timeline_trend.map((t, idx) => {
                  const savedPct = Math.min(100, Math.max(t.saved_k > 0 ? 6 : 2, (t.saved_k / yMax) * 100));
                  const consumedPct = Math.min(100, Math.max(t.consumed_k > 0 ? 6 : 2, (t.consumed_k / yMax) * 100));
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative"
                    >
                      {/* Hover tooltip */}
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 bg-slate-900 text-white text-3xs font-mono px-2 py-1 rounded-md shadow-md whitespace-nowrap">
                        <div>{t.date || t.day}</div>
                        <div className="text-teal-300">Tiết kiệm: {t.saved_k}k</div>
                        <div className="text-slate-300">Tiêu thụ: {t.consumed_k}k</div>
                      </div>

                      <div className="w-full flex items-end justify-center gap-1 h-[156px]">
                        <div
                          style={{ height: `${savedPct}%` }}
                          className="w-3 sm:w-4 bg-teal-600 group-hover:bg-teal-700 rounded-t-[3px] transition-all cursor-pointer"
                        />
                        <div
                          style={{ height: `${consumedPct}%` }}
                          className="w-3 sm:w-4 bg-slate-300 group-hover:bg-slate-400 rounded-t-[3px] transition-all cursor-pointer"
                        />
                      </div>
                      <div className="h-7 pt-1.5 flex flex-col items-center justify-start leading-tight">
                        <span className="text-2xs font-semibold text-slate-700">{t.day}</span>
                        <span className="text-3xs text-slate-400 font-mono hidden sm:inline">
                          {t.date}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thanh Phân Bổ Nghiệp Vụ Lâm Sàng: Chiếm 5/12 cột */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col min-h-[300px]">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Phân bổ nghiệp vụ lâm sàng
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tần suất các nhóm câu hỏi chuyên môn được tra cứu
          </p>
        </div>

        <div className="mt-4 flex-1 flex flex-col justify-center">
          {d.intent_distribution.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center gap-1.5 text-center">
              <PieChart className="w-5 h-5 text-slate-300" />
              <p className="text-xs font-medium text-slate-500">
                Chưa có dữ liệu hội thoại được ghi nhận
              </p>
              <p className="text-2xs text-slate-400">
                Tỷ trọng nhóm nghiệp vụ sẽ hiển thị tại đây
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {d.intent_distribution.slice(0, 6).map((it, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="font-medium text-slate-800 truncate" title={it.intent}>
                      {formatIntentLabel(it.intent)}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0 text-2xs">
                      {it.pct}%{' '}
                      <span className="text-slate-500 font-normal">({it.count})</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{
                        width: `${Math.max(3, it.pct)}%`,
                        backgroundColor: it.color || '#0d9488',
                      }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
