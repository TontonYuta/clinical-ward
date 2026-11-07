import React from 'react';
import { ShieldAlert, ShieldCheck, CheckCircle2, AlertOctagon, FileCheck, Stethoscope } from 'lucide-react';
import { TelemetryOverviewResponse } from '../../types/admin';

interface AuditTabProps {
  data: TelemetryOverviewResponse | null;
}

export const AuditTab: React.FC<AuditTabProps> = ({ data }) => {
  const ddiCount = data?.ddi_blocks_count ?? 0;
  const guardCount = data?.guardrail_blocks_count ?? 0;
  const bhytSaved = data?.bhyt_rejection_saved_vnd ?? 0;
  const auditedCount = data?.bhyt_audited ?? 0;

  // Lọc sự kiện kiểm toán thật từ CSDL logs
  const realAuditEvents = (data?.recent_events || []).filter(
    (e) => e.status === 'blocked' || e.event_type === 'DDI_BLOCKED' || e.event_type === 'GUARDRAIL_BLOCKED'
  );

  return (
    <div className="space-y-6">
      {/* Thẻ Tổng Quan An Toàn */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
              Tương Tác DDI Chặn
            </span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold font-mono text-rose-700">{ddiCount} ca</div>
          <div className="text-xs sm:text-sm text-slate-500 font-medium">
            Phối hợp thuốc nguy cơ cao bị chặn tự động trước khi ký toa
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
              Guardrails Kích Hoạt
            </span>
            <div className="p-2 bg-teal-50 rounded-lg text-teal-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold font-mono text-teal-800">{guardCount} lần</div>
          <div className="text-xs sm:text-sm text-slate-500 font-medium">
            Bảo vệ ranh giới an toàn chuyên môn lâm sàng Bộ Y Tế
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
              BHYT Xuất Toán Cứu Được
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold font-mono text-emerald-700">
            {bhytSaved.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-xs sm:text-sm text-slate-500 font-medium">
            Từ {auditedCount} ca kiểm toán tự động theo TT 26/2025
          </div>
        </div>
      </div>

      {/* Bảng Nhật Ký Kiểm Toán An Toàn */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h2 className="text-lg lg:text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-teal-700" />
            Nhật Ký Can Thiệp An Toàn Lâm Sàng & Guardrails
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Ghi nhận kiểm toán tự động theo Thông tư 26/2025/TT-BYT và Quyết định 5948/QĐ-BYT
          </p>
        </div>

        <div className="divide-y divide-slate-100 pt-2">
          {realAuditEvents.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
              <div className="p-3 bg-emerald-50 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-700">
                  Chưa ghi nhận sự cố an toàn y khoa hoặc vi phạm ranh giới lâm sàng
                </p>
                <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                  Toàn bộ các truy vấn và y lệnh trong ca trực đều tuân thủ đúng khuyến cáo Dược thư Quốc gia V & QĐ 5948/QĐ-BYT.
                </p>
              </div>
            </div>
          ) : (
            realAuditEvents.map((item) => (
              <div key={item.id} className="py-3.5 flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                      item.event_type === 'DDI_BLOCKED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                      'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {item.event_type}
                    </span>
                    <span className="text-xs text-slate-400 font-mono font-medium">{item.timestamp}</span>
                    <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                      {item.user_role}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium leading-relaxed">{item.query}</p>
                </div>

                <div className="shrink-0 pt-1">
                  <ShieldCheck className="w-5 h-5 text-rose-600" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
