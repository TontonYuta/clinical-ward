import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  FileCheck,
  Search,
  X,
  AlertTriangle,
  Copy,
  Check,
  FileText,
  Eye
} from 'lucide-react';
import { TelemetryOverviewResponse, BhytAuditLogItem, BhytViolationDetail } from '../../types/admin';

interface AuditTabProps {
  data: TelemetryOverviewResponse | null;
}

export const AuditTab: React.FC<AuditTabProps> = ({ data }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REJECT_ERROR' | 'WARNING' | 'PASS'>('ALL');
  const [selectedLog, setSelectedLog] = useState<BhytAuditLogItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const bhytSaved = data?.bhyt_rejection_saved_vnd ?? 0;
  const auditedCount = data?.bhyt_audited ?? 0;

  // Lấy danh sách log BHYT
  const bhytLogs: BhytAuditLogItem[] = useMemo(() => {
    return data?.bhyt_logs || [];
  }, [data]);

  // Lọc danh sách BHYT theo từ khóa và trạng thái
  const filteredBhytLogs = useMemo(() => {
    return bhytLogs.filter((item) => {
      // 1. Lọc theo trạng thái
      if (statusFilter === 'REJECT_ERROR') {
        if (item.status !== 'REJECT' && item.status !== 'ERROR') return false;
      } else if (statusFilter === 'WARNING') {
        if (item.status !== 'WARNING') return false;
      } else if (statusFilter === 'PASS') {
        if (item.status !== 'PASS') return false;
      }

      // 2. Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = (item.patient_name || '').toLowerCase();
        const pId = (item.prescription_id || '').toLowerCase();
        const card = (item.insurance_card_number || '').toLowerCase();
        const icd = (item.primary_icd10 || '').toLowerCase();
        return pName.includes(q) || pId.includes(q) || card.includes(q) || icd.includes(q);
      }

      return true;
    });
  }, [bhytLogs, statusFilter, searchQuery]);

  // Đếm nhanh số lượng theo từng nhóm trạng thái
  const counts = useMemo(() => {
    let rejectError = 0;
    let warning = 0;
    let pass = 0;
    bhytLogs.forEach((l) => {
      if (l.status === 'REJECT' || l.status === 'ERROR') rejectError++;
      else if (l.status === 'WARNING') warning++;
      else if (l.status === 'PASS') pass++;
    });
    return { all: bhytLogs.length, rejectError, warning, pass };
  }, [bhytLogs]);

  // Parse chi tiết vi phạm của log đang chọn
  const selectedViolations: BhytViolationDetail[] = useMemo(() => {
    if (!selectedLog) return [];
    if (selectedLog.violations && selectedLog.violations.length > 0) return selectedLog.violations;
    if (selectedLog.violations_json) {
      try {
        return JSON.parse(selectedLog.violations_json);
      } catch {
        return [];
      }
    }
    return [];
  }, [selectedLog]);

  const handleCopyLogDetail = () => {
    if (!selectedLog) return;
    const text = JSON.stringify(selectedLog, null, 2);
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. 4 Thẻ Thống Kê Giám Định BHYT Full-Width (Airy Main-App proportions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ đã giám định</span>
            <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
            {auditedCount} <span className="text-sm font-normal text-slate-500 font-sans">ca</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Xuất toán bảo toàn</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
            {bhytSaved.toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-500 font-sans">₫</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đạt chuẩn thanh toán</span>
            <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
            {counts.pass} <span className="text-sm font-normal text-slate-500 font-sans">ca</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cảnh báo &amp; Lỗi xuất toán</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
            {counts.warning + counts.rejectError} <span className="text-sm font-normal text-slate-500 font-sans">ca</span>
          </div>
        </div>
      </div>

      {/* 2. Sổ Nhật Ký Giám Định BHYT & Check Lỗi */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        {/* Header & Tìm kiếm */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Lịch sử giám định đơn thuốc BHYT (TT 20/2022 &amp; QĐ 3618)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm vào từng đơn thuốc để xem chi tiết vi phạm, nguy cơ xuất toán và căn cứ xử lý
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã đơn, tên BN, thẻ BHYT, ICD-10..."
              className="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills (Consistent Teal accent, scrollable on mobile) */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50/70 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              ['ALL', 'Tất cả', counts.all],
              ['REJECT_ERROR', 'Bị xuất toán / Lỗi', counts.rejectError],
              ['WARNING', 'Cảnh báo', counts.warning],
              ['PASS', 'Đạt chuẩn', counts.pass],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                statusFilter === key
                  ? 'bg-teal-50 text-teal-900 border-teal-300 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{label}</span>
              <span className="font-mono text-2xs opacity-75">({count})</span>
            </button>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase text-2xs tracking-wider select-none">
                <th className="py-2.5 pl-5 sm:pl-6 pr-3">Thời gian</th>
                <th className="py-2.5 px-3">Mã đơn / Bệnh nhân</th>
                <th className="py-2.5 px-3">Mã thẻ BHYT</th>
                <th className="py-2.5 px-3">Tuyến BV &amp; ĐT</th>
                <th className="py-2.5 px-3">ICD-10</th>
                <th className="py-2.5 px-3 text-center">Trạng thái</th>
                <th className="py-2.5 px-3 text-right">Xuất toán rủi ro</th>
                <th className="py-2.5 pl-3 pr-5 sm:pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBhytLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileCheck className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Không tìm thấy bản ghi giám định BHYT nào</p>
                        <p className="text-xs text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBhytLogs.map((log) => {
                    const isReject = log.status === 'REJECT';
                    const isError = log.status === 'ERROR';
                    const isWarning = log.status === 'WARNING';
                    const isPass = log.status === 'PASS';

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-2xs whitespace-nowrap">
                          {log.created_at ? log.created_at.slice(11, 19) : '--:--:--'}
                          <span className="block text-3xs text-slate-400">
                            {log.created_at ? log.created_at.slice(0, 10) : ''}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 min-w-[160px]">
                          <span className="font-medium text-slate-900 block truncate group-hover:text-teal-700 transition">
                            {log.patient_name || 'Bệnh nhân'}
                          </span>
                          <span className="font-mono text-3xs text-slate-400">
                            {log.prescription_id}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-2xs text-slate-500 whitespace-nowrap">
                          {log.insurance_card_number || '---'}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-xs text-slate-700">
                          <span>
                            {log.hospital_rank === 'HANG_I' ? 'Tuyến 1' : log.hospital_rank === 'HANG_II' ? 'Tuyến 2' : log.hospital_rank === 'HANG_III' ? 'Tuyến 3' : 'ĐB'}
                          </span>
                          <span className="text-slate-400 text-3xs ml-1">
                            ({log.treatment_type === 'NOI_TRU' ? 'Nội trú' : 'Ngoại trú'})
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-xs text-slate-800">
                          {log.primary_icd10 || '---'}
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isReject && (
                            <span className="inline-flex items-center gap-1 text-2xs font-mono font-medium text-rose-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              REJECT
                            </span>
                          )}
                          {isError && (
                            <span className="inline-flex items-center gap-1 text-2xs font-mono font-medium text-rose-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              LỖI ({log.violations_count})
                            </span>
                          )}
                          {isWarning && (
                            <span className="inline-flex items-center gap-1 text-2xs font-mono font-medium text-amber-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              CẢNH BÁO
                            </span>
                          )}
                          {isPass && (
                            <span className="inline-flex items-center gap-1 text-2xs font-mono font-medium text-emerald-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              HỢP LỆ
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                          {log.at_risk_cost_vnd > 0 ? (
                            <span className="font-medium text-rose-600">
                              {log.at_risk_cost_vnd.toLocaleString('vi-VN')} đ
                            </span>
                          ) : (
                            <span className="text-slate-400">0 đ</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="text-xs text-slate-400 group-hover:text-teal-700 font-medium">
                            Chi tiết →
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (BHYT Audit — zero clipping on 390px) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredBhytLogs.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-500 text-xs">
                Không tìm thấy bản ghi giám định BHYT nào.
              </div>
            ) : (
              filteredBhytLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedLog(log)}
                  className="w-full text-left p-4 hover:bg-teal-50/40 transition-colors space-y-2 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {log.patient_name || 'Bệnh nhân'}
                      </div>
                      <div className="text-2xs font-mono text-slate-500 truncate mt-0.5">
                        {log.prescription_id} · {log.primary_icd10 || '---'}
                      </div>
                    </div>
                    <span className="text-2xs font-mono font-semibold text-slate-700 shrink-0">
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-2xs text-slate-500">
                    <span className="font-mono">{log.insurance_card_number || '---'}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {Number(log.at_risk_cost_vnd || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

      {/* 3. Modal / Drawer Kiểm Tra Chi Tiết Lỗi Giám Định BHYT */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl text-white ${
                  selectedLog.status === 'REJECT' || selectedLog.status === 'ERROR'
                    ? 'bg-rose-600'
                    : selectedLog.status === 'WARNING'
                    ? 'bg-amber-600'
                    : 'bg-emerald-600'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    Chi tiết Giám định BHYT &amp; Check Lỗi
                  </h3>
                  <p className="text-2xs text-slate-500 font-mono truncate">
                    ID: {selectedLog.id} • Đơn: {selectedLog.prescription_id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLogDetail}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                  title="Sao chép toàn bộ JSON log"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  title="Đóng (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body: Thông tin tóm tắt & Danh sách vi phạm */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Thẻ thông tin hành chính đơn thuốc */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase block">Bệnh nhân</span>
                  <span className="font-bold text-slate-800">{selectedLog.patient_name || 'Bệnh nhân'}</span>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase block">Thẻ BHYT</span>
                  <span className="font-mono font-bold text-slate-800">{selectedLog.insurance_card_number || '---'}</span>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase block">Chẩn đoán ICD-10</span>
                  <span className="font-mono font-bold text-blue-700">{selectedLog.primary_icd10 || '---'}</span>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase block">Nguy cơ xuất toán</span>
                  <span className="font-mono font-extrabold text-rose-700">
                    {selectedLog.at_risk_cost_vnd.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Danh sách lỗi vi phạm */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-slate-500" />
                    <span>Danh sách vi phạm &amp; lỗi phát hiện ({selectedViolations.length}):</span>
                  </h4>
                  <span className={`inline-flex items-center gap-1 font-mono text-2xs font-medium ${
                    selectedLog.status === 'REJECT' || selectedLog.status === 'ERROR' ? 'text-rose-600' :
                    selectedLog.status === 'WARNING' ? 'text-amber-600' : 'text-emerald-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedLog.status === 'REJECT' || selectedLog.status === 'ERROR' ? 'bg-rose-500' :
                      selectedLog.status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    {selectedLog.status}
                  </span>
                </div>

                {selectedViolations.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-900">Đơn thuốc hợp lệ</p>
                    <p className="text-3xs text-slate-500">Không ghi nhận bất kỳ vi phạm danh mục hoặc điều kiện thanh toán nào</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedViolations.map((v, idx) => (
                      <div
                        key={v.id || idx}
                        className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-900 block text-xs">
                              {idx + 1}. {v.title || v.category || 'Vi phạm điều kiện thanh toán'}
                            </span>
                            {v.drug_name && (
                              <span className="text-3xs text-slate-500 font-sans block mt-0.5">
                                Thuốc: <strong className="text-slate-800">{v.drug_name}</strong> {v.active_ingredient ? `(${v.active_ingredient})` : ''} • Mã: {v.drug_code || '---'}
                              </span>
                            )}
                          </div>
                          {v.rejection_risk_vnd && v.rejection_risk_vnd > 0 ? (
                            <span className="font-mono text-xs font-medium text-rose-600 shrink-0">
                              -{v.rejection_risk_vnd.toLocaleString('vi-VN')} đ
                            </span>
                          ) : null}
                        </div>

                        <p className="text-slate-700 text-xs leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-100">
                          {v.detail}
                        </p>

                        {/* Căn cứ pháp lý & Hành động xử lý */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 text-2xs">
                          {v.legal_ref && (
                            <div className="text-slate-500 font-sans flex items-center gap-1 truncate">
                              <span className="font-medium text-slate-600">Căn cứ:</span>
                              <span className="text-slate-800 truncate font-mono">
                                {v.legal_ref.doc_code || v.legal_ref.doc_title}
                                {v.legal_ref.section ? ` - ${v.legal_ref.section}` : ''}
                                {v.legal_ref.page_number ? ` (Trang ${v.legal_ref.page_number})` : ''}
                              </span>
                            </div>
                          )}

                          {v.action && (
                            <div className="text-slate-600 text-3xs shrink-0 font-medium">
                              Hướng xử lý: <span className="text-slate-800">{v.action}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-3xs text-slate-400 font-mono">
                Ghi nhận tại: {selectedLog.created_at || 'Vừa xong'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
