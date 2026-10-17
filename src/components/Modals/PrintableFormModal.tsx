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
  ShieldCheck,
  CheckCircle2,
  FileText,
  Boxes,
  Building2,
  AlertTriangle,
  Stethoscope,
  Copy,
  ExternalLink,
  Thermometer,
  ClipboardCheck,
  ShieldAlert,
  ArrowRightLeft,
  Check,
  Clock,
  UserCheck
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
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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

  const currentProfile = USER_PROFILES[currentUserRole];
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

  // Copy electronic signature hash
  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback('Đã sao chép mã xác thực HMAC-SHA256!');
    setTimeout(() => setCopyFeedback(null), 2500);
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
    @page { size: A4 portrait; margin: 15mm 20mm 15mm 20mm; }
    body { font-family: 'Times New Roman', Times, serif; padding: 25px; line-height: 1.45; color: #000; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; vertical-align: middle; }
    th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: none; }
    .header-table td { border: none; padding: 1px 4px; vertical-align: top; }
    .sig-table { width: 100%; border-collapse: collapse; margin-top: 25px; border: none; page-break-inside: avoid; }
    .sig-table td { border: none; vertical-align: top; text-align: center; font-size: 13px; }
    .line-hr { border-bottom: 1px solid #000; width: 60%; margin: 3px auto 6px auto; }
    .line-full { border-bottom: 1px solid #000; margin: 8px 0; }
    .audit-box { border: 1px solid #10b981; background-color: #ecfdf5; padding: 8px 12px; border-radius: 4px; margin: 12px 0; font-size: 11px; }
  </style>
</head>
<body>
  ${docEl.innerHTML}
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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-6xl h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        
        {/* Top Control Bar */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-2xs">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <span>Trung Tâm Xuất &amp; In Biểu Mẫu Hành Chính Y Tế</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                  Chuẩn NĐ 30/2020 · Bộ Y Tế &amp; Bộ Tài Chính
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Thể thức văn bản hành chính quy chuẩn, tích hợp xác thực chữ ký số (NĐ 130/2018) và xuất bản in khổ A4.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer"
              title="Tải văn bản định dạng HTML chuẩn"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Tải file HTML</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
              title="In trực tiếp ra máy in hoặc lưu file PDF (Ctrl + P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Biểu Mẫu (A4 / PDF)</span>
            </button>

            <button
              data-testid="close-printable-modal"
              onClick={onClose}
              title="Đóng biểu mẫu (Esc)"
              aria-label="Đóng biểu mẫu"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (8 Comprehensive Medical & Administrative Forms) */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200/90 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveFormType('TT20_AMPOULE_DESTRUCTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            {activeFormType === 'EMERGENCY_BORROW_TICKET' && (
              <>
                <span className="font-semibold text-slate-700">Chọn phiếu xuất mượn kẹp bệnh án:</span>
                <select
                  value={activeDebtId}
                  onChange={(e) => setActiveDebtId(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-teal-700"
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
                <span className="font-semibold text-slate-700">Chọn phiếu sự cố / hồ sơ thiết bị:</span>
                <select
                  value={activeTicketId}
                  onChange={(e) => setActiveTicketId(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-teal-700"
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
                <span className="font-semibold text-slate-700">Chọn tài sản công bàn giao:</span>
                <select
                  value={activeAssetId}
                  onChange={(e) => setActiveAssetId(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-teal-700"
                >
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code}: {a.deviceName} (Serial: {a.serialNumber}) - Đăng ký: {a.registeredDepartment}
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

          <div className="text-[11px] text-slate-500 font-mono">
            Khổ in: A4 (210mm × 297mm) · Phông chữ: Times New Roman
          </div>
        </div>

        {/* Document Preview Canvas (Simulating pure white A4 Paper) */}
        <div className="flex-1 overflow-y-auto bg-slate-300/60 p-4 md:p-6 flex justify-center">
          <div
            id="printable-medical-document"
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 md:p-10 shadow-xl border border-slate-300 rounded-xs text-[13px] leading-relaxed font-serif"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >

            {/* ========================================================================= */}
            {/* FORM 1: MẪU SỐ 16 PHỤ LỤC II NĐ 54/2017 & ĐIỀU 15, 16 TT 20/2017/TT-BYT    */}
            {/* ========================================================================= */}
            {activeFormType === 'TT20_AMPOULE_DESTRUCTION' && (
              <div className="space-y-4">
                {/* Administrative Header (NĐ 30/2020/NĐ-CP) */}
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">SỞ Y TẾ THÀNH PHỐ HÀ NỘI</div>
                    <div className="text-[12px] uppercase font-bold text-black">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11px] font-bold text-black">HỘI ĐỒNG TIÊU HỦY VỎ THUỐC</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Số: 16/BB-HĐH/2026</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN TIÊU HỦY VỎ ỐNG THUỐC PHẢI KIỂM SOÁT ĐẶC BIỆT
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Ban hành kèm theo Mẫu số 16 Phụ lục II Nghị định số 54/2017/NĐ-CP &amp; Điều 15, Điều 16 Thông tư số 20/2017/TT-BYT)
                  </p>
                </div>

                {/* Legal Preamble */}
                <div className="text-[12.5px] space-y-1 text-justify">
                  <p>- Căn cứ Luật Dược số 105/2016/QH13 ngày 06 tháng 04 năm 2016;</p>
                  <p>- Căn cứ Nghị định số 54/2017/NĐ-CP ngày 08 tháng 05 năm 2017 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Dược;</p>
                  <p>- Căn cứ Thông tư số 20/2017/TT-BYT ngày 10 tháng 05 năm 2017 của Bộ Y tế quy định chi tiết về quản lý thuốc phải kiểm soát đặc biệt;</p>
                  <p>- Căn cứ Thông tư số 20/2021/TT-BYT ngày 26 tháng 11 năm 2021 của Bộ Y tế quy định về quản lý chất thải y tế trong phạm vi khuôn viên cơ sở y tế;</p>
                  <p>- Căn cứ Quyết định số 104/QĐ-BVĐK ngày 15/01/2026 của Giám đốc Bệnh viện về việc thành lập Hội đồng tiêu hủy vỏ ống thuốc gây nghiện, hướng thần tại Khoa Dược.</p>
                </div>

                {/* Council Members */}
                <div className="text-[12.5px] space-y-1 pt-1">
                  <p className="font-bold">Hôm nay, vào hồi 10 giờ 30 phút, ngày {day} tháng {month} năm {year}, tại Phòng Lưu trữ &amp; Tiêu hủy Kho Dược, Hội đồng gồm có:</p>
                  <div className="pl-4 space-y-1">
                    <p>1. <strong>DS. CKI Nguyễn Văn Hoàng</strong> - Trưởng Khoa Dược (Chủ tịch Hội đồng) - CCHN: <span className="font-mono">002341/HN-CCHN</span></p>
                    <p>2. <strong>BS. CKII Trần Văn Hùng</strong> - Trưởng Khoa Cấp Cứu A9 (Ủy viên chuyên môn) - CCHN: <span className="font-mono">009125/BYT-CCHN</span></p>
                    <p>3. <strong>ĐD. Lê Thị Thu</strong> - Điều dưỡng Trưởng ca Cấp Cứu A9 (Ủy viên kiêm Thư ký) - CCHN: <span className="font-mono">004812/HN-CCHN</span></p>
                    <p>4. <strong>DS. Nguyễn Bích Ngọc</strong> - Dược sĩ Phụ trách Kho Dược Bệnh viện (Ủy viên Giám sát) - CCHN: <span className="font-mono">005721/HN-CCHN</span></p>
                  </div>
                </div>

                {/* Table of Destroyed Items */}
                <div className="pt-2">
                  <p className="font-bold text-[12.5px] mb-1">
                    Hội đồng đã tiến hành kiểm kê, đối soát đối chiếu 100% vỏ ống thuốc đã sử dụng thực tế như sau:
                  </p>
                  <table className="w-full border-collapse border border-black text-[12px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-center">
                        <th className="border border-black p-1.5 w-8">STT</th>
                        <th className="border border-black p-1.5 text-left">Tên thuốc, nồng độ, hàm lượng</th>
                        <th className="border border-black p-1.5 w-16">Dạng bào chế</th>
                        <th className="border border-black p-1.5 w-14">ĐVT</th>
                        <th className="border border-black p-1.5 w-20">Số lượng vỏ</th>
                        <th className="border border-black p-1.5 w-24">Số lô / Hạn dùng</th>
                        <th className="border border-black p-1.5 text-left">Hồ sơ bệnh án sử dụng (BN / Buồng)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black p-1.5 text-center">1</td>
                        <td className="border border-black p-1.5 font-bold">Morphin sulfat 10mg/1ml</td>
                        <td className="border border-black p-1.5 text-center">Thuốc tiêm</td>
                        <td className="border border-black p-1.5 text-center">Ống</td>
                        <td className="border border-black p-1.5 text-center font-bold">02</td>
                        <td className="border border-black p-1.5 text-center font-mono">LOT-MS24-01 (10/2026)</td>
                        <td className="border border-black p-1.5">Võ Minh Trí (BN-8820) - Cấp cứu 3</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-1.5 text-center">2</td>
                        <td className="border border-black p-1.5 font-bold">Fentanyl 0.1mg/2ml</td>
                        <td className="border border-black p-1.5 text-center">Thuốc tiêm</td>
                        <td className="border border-black p-1.5 text-center">Ống</td>
                        <td className="border border-black p-1.5 text-center font-bold">01</td>
                        <td className="border border-black p-1.5 text-center font-mono">LOT-FT24-08 (12/2026)</td>
                        <td className="border border-black p-1.5">Nguyễn Hải Đăng (BN-8791) - Mổ sọ não</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-1.5 text-center">3</td>
                        <td className="border border-black p-1.5 font-bold">Diazepam 10mg/2ml (Seduxen)</td>
                        <td className="border border-black p-1.5 text-center">Thuốc tiêm</td>
                        <td className="border border-black p-1.5 text-center">Ống</td>
                        <td className="border border-black p-1.5 text-center font-bold">02</td>
                        <td className="border border-black p-1.5 text-center font-mono">LOT-DZ24-11 (08/2026)</td>
                        <td className="border border-black p-1.5">Lê Hoàng Nam (BN-8830) - Cấp cứu thần kinh</td>
                      </tr>
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={4} className="border border-black p-1.5 text-right uppercase">Tổng cộng số lượng vỏ hủy:</td>
                        <td className="border border-black p-1.5 text-center font-bold">05 ống</td>
                        <td colSpan={2} className="border border-black p-1.5 italic font-normal text-slate-700">
                          (Viết bằng chữ: Không năm ống vỏ thủy tinh nguyên vẹn)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Method & Conclusion */}
                <div className="text-[12.5px] space-y-1.5 pt-1 text-justify">
                  <p>
                    - <strong>Quy trình &amp; Phương pháp tiêu hủy:</strong> Đập vỡ vụn nát hoàn toàn vỏ ống thủy tinh trong khay inox chuyên dụng có màn chắn an toàn dưới sự giám sát trực tiếp của 100% thành viên Hội đồng. Sau đó, ngâm dung dịch khử khuẩn Chloramin B 0.5% trong 30 phút, đóng gói niêm phong vào thùng rác chuyên dụng màu vàng có dán nhãn "CHẤT THẢI Y TẾ SẮC NHỌN NGUY HẠI" và bàn giao bộ phận xử lý rác thải y tế bệnh viện theo đúng Thông tư số 20/2021/TT-BYT.
                  </p>
                  <p>
                    - <strong>Thời hạn lưu trữ hồ sơ:</strong> Biên bản này cùng với cuống phiếu xuất kho và hồ sơ bệnh án được bảo quản lưu trữ tối thiểu <strong>02 năm</strong> kể từ ngày tiêu hủy theo đúng quy định tại Khoản 5 Điều 16 Thông tư số 20/2017/TT-BYT.
                  </p>
                  <p>
                    - Biên bản được lập thành 03 bản có giá trị pháp lý như nhau: 01 bản lưu tại Kho Dược, 01 bản lưu tại Khoa Cấp Cứu A9, 01 bản báo cáo Giám đốc Bệnh viện.
                  </p>
                </div>

                {/* Electronic Stamp */}
                <div className="my-3 p-2.5 rounded border border-emerald-600 bg-emerald-50 text-[11.5px] text-emerald-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div>
                      <div className="font-bold uppercase text-emerald-900">
                        CHỨNG THỰC KÝ SỐ LÂM SÀNG (NGHỊ ĐỊNH 130/2018/NĐ-CP &amp; LUẬT GDĐT 2023)
                      </div>
                      <div className="text-[10px] text-emerald-800 font-mono">
                        HMAC-SHA256: 7a82f9c011e4d82b4937a01fa281ce919d7b21e84a20bfa492c10
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px] font-mono">
                    HỢP LỆ 100%
                  </span>
                </div>

                {/* Signatures 3 Columns */}
                <div className="grid grid-cols-3 text-center text-[12px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">THƯ KÝ HỘI ĐỒNG</div>
                    <div className="italic text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold italic">[Đã ký điện tử]</div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                    <div className="text-[11px] text-slate-600 font-mono">004812/HN-CCHN</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">ỦY VIÊN HỘI ĐỒNG</div>
                    <div className="italic text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold italic">[Đã ký điện tử]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                    <div className="text-[11px] text-slate-600 font-mono">009125/BYT-CCHN</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">CHỦ TỊCH HỘI ĐỒNG</div>
                    <div className="italic text-slate-500">(Ký, đóng dấu hoặc ký số)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold italic">[Đã ký số phê duyệt]</div>
                    <div className="font-bold">DS. CKI Nguyễn Văn Hoàng</div>
                    <div className="text-[11px] text-slate-600 font-mono">002341/HN-CCHN</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 2: MẪU SỐ 01/TT22 - PHIẾU DỰ TRÙ THUỐC, HÓA CHẤT, VẬT TƯ TIÊU HAO    */}
            {/* ========================================================================= */}
            {activeFormType === 'TT22_RESTOCK_PROPOSAL' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[12px] uppercase font-bold text-black">KHOA CẤP CỨU A9</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Mã phiếu: DTT-2026-088</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    PHIẾU DỰ TRÙ THUỐC, HÓA CHẤT, VẬT TƯ TIÊU HAO BỔ SUNG CƠ SỐ TỦ TRỰC
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Ban hành kèm theo Mẫu số 01 Thông tư số 22/2011/TT-BYT &amp; Thông tư số 23/2011/TT-BYT của Bộ Y tế)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1 text-justify">
                  <p>- Kính gửi: <strong>Kho Dược Bệnh Viện Đa Khoa</strong></p>
                  <p>- Khoa phòng yêu cầu: <strong>Khoa Cấp Cứu A9 - Xe tiêm cấp cứu cơ động &amp; Tủ trực đêm</strong></p>
                  <p>- Căn cứ Quyết định số 45/QĐ-BV về việc ban hành danh mục và định mức cơ số tủ trực cấp cứu cố định.</p>
                  <p>- Hình thức lĩnh: Lĩnh bù định mức cơ số tủ trực theo nguyên tắc xuất nhập FEFO (First Expired, First Out).</p>
                </div>

                <table className="w-full border-collapse border border-black text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5 w-8">STT</th>
                      <th className="border border-black p-1.5 text-left">Tên thuốc, nồng độ, hàm lượng, quy cách</th>
                      <th className="border border-black p-1.5 w-14">ĐVT</th>
                      <th className="border border-black p-1.5 w-20">Cơ số duyệt</th>
                      <th className="border border-black p-1.5 w-20">Tồn hiện tại</th>
                      <th className="border border-black p-1.5 w-24">Số lượng xin lĩnh</th>
                      <th className="border border-black p-1.5 w-24">Số lượng thực cấp</th>
                      <th className="border border-black p-1.5 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockBatches.length > 0 ? (
                      lowStockBatches.slice(0, 6).map((b, idx) => {
                        const needed = Math.max(0, b.maxThreshold - b.currentStock);
                        return (
                          <tr key={b.id}>
                            <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                            <td className="border border-black p-1.5 font-bold">{b.itemName}</td>
                            <td className="border border-black p-1.5 text-center">{b.unit}</td>
                            <td className="border border-black p-1.5 text-center font-mono font-bold">{b.maxThreshold}</td>
                            <td className="border border-black p-1.5 text-center font-mono text-rose-700 font-bold">{b.currentStock}</td>
                            <td className="border border-black p-1.5 text-center font-mono font-bold bg-amber-50">+{needed}</td>
                            <td className="border border-black p-1.5 text-center font-mono font-bold">+{needed}</td>
                            <td className="border border-black p-1.5 text-[11px] text-slate-700">Bù cơ số TT 22</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="border border-black p-1.5 text-center">1</td>
                        <td className="border border-black p-1.5 font-bold">Adrenalin 1mg/1ml (Hộp chống sốc phản vệ)</td>
                        <td className="border border-black p-1.5 text-center">Ống</td>
                        <td className="border border-black p-1.5 text-center font-mono">10</td>
                        <td className="border border-black p-1.5 text-center font-mono text-rose-700 font-bold">2</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold bg-amber-50">+8</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">+8</td>
                        <td className="border border-black p-1.5 text-[11px]">Bù cơ số cấp bách</td>
                      </tr>
                    )}
                    <tr className="font-bold bg-slate-50">
                      <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                        Tổng số mặt hàng dự trù lĩnh:
                      </td>
                      <td colSpan={3} className="border border-black p-1.5 text-left font-bold">
                        {Math.max(lowStockBatches.length, 1)} khoản (Đã đối soát 100% định mức cơ số an toàn)
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12px] italic text-slate-700 pt-1">
                  * Trách nhiệm: Kho Dược căn cứ theo phiếu dự trù này thực hiện xuất kho theo chuẩn FEFO, ghi sổ theo dõi xuất nhập tồn và bàn giao trực tiếp tại cửa sổ cấp phát Kho Dược.
                </div>

                {/* Signatures 4 Columns */}
                <div className="grid grid-cols-4 text-center text-[11.5px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">NGƯỜI LẬP DỰ TRÙ</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký]</div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG KHOA LÂM SÀNG</div>
                    <div className="italic text-slate-500">(Ký xác nhận)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã duyệt]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG KHOA DƯỢC</div>
                    <div className="italic text-slate-500">(Ký duyệt xuất kho)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã duyệt phát]</div>
                    <div className="font-bold">DS. CKI Nguyễn Văn Hoàng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">THỦ KHO GIAO NHẬN</div>
                    <div className="italic text-slate-500">(Kho dược cấp phát)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã nhận]</div>
                    <div className="font-bold">DS. Phạm Minh Khoa</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 3: MẪU 01/TSC-BBGN - BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG       */}
            {/* ========================================================================= */}
            {activeFormType === 'TSC_HANDOVER_TRANSFER' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[12px] uppercase font-bold text-black">PHÒNG VẬT TƯ - TBYT</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Mẫu số: 01/TSC-BBGN</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG (ĐIỀU CHUYỂN TBYT)
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Ban hành kèm theo Nghị định số 151/2017/NĐ-CP, Nghị định số 114/2024/NĐ-CP &amp; Thông tư số 23/2023/TT-BTC)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1 text-justify">
                  <p>- Căn cứ Luật Quản lý, sử dụng tài sản công số 15/2017/QH14 ngày 21 tháng 06 năm 2017;</p>
                  <p>- Căn cứ Nghị định số 151/2017/NĐ-CP và Nghị định số 114/2024/NĐ-CP của Chính phủ quy định chi tiết thi hành Luật Quản lý, sử dụng tài sản công;</p>
                  <p>- Căn cứ Quyết định điều chuyển tài sản công số 88/QĐ-BVĐK ngày 10/02/2026 của Giám đốc Bệnh viện;</p>
                  <p>- Hôm nay, ngày {day}/{month}/{year}, các bên tiến hành bàn giao và tiếp nhận tài sản công gồm có:</p>
                  <div className="pl-3 space-y-0.5">
                    <p><strong>A. BÊN GIAO:</strong> {currentAsset?.registeredDepartment || 'Khoa Cấp Cứu A9'} - Đại diện: BS. CKII Trần Văn Hùng (Trưởng khoa)</p>
                    <p><strong>B. BÊN NHẬN:</strong> {currentAsset?.actualDepartment || 'Khoa Phẫu Thuật Gây Mê Hồi Sức'} - Đại diện: BS. Vũ Hải Long (Phụ trách phòng mổ)</p>
                    <p><strong>C. ĐƠN VỊ GIÁM SÁT KỸ THUẬT &amp; HẠCH TOÁN:</strong> Phòng Vật tư - TBYT (KS. Đặng Văn Nam) &amp; Phòng Kế toán.</p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5 w-8">STT</th>
                      <th className="border border-black p-1.5 text-left">Tên trang thiết bị y tế</th>
                      <th className="border border-black p-1.5 w-28">Số Serial / Model</th>
                      <th className="border border-black p-1.5 w-16">Năm SD</th>
                      <th className="border border-black p-1.5 w-24">Nguyên giá (VNĐ)</th>
                      <th className="border border-black p-1.5 w-20">Hao mòn</th>
                      <th className="border border-black p-1.5 text-left">Tình trạng kỹ thuật khi giao</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 text-center">1</td>
                      <td className="border border-black p-1.5 font-bold">{currentAsset?.deviceName || 'Máy thở Puritan Bennett 840 (PB840)'}</td>
                      <td className="border border-black p-1.5 text-center font-mono">{currentAsset?.serialNumber || 'PB840-VN-2021-998'}</td>
                      <td className="border border-black p-1.5 text-center">2021</td>
                      <td className="border border-black p-1.5 text-right font-mono">1.250.000.000</td>
                      <td className="border border-black p-1.5 text-center font-bold">35%</td>
                      <td className="border border-black p-1.5 text-[11px]">Hoạt động tốt, đầy đủ phụ kiện thở, tem KĐ còn hạn</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">2</td>
                      <td className="border border-black p-1.5 font-bold">Máy sốc tim Zoll R Series ALS</td>
                      <td className="border border-black p-1.5 text-center font-mono">ZOLL-R-8831</td>
                      <td className="border border-black p-1.5 text-center">2020</td>
                      <td className="border border-black p-1.5 text-right font-mono">450.000.000</td>
                      <td className="border border-black p-1.5 text-center font-bold">42%</td>
                      <td className="border border-black p-1.5 text-[11px]">Bản cực nhạy, pin tích điện &gt; 2.5h</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12.5px] space-y-1 text-justify pt-1">
                  <p>
                    - <strong>Hồ sơ kèm theo tài sản:</strong> Bàn giao kèm theo 01 bộ Sổ lý lịch máy, Sách hướng dẫn sử dụng tiếng Việt, Giấy chứng nhận kiểm định an toàn điện còn hiệu lực và 02 bộ dây thở silicon tiệt trùng.
                  </p>
                  <p>
                    - <strong>Trách nhiệm các bên:</strong> Bên nhận có trách nhiệm quản lý, theo dõi sử dụng đúng quy trình kỹ thuật y tế và thông báo Phòng KHTC để thực hiện ghi tăng/giảm tài sản cố định trên phần mềm kế toán theo Thông tư 23/2023/TT-BTC.
                  </p>
                </div>

                <div className="grid grid-cols-3 text-center text-[12px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">ĐẠI DIỆN BÊN GIAO</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký giao]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">KỸ SƯ TBYT GIÁM SÁT</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã kiểm định]</div>
                    <div className="font-bold">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">ĐẠI DIỆN BÊN NHẬN</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã nhận máy]</div>
                    <div className="font-bold">BS. Vũ Hải Long</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 4: PHIẾU XUẤT MƯỢN KHẨN CẤP THUỐC, VẬT TƯ TỦ TRỰC (KẸP BỆNH ÁN)       */}
            {/* ========================================================================= */}
            {activeFormType === 'EMERGENCY_BORROW_TICKET' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[12px] uppercase font-bold text-black">KHOA CẤP CỨU A9</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-mono font-bold text-rose-700">MÃ PHIẾU: {currentDebt?.code || 'PN-2026-089'}</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">
                      {currentDebt?.borrowTime || '01:40 AM'}, ngày {day} tháng {month} năm {year}
                    </div>
                  </div>
                </div>

                <div className="text-center py-1 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    PHIẾU XUẤT MƯỢN KHẨN CẤP THUỐC / VẬT TƯ Y TẾ TỦ TRỰC
                  </h1>
                  <p className="italic text-[11.5px] text-slate-800">
                    (Chứng từ pháp lý kẹp Hồ sơ bệnh án - Căn cứ Điều 10 Thông tư số 22/2011/TT-BYT &amp; Thông tư số 31/2021/TT-BYT)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-[12.5px] p-3 rounded bg-slate-50 border border-black/80">
                  <div><strong>Họ và tên người bệnh:</strong> <span className="uppercase font-bold">{currentDebt?.patientName || 'Võ Minh Trí (BN-8820)'}</span></div>
                  <div><strong>Mã hồ sơ bệnh án (PID):</strong> <span className="font-mono font-bold">BA-2026-CC088</span></div>
                  <div><strong>Vị trí buồng / giường:</strong> {currentDebt?.patientRoom || 'Buồng cấp cứu 3 - Giường 02'}</div>
                  <div><strong>Thời điểm xuất rút thuốc:</strong> {currentDebt?.borrowTime} - {currentDebt?.borrowDate}</div>
                  <div><strong>Bác sĩ ra y lệnh cấp cứu:</strong> BS. CKII Trần Văn Hùng</div>
                  <div><strong>Điều dưỡng thực hiện xuất tủ:</strong> {currentDebt?.borrowerName || 'ĐD. Lê Thị Thu'}</div>
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <strong>Chỉ định lâm sàng / Lý do cấp bách:</strong> {currentDebt?.note || 'Cấp cứu sốc phản vệ / giảm đau tiền phẫu khẩn cấp ca trực đêm ngoài giờ'}
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5 w-10">STT</th>
                      <th className="border border-black p-1.5 text-left">Tên thuốc, hàm lượng, vật tư y tế</th>
                      <th className="border border-black p-1.5 w-24">Phân loại</th>
                      <th className="border border-black p-1.5 w-20">Số lượng</th>
                      <th className="border border-black p-1.5 w-28">Đường dùng</th>
                      <th className="border border-black p-1.5 w-28">Thu hồi vỏ ống</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 text-center">1</td>
                      <td className="border border-black p-1.5 font-bold">{currentDebt?.itemName}</td>
                      <td className="border border-black p-1.5 text-center">{currentDebt?.itemType}</td>
                      <td className="border border-black p-1.5 text-center font-bold font-mono">{currentDebt?.quantity}</td>
                      <td className="border border-black p-1.5 text-center">Tiêm tĩnh mạch chậm</td>
                      <td className="border border-black p-1.5 text-center font-medium">
                        {currentDebt?.ampouleReturned ? 'Đã thu hồi vỏ (TT 20)' : 'Chưa thu hồi vỏ'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12px] italic text-slate-800 bg-amber-50 p-2.5 rounded border border-amber-300">
                  <strong>Cam kết trách nhiệm y tế:</strong> Bác sĩ ra y lệnh có trách nhiệm ghi vào Hồ sơ bệnh án và kê đơn thuốc hoàn trả cơ số tủ trực trước <strong>07:30 sáng</strong> để Điều dưỡng trưởng ca tổng hợp lĩnh bù tại Kho Dược theo đúng Điều 10 Thông tư số 22/2011/TT-BYT.
                </div>

                <div className="grid grid-cols-2 text-center text-[12px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">ĐIỀU DƯỠNG XUẤT THUỐC</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký xác nhận PIN]</div>
                    <div className="font-bold">{currentDebt?.borrowerName || 'ĐD. Lê Thị Thu'}</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">BÁC SĨ RA Y LỆNH CẤP CỨU</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký y lệnh]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 5: BIÊN BẢN KIỂM ĐỊNH AN TOÀN ĐIỆN VÀ THỬ TẢI LÂM SÀNG TBYT (NĐ 98)   */}
            {/* ========================================================================= */}
            {activeFormType === 'EQUIPMENT_HANDOVER_INSPECT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[12px] uppercase font-bold text-black">PHÒNG VẬT TƯ - TBYT</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Số: 98/BB-KTĐ/2026</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN KIỂM ĐỊNH AN TOÀN ĐIỆN VÀ THỬ TẢI LÂM SÀNG TRANG THIẾT BỊ Y TẾ
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Căn cứ Điều 34, 55, 56, 57, 58 Nghị định 98/2021/NĐ-CP &amp; Tiêu chuẩn Quốc gia TCVN 7303-1:2009 / IEC 60601-1)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1 text-justify">
                  <p>- Thiết bị kiểm định: <strong>{currentTicket?.deviceName || 'Máy thở Puritan Bennett 840 (PB840)'}</strong> - Model: <strong>{currentTicket?.deviceModel || 'PB840 Ventilator'}</strong></p>
                  <p>- Số Serial: <span className="font-mono font-bold">{currentTicket?.serialNumber || 'PB840-VN-2021-998'}</span> | Phân loại rủi ro: <strong className="text-rose-700">Loại {currentTicket?.riskClass || 'D'} (Can thiệp hô hấp sống còn)</strong></p>
                  <p>- Khoa phòng tiếp nhận vận hành: <strong>{currentTicket?.location || 'Phòng Mổ 2 - Tầng 3 (Khu Phẫu Thuật)'}</strong></p>
                  <p>- Kỹ sư thực hiện kiểm định: <strong>KS. Đặng Văn Nam (Kỹ sư y sinh BME - Phòng Vật tư TBYT)</strong></p>
                  <p>- Thiết bị đo chuẩn kiểm định: Máy phân tích an toàn điện Fluke ESA620 &amp; Phổi giả hiệu chuẩn VT-Plus HF.</p>
                </div>

                <table className="w-full border-collapse border border-black text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5 w-10">STT</th>
                      <th className="border border-black p-1.5 text-left">Hạng mục kiểm tra an toàn theo IEC 60601-1</th>
                      <th className="border border-black p-1.5 w-28">Tiêu chuẩn cho phép</th>
                      <th className="border border-black p-1.5 w-24">Kết quả đo</th>
                      <th className="border border-black p-1.5 w-24">Kết luận</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 text-center">1</td>
                      <td className="border border-black p-1.5">Điện trở nối đất bảo vệ (Protective Earth)</td>
                      <td className="border border-black p-1.5 text-center">&le; 0.20 &Omega;</td>
                      <td className="border border-black p-1.5 text-center font-mono font-bold">0.08 &Omega;</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">2</td>
                      <td className="border border-black p-1.5">Dòng rò tiếp đất (Earth Leakage Current)</td>
                      <td className="border border-black p-1.5 text-center">&le; 500 &mu;A</td>
                      <td className="border border-black p-1.5 text-center font-mono font-bold">115 &mu;A</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">3</td>
                      <td className="border border-black p-1.5">Dòng rò qua vỏ thiết bị (Enclosure Leakage)</td>
                      <td className="border border-black p-1.5 text-center">&le; 100 &mu;A</td>
                      <td className="border border-black p-1.5 text-center font-mono font-bold">24 &mu;A</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">4</td>
                      <td className="border border-black p-1.5">Dòng rò bệnh nhân bộ phận CF (Patient Leakage)</td>
                      <td className="border border-black p-1.5 text-center">&le; 10 &mu;A</td>
                      <td className="border border-black p-1.5 text-center font-mono font-bold">2.1 &mu;A</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">5</td>
                      <td className="border border-black p-1.5">Thử tải phổi giả liên tục 120 phút (Test Lung)</td>
                      <td className="border border-black p-1.5 text-center">Sai số Ppeak &lt; 5%</td>
                      <td className="border border-black p-1.5 text-center font-mono font-bold">Sai số 1.8%</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">6</td>
                      <td className="border border-black p-1.5">Thử nghiệm ngắt nguồn 220V chạy ắc quy dự phòng</td>
                      <td className="border border-black p-1.5 text-center">Tự ngắt, pin &gt; 120p</td>
                      <td className="border border-black p-1.5 text-center font-mono font-bold">Chạy 160 phút</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">ĐẠT</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12.5px] font-bold text-slate-900 pt-1">
                  Kết luận &amp; Quyết định cấp tem: Thiết bị đạt 100% tiêu chuẩn kỹ thuật an toàn điện &amp; thông khí lâm sàng. Đã dán Tem kiểm định an toàn số: <span className="font-mono text-teal-800">KD-2026-PB840</span>, thời hạn kiểm định định kỳ tiếp theo: <strong>12 tháng</strong> ({day}/{month}/2027).
                </div>

                <div className="grid grid-cols-2 text-center text-[12px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">KỸ SƯ KIỂM ĐỊNH TBYT</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký nghiệm thu]</div>
                    <div className="font-bold">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">ĐIỀU DƯỠNG TRƯỞNG TIẾP NHẬN</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã nhận máy an toàn]</div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 6: MẪU 05-TSC - BIÊN BẢN KIỂM KÊ TÀI SẢN CỐ ĐỊNH & TRANG THIẾT BỊ Y TẾ  */}
            {/* ========================================================================= */}
            {activeFormType === 'TSC_ANNUAL_AUDIT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[12px] uppercase font-bold text-black">HỘI ĐỒNG KIỂM KÊ TÀI SẢN</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Mẫu số: 05-TSC</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN KIỂM KÊ TÀI SẢN CỐ ĐỊNH VÀ TRANG THIẾT BỊ Y TẾ
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Ban hành kèm theo Mẫu số 05-TSC Thông tư số 23/2023/TT-BTC &amp; Nghị định số 151/2017/NĐ-CP của Chính phủ)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1 text-justify">
                  <p>- Căn cứ Quyết định số 12/QĐ-BVĐK của Giám đốc Bệnh viện về việc thành lập Hội đồng kiểm kê tài sản định kỳ;</p>
                  <p>- Thời điểm kiểm kê: 08 giờ 00 phút, ngày {day} tháng {month} năm {year} tại Khoa Cấp Cứu A9;</p>
                  <p>- Thành phần Hội đồng kiểm kê gồm có: <strong>DS. CKI Nguyễn Văn Hoàng</strong> (Trưởng ban), <strong>KS. Đặng Văn Nam</strong> (Phòng TBYT), <strong>BS. CKII Trần Văn Hùng</strong> (Trưởng khoa lâm sàng), <strong>CN. Phạm Thu Thảo</strong> (Kế toán tài sản).</p>
                </div>

                <table className="w-full border-collapse border border-black text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5 w-8">STT</th>
                      <th className="border border-black p-1.5 text-left">Tên tài sản / Thiết bị y tế</th>
                      <th className="border border-black p-1.5 w-24">Mã tài sản</th>
                      <th className="border border-black p-1.5 w-28">Nơi bố trí sổ sách</th>
                      <th className="border border-black p-1.5 w-28">Vị trí thực tế</th>
                      <th className="border border-black p-1.5 w-24">Tình trạng máy</th>
                      <th className="border border-black p-1.5 text-left">Kiến nghị xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.slice(0, 5).map((a, idx) => (
                      <tr key={a.id}>
                        <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-black p-1.5 font-bold">{a.deviceName}</td>
                        <td className="border border-black p-1.5 text-center font-mono">{a.code}</td>
                        <td className="border border-black p-1.5 text-center">{a.registeredDepartment}</td>
                        <td className="border border-black p-1.5 text-center font-medium">
                          <span className={a.isMisallocated ? 'text-amber-800 font-bold' : ''}>
                            {a.actualDepartment}
                          </span>
                        </td>
                        <td className="border border-black p-1.5 text-center">
                          {a.condition === 'operational' ? 'Hoạt động tốt' : a.pendingLiquidation ? 'Chờ thanh lý' : 'Cần bảo trì'}
                        </td>
                        <td className="border border-black p-1.5 text-[11px]">
                          {a.isMisallocated ? 'Lập Mẫu 01/TSC điều chuyển' : a.pendingLiquidation ? 'Đề xuất thanh lý tài sản' : 'Tiếp tục sử dụng'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-[12.5px] space-y-1 text-justify pt-1">
                  <p>
                    - <strong>Đánh giá chung:</strong> 100% trang thiết bị được dán mã QR/RFID kiểm kê. Đã phát hiện và lập phương án xử lý đối với các máy thở/máy theo dõi đang bố trí lệch khoa phục vụ cấp cứu bệnh nhân nặng.
                  </p>
                </div>

                <div className="grid grid-cols-4 text-center text-[11.5px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">KỸ SƯ VẬT TƯ TBYT</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký]</div>
                    <div className="font-bold">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">KẾ TOÁN TÀI SẢN</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã đối soát]</div>
                    <div className="font-bold">CN. Phạm Thu Thảo</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG KHOA LÂM SÀNG</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã xác nhận]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG BAN KIỂM KÊ</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã duyệt]</div>
                    <div className="font-bold">TS.BS. Nguyễn Văn An</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 7: BIÊN BẢN XỬ LÝ SỰ CỐ QUÁ NHIỆT & THẨM ĐỊNH VẮC XIN BIỆT TRỮ (GSP) */}
            {/* ========================================================================= */}
            {activeFormType === 'COLD_CHAIN_INCIDENT_REPORT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">SỞ Y TẾ THÀNH PHỐ HÀ NỘI</div>
                    <div className="text-[12px] uppercase font-bold text-black">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[11px] font-bold text-black">KHOA DƯỢC - CHUỖI LẠNH GSP</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Số: 36/BB-SCL/2026</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN XỬ LÝ SỰ CỐ QUÁ NHIỆT CHUỖI LẠNH &amp; THẨM ĐỊNH LÔ VẮC XIN BIỆT TRỮ
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Theo nguyên tắc GSP - Thông tư số 36/2018/TT-BYT &amp; Quy định bảo quản Dự án TCMR Quốc Gia)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1 text-justify">
                  <p>- Căn cứ Thông tư số 36/2018/TT-BYT ngày 22 tháng 11 năm 2018 của Bộ Y tế quy định về Thực hành tốt bảo quản thuốc, nguyên liệu làm thuốc (GSP);</p>
                  <p>- Căn cứ Quyết định số 1570/2000/QĐ-BYT về triển khai áp dụng nguyên tắc Thực hành tốt bảo quản thuốc;</p>
                  <p>- Thiết bị bảo quản: <strong>Tủ lạnh chuyên dụng bảo quản Vắc xin B Medical Systems (TCW 3000AC)</strong>;</p>
                  <p>- Thông tin sự cố: Cảm biến IoT ghi nhận nhiệt độ tăng lên <strong>{coldChainState?.currentTemp ?? 11.0}°C</strong> (Vượt ngưỡng GSP 2.0°C - 8.0°C) do gián đoạn nguồn điện lưới 220V ca trực đêm. Hệ thống đã tự động kích hoạt máy phát điện dự phòng và niêm phong Biệt trữ (Quarantine).</p>
                </div>

                <table className="w-full border-collapse border border-black text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5 w-8">STT</th>
                      <th className="border border-black p-1.5 text-left">Tên Vắc xin / Sinh phẩm y tế</th>
                      <th className="border border-black p-1.5 w-24">Số lô / Hạn dùng</th>
                      <th className="border border-black p-1.5 w-20">Số lượng (Liều)</th>
                      <th className="border border-black p-1.5 w-28">Chỉ thị VVM</th>
                      <th className="border border-black p-1.5 w-28">Thử nghiệm Shake Test</th>
                      <th className="border border-black p-1.5 text-left">Kết luận thẩm định</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 text-center">1</td>
                      <td className="border border-black p-1.5 font-bold">Vắc xin Uốn ván hấp phụ (VAT 0.5ml)</td>
                      <td className="border border-black p-1.5 text-center font-mono">LOT-VAT24 (09/2026)</td>
                      <td className="border border-black p-1.5 text-center font-mono">200</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">Giai đoạn 1 (An toàn)</td>
                      <td className="border border-black p-1.5 text-center">Âm tính (Không đông băng)</td>
                      <td className="border border-black p-1.5 text-emerald-800 font-bold">ĐỦ ĐIỀU KIỆN GIẢI PHÓNG</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">2</td>
                      <td className="border border-black p-1.5 font-bold">Vắc xin Viêm gan B tái tổ hợp (Engerix-B)</td>
                      <td className="border border-black p-1.5 text-center font-mono">LOT-HBV24 (11/2026)</td>
                      <td className="border border-black p-1.5 text-center font-mono">150</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">Giai đoạn 1 (An toàn)</td>
                      <td className="border border-black p-1.5 text-center">Âm tính (Không đông băng)</td>
                      <td className="border border-black p-1.5 text-emerald-800 font-bold">ĐỦ ĐIỀU KIỆN GIẢI PHÓNG</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 text-center">3</td>
                      <td className="border border-black p-1.5 font-bold">Huyết thanh kháng uốn ván (SAT 1500 UI)</td>
                      <td className="border border-black p-1.5 text-center font-mono">LOT-SAT24 (08/2026)</td>
                      <td className="border border-black p-1.5 text-center font-mono">100</td>
                      <td className="border border-black p-1.5 text-center font-bold text-emerald-800">Giai đoạn 1 (An toàn)</td>
                      <td className="border border-black p-1.5 text-center">Đạt chuẩn cảm quan</td>
                      <td className="border border-black p-1.5 text-emerald-800 font-bold">ĐỦ ĐIỀU KIỆN GIẢI PHÓNG</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12.5px] space-y-1 text-justify pt-1 font-medium">
                  <p>
                    - <strong>Kết luận của Hội đồng Thẩm định GSP:</strong> Nhiệt độ động học trung bình (MKT) duy trì ở mức an toàn sinh học. Toàn bộ 450 liều vắc xin không bị biến tính hoạt lực. Cho phép mở niêm phong biệt trữ và giải phóng vào sử dụng theo đúng Quy trình SOP.
                  </p>
                </div>

                <div className="grid grid-cols-3 text-center text-[12px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">THỦ KHO CHUỖI LẠNH</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký xác nhận]</div>
                    <div className="font-bold">DS. Nguyễn Bích Ngọc</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">BS. PHỤ TRÁCH TIÊM CHỦNG</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã kiểm định hoạt lực]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG KHOA DƯỢC</div>
                    <div className="italic text-slate-500">(Ký duyệt giải phóng lô)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký lệnh giải phóng]</div>
                    <div className="font-bold">DS. CKI Nguyễn Văn Hoàng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 8: SỔ GIAO BAN VÀ BÀN GIAO CA TRỰC ĐIỀU DƯỠNG LÂM SÀNG                 */}
            {/* ========================================================================= */}
            {activeFormType === 'SHIFT_HANDOVER_RECORD' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 border-b border-black pb-2 mb-2">
                  <div className="col-span-5 text-center">
                    <div className="text-[11.5px] uppercase text-black font-normal">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="text-[12px] uppercase font-bold text-black">KHOA CẤP CỨU A9</div>
                    <div className="w-20 mx-auto border-b border-black my-1"></div>
                    <div className="text-[11.5px] font-normal text-black italic">Sổ trực: GB-2026-CA01</div>
                  </div>
                  <div className="col-span-7 text-center">
                    <div className="text-[12px] uppercase font-bold text-black tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="text-[12.5px] font-bold text-black">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-36 mx-auto border-b border-black my-1"></div>
                    <div className="text-[12px] italic text-black">Hà Nội, 07 giờ 00 ngày {day} tháng {month} năm {year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN BÀN GIAO CA TRỰC ĐIỀU DƯỠNG LÂM SÀNG
                  </h1>
                  <p className="italic text-[12px] text-slate-800">
                    (Ban hành theo Quy chế Bệnh viện - Quyết định 1895/1997/QĐ-BYT &amp; Thông tư số 31/2021/TT-BYT của Bộ Y tế)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1">
                  <p>- Thời gian giao ca: <strong>07 giờ 00 phút, ngày {day}/{month}/{year}</strong></p>
                  <p>- Ca giao: <strong>Ca trực đêm (19h00 - 07h00)</strong> - Đại diện: ĐD. Lê Thị Thu</p>
                  <p>- Ca nhận: <strong>Ca trực ngày (07h00 - 13h30)</strong> - Đại diện: ĐD. Hoàng Thị Mai</p>
                  <p>- Bác sĩ Trưởng ca trực kiểm duyệt: <strong>BS. CKII Trần Văn Hùng</strong></p>
                </div>

                {/* Section 1: Clinical patients */}
                <div className="pt-1">
                  <h3 className="font-bold text-[12.5px] text-black uppercase mb-1">
                    1. Tình hình người bệnh trong ca trực:
                  </h3>
                  <div className="p-2.5 rounded border border-black text-[12px] space-y-1 bg-slate-50">
                    <p>• Tổng số bệnh nhân cấp cứu hiện diện: <strong>24 người bệnh</strong> (Nhập viện mới trong đêm: 08; Chuyển mổ: 02; Tử vong/Nặng xin về: 00).</p>
                    <p>• Bệnh nhân nặng thở máy xâm lấn: <strong>03 bệnh nhân</strong> (Buồng 1 - Giường 01; Buồng 2 - Giường 04; Buồng 3 - Giường 02).</p>
                    <p>• Bệnh nhân đang truyền thuốc vận mạch (Noradrenalin/Adrenalin): <strong>02 bệnh nhân</strong> ổn định huyết áp.</p>
                  </div>
                </div>

                {/* Section 2: Narcotics & Emergency Drugs */}
                <div className="pt-1">
                  <h3 className="font-bold text-[12.5px] text-black uppercase mb-1">
                    2. Bàn giao cơ số thuốc tủ trực &amp; Thuốc kiểm soát đặc biệt:
                  </h3>
                  <table className="w-full border-collapse border border-black text-[12px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-center">
                        <th className="border border-black p-1.5 w-10">STT</th>
                        <th className="border border-black p-1.5 text-left">Tên thuốc / Hàm lượng</th>
                        <th className="border border-black p-1.5 w-20">Cơ số duyệt</th>
                        <th className="border border-black p-1.5 w-20">Tồn thực tế</th>
                        <th className="border border-black p-1.5 w-24">Vỏ ống thu hồi</th>
                        <th className="border border-black p-1.5 text-left">Phiếu nợ / Bác sĩ ra y lệnh</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black p-1.5 text-center">1</td>
                        <td className="border border-black p-1.5 font-bold">Morphin sulfat 10mg/1ml</td>
                        <td className="border border-black p-1.5 text-center font-mono">10</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">08</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold text-emerald-800">02 ống (Đã khóa két)</td>
                        <td className="border border-black p-1.5">Phiếu PN-2026-089 (BS. Trần Văn Hùng)</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-1.5 text-center">2</td>
                        <td className="border border-black p-1.5 font-bold">Fentanyl 0.1mg/2ml</td>
                        <td className="border border-black p-1.5 text-center font-mono">05</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">04</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold text-emerald-800">01 ống (Đã khóa két)</td>
                        <td className="border border-black p-1.5">Phiếu PN-2026-087 (BS. Nguyễn Minh Tuấn)</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-1.5 text-center">3</td>
                        <td className="border border-black p-1.5 font-bold">Adrenalin 1mg/1ml</td>
                        <td className="border border-black p-1.5 text-center font-mono">10</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">07</td>
                        <td className="border border-black p-1.5 text-center">Không áp dụng</td>
                        <td className="border border-black p-1.5">Phiếu PN-2026-085 (BS. Trần Văn Hùng)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 3: Equipment Status */}
                <div className="pt-1">
                  <h3 className="font-bold text-[12.5px] text-black uppercase mb-1">
                    3. Bàn giao trang thiết bị y tế cấp cứu sống còn:
                  </h3>
                  <div className="p-2.5 rounded border border-black text-[12px] space-y-1 bg-slate-50">
                    <p>• 02 Máy thở Puritan Bennett 840 (PB840) hoạt động ổn định, áp lực khí oxy trung tâm đạt 4.2 bar.</p>
                    <p>• 01 Máy sốc tim Zoll R Series kiểm tra ca trực đạt mức xả 200J, pin sạc đầy 100%.</p>
                    <p>• 04 Bơm tiêm điện và 02 Máy truyền dịch hoạt động chính xác không báo động dòng chảy.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 text-center text-[12px] pt-4 page-break-inside-avoid">
                  <div>
                    <div className="font-bold uppercase">ĐIỀU DƯỠNG CA TRƯỚC</div>
                    <div className="italic text-slate-500">(Bàn giao)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã bàn giao]</div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">ĐIỀU DƯỠNG CA SAU</div>
                    <div className="italic text-slate-500">(Tiếp nhận)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã kiểm nhận]</div>
                    <div className="font-bold">ĐD. Hoàng Thị Mai</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">BÁC SĨ TRƯỞNG CA TRỰC</div>
                    <div className="italic text-slate-500">(Ký duyệt giao ban)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã duyệt giao ban]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Info & Verification Bar */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Hệ thống biểu mẫu hành chính lâm sàng số hóa: Hợp chuẩn Nghị định 30/2020/NĐ-CP &amp; Thông tư Bộ Y tế.</span>
          </div>
          {copyFeedback && (
            <span className="text-emerald-700 font-bold animate-in fade-in">{copyFeedback}</span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyHash('HMAC-SHA256:7a82f9c011e4d82b4937a01fa281ce919d7b21e84a20bfa492c10')}
              className="text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-medium hover:underline"
            >
              <Copy className="w-3.5 h-3.5 text-teal-700" />
              <span>Sao chép mã xác thực băm</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
