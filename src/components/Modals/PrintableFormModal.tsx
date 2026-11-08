/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  FileCheck2,
  CheckCircle2,
  FileText,
  Boxes,
  Building2,
  AlertTriangle,
  Stethoscope,
  ExternalLink,
  Thermometer,
  ClipboardCheck,
  ShieldAlert,
  ArrowRightLeft,
  Check,
  Clock,
  UserCheck,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import {
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  AssetAuditRecord,
  ColdChainMonitorState,
  UserRole
} from '../../types/clinical';
import { USER_PROFILES } from '../../data/initialData';

export type PrintableFormType =
  | 'TT20_AMPOULE_DESTRUCTION'     // Mẫu 16 Phụ lục II NĐ 54/2017 & Điều 15, 16 TT 20/2017/TT-BYT (Hủy vỏ ống gây nghiện)
  | 'TT22_RESTOCK_PROPOSAL'        // Mẫu số 01/TT22 Thông tư 22/2011/TT-BYT (Dự trù thuốc tủ trực)
  | 'TSC_HANDOVER_TRANSFER'        // Mẫu 01/TSC-BBGN NĐ 151/2017 & NĐ 114/2024 (Biên bản bàn giao TBYT)
  | 'EMERGENCY_BORROW_TICKET'      // Phiếu xuất mượn khẩn tủ trực Điều 10 TT 22/2011/TT-BYT (Kẹp bệnh án)
  | 'EQUIPMENT_HANDOVER_INSPECT'   // Biên bản kiểm định an toàn điện & thử tải Điều 34 NĐ 98/2021 & IEC 60601-1
  | 'TSC_ANNUAL_AUDIT'             // Mẫu 05-TSC Thông tư 23/2023/TT-BTC & NĐ 151/2017 (Biên bản kiểm kê TBYT)
  | 'COLD_CHAIN_INCIDENT_REPORT'   // Biên bản sự cố chuỗi lạnh & thẩm định vắc xin GSP (Thông tư 36/2018/TT-BYT)
  | 'SHIFT_HANDOVER_RECORD';       // Sổ giao ban và bàn giao ca trực điều dưỡng lâm sàng (TT 31/2021/TT-BYT & QĐ 1895)

export const ALL_PRINTABLE_FORMS: { id: PrintableFormType; shortLabel: string; codeLabel: string }[] = [
  { id: 'TT20_AMPOULE_DESTRUCTION', shortLabel: 'Mẫu 16 (TT 20) Hủy Vỏ Morphin', codeLabel: '1. Mẫu 16 TT 20' },
  { id: 'TT22_RESTOCK_PROPOSAL', shortLabel: 'Mẫu 01 (TT 22) Dự Trù Tủ Trực', codeLabel: '2. Mẫu 01 TT 22' },
  { id: 'TSC_HANDOVER_TRANSFER', shortLabel: 'Mẫu 01 (TSC) Bàn Giao TBYT', codeLabel: '3. Mẫu 01 TSC' },
  { id: 'EMERGENCY_BORROW_TICKET', shortLabel: 'Phiếu Mượn Khẩn Tủ Trực (Kẹp Bệnh Án)', codeLabel: '4. Phiếu Mượn TT 22' },
  { id: 'EQUIPMENT_HANDOVER_INSPECT', shortLabel: 'Biên Bản KĐ Điện IEC 60601 (NĐ 98)', codeLabel: '5. KĐ An Toàn NĐ 98' },
  { id: 'TSC_ANNUAL_AUDIT', shortLabel: 'Mẫu 05 (TSC) Kiểm Kê Tài Sản', codeLabel: '6. Mẫu 05 TSC' },
  { id: 'COLD_CHAIN_INCIDENT_REPORT', shortLabel: 'Biên Bản Quá Nhiệt Vắc Xin GSP', codeLabel: '7. Chuỗi Lạnh GSP' },
  { id: 'SHIFT_HANDOVER_RECORD', shortLabel: 'Sổ Bàn Giao Ca Trực Điều Dưỡng', codeLabel: '8. Sổ Bàn Giao Ca' },
];

interface PrintableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormType?: PrintableFormType;
  selectedDebtRecord?: DebtRecord | null;
  selectedEquipmentTicket?: EquipmentTicket | null;
  selectedAssetRecord?: AssetAuditRecord | null;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  assets: AssetAuditRecord[];
  coldChainState?: ColdChainMonitorState;
  currentUserRole: UserRole;
}

export const PrintableFormModal: React.FC<PrintableFormModalProps> = ({
  isOpen,
  onClose,
  initialFormType = 'TT20_AMPOULE_DESTRUCTION',
  selectedDebtRecord,
  selectedEquipmentTicket,
  selectedAssetRecord,
  debts,
  tickets,
  batches,
  assets,
  coldChainState,
  currentUserRole
}) => {
  const [activeFormType, setActiveFormType] = useState<PrintableFormType>(initialFormType);
  const [activeDebtId, setActiveDebtId] = useState<string>(selectedDebtRecord?.id || debts[0]?.id || '');
  const [activeTicketId, setActiveTicketId] = useState<string>(selectedEquipmentTicket?.id || tickets[0]?.id || '');
  const [activeAssetId, setActiveAssetId] = useState<string>(selectedAssetRecord?.id || assets[0]?.id || '');
  const [zoomMode, setZoomMode] = useState<'fit' | '100%'>('fit');

  useEffect(() => {
    setActiveFormType(initialFormType);
  }, [initialFormType]);

  useEffect(() => {
    if (selectedDebtRecord?.id) {
      setActiveDebtId(selectedDebtRecord.id);
    }
  }, [selectedDebtRecord]);

  useEffect(() => {
    if (selectedEquipmentTicket?.id) {
      setActiveTicketId(selectedEquipmentTicket.id);
    }
  }, [selectedEquipmentTicket]);

  useEffect(() => {
    if (selectedAssetRecord?.id) {
      setActiveAssetId(selectedAssetRecord.id);
    }
  }, [selectedAssetRecord]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const [day, month, year] = currentDateStr.split('/');

  // Current selections
  const currentDebt = debts.find(d => d.id === activeDebtId) || selectedDebtRecord || debts[0];
  const currentTicket = tickets.find(t => t.id === activeTicketId) || selectedEquipmentTicket || tickets[0];
  const currentAsset = assets.find(a => a.id === activeAssetId) || selectedAssetRecord || assets[0];

  // Narcotic debts for destruction form
  const narcoticDebts = debts.filter(d => d.itemType === 'Thuốc gây nghiện');

  // Low stock batches for restock proposal
  const lowStockBatches = batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold);

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Download raw document
  const handleDownloadHtml = () => {
    const docEl = document.getElementById('printable-medical-document');
    if (!docEl) return;
    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Bieu_Mau_Hanh_Chinh_Y_Te_${activeFormType}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Times New Roman', Times, serif; font-size: 11.5px; line-height: 1.35; }
    #printable-medical-document { width: 100%; max-width: 100%; margin: 0 auto; padding: 0; box-sizing: border-box; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; vertical-align: middle; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: none; }
    .header-table td { border: none; padding: 1px 2px; vertical-align: top; }
    .sig-table { width: 100%; border-collapse: collapse; margin-top: 14px; border: none; page-break-inside: avoid; }
    .sig-table td { border: none; vertical-align: top; text-align: center; font-size: 11px; }
    .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>
  <div id="printable-medical-document">
    ${docEl.innerHTML}
  </div>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bieu_Mau_Chuan_Y_Te_${activeFormType}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrevForm = () => {
    const currentIndex = ALL_PRINTABLE_FORMS.findIndex(f => f.id === activeFormType);
    const prevIndex = (currentIndex - 1 + ALL_PRINTABLE_FORMS.length) % ALL_PRINTABLE_FORMS.length;
    setActiveFormType(ALL_PRINTABLE_FORMS[prevIndex].id);
  };

  const handleNextForm = () => {
    const currentIndex = ALL_PRINTABLE_FORMS.findIndex(f => f.id === activeFormType);
    const nextIndex = (currentIndex + 1) % ALL_PRINTABLE_FORMS.length;
    setActiveFormType(ALL_PRINTABLE_FORMS[nextIndex].id);
  };

  return (
    <div
      onClick={onClose}
      data-testid="printable-form-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200 print:static print:p-0 print:bg-white print:block"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-6xl h-[95vh] rounded-lg shadow-xl flex flex-col overflow-hidden border border-slate-200 print:h-auto print:max-w-none print:w-full print:border-none print:shadow-none print:overflow-visible print:rounded-none"
      >
        
        {/* Top Control Bar */}
        <div className="px-3 sm:px-5 py-2 sm:py-2.5 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0 print:hidden gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <span className="truncate">Biểu Mẫu Hành Chính Y Tế</span>
                <span className="hidden md:inline px-2 py-0.5 rounded text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 font-sans">
                  Chuẩn In 1 Trang A4
                </span>
              </h2>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                Định dạng chuẩn thể thức văn bản hành chính y tế (NĐ 30/2020)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setZoomMode(prev => prev === 'fit' ? '100%' : 'fit')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-200 cursor-pointer"
              title={zoomMode === 'fit' ? "Xem tỉ lệ thật 100%" : "Thu vừa màn hình để xem trọn vẹn trang"}
            >
              {zoomMode === 'fit' ? <Maximize2 className="w-3.5 h-3.5 text-teal-700" /> : <ZoomOut className="w-3.5 h-3.5 text-teal-700" />}
              <span>{zoomMode === 'fit' ? '100%' : 'Fit'}</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-200 cursor-pointer"
              title="Tải văn bản định dạng HTML chuẩn in ấn"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>HTML</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
              title="In trực tiếp ra máy in hoặc lưu file PDF (Ctrl + P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">In Biểu Mẫu (A4 / PDF)</span>
              <span className="sm:hidden">In A4</span>
            </button>

            <button
              data-testid="close-printable-modal"
              onClick={onClose}
              title="Đóng biểu mẫu (Esc)"
              aria-label="Đóng biểu mẫu"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer ml-0.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Form Picker (sm:hidden) */}
        <div className="sm:hidden px-3 py-2 bg-slate-100 border-b border-slate-200/90 flex items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[11px] font-bold text-slate-600 shrink-0">Biểu mẫu:</span>
            <select
              value={activeFormType}
              onChange={(e) => setActiveFormType(e.target.value as PrintableFormType)}
              className="flex-1 py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:border-teal-600 truncate shadow-2xs"
            >
              {ALL_PRINTABLE_FORMS.map((form, idx) => (
                <option key={form.id} value={form.id}>
                  {idx + 1}. {form.shortLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePrevForm}
              className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95 shadow-2xs cursor-pointer font-bold"
              title="Biểu mẫu trước"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNextForm}
              className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95 shadow-2xs cursor-pointer font-bold"
              title="Biểu mẫu kế tiếp"
            >
              ›
            </button>
          </div>
        </div>

        {/* Desktop Tab Navigation (hidden sm:flex) (8 Comprehensive Medical & Administrative Forms) */}
        <div className="hidden sm:flex px-4 py-1.5 bg-slate-100 border-b border-slate-200/90 items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 print:hidden">
          <button
            onClick={() => setActiveFormType('TT20_AMPOULE_DESTRUCTION')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'TT20_AMPOULE_DESTRUCTION'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>1. Mẫu 16 (TT 20 &amp; NĐ 54) - Hủy Vỏ Ống Gây Nghiện</span>
          </button>

          <button
            onClick={() => setActiveFormType('TT22_RESTOCK_PROPOSAL')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'TT22_RESTOCK_PROPOSAL'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-amber-600" />
            <span>2. Mẫu 01/TT22 - Dự Trù Cơ Số Thuốc Tủ Trực</span>
          </button>

          <button
            onClick={() => setActiveFormType('TSC_HANDOVER_TRANSFER')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'TSC_HANDOVER_TRANSFER'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            <span>3. Mẫu 01/TSC-BBGN - Bàn Giao &amp; Điều Chuyển TBYT</span>
          </button>

          <button
            onClick={() => setActiveFormType('EMERGENCY_BORROW_TICKET')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'EMERGENCY_BORROW_TICKET'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>4. Phiếu Mượn Khẩn Tủ Trực (Kẹp Bệnh Án)</span>
          </button>

          <button
            onClick={() => setActiveFormType('EQUIPMENT_HANDOVER_INSPECT')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'EQUIPMENT_HANDOVER_INSPECT'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
            <span>5. Biên Bản KĐ An Toàn Điện IEC 60601 (NĐ 98)</span>
          </button>

          <button
            onClick={() => setActiveFormType('TSC_ANNUAL_AUDIT')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'TSC_ANNUAL_AUDIT'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>6. Mẫu 05-TSC - Biên Bản Kiểm Kê Tài Sản Cố Định</span>
          </button>

          <button
            onClick={() => setActiveFormType('COLD_CHAIN_INCIDENT_REPORT')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'COLD_CHAIN_INCIDENT_REPORT'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5 text-cyan-600" />
            <span>7. Biên Bản Sự Cố Quá Nhiệt &amp; Thẩm Định Vắc Xin (GSP)</span>
          </button>

          <button
            onClick={() => setActiveFormType('SHIFT_HANDOVER_RECORD')}
            className={`px-2.5 py-1.2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'SHIFT_HANDOVER_RECORD'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>8. Sổ Bàn Giao Ca Trực Điều Dưỡng Lâm Sàng</span>
          </button>
        </div>

        {/* Dynamic Context Selector Bar */}
        <div className="px-3 sm:px-5 py-2 sm:py-1.5 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs shrink-0 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
            {activeFormType === 'EMERGENCY_BORROW_TICKET' && (
              <>
                <span className="font-semibold text-slate-700">Chọn phiếu xuất mượn:</span>
                <select
                  value={activeDebtId}
                  onChange={(e) => setActiveDebtId(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 sm:py-0.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-teal-700 truncate shadow-2xs"
                >
                  {debts.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.code}: {d.itemName} ({d.quantity}) - BN: {d.patientName} ({d.patientRoom})
                    </option>
                  ))}
                </select>
              </>
            )}

            {(activeFormType === 'EQUIPMENT_HANDOVER_INSPECT') && (
              <>
                <span className="font-semibold text-slate-700">Chọn phiếu sự cố / thiết bị:</span>
                <select
                  value={activeTicketId}
                  onChange={(e) => setActiveTicketId(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 sm:py-0.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-teal-700 truncate shadow-2xs"
                >
                  {tickets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code}: {t.deviceName} (Serial: {t.serialNumber}) - {t.location}
                    </option>
                  ))}
                </select>
              </>
            )}

            {(activeFormType === 'TSC_HANDOVER_TRANSFER') && (
              <>
                <span className="font-semibold text-slate-700">Chọn tài sản bàn giao:</span>
                <select
                  value={activeAssetId}
                  onChange={(e) => setActiveAssetId(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 sm:py-0.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-teal-700 truncate shadow-2xs"
                >
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code}: {a.deviceName} (Serial: {a.serialNumber}) - {a.registeredDepartment}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeFormType === 'TT20_AMPOULE_DESTRUCTION' && (
              <span className="text-slate-600 font-medium">
                Tự động tổng hợp <strong>{narcoticDebts.length} vỏ ống thuốc gây nghiện</strong> đã thu hồi trong ca trực.
              </span>
            )}

            {activeFormType === 'TT22_RESTOCK_PROPOSAL' && (
              <span className="text-slate-600 font-medium">
                Tự động đối soát <strong>{lowStockBatches.length} mặt hàng cạn cơ số</strong> so với định mức an toàn.
              </span>
            )}

            {activeFormType === 'TSC_ANNUAL_AUDIT' && (
              <span className="text-slate-600 font-medium">
                Tổng hợp đối soát <strong>{assets.length} trang thiết bị y tế</strong> toàn khoa lâm sàng.
              </span>
            )}

            {activeFormType === 'COLD_CHAIN_INCIDENT_REPORT' && (
              <span className="text-slate-600 font-medium">
                Trích xuất dữ liệu chuỗi lạnh: Nhiệt độ hiện tại: <strong>{coldChainState?.currentTemp ?? 4.5}°C</strong> (Dải chuẩn: 2.0°C - 8.0°C).
              </span>
            )}

            {activeFormType === 'SHIFT_HANDOVER_RECORD' && (
              <span className="text-slate-600 font-medium">
                Bàn giao ca trực Cấp Cứu A9: Ghi nhận <strong>{debts.filter(d => d.status === 'debt').length} phiếu nợ</strong> và <strong>{tickets.length} thiết bị buồng cấp cứu</strong>.
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 font-sans hidden sm:block">
            Khổ in: A4 (210mm × 297mm) · Chuẩn 1 trang không tràn
          </div>
        </div>

        {/* Mobile Horizontal Panning Guide & Zoom Mode Toggle */}
        <div className="sm:hidden px-3.5 py-1.5 bg-teal-50/90 border-b border-teal-200/80 text-[11px] text-teal-900 flex items-center justify-between shrink-0 font-medium">
          <div className="flex items-center gap-1.5">
            <span>👉 Vuốt ngang để xem toàn trang A4</span>
          </div>
          <button
            type="button"
            onClick={() => setZoomMode(prev => prev === 'fit' ? '100%' : 'fit')}
            className="text-[10px] font-bold bg-white text-teal-800 px-2 py-0.5 rounded border border-teal-300 shadow-2xs cursor-pointer active:scale-95"
          >
            {zoomMode === 'fit' ? '🔍 Xem 100%' : '📱 Thu vừa màn hình'}
          </button>
        </div>

        {/* Document Preview Canvas (Simulating pure white A4 Paper) */}
        <div className="flex-1 overflow-auto bg-slate-300/60 p-2 sm:p-5 flex justify-start sm:justify-center items-start print:overflow-visible print:p-0 print:bg-transparent print:block">
          <div
            id="printable-medical-document"
            className={`w-[210mm] max-w-[210mm] bg-white text-black p-6 sm:p-7 shadow-xl border border-slate-300 rounded-xs text-[11.5px] leading-snug font-serif transition-transform duration-150 ${
              zoomMode === 'fit' ? 'scale-[0.88] origin-top my-1' : 'scale-100 my-2'
            }`}
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >

            {/* ========================================================================= */}
            {/* FORM 1: MẪU SỐ 16 PHỤ LỤC II NĐ 54/2017 & ĐIỀU 15, 16 TT 20/2017/TT-BYT    */}
            {/* ========================================================================= */}
            {activeFormType === 'TT20_AMPOULE_DESTRUCTION' && (
              <div className="space-y-2">
                {/* Administrative Header (NĐ 30/2020/NĐ-CP) */}
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">SỞ Y TẾ THÀNH PHỐ HÀ NỘI</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[10.5px] font-bold text-black">HỘI ĐỒNG TIÊU HỦY VỎ THUỐC</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Số: 16/BB-THV/2026</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    BIÊN BẢN TIÊU HỦY VỎ THUỐC PHẢI KIỂM SOÁT ĐẶC BIỆT
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Ban hành kèm theo Mẫu số 16 Phụ lục II Nghị định số 54/2017/NĐ-CP &amp; Thông tư số 20/2017/TT-BYT)
                  </p>
                </div>

                {/* Legal Preamble */}
                <div className="text-[11px] space-y-0.5 text-justify text-slate-900">
                  <p>- Căn cứ Luật Dược số 105/2016/QH13 ngày 06 tháng 4 năm 2016;</p>
                  <p>- Căn cứ Nghị định số 54/2017/NĐ-CP và Thông tư số 20/2017/TT-BYT của Bộ Y tế quy định chi tiết một số điều của Luật Dược về thuốc phải kiểm soát đặc biệt;</p>
                  <p>- Căn cứ Quyết định số 104/QĐ-BVĐK của Giám đốc Bệnh viện về việc thành lập Hội đồng tiêu hủy vỏ thuốc phải kiểm soát đặc biệt.</p>
                </div>

                {/* Council Members */}
                <div className="text-[11px] pt-0.5">
                  <p className="font-bold">Hôm nay, vào hồi 10 giờ 30 phút ngày {day} tháng {month} năm {year}, tại Kho Dược, Hội đồng gồm có:</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pl-2 text-[10.5px] pt-0.5">
                    <p>1. Ông: <strong>DS. CKI Nguyễn Văn Hoàng</strong> - Trưởng Khoa Dược (Chủ tịch Hội đồng)</p>
                    <p>2. Ông: <strong>BS. CKII Trần Văn Hùng</strong> - Trưởng Khoa Cấp Cứu A9 (Ủy viên)</p>
                    <p>3. Bà: <strong>ĐD. Lê Thị Thu</strong> - Điều dưỡng Trưởng ca A9 (Ủy viên kiêm Thư ký)</p>
                    <p>4. Bà: <strong>DS. Nguyễn Bích Ngọc</strong> - Dược sĩ Kho Dược (Ủy viên giám sát)</p>
                  </div>
                </div>

                {/* Table of Destroyed Items */}
                <div className="pt-0.5">
                  <p className="font-bold text-[11px] mb-0.5">
                    Hội đồng đã kiểm kê, đối soát đối chiếu 100% vỏ thuốc đã sử dụng thực tế như sau:
                  </p>
                  <table className="w-full border-collapse border border-black text-[10.5px]">
                    <thead>
                      <tr className="font-bold text-center">
                        <th className="border border-black py-1 px-1 w-7">STT</th>
                        <th className="border border-black py-1 px-1.5 text-left">Tên thuốc, nồng độ, hàm lượng</th>
                        <th className="border border-black py-1 px-1 w-14">Dạng bào chế</th>
                        <th className="border border-black py-1 px-1 w-10">ĐVT</th>
                        <th className="border border-black py-1 px-1 w-14">Số lượng vỏ</th>
                        <th className="border border-black py-1 px-1.5 w-24">Số lô / Hạn dùng</th>
                        <th className="border border-black py-1 px-1.5 text-left">Hồ sơ bệnh án sử dụng (BN / Buồng)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">1</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Morphin sulfat 10mg/1ml</td>
                        <td className="border border-black py-1 px-1 text-center">Thuốc tiêm</td>
                        <td className="border border-black py-1 px-1 text-center">Ống</td>
                        <td className="border border-black py-1 px-1 text-center font-bold">02</td>
                        <td className="border border-black py-1 px-1.5 text-center font-mono">LOT-MS24-01 (10/2026)</td>
                        <td className="border border-black py-1 px-1.5">Võ Minh Trí (BN-8820) - Cấp cứu 3</td>
                      </tr>
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">2</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Fentanyl 0.1mg/2ml</td>
                        <td className="border border-black py-1 px-1 text-center">Thuốc tiêm</td>
                        <td className="border border-black py-1 px-1 text-center">Ống</td>
                        <td className="border border-black py-1 px-1 text-center font-bold">01</td>
                        <td className="border border-black py-1 px-1.5 text-center font-mono">LOT-FT24-08 (12/2026)</td>
                        <td className="border border-black py-1 px-1.5">Nguyễn Hải Đăng (BN-8791) - Mổ sọ não</td>
                      </tr>
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">3</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Diazepam 10mg/2ml (Seduxen)</td>
                        <td className="border border-black py-1 px-1 text-center">Thuốc tiêm</td>
                        <td className="border border-black py-1 px-1 text-center">Ống</td>
                        <td className="border border-black py-1 px-1 text-center font-bold">02</td>
                        <td className="border border-black py-1 px-1.5 text-center font-mono">LOT-DZ24-11 (08/2026)</td>
                        <td className="border border-black py-1 px-1.5">Lê Hoàng Nam (BN-8830) - Cấp cứu TK</td>
                      </tr>
                      <tr className="font-bold">
                        <td colSpan={4} className="border border-black py-1 px-1 text-right uppercase">Tổng cộng:</td>
                        <td className="border border-black py-1 px-1 text-center font-bold">05 ống</td>
                        <td colSpan={2} className="border border-black py-1 px-1.5 italic font-normal text-slate-700">
                          (Viết bằng chữ: Không năm ống vỏ thủy tinh nguyên vẹn)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Method & Conclusion */}
                <div className="text-[11px] space-y-0.5 text-justify text-slate-800">
                  <p>
                    - <strong>Quy trình &amp; Phương pháp tiêu hủy:</strong> Đập vỡ vụn nát hoàn toàn vỏ thủy tinh trong khay inox chuyên dụng dưới sự giám sát trực tiếp của 100% thành viên Hội đồng; ngâm dung dịch Chloramin B 0.5% trong 30 phút; đóng gói niêm phong vào thùng rác chuyên dụng màu vàng đựng chất thải y tế sắc nhọn nguy hại bàn giao xử lý theo quy định của Bộ Y tế.
                  </p>
                  <p>
                    - <strong>Lưu trữ hồ sơ:</strong> Biên bản này cùng cuống phiếu xuất được lưu trữ tối thiểu <strong>02 năm</strong> kể từ ngày tiêu hủy theo quy định. Lập thành 03 bản lưu Kho Dược, Khoa Cấp Cứu A9 và Báo cáo Ban Giám Đốc.
                  </p>
                </div>

                {/* Signatures 3 Columns */}
                <div className="grid grid-cols-3 text-center text-[11px] pt-2 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">THƯ KÝ HỘI ĐỒNG</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">ĐD. Lê Thị Thu</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">ỦY VIÊN HỘI ĐỒNG</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">CHỦ TỊCH HỘI ĐỒNG</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">DS. CKI Nguyễn Văn Hoàng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 2: MẪU SỐ 01/TT22 - PHIẾU DỰ TRÙ THUỐC, HÓA CHẤT, VẬT TƯ TIÊU HAO    */}
            {/* ========================================================================= */}
            {activeFormType === 'TT22_RESTOCK_PROPOSAL' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">KHOA CẤP CỨU A9</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Số phiếu: DTT-2026-088</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    PHIẾU DỰ TRÙ THUỐC, HÓA CHẤT, VẬT TƯ TIÊU HAO BỔ SUNG CƠ SỐ TỦ TRỰC
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Ban hành kèm theo Mẫu số 01 Thông tư số 22/2011/TT-BYT &amp; Thông tư số 23/2011/TT-BYT của Bộ Y tế)
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5 text-justify text-slate-900">
                  <p>- Kính gửi: <strong>Khoa Dược Bệnh Viện Đa Khoa</strong> | Khoa yêu cầu: <strong>Khoa Cấp Cứu A9 - Xe tiêm &amp; Tủ trực đêm</strong></p>
                  <p>- Căn cứ Quyết định 45/QĐ-BV về cơ số tủ trực cố định. Thực hiện lĩnh bù theo định mức an toàn.</p>
                </div>

                <table className="w-full border-collapse border border-black text-[10.5px] my-1">
                  <thead>
                    <tr className="font-bold text-center">
                      <th className="border border-black py-1 px-1 w-7">STT</th>
                      <th className="border border-black py-1 px-1.5 text-left">Tên thuốc, nồng độ, hàm lượng, quy cách</th>
                      <th className="border border-black py-1 px-1 w-12">ĐVT</th>
                      <th className="border border-black py-1 px-1 w-16">Cơ số duyệt</th>
                      <th className="border border-black py-1 px-1 w-16">Tồn hiện tại</th>
                      <th className="border border-black py-1 px-1 w-20">Số xin lĩnh</th>
                      <th className="border border-black py-1 px-1 w-20">Thực cấp</th>
                      <th className="border border-black py-1 px-1.5 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockBatches.length > 0 ? (
                      lowStockBatches.slice(0, 5).map((b, idx) => {
                        const needed = Math.max(0, b.maxThreshold - b.currentStock);
                        return (
                          <tr key={b.id}>
                            <td className="border border-black py-1 px-1 text-center">{idx + 1}</td>
                            <td className="border border-black py-1 px-1.5 font-bold">{b.itemName}</td>
                            <td className="border border-black py-1 px-1 text-center">{b.unit}</td>
                            <td className="border border-black py-1 px-1 text-center font-mono font-bold">{b.maxThreshold}</td>
                            <td className="border border-black py-1 px-1 text-center font-mono font-bold">{b.currentStock}</td>
                            <td className="border border-black py-1 px-1 text-center font-mono font-bold">{needed}</td>
                            <td className="border border-black py-1 px-1 text-center font-mono font-bold">{needed}</td>
                            <td className="border border-black py-1 px-1.5 text-[10px] text-slate-700">Bù cơ số TT 22</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">1</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Adrenalin 1mg/1ml (Hộp chống sốc phản vệ)</td>
                        <td className="border border-black py-1 px-1 text-center">Ống</td>
                        <td className="border border-black py-1 px-1 text-center font-mono">10</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">2</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">8</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">8</td>
                        <td className="border border-black py-1 px-1.5 text-[10px]">Bù cơ số cấp bách</td>
                      </tr>
                    )}
                    <tr className="font-bold">
                      <td colSpan={5} className="border border-black py-1 px-1 text-right uppercase">
                        Tổng số khoản dự trù:
                      </td>
                      <td colSpan={3} className="border border-black py-1 px-1.5 text-left font-bold">
                        {Math.max(Math.min(lowStockBatches.length, 5), 1)} khoản (Đã đối soát 100% định mức cơ số an toàn)
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[10.5px] italic text-slate-700 pt-0.5">
                  * Trách nhiệm: Kho Dược căn cứ phiếu dự trù này thực hiện xuất kho theo chuẩn FEFO và bàn giao trực tiếp tại cửa sổ cấp phát Kho Dược.
                </div>

                {/* Signatures 4 Columns */}
                <div className="grid grid-cols-4 text-center text-[10.5px] pt-2 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10px]">NGƯỜI LẬP DỰ TRÙ</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">ĐD. Lê Thị Thu</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">TRƯỞNG KHOA LÂM SÀNG</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">TRƯỞNG KHOA DƯỢC</div>
                    <div className="italic text-[9px] text-slate-500">(Ký duyệt xuất kho)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">DS. CKI Nguyễn Văn Hoàng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">NGƯỜI CẤP PHÁT</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">DS. Phạm Minh Khoa</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 3: MẪU 01/TSC-BBGN - BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG       */}
            {/* ========================================================================= */}
            {activeFormType === 'TSC_HANDOVER_TRANSFER' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">PHÒNG VẬT TƯ - TBYT</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Mẫu số: 01/TSC-BBGN</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG (ĐIỀU CHUYỂN TBYT)
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Ban hành kèm theo Nghị định số 151/2017/NĐ-CP &amp; Nghị định số 114/2024/NĐ-CP của Chính phủ)
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5 text-justify text-slate-900">
                  <p>- Căn cứ Luật Quản lý, sử dụng tài sản công số 15/2017/QH14; Nghị định 151/2017/NĐ-CP &amp; NĐ 114/2024/NĐ-CP;</p>
                  <p>- Căn cứ Quyết định điều chuyển tài sản công số 88/QĐ-BVĐK của Giám đốc Bệnh viện;</p>
                  <p>- Hôm nay, ngày {day} tháng {month} năm {year}, các bên tiến hành bàn giao và tiếp nhận tài sản công gồm có:</p>
                  <div className="pl-3 space-y-0.5 text-[10.5px]">
                    <p><strong>A. BÊN GIAO:</strong> {currentAsset?.registeredDepartment || 'Khoa Cấp Cứu A9'} - Đại diện: BS. CKII Trần Văn Hùng (Trưởng khoa)</p>
                    <p><strong>B. BÊN NHẬN:</strong> {currentAsset?.actualDepartment || 'Khoa Phẫu Thuật Gây Mê Hồi Sức'} - Đại diện: BS. Vũ Hải Long (Phụ trách phòng mổ)</p>
                    <p><strong>C. ĐƠN VỊ GIÁM SÁT KỸ THUẬT:</strong> Phòng Vật tư - TBYT (KS. Đặng Văn Nam) &amp; Phòng Tài chính - Kế toán.</p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-[10.5px] my-1.5">
                  <thead>
                    <tr className="font-bold text-center">
                      <th className="border border-black py-1 px-1 w-7">STT</th>
                      <th className="border border-black py-1 px-1.5 text-left">Tên trang thiết bị y tế</th>
                      <th className="border border-black py-1 px-1 w-28">Số Serial / Model</th>
                      <th className="border border-black py-1 px-1 w-16">Năm SD</th>
                      <th className="border border-black py-1 px-1 w-24">Nguyên giá (VNĐ)</th>
                      <th className="border border-black py-1 px-1.5 text-left">Tình trạng kỹ thuật khi giao</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">1</td>
                      <td className="border border-black py-1 px-1.5 font-bold">{currentAsset?.deviceName || 'Máy thở Puritan Bennett 840 (PB840)'}</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">{currentAsset?.serialNumber || 'PB840-VN-2021-998'}</td>
                      <td className="border border-black py-1 px-1 text-center">2021</td>
                      <td className="border border-black py-1 px-1 text-right font-mono">1.250.000.000</td>
                      <td className="border border-black py-1 px-1.5 text-[10px]">Hoạt động tốt, phụ kiện thở đầy đủ, tem kiểm định còn hạn</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">2</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Máy sốc tim Zoll R Series ALS</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">ZOLL-R-8831</td>
                      <td className="border border-black py-1 px-1 text-center">2020</td>
                      <td className="border border-black py-1 px-1 text-right font-mono">450.000.000</td>
                      <td className="border border-black py-1 px-1.5 text-[10px]">Bản cực nhạy, pin tích điện &gt; 2.5 giờ</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[11px] space-y-0.5 text-justify pt-0.5">
                  <p>
                    - <strong>Hồ sơ kèm theo:</strong> 01 bộ Sổ lý lịch máy, Sách HDSD tiếng Việt, Giấy chứng nhận kiểm định an toàn điện còn hiệu lực.
                  </p>
                  <p>
                    - <strong>Trách nhiệm:</strong> Bên nhận có trách nhiệm quản lý, theo dõi sử dụng đúng quy trình và báo Phòng Tài chính - Kế toán ghi tăng/giảm tài sản cố định theo quy định hiện hành.
                  </p>
                </div>

                <div className="grid grid-cols-3 text-center text-[10.5px] pt-2 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">ĐẠI DIỆN BÊN GIAO</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">KỸ SƯ GIÁM SÁT KỸ THUẬT</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">ĐẠI DIỆN BÊN NHẬN</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">BS. Vũ Hải Long</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 4: PHIẾU XUẤT MƯỢN KHẨN CẤP THUỐC, VẬT TƯ TỦ TRỰC (KẸP BỆNH ÁN)       */}
            {/* ========================================================================= */}
            {activeFormType === 'EMERGENCY_BORROW_TICKET' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">KHOA CẤP CỨU A9</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Số phiếu: {currentDebt?.code || 'PN-2026-089'}</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">
                      Hà Nội, hồi {currentDebt?.borrowTime || '01:40'}, ngày {day} tháng {month} năm {year}
                    </div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    PHIẾU XUẤT MƯỢN KHẨN CẤP THUỐC, VẬT TƯ Y TẾ TỦ TRỰC
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Chứng từ pháp lý kẹp Hồ sơ bệnh án - Căn cứ Điều 10 Thông tư số 22/2011/TT-BYT &amp; Thông tư số 31/2021/TT-BYT)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] p-2 border border-black">
                  <div><strong>Họ và tên người bệnh:</strong> <span className="uppercase font-bold">{currentDebt?.patientName || 'Võ Minh Trí (BN-8820)'}</span></div>
                  <div><strong>Mã bệnh án (PID):</strong> <span className="font-mono font-bold">BA-2026-CC088</span></div>
                  <div><strong>Vị trí buồng / giường:</strong> {currentDebt?.patientRoom || 'Buồng cấp cứu 3 - Giường 02'}</div>
                  <div><strong>Thời điểm xuất rút:</strong> {currentDebt?.borrowTime} - {currentDebt?.borrowDate}</div>
                  <div><strong>Bác sĩ chỉ định:</strong> BS. CKII Trần Văn Hùng</div>
                  <div><strong>Điều dưỡng xuất tủ:</strong> {currentDebt?.borrowerName || 'ĐD. Lê Thị Thu'}</div>
                  <div className="col-span-2 pt-0.5 border-t border-black/40">
                    <strong>Chỉ định lâm sàng:</strong> {currentDebt?.note || 'Cấp cứu sốc chấn thương / giảm đau tiền phẫu khẩn cấp ca trực đêm'}
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-[10.5px] my-1.5">
                  <thead>
                    <tr className="font-bold text-center">
                      <th className="border border-black py-1 px-1 w-8">STT</th>
                      <th className="border border-black py-1 px-1.5 text-left">Tên thuốc, hàm lượng, vật tư y tế</th>
                      <th className="border border-black py-1 px-1 w-20">Phân loại</th>
                      <th className="border border-black py-1 px-1 w-16">Số lượng</th>
                      <th className="border border-black py-1 px-1 w-24">Đường dùng</th>
                      <th className="border border-black py-1 px-1 w-24">Thu hồi vỏ ống</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">1</td>
                      <td className="border border-black py-1 px-1.5 font-bold">{currentDebt?.itemName}</td>
                      <td className="border border-black py-1 px-1 text-center">{currentDebt?.itemType}</td>
                      <td className="border border-black py-1 px-1 text-center font-bold font-mono">{currentDebt?.quantity}</td>
                      <td className="border border-black py-1 px-1 text-center">Tiêm tĩnh mạch chậm</td>
                      <td className="border border-black py-1 px-1 text-center font-medium">
                        {currentDebt?.ampouleReturned ? 'Đã thu hồi vỏ (TT 20)' : 'Chưa thu hồi vỏ'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[10.5px] italic text-slate-800 pt-0.5">
                  * Trách nhiệm: Bác sĩ chỉ định có trách nhiệm kê đơn thuốc hoàn trả cơ số tủ trực trong ca trực hoặc trước 07h30 sáng để Điều dưỡng trưởng ca tổng hợp lĩnh bù tại Kho Dược theo Điều 10 Thông tư 22/2011/TT-BYT.
                </div>

                <div className="grid grid-cols-2 text-center text-[11px] pt-3 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">ĐIỀU DƯỠNG XUẤT THUỐC</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">{currentDebt?.borrowerName || 'ĐD. Lê Thị Thu'}</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">BÁC SĨ CHỈ ĐỊNH CẤP CỨU</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 5: BIÊN BẢN KIỂM ĐỊNH AN TOÀN ĐIỆN VÀ THỬ TẢI LÂM SÀNG TBYT (NĐ 98)   */}
            {/* ========================================================================= */}
            {activeFormType === 'EQUIPMENT_HANDOVER_INSPECT' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">PHÒNG VẬT TƯ - TBYT</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Số: 98/BB-KTĐ/2026</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    BIÊN BẢN KIỂM ĐỊNH AN TOÀN ĐIỆN VÀ THỬ TẢI LÂM SÀNG TRANG THIẾT BỊ Y TẾ
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Căn cứ Điều 34 Nghị định số 98/2021/NĐ-CP &amp; Tiêu chuẩn Quốc gia TCVN 7303-1:2009 / IEC 60601-1)
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5 text-justify text-slate-900">
                  <p>- Thiết bị kiểm định: <strong>{currentTicket?.deviceName || 'Máy thở Puritan Bennett 840 (PB840)'}</strong> - Model: <strong>{currentTicket?.deviceModel || 'PB840 Ventilator'}</strong></p>
                  <p>- Số Serial: <span className="font-mono font-bold">{currentTicket?.serialNumber || 'PB840-VN-2021-998'}</span> | Phân loại mức độ rủi ro: <strong>Loại {currentTicket?.riskClass || 'D'} (Can thiệp hô hấp sống còn)</strong></p>
                  <p>- Vị trí khoa phòng: <strong>{currentTicket?.location || 'Phòng Mổ 2 - Tầng 3 (Khu Phẫu Thuật)'}</strong> | Kỹ sư thực hiện: <strong>KS. Đặng Văn Nam (Phòng TBYT)</strong></p>
                </div>

                <table className="w-full border-collapse border border-black text-[10.5px] my-1">
                  <thead>
                    <tr className="font-bold text-center">
                      <th className="border border-black py-1 px-1 w-7">STT</th>
                      <th className="border border-black py-1 px-1.5 text-left">Hạng mục an toàn điện theo IEC 60601-1</th>
                      <th className="border border-black py-1 px-1 w-24">Tiêu chuẩn cho phép</th>
                      <th className="border border-black py-1 px-1 w-20">Kết quả đo</th>
                      <th className="border border-black py-1 px-1 w-16">Kết luận</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">1</td>
                      <td className="border border-black py-1 px-1.5">Điện trở nối đất bảo vệ (Protective Earth)</td>
                      <td className="border border-black py-1 px-1 text-center">&le; 0.20 &Omega;</td>
                      <td className="border border-black py-1 px-1 text-center font-mono font-bold">0.08 &Omega;</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">2</td>
                      <td className="border border-black py-1 px-1.5">Dòng rò tiếp đất (Earth Leakage Current)</td>
                      <td className="border border-black py-1 px-1 text-center">&le; 500 &mu;A</td>
                      <td className="border border-black py-1 px-1 text-center font-mono font-bold">115 &mu;A</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">3</td>
                      <td className="border border-black py-1 px-1.5">Dòng rò qua vỏ thiết bị (Enclosure Leakage)</td>
                      <td className="border border-black py-1 px-1 text-center">&le; 100 &mu;A</td>
                      <td className="border border-black py-1 px-1 text-center font-mono font-bold">24 &mu;A</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">4</td>
                      <td className="border border-black py-1 px-1.5">Dòng rò bệnh nhân bộ phận CF (Patient Leakage)</td>
                      <td className="border border-black py-1 px-1 text-center">&le; 10 &mu;A</td>
                      <td className="border border-black py-1 px-1 text-center font-mono font-bold">2.1 &mu;A</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">5</td>
                      <td className="border border-black py-1 px-1.5">Thử tải phổi giả 120 phút (Test Lung Compliance)</td>
                      <td className="border border-black py-1 px-1 text-center">Sai số Ppeak &lt; 5%</td>
                      <td className="border border-black py-1 px-1 text-center font-mono font-bold">Sai số 1.8%</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">6</td>
                      <td className="border border-black py-1 px-1.5">Thử nghiệm ngắt nguồn 220V chạy ắc quy dự phòng</td>
                      <td className="border border-black py-1 px-1 text-center">Tự ngắt, pin &gt; 120p</td>
                      <td className="border border-black py-1 px-1 text-center font-mono font-bold">160 phút</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">ĐẠT</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[11px] font-bold text-slate-900 pt-0.5">
                  Kết luận &amp; Cấp tem: Đạt 100% tiêu chuẩn an toàn điện &amp; thông khí lâm sàng. Đủ điều kiện đưa vào phục vụ điều trị. Cấp tem kiểm định số: KD-2026-PB840, hiệu lực: <strong>12 tháng</strong> ({day}/{month}/2027).
                </div>

                <div className="grid grid-cols-2 text-center text-[11px] pt-3 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">KỸ SƯ KIỂM ĐỊNH TBYT</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">ĐIỀU DƯỠNG TRƯỞNG TIẾP NHẬN</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">ĐD. Lê Thị Thu</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 6: MẪU 05-TSC - BIÊN BẢN KIỂM KÊ TÀI SẢN CỐ ĐỊNH & TRANG THIẾT BỊ Y TẾ  */}
            {/* ========================================================================= */}
            {activeFormType === 'TSC_ANNUAL_AUDIT' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">HỘI ĐỒNG KIỂM KÊ TÀI SẢN</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Mẫu số: 05-TSC</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    BIÊN BẢN KIỂM KÊ TÀI SẢN CỐ ĐỊNH VÀ TRANG THIẾT BỊ Y TẾ
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Ban hành kèm theo Mẫu số 05-TSC Thông tư số 23/2023/TT-BTC &amp; Nghị định số 151/2017/NĐ-CP của Chính phủ)
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5 text-justify text-slate-900">
                  <p>- Căn cứ Quyết định 12/QĐ-BVĐK của Giám đốc Bệnh viện về việc thành lập Hội đồng kiểm kê tài sản định kỳ;</p>
                  <p>- Thời điểm kiểm kê: 08 giờ 00 phút ngày {day} tháng {month} năm {year} tại Khoa Cấp Cứu A9;</p>
                  <p>- Hội đồng kiểm kê: <strong>DS. CKI Nguyễn Văn Hoàng</strong> (Trưởng ban), <strong>KS. Đặng Văn Nam</strong> (TBYT), <strong>BS. CKII Trần Văn Hùng</strong> (Trưởng khoa), <strong>CN. Phạm Thu Thảo</strong> (Kế toán).</p>
                </div>

                <table className="w-full border-collapse border border-black text-[10.5px] my-1.5">
                  <thead>
                    <tr className="font-bold text-center">
                      <th className="border border-black py-1 px-1 w-7">STT</th>
                      <th className="border border-black py-1 px-1.5 text-left">Tên tài sản / Thiết bị y tế</th>
                      <th className="border border-black py-1 px-1 w-20">Mã tài sản</th>
                      <th className="border border-black py-1 px-1 w-24">Nơi bố trí sổ sách</th>
                      <th className="border border-black py-1 px-1 w-24">Vị trí thực tế</th>
                      <th className="border border-black py-1 px-1 w-20">Tình trạng</th>
                      <th className="border border-black py-1 px-1.5 text-left">Kiến nghị xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.slice(0, 5).map((a, idx) => (
                      <tr key={a.id}>
                        <td className="border border-black py-1 px-1 text-center">{idx + 1}</td>
                        <td className="border border-black py-1 px-1.5 font-bold">{a.deviceName}</td>
                        <td className="border border-black py-1 px-1 text-center font-mono">{a.code}</td>
                        <td className="border border-black py-1 px-1 text-center">{a.registeredDepartment}</td>
                        <td className="border border-black py-1 px-1 text-center font-medium">
                          {a.actualDepartment}
                        </td>
                        <td className="border border-black py-1 px-1 text-center">
                          {a.condition === 'operational' ? 'Hoạt động tốt' : a.pendingLiquidation ? 'Chờ thanh lý' : 'Cần bảo trì'}
                        </td>
                        <td className="border border-black py-1 px-1.5 text-[10px]">
                          {a.isMisallocated ? 'Lập Mẫu 01/TSC điều chuyển' : a.pendingLiquidation ? 'Đề xuất thanh lý tài sản' : 'Tiếp tục sử dụng'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-[11px] space-y-0.5 text-justify pt-0.5">
                  <p>
                    - <strong>Đánh giá chung:</strong> 100% trang thiết bị được kiểm kê, dán nhãn quản lý theo quy định. Hội đồng kiến nghị các khoa phòng tiếp tục theo dõi, bảo dưỡng định kỳ đúng quy trình.
                  </p>
                </div>

                <div className="grid grid-cols-4 text-center text-[10.5px] pt-2 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10px]">KỸ SƯ PHÒNG TBYT</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">KẾ TOÁN TÀI SẢN</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">CN. Phạm Thu Thảo</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">TRƯỞNG KHOA LÂM SÀNG</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">TRƯỞNG BAN KIỂM KÊ</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">TS.BS. Nguyễn Văn An</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 7: BIÊN BẢN XỬ LÝ SỰ CỐ QUÁ NHIỆT & THẨM ĐỊNH VẮC XIN BIỆT TRỮ (GSP) */}
            {/* ========================================================================= */}
            {activeFormType === 'COLD_CHAIN_INCIDENT_REPORT' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">SỞ Y TẾ THÀNH PHỐ HÀ NỘI</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[10.5px] font-bold text-black">KHOA DƯỢC - CHUỖI LẠNH GSP</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Số: 36/BB-SCL/2026</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    BIÊN BẢN XỬ LÝ SỰ CỐ QUÁ NHIỆT CHUỖI LẠNH &amp; THẨM ĐỊNH LÔ VẮC XIN BIỆT TRỮ
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Theo nguyên tắc Thực hành tốt bảo quản thuốc GSP - Thông tư số 36/2018/TT-BYT)
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5 text-justify text-slate-900">
                  <p>- Căn cứ Thông tư số 36/2018/TT-BYT về Thực hành tốt bảo quản thuốc (GSP) và quy định của Dự án Tiêm chủng mở rộng;</p>
                  <p>- Thiết bị theo dõi: <strong>Tủ lạnh Vắc xin B Medical Systems (TCW 3000AC)</strong> | Nhiệt độ đỉnh sự cố ghi nhận: <strong>{coldChainState?.currentTemp ?? 11.0}°C</strong> do mất điện lưới cục bộ, kíp trực đã kích hoạt máy phát và thực hiện niêm phong biệt trữ.</p>
                </div>

                <table className="w-full border-collapse border border-black text-[10.5px] my-1.5">
                  <thead>
                    <tr className="font-bold text-center">
                      <th className="border border-black py-1 px-1 w-7">STT</th>
                      <th className="border border-black py-1 px-1.5 text-left">Tên Vắc xin / Sinh phẩm y tế</th>
                      <th className="border border-black py-1 px-1 w-24">Số lô / Hạn dùng</th>
                      <th className="border border-black py-1 px-1 w-16">Số lượng</th>
                      <th className="border border-black py-1 px-1 w-24">Chỉ thị VVM</th>
                      <th className="border border-black py-1 px-1 w-24">Shake Test</th>
                      <th className="border border-black py-1 px-1.5 text-left">Kết luận thẩm định</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">1</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Vắc xin Uốn ván hấp phụ (VAT 0.5ml)</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">LOT-VAT24 (09/2026)</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">200 liều</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">Giai đoạn 1 (An toàn)</td>
                      <td className="border border-black py-1 px-1 text-center">Âm tính</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Đủ điều kiện giải phóng</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">2</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Vắc xin Viêm gan B (Engerix-B)</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">LOT-HBV24 (11/2026)</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">150 liều</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">Giai đoạn 1 (An toàn)</td>
                      <td className="border border-black py-1 px-1 text-center">Âm tính</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Đủ điều kiện giải phóng</td>
                    </tr>
                    <tr>
                      <td className="border border-black py-1 px-1 text-center">3</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Huyết thanh kháng uốn ván (SAT 1500)</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">LOT-SAT24 (08/2026)</td>
                      <td className="border border-black py-1 px-1 text-center font-mono">100 lọ</td>
                      <td className="border border-black py-1 px-1 text-center font-bold">Giai đoạn 1 (An toàn)</td>
                      <td className="border border-black py-1 px-1 text-center">Đạt chuẩn</td>
                      <td className="border border-black py-1 px-1.5 font-bold">Đủ điều kiện giải phóng</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[11px] space-y-0.5 text-justify pt-0.5 font-medium">
                  <p>
                    - <strong>Kết luận của Hội đồng GSP:</strong> Nhiệt độ động học trung bình (MKT) duy trì an toàn sinh học. Toàn bộ 450 liều vắc xin không bị biến tính. Cho phép mở niêm phong biệt trữ và giải phóng vào sử dụng theo SOP.
                  </p>
                </div>

                <div className="grid grid-cols-3 text-center text-[10.5px] pt-2 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">CÁN BỘ CHUỖI LẠNH</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">DS. Nguyễn Bích Ngọc</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">PHỤ TRÁCH TIÊM CHỦNG</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10.5px]">TRƯỞNG KHOA DƯỢC</div>
                    <div className="italic text-[9.5px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[11px]">DS. CKI Nguyễn Văn Hoàng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 8: SỔ GIAO BAN VÀ BÀN GIAO CA TRỰC ĐIỀU DƯỠNG LÂM SÀNG                 */}
            {/* ========================================================================= */}
            {activeFormType === 'SHIFT_HANDOVER_RECORD' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-1.5 mb-1.5">
                  <div className="col-span-5 text-center">
                    <div className="text-[11px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11.5px] uppercase font-bold text-black">KHOA CẤP CỨU A9</div>
                    <div className="w-16 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] font-normal text-black italic">Sổ trực: GB-2026/01</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[11.5px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 mx-auto border-b border-black my-0.5"></div>
                    <div className="text-[11px] italic text-black">Hà Nội, 07 giờ 00 ngày {day}/{month}/{year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-[13.5px] font-bold uppercase tracking-wide">
                    BIÊN BẢN BÀN GIAO CA TRỰC ĐIỀU DƯỠNG LÂM SÀNG
                  </h1>
                  <p className="italic text-[11px] text-slate-800">
                    (Ban hành theo Quy chế Bệnh viện - Quyết định 1895/1997/QĐ-BYT &amp; Thông tư số 31/2021/TT-BYT của Bộ Y tế)
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5">
                  <p>- Giao ca: <strong>07 giờ 00 ngày {day}/{month}/{year}</strong> | Ca giao: <strong>Đêm (19h-07h) - ĐD. Lê Thị Thu</strong> | Ca nhận: <strong>Ngày (07h-13h30) - ĐD. Hoàng Thị Mai</strong></p>
                  <p>- Bác sĩ Trưởng ca trực kiểm duyệt: <strong>BS. CKII Trần Văn Hùng</strong></p>
                </div>

                {/* Section 1: Clinical patients */}
                <div className="pt-0.5">
                  <h3 className="font-bold text-[11px] text-black uppercase mb-0.5">
                    1. Tình hình người bệnh trong ca trực:
                  </h3>
                  <div className="p-1.5 border border-black text-[10.5px] space-y-0.5">
                    <p>• Tổng người bệnh hiện diện: <strong>24 người bệnh</strong> (Mới vào: 08; Mổ cấp cứu: 02; Tử vong/Nặng xin về: 00).</p>
                    <p>• Người bệnh nặng thở máy xâm lấn: <strong>03 người bệnh</strong> (Buồng 1-G01; Buồng 2-G04; Buồng 3-G02).</p>
                    <p>• Người bệnh truyền thuốc vận mạch (Noradrenalin/Adrenalin): <strong>02 người bệnh</strong> huyết áp kiểm soát ổn.</p>
                  </div>
                </div>

                {/* Section 2: Narcotics & Emergency Drugs */}
                <div className="pt-0.5">
                  <h3 className="font-bold text-[11px] text-black uppercase mb-0.5">
                    2. Bàn giao cơ số thuốc tủ trực &amp; Thuốc kiểm soát đặc biệt:
                  </h3>
                  <table className="w-full border-collapse border border-black text-[10.5px]">
                    <thead>
                      <tr className="font-bold text-center">
                        <th className="border border-black py-1 px-1 w-7">STT</th>
                        <th className="border border-black py-1 px-1.5 text-left">Tên thuốc / Hàm lượng</th>
                        <th className="border border-black py-1 px-1 w-14">Cơ số</th>
                        <th className="border border-black py-1 px-1 w-14">Tồn TT</th>
                        <th className="border border-black py-1 px-1 w-20">Vỏ thu hồi</th>
                        <th className="border border-black py-1 px-1.5 text-left">Phiếu xuất mượn / Bác sĩ chỉ định</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">1</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Morphin sulfat 10mg/1ml</td>
                        <td className="border border-black py-1 px-1 text-center font-mono">10</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">08</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">02 vỏ</td>
                        <td className="border border-black py-1 px-1.5">Phiếu PN-2026-089 (BS. Trần Văn Hùng)</td>
                      </tr>
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">2</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Fentanyl 0.1mg/2ml</td>
                        <td className="border border-black py-1 px-1 text-center font-mono">05</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">04</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">01 vỏ</td>
                        <td className="border border-black py-1 px-1.5">Phiếu PN-2026-087 (BS. Nguyễn Minh Tuấn)</td>
                      </tr>
                      <tr>
                        <td className="border border-black py-1 px-1 text-center">3</td>
                        <td className="border border-black py-1 px-1.5 font-bold">Adrenalin 1mg/1ml</td>
                        <td className="border border-black py-1 px-1 text-center font-mono">10</td>
                        <td className="border border-black py-1 px-1 text-center font-mono font-bold">07</td>
                        <td className="border border-black py-1 px-1 text-center">-</td>
                        <td className="border border-black py-1 px-1.5">Phiếu PN-2026-085 (BS. Trần Văn Hùng)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 3: Equipment Status */}
                <div className="pt-0.5">
                  <h3 className="font-bold text-[11px] text-black uppercase mb-0.5">
                    3. Bàn giao trang thiết bị y tế cấp cứu sống còn:
                  </h3>
                  <div className="p-1.5 border border-black text-[10.5px] space-y-0.5">
                    <p>• 02 Máy thở Puritan Bennett 840 (PB840) hoạt động ổn định, áp lực oxy trung tâm 4.2 bar.</p>
                    <p>• 01 Máy sốc tim Zoll R xả chuẩn 200J, pin sạc 100% | 04 Bơm tiêm điện &amp; 02 Máy truyền dịch chuẩn tốc độ.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 text-center text-[10.5px] pt-1.5 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase text-[10px]">ĐIỀU DƯỠNG GIAO CA</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">ĐD. Lê Thị Thu</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">ĐIỀU DƯỠNG NHẬN CA</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">ĐD. Hoàng Thị Mai</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[10px]">BÁC SĨ TRƯỞNG CA TRỰC</div>
                    <div className="italic text-[9px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-[10.5px]">BS. CKII Trần Văn Hùng</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Info Bar */}
        <div className="px-5 py-2 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-600"></span>
            <span>Hệ thống biểu mẫu hành chính y tế: Hợp chuẩn thể thức Nghị định 30/2020/NĐ-CP &amp; các Thông tư chuyên ngành Bộ Y tế.</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Khổ giấy: A4 (210 × 297 mm) · Tỉ lệ co giãn chuẩn 100%
          </div>
        </div>

      </div>
    </div>
  );
};
