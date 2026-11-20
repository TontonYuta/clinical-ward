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
    <div className="space-y-4">
      {/* 1. Dải Thống Kê Giám Định BHYT */}
      <div className="bg-white border border-slate-200/90 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        <div className="p-3.5 sm:px-5 sm:py-4">
          <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Hồ sơ đã giám định</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {auditedCount} <span className="text-xs font-normal text-slate-400 font-sans">ca</span>
          </div>
        </div>

        <div className="p-3.5 sm:px-5 sm:py-4">
          <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Xuất toán bảo toàn</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {bhytSaved.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400 font-sans">₫</span>
          </div>
        </div>

        <div className="p-3.5 sm:px-5 sm:py-4">
          <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Đạt chuẩn thanh toán</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {counts.pass} <span className="text-xs font-normal text-slate-400 font-sans">ca</span>
          </div>
        </div>

        <div className="p-3.5 sm:px-5 sm:py-4">
          <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Cảnh báo &amp; Lỗi xuất toán</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {counts.warning + counts.rejectError} <span className="text-xs font-normal text-slate-400 font-sans">ca</span>
          </div>
        </div>
      </div>

      {/* 2. Sổ Nhật Ký Giám Định BHYT & Check Lỗi */}
      <div className="bg-white rounded-lg border border-slate-200/90 overflow-hidden flex flex-col space-y-3 p-3 sm:px-4 sm:py-3.5">
          {/* Header & Bộ lọc */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Lịch sử Giám định Đơn thuốc BHYT (Căn cứ TT 20/2022 &amp; QĐ 3618)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bấm vào từng đơn thuốc để kiểm tra danh sách vi phạm, lỗi xuất toán, và căn cứ pháp lý xử lý
              </p>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã đơn, tên BN, thẻ BHYT, ICD-10..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Tất cả</span>
              <span className="font-mono text-2xs opacity-70">({counts.all})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('REJECT_ERROR')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'REJECT_ERROR'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Bị xuất toán / Lỗi</span>
              <span className="font-mono text-2xs opacity-70">({counts.rejectError})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('WARNING')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'WARNING'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Cảnh báo</span>
              <span className="font-mono text-2xs opacity-70">({counts.warning})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PASS')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'PASS'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Đạt chuẩn</span>
              <span className="font-mono text-2xs opacity-70">({counts.pass})</span>
            </button>
          </div>

          {/* Bảng dữ liệu Log Giám Định */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-3xs tracking-wider select-none">
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Mã đơn / Bệnh nhân</th>
                  <th className="py-2.5 px-3">Mã thẻ BHYT</th>
                  <th className="py-2.5 px-3">Tuyến BV &amp; ĐT</th>
                  <th className="py-2.5 px-3">ICD-10</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Xuất toán rủi ro</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
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
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Danh sách vi phạm &amp; lỗi phát hiện ({selectedViolations.length}):</span>
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-2xs font-extrabold font-mono ${
                    selectedLog.status === 'REJECT' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    selectedLog.status === 'ERROR' ? 'bg-rose-200 text-rose-900 border border-rose-400' :
                    selectedLog.status === 'WARNING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {selectedLog.status}
                  </span>
                </div>

                {selectedViolations.length === 0 ? (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <p className="text-xs font-bold text-emerald-900">Đơn thuốc hoàn toàn hợp lệ</p>
                    <p className="text-3xs text-emerald-700">Không ghi nhận bất kỳ vi phạm danh mục hoặc điều kiện thanh toán nào</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedViolations.map((v, idx) => (
                      <div
                        key={v.id || idx}
                        className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-rose-950 block text-xs">
                              {idx + 1}. {v.title || v.category || 'Vi phạm điều kiện thanh toán'}
                            </span>
                            {v.drug_name && (
                              <span className="text-3xs text-slate-600 font-sans block mt-0.5">
                                Thuốc: <strong className="text-slate-800">{v.drug_name}</strong> {v.active_ingredient ? `(${v.active_ingredient})` : ''} • Mã: {v.drug_code || '---'}
                              </span>
                            )}
                          </div>
                          {v.rejection_risk_vnd && v.rejection_risk_vnd > 0 ? (
                            <span className="font-mono text-2xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded shrink-0">
                              -{v.rejection_risk_vnd.toLocaleString('vi-VN')} đ
                            </span>
                          ) : null}
                        </div>

                        <p className="text-slate-700 text-xs leading-relaxed bg-white/70 p-2 rounded-lg border border-rose-100">
                          {v.detail}
                        </p>

                        {/* Căn cứ pháp lý & Hành động xử lý */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-rose-200/60 text-2xs">
                          {v.legal_ref && (
                            <div className="text-slate-600 font-sans flex items-center gap-1 truncate">
                              <span className="font-semibold text-slate-700">Căn cứ:</span>
                              <span className="text-teal-800 font-medium truncate">
                                {v.legal_ref.doc_code || v.legal_ref.doc_title}
                                {v.legal_ref.section ? ` - ${v.legal_ref.section}` : ''}
                                {v.legal_ref.page_number ? ` (Trang ${v.legal_ref.page_number})` : ''}
                              </span>
                            </div>
                          )}

                          {v.action && (
                            <div className="text-amber-900 font-semibold bg-amber-100/70 px-2 py-0.5 rounded text-3xs shrink-0">
                              Khắc phục: {v.action}
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
