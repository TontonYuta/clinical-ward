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
  ExternalLink
} from 'lucide-react';
import {
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  AssetAuditRecord,
  UserRole
} from '../../types/clinical';
import { USER_PROFILES } from '../../data/initialData';

export type PrintableFormType =
  | 'TT20_AMPOULE_DESTRUCTION'  // Mẫu 16 Phụ lục II NĐ 54/2017 & TT 20/2017 (Hủy vỏ ống thuốc gây nghiện)
  | 'TT22_RESTOCK_PROPOSAL'     // Mẫu số 01/TT22 Thông tư 22/2011/TT-BYT (Dự trù thuốc tủ trực)
  | 'TSC_HANDOVER_TRANSFER'     // Mẫu 01/TSC-BBGN NĐ 151/2017 & NĐ 114/2024 (Biên bản bàn giao TBYT)
  | 'EMERGENCY_BORROW_TICKET'   // Phiếu xuất mượn khẩn tủ trực Điều 10 TT 22/2011/TT-BYT (Kẹp bệnh án)
  | 'EQUIPMENT_HANDOVER_INSPECT'; // Biên bản kiểm định an toàn điện & thử tải Điều 34 NĐ 98/2021

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
  currentUserRole
}) => {
  const [activeFormType, setActiveFormType] = useState<PrintableFormType>(initialFormType);
  const [activeDebtId, setActiveDebtId] = useState<string>(selectedDebtRecord?.id || debts[0]?.id || '');
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

  // Selected debt
  const currentDebt = debts.find(d => d.id === activeDebtId) || selectedDebtRecord || debts[0];

  // Narcotics debt list for destruction
  const narcoticDebts = debts.filter(d => d.itemType === 'Thuốc gây nghiện');

  // Low stock batches for Mẫu 01/TT22
  const lowStockBatches = batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold);

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Copy hash or text
  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback('Đã sao chép mã xác thực!');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Download raw document
  const handleDownloadHtml = () => {
    const docEl = document.getElementById('printable-medical-document');
    if (!docEl) return;
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bieu_Mau_Y_Te_${activeFormType}</title>
  <style>
    body { font-family: 'Times New Roman', Times, serif; padding: 20px; line-height: 1.4; color: #000; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; }
    th { background-color: #f2f2f2; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .header-table { border: none; margin-bottom: 20px; }
    .header-table td { border: none; padding: 2px 4px; }
    .sig-table { border: none; margin-top: 30px; }
    .sig-table td { border: none; vertical-align: top; }
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
    a.download = `Bieu_Mau_Y_Te_${activeFormType}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
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
                  Chuẩn Bộ Y Tế &amp; Bộ Tài Chính
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Tự động trích xuất dữ liệu lâm sàng, đối soát chữ ký số (NĐ 130) và xuất bản in khổ A4 chuẩn mực.
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
              <span>Tải file</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
              title="In trực tiếp ra máy in hoặc lưu PDF (Ctrl + P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Biểu Mẫu (A4)</span>
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

        {/* Tab Navigation (5 Official Medical Forms) */}
        <div className="px-5 py-2 bg-slate-100 border-b border-slate-200/90 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveFormType('TT20_AMPOULE_DESTRUCTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeFormType === 'TT20_AMPOULE_DESTRUCTION'
                ? 'bg-white text-teal-900 shadow-2xs border border-slate-300/80 ring-1 ring-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 text-rose-600" />
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
            <span>3. Mẫu 01/TSC-BBGN (NĐ 151 &amp; NĐ 114) - Điều Chuyển TBYT</span>
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
            <span>4. Phiếu Mượn Khẩn Tủ Trực (Điều 10 TT 22 - Kẹp Bệnh Án)</span>
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
            <span>5. Biên Bản Nghiệm Thu &amp; An Toàn Điện (NĐ 98/2021)</span>
          </button>
        </div>

        {/* Dynamic Context Selector bar */}
        {activeFormType === 'EMERGENCY_BORROW_TICKET' && (
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-700">Chọn phiếu nợ cần in kèm bệnh án:</span>
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
          </div>
        )}

        {/* Document Preview Canvas (Simulating pure white A4 Paper) */}
        <div className="flex-1 overflow-y-auto bg-slate-300/60 p-6 flex justify-center">
          <div
            id="printable-medical-document"
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-10 shadow-xl border border-slate-300 rounded-xs text-[13px] leading-relaxed font-serif"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            
            {/* ========================================================================= */}
            {/* FORM 1: MẪU SỐ 16 PHỤ LỤC II NĐ 54/2017 & TT 20/2017                     */}
            {/* ========================================================================= */}
            {activeFormType === 'TT20_AMPOULE_DESTRUCTION' && (
              <div className="space-y-4">
                {/* Header Table */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div className="text-center w-56 text-[12px]">
                    <div className="font-bold uppercase">SỞ Y TẾ THÀNH PHỐ</div>
                    <div className="font-bold uppercase text-slate-900">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="italic text-slate-600">Số: 16/BB-HĐH/2026</div>
                  </div>
                  <div className="text-center w-72 text-[12px]">
                    <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold underline pb-1">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="italic text-slate-600">Hà Nội, ngày {day} tháng {month} năm 20{year}</div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN TIÊU HỦY VỎ ỐNG THUỐC PHẢI KIỂM SOÁT ĐẶC BIỆT
                  </h1>
                  <p className="italic text-[12px] text-slate-600">
                    (Ban hành kèm theo Mẫu số 16 Phụ lục II Nghị định số 54/2017/NĐ-CP &amp; Điều 15, 16 Thông tư 20/2017/TT-BYT)
                  </p>
                </div>

                {/* Legal Preamble */}
                <div className="text-[12.5px] space-y-1">
                  <p>
                    - Căn cứ Luật Dược số 105/2016/QH13 ngày 06 tháng 04 năm 2016;
                  </p>
                  <p>
                    - Căn cứ Nghị định số 54/2017/NĐ-CP ngày 08 tháng 05 năm 2017 của Chính phủ quy định chi tiết một số điều của Luật Dược;
                  </p>
                  <p>
                    - Căn cứ Thông tư số 20/2017/TT-BYT ngày 10 tháng 05 năm 2017 của Bộ Y tế quy định về quản lý thuốc phải kiểm soát đặc biệt;
                  </p>
                  <p>
                    - Căn cứ Quyết định số 104/QĐ-BVĐK của Giám đốc Bệnh viện về việc thành lập Hội đồng tiêu hủy vỏ ống thuốc gây nghiện, hướng thần.
                  </p>
                </div>

                {/* Council Members */}
                <div className="text-[12.5px] space-y-1 pt-1">
                  <p className="font-bold">Hôm nay, vào hồi 10 giờ 30 phút, ngày {day}/{month}/20{year}, tại Phòng Tiêu hủy - Khoa Dược, chúng tôi gồm có:</p>
                  <div className="pl-4 space-y-1">
                    <p>1. <strong>DS. CKI Nguyễn Văn Hoàng</strong> - Trưởng Khoa Dược (Chủ tịch Hội đồng) - CCHN: <span className="font-mono">002341/HN-CCHN</span></p>
                    <p>2. <strong>BS. CKII Trần Văn Hùng</strong> - Bác sĩ Trưởng ca trực Cấp cứu (Ủy viên) - CCHN: <span className="font-mono">009125/BYT-CCHN</span></p>
                    <p>3. <strong>ĐD. Lê Thị Thu</strong> - Điều dưỡng trực buồng cấp cứu A9 (Ủy viên kiêm Thư ký) - CCHN: <span className="font-mono">004812/HN-CCHN</span></p>
                  </div>
                </div>

                {/* Table of Destroyed Items */}
                <div className="pt-2">
                  <p className="font-bold text-[12.5px] mb-1">
                    Hội đồng đã tiến hành kiểm kê, đối soát và thực hiện tiêu hủy toàn bộ vỏ ống thuốc đã sử dụng như sau:
                  </p>
                  <table className="w-full border-collapse border border-slate-900 text-[12px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-center">
                        <th className="border border-slate-900 p-1.5 w-8">STT</th>
                        <th className="border border-slate-900 p-1.5 text-left">Tên thuốc, nồng độ, hàm lượng</th>
                        <th className="border border-slate-900 p-1.5 w-16">ĐVT</th>
                        <th className="border border-slate-900 p-1.5 w-20">Số lượng vỏ</th>
                        <th className="border border-slate-900 p-1.5 w-24">Số lô</th>
                        <th className="border border-slate-900 p-1.5 text-left">Hồ sơ bệnh án sử dụng</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-900 p-1.5 text-center">1</td>
                        <td className="border border-slate-900 p-1.5 font-bold">Morphin sulfat 10mg/1ml</td>
                        <td className="border border-slate-900 p-1.5 text-center">Ống</td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">02</td>
                        <td className="border border-slate-900 p-1.5 text-center font-mono">LOT-MS24-01</td>
                        <td className="border border-slate-900 p-1.5">Trần Văn Nam (BN-8820) - Buồng Cấp cứu A9</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-900 p-1.5 text-center">2</td>
                        <td className="border border-slate-900 p-1.5 font-bold">Fentanyl 0.1mg/2ml</td>
                        <td className="border border-slate-900 p-1.5 text-center">Ống</td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">01</td>
                        <td className="border border-slate-900 p-1.5 text-center font-mono">LOT-FT24-08</td>
                        <td className="border border-slate-900 p-1.5">Nguyễn Hải Đăng (BN-8791) - Mổ sọ não</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-900 p-1.5 text-center">3</td>
                        <td className="border border-slate-900 p-1.5 font-bold">Diazepam 10mg/2ml (Seduxen)</td>
                        <td className="border border-slate-900 p-1.5 text-center">Ống</td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">02</td>
                        <td className="border border-slate-900 p-1.5 text-center font-mono">LOT-DZ24-11</td>
                        <td className="border border-slate-900 p-1.5">Lê Hoàng Nam (BN-8830) - Buồng Cấp cứu Thần kinh</td>
                      </tr>
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={3} className="border border-slate-900 p-1.5 text-right uppercase">Tổng cộng:</td>
                        <td className="border border-slate-900 p-1.5 text-center">05 ống</td>
                        <td colSpan={2} className="border border-slate-900 p-1.5 italic font-normal text-slate-600">Đã kiểm đếm đầy đủ 100% vỏ nguyên vẹn</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Method & Conclusion */}
                <div className="text-[12.5px] space-y-1 pt-1">
                  <p>
                    - <strong>Hình thức tiêu hủy:</strong> Đập vỡ nát hoàn toàn toàn bộ vỏ ống thủy tinh trong khay sắt chuyên dụng dưới sự chứng kiến độc lập của 03 thành viên Hội đồng. Sau đó, ngâm trong dung dịch khử trùng và đóng bao niêm phong rác thải y tế nguy hại theo đúng quy chuẩn Bộ Y tế.
                  </p>
                  <p>
                    - Biên bản được lập thành 03 bản có giá trị pháp lý như nhau: 01 bản lưu tại Kho Dược, 01 bản lưu tại Khoa Cấp Cứu, 01 bản gửi Giám đốc Bệnh viện báo cáo.
                  </p>
                </div>

                {/* Digital Signature Audit Stamp */}
                <div className="my-3 p-2.5 rounded border border-emerald-600 bg-emerald-50/60 text-[11px] text-emerald-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div>
                      <div className="font-bold text-emerald-900 uppercase">
                        VĂN BẢN XÁC THỰC KÝ SỐ Y TẾ ĐIỆN TỬ (NGHỊ ĐỊNH 130/2018/NĐ-CP)
                      </div>
                      <div className="text-[10px] text-emerald-800 font-mono">
                        HMAC-SHA256: 4e91f092ca8a27d6b389178efc21bc4d918731ad8921f92
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                    HỢP LỆ 100%
                  </span>
                </div>

                {/* Signatures 3 Columns */}
                <div className="grid grid-cols-3 text-center text-[12px] pt-4">
                  <div>
                    <div className="font-bold uppercase">THƯ KÝ HỘI ĐỒNG</div>
                    <div className="italic text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16 flex items-center justify-center">
                      <span className="font-mono text-xs text-teal-800 font-bold italic">[Đã ký điện tử]</span>
                    </div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                    <div className="text-[11px] text-slate-600 font-mono">004812/HN-CCHN</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase">ỦY VIÊN HỘI ĐỒNG</div>
                    <div className="italic text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16 flex items-center justify-center">
                      <span className="font-mono text-xs text-teal-800 font-bold italic">[Đã ký điện tử]</span>
                    </div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                    <div className="text-[11px] text-slate-600 font-mono">009125/BYT-CCHN</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase">CHỦ TỊCH HỘI ĐỒNG</div>
                    <div className="italic text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16 flex items-center justify-center">
                      <span className="font-mono text-xs text-teal-800 font-bold italic">[Đã ký điện tử]</span>
                    </div>
                    <div className="font-bold">DS. CKI Nguyễn Văn Hoàng</div>
                    <div className="text-[11px] text-slate-600 font-mono">002341/HN-CCHN</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 2: MẪU SỐ 01/TT22 - PHIẾU DỰ TRÙ THUỐC TỦ TRỰC                     */}
            {/* ========================================================================= */}
            {activeFormType === 'TT22_RESTOCK_PROPOSAL' && (
              <div className="space-y-4">
                {/* Header Table */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div className="text-center w-56 text-[12px]">
                    <div className="font-bold uppercase">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="font-bold uppercase text-slate-900">KHOA CẤP CỨU A9</div>
                    <div className="italic text-slate-600">Số: 01/DTTT-2026</div>
                  </div>
                  <div className="text-center w-72 text-[12px]">
                    <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold underline pb-1">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="italic text-slate-600">Hà Nội, ngày {day} tháng {month} năm 20{year}</div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    PHIẾU DỰ TRÙ THUỐC, VẬT TƯ TIÊU HAO BỔ SUNG CƠ SỐ TỦ TRỰC
                  </h1>
                  <p className="italic text-[12px] text-slate-600">
                    (Ban hành kèm theo Mẫu số 01 Thông tư số 22/2011/TT-BYT ngày 10/06/2011 của Bộ Y tế)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1">
                  <p>- Kính gửi: <strong>Kho Dược Bệnh Viện Đa Khoa</strong></p>
                  <p>- Khoa yêu cầu: <strong>Khoa Cấp Cứu A9 - Xe tiêm cấp cứu số 1 &amp; Tủ trực đêm</strong></p>
                  <p>- Căn cứ Quyết định số 45/QĐ-BV về việc ban hành danh mục cơ số tủ trực cấp cứu cố định.</p>
                </div>

                {/* Table of Restock Items */}
                <table className="w-full border-collapse border border-slate-900 text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-slate-900 p-1.5 w-8">STT</th>
                      <th className="border border-slate-900 p-1.5 text-left">Tên thuốc, nồng độ, hàm lượng</th>
                      <th className="border border-slate-900 p-1.5 w-14">ĐVT</th>
                      <th className="border border-slate-900 p-1.5 w-20">Cơ số duyệt</th>
                      <th className="border border-slate-900 p-1.5 w-20">Tồn hiện tại</th>
                      <th className="border border-slate-900 p-1.5 w-24">Số lượng xin lĩnh</th>
                      <th className="border border-slate-900 p-1.5 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockBatches.slice(0, 6).map((b, idx) => {
                      const needed = Math.max(0, b.maxThreshold - b.currentStock);
                      return (
                        <tr key={b.id}>
                          <td className="border border-slate-900 p-1.5 text-center">{idx + 1}</td>
                          <td className="border border-slate-900 p-1.5 font-bold">{b.itemName}</td>
                          <td className="border border-slate-900 p-1.5 text-center">{b.unit}</td>
                          <td className="border border-slate-900 p-1.5 text-center font-mono font-bold">{b.maxThreshold}</td>
                          <td className="border border-slate-900 p-1.5 text-center font-mono text-rose-700 font-bold">{b.currentStock}</td>
                          <td className="border border-slate-900 p-1.5 text-center font-mono font-bold bg-amber-50">+{needed}</td>
                          <td className="border border-slate-900 p-1.5 text-[11px] text-slate-600">Bù về cơ số an toàn TT 22</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Electronic Stamp */}
                <div className="my-3 p-2 rounded border border-teal-600 bg-teal-50/60 text-[11px] text-teal-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Chứng từ điện tử tích hợp chữ ký số và trừ kho tự động theo chuẩn FEFO.</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">Mã phiếu: DTT-2026-088</span>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-4 text-center text-[11px] pt-4">
                  <div>
                    <div className="font-bold uppercase">NGƯỜI LẬP PHIẾU</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký]</div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG KHOA LÂM SÀNG</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã duyệt]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">TRƯỞNG KHOA DƯỢC</div>
                    <div className="italic text-slate-500">(Ký duyệt phát bù)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã duyệt]</div>
                    <div className="font-bold">DS. CKI Nguyễn Văn Hoàng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">NGƯỜI GIAO NHẬN</div>
                    <div className="italic text-slate-500">(Kho dược cấp phát)</div>
                    <div className="h-14 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã nhận]</div>
                    <div className="font-bold">DS. Phạm Minh Khoa</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 3: MẪU 01/TSC-BBGN - BIÊN BẢN BÀN GIAO TÀI SẢN CÔNG                 */}
            {/* ========================================================================= */}
            {activeFormType === 'TSC_HANDOVER_TRANSFER' && (
              <div className="space-y-4">
                {/* Header Table */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div className="text-center w-56 text-[12px]">
                    <div className="font-bold uppercase">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="font-bold uppercase text-slate-900">PHÒNG VẬT TƯ - TBYT</div>
                    <div className="italic text-slate-600">Mẫu số: 01/TSC-BBGN</div>
                  </div>
                  <div className="text-center w-72 text-[12px]">
                    <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold underline pb-1">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="italic text-slate-600">Hà Nội, ngày {day} tháng {month} năm 20{year}</div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG (ĐIỀU CHUYỂN TBYT)
                  </h1>
                  <p className="italic text-[12px] text-slate-600">
                    (Ban hành kèm theo Nghị định số 151/2017/NĐ-CP &amp; Nghị định số 114/2024/NĐ-CP của Chính phủ)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1">
                  <p>- Căn cứ Quyết định điều chuyển tài sản công số 88/QĐ-BVĐK của Giám đốc Bệnh viện;</p>
                  <p>- Hôm nay, ngày {day}/{month}/20{year}, chúng tôi gồm các bên tiến hành bàn giao và tiếp nhận tài sản công:</p>
                  <p><strong>A. BÊN GIAO:</strong> Khoa Cấp Cứu A9 - Đại diện: BS. CKII Trần Văn Hùng (Trưởng khoa)</p>
                  <p><strong>B. BÊN NHẬN:</strong> Phòng Mổ 2 (Khu Phẫu Thuật) - Đại diện: BS. Vũ Hải Long (Phụ trách phòng mổ)</p>
                  <p><strong>C. ĐƠN VỊ GIÁM SÁT KỸ THUẬT:</strong> Phòng Vật tư - TBYT - Đại diện: KS. Đặng Văn Nam (Kỹ sư BME)</p>
                </div>

                {/* Table of Assets */}
                <table className="w-full border-collapse border border-slate-900 text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-slate-900 p-1.5 w-8">STT</th>
                      <th className="border border-slate-900 p-1.5 text-left">Tên trang thiết bị y tế</th>
                      <th className="border border-slate-900 p-1.5 w-28">Số Serial / Model</th>
                      <th className="border border-slate-900 p-1.5 w-16">Năm SD</th>
                      <th className="border border-slate-900 p-1.5 w-24">Nguyên giá (VNĐ)</th>
                      <th className="border border-slate-900 p-1.5 w-20">Hao mòn</th>
                      <th className="border border-slate-900 p-1.5 text-left">Tình trạng kỹ thuật</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">1</td>
                      <td className="border border-slate-900 p-1.5 font-bold">Máy thở Puritan Bennett 840 (PB840)</td>
                      <td className="border border-slate-900 p-1.5 text-center font-mono">PB840-VN-2021-998</td>
                      <td className="border border-slate-900 p-1.5 text-center">2021</td>
                      <td className="border border-slate-900 p-1.5 text-right font-mono">1.250.000.000</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold">35%</td>
                      <td className="border border-slate-900 p-1.5 text-[11px]">Hoạt động tốt, đã kiểm định</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">2</td>
                      <td className="border border-slate-900 p-1.5 font-bold">Máy sốc tim Zoll R Series ALS</td>
                      <td className="border border-slate-900 p-1.5 text-center font-mono">ZOLL-R-8831</td>
                      <td className="border border-slate-900 p-1.5 text-center">2020</td>
                      <td className="border border-slate-900 p-1.5 text-right font-mono">450.000.000</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold">42%</td>
                      <td className="border border-slate-900 p-1.5 text-[11px]">Bản cực nhạy, pin lưu &gt; 2h</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-3 text-center text-[12px] pt-6">
                  <div>
                    <div className="font-bold uppercase">ĐẠI DIỆN BÊN GIAO</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký bàn giao]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">KỸ SƯ TBYT GIÁM SÁT</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã kiểm định]</div>
                    <div className="font-bold">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">ĐẠI DIỆN BÊN NHẬN</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã tiếp nhận]</div>
                    <div className="font-bold">BS. Vũ Hải Long</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 4: PHIẾU XUẤT MƯỢN KHẨN TỦ TRỰC (ĐIỀU 10 TT 22 - KẸP BỆNH ÁN)       */}
            {/* ========================================================================= */}
            {activeFormType === 'EMERGENCY_BORROW_TICKET' && (
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-slate-300 pb-2">
                  <div className="text-center w-52 text-[12px]">
                    <div className="font-bold uppercase">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="font-bold text-slate-900">KHOA CẤP CỨU A9</div>
                    <div className="text-[11px] font-mono font-bold text-rose-700">MÃ PHIẾU: {currentDebt?.code || 'PN-2026-089'}</div>
                  </div>
                  <div className="text-center w-64 text-[12px]">
                    <div className="font-bold uppercase text-[11px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="underline text-[11px]">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="italic text-[11px] text-slate-500">{currentDebt?.borrowTime || '01:40 AM'} - Ngày {day}/{month}/20{year}</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    PHIẾU XUẤT MƯỢN KHẨN DƯỢC PHẨM / VẬT TƯ TỦ TRỰC CA ĐÊM
                  </h1>
                  <p className="italic text-[11px] text-slate-600">
                    (Ban hành theo Quy chế Quản lý Tủ trực Cấp cứu - Điều 10 Thông tư 22/2011/TT-BYT)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12.5px] p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div><strong>Họ và tên bệnh nhân:</strong> {currentDebt?.patientName || 'Võ Minh Trí'}</div>
                  <div><strong>Vị trí cấp cứu:</strong> {currentDebt?.patientRoom || 'Buồng cấp cứu 3 - Giường 02'}</div>
                  <div><strong>Thời điểm rút thuốc:</strong> {currentDebt?.borrowTime} - {currentDebt?.borrowDate}</div>
                  <div><strong>Người thực hiện rút:</strong> {currentDebt?.borrowerName || 'ĐD. Lê Thị Thu'}</div>
                  <div className="col-span-2">
                    <strong>Chỉ định lâm sàng:</strong> {currentDebt?.note || 'Cấp cứu sốc phản vệ / giảm đau tiền phẫu khẩn cấp ca trực đêm'}
                  </div>
                </div>

                <table className="w-full border-collapse border border-slate-900 text-[12px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-slate-900 p-1.5 w-10">STT</th>
                      <th className="border border-slate-900 p-1.5 text-left">Tên thuốc / Hàm lượng / Vật tư</th>
                      <th className="border border-slate-900 p-1.5 w-24">Phân loại</th>
                      <th className="border border-slate-900 p-1.5 w-20">Số lượng</th>
                      <th className="border border-slate-900 p-1.5 w-28">Tình trạng vỏ ống</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">1</td>
                      <td className="border border-slate-900 p-1.5 font-bold">{currentDebt?.itemName}</td>
                      <td className="border border-slate-900 p-1.5 text-center">{currentDebt?.itemType}</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold font-mono">{currentDebt?.quantity}</td>
                      <td className="border border-slate-900 p-1.5 text-center font-medium">
                        {currentDebt?.ampouleReturned ? 'Đã thu hồi vỏ (TT 20)' : 'Chưa thu hồi vỏ'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12px] italic text-slate-700 bg-amber-50 p-2 rounded border border-amber-200">
                  * Cam kết: Bác sĩ điều trị có trách nhiệm kê đơn thuốc hoàn bù cơ số tủ trực trước 07:00 sáng giao ban để Điều dưỡng trưởng lĩnh bù tại Kho Dược theo đúng Điều 10 Thông tư 22/2011/TT-BYT.
                </div>

                <div className="grid grid-cols-2 text-center text-[12px] pt-4">
                  <div>
                    <div className="font-bold uppercase">ĐIỀU DƯỠNG XUẤT THUỐC</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký xác nhận PIN]</div>
                    <div className="font-bold">{currentDebt?.borrowerName || 'ĐD. Lê Thị Thu'}</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">BÁC SĨ RA Y LỆNH CẤP CỨU</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký chứng nhận]</div>
                    <div className="font-bold">BS. CKII Trần Văn Hùng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORM 5: BIÊN BẢN NGHIỆM THU KIỂM ĐỊNH AN TOÀN ĐIỆN & THỬ TẢI (NĐ 98/2021) */}
            {/* ========================================================================= */}
            {activeFormType === 'EQUIPMENT_HANDOVER_INSPECT' && (
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div className="text-center w-56 text-[12px]">
                    <div className="font-bold uppercase">BỆNH VIỆN ĐA KHOA TỈNH</div>
                    <div className="font-bold uppercase text-slate-900">PHÒNG VẬT TƯ - TBYT</div>
                    <div className="italic text-slate-600">Số: 98/BB-KTĐ/2026</div>
                  </div>
                  <div className="text-center w-72 text-[12px]">
                    <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold underline pb-1">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="italic text-slate-600">Hà Nội, ngày {day} tháng {month} năm 20{year}</div>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base font-bold uppercase tracking-wide">
                    BIÊN BẢN NGHIỆM THU KIỂM ĐỊNH AN TOÀN ĐIỆN &amp; THỬ TẢI LÂM SÀNG TBYT
                  </h1>
                  <p className="italic text-[12px] text-slate-600">
                    (Căn cứ Điều 34 &amp; 58 Nghị định 98/2021/NĐ-CP &amp; Tiêu chuẩn Quốc gia TCVN 7303 / IEC 60601-1)
                  </p>
                </div>

                <div className="text-[12.5px] space-y-1">
                  <p>- Thiết bị kiểm định: <strong>Máy thở Puritan Bennett 840 (PB840)</strong> - Model: <strong>PB840 Ventilator</strong></p>
                  <p>- Số Serial: <span className="font-mono font-bold">PB840-VN-2021-998</span> | Phân loại rủi ro: <strong className="text-rose-700">Loại D (Can thiệp hô hấp sống còn)</strong></p>
                  <p>- Khoa phòng tiếp nhận sử dụng: <strong>Phòng Mổ 2 - Tầng 3 (Khu Phẫu Thuật)</strong></p>
                  <p>- Kỹ sư thực hiện kiểm tra: <strong>KS. Đặng Văn Nam (Kỹ sư y sinh - Phòng Vật tư TBYT)</strong></p>
                </div>

                {/* Safety Test Table */}
                <table className="w-full border-collapse border border-slate-900 text-[12px] mt-2">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-slate-900 p-1.5 w-10">STT</th>
                      <th className="border border-slate-900 p-1.5 text-left">Hạng mục kiểm tra an toàn</th>
                      <th className="border border-slate-900 p-1.5 w-28">Tiêu chuẩn IEC</th>
                      <th className="border border-slate-900 p-1.5 w-24">Kết quả đo</th>
                      <th className="border border-slate-900 p-1.5 w-24">Kết luận</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">1</td>
                      <td className="border border-slate-900 p-1.5">Điện trở nối đất bảo vệ (Protective Earth)</td>
                      <td className="border border-slate-900 p-1.5 text-center">&lt;= 0.20 Ohm</td>
                      <td className="border border-slate-900 p-1.5 text-center font-mono font-bold">0.08 Ohm</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold text-emerald-700">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">2</td>
                      <td className="border border-slate-900 p-1.5">Dòng rò tiếp đất (Earth Leakage Current)</td>
                      <td className="border border-slate-900 p-1.5 text-center">&lt;= 500 uA</td>
                      <td className="border border-slate-900 p-1.5 text-center font-mono font-bold">115 uA</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold text-emerald-700">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">3</td>
                      <td className="border border-slate-900 p-1.5">Dòng rò qua vỏ thiết bị (Enclosure Leakage)</td>
                      <td className="border border-slate-900 p-1.5 text-center">&lt;= 100 uA</td>
                      <td className="border border-slate-900 p-1.5 text-center font-mono font-bold">24 uA</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold text-emerald-700">ĐẠT</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 p-1.5 text-center">4</td>
                      <td className="border border-slate-900 p-1.5">Thử tải phổi giả (Test Lung Compliance 2h)</td>
                      <td className="border border-slate-900 p-1.5 text-center">Ppeak sai số &lt; 5%</td>
                      <td className="border border-slate-900 p-1.5 text-center font-mono font-bold">Sai số 1.8%</td>
                      <td className="border border-slate-900 p-1.5 text-center font-bold text-emerald-700">ĐẠT</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-[12.5px] font-bold text-slate-800 pt-1">
                  Kết luận: Thiết bị đạt 100% tiêu chuẩn kỹ thuật an toàn điện &amp; thông khí lâm sàng. Cho phép đưa vào buồng bệnh phục vụ điều trị người bệnh.
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 text-center text-[12px] pt-6">
                  <div>
                    <div className="font-bold uppercase">KỸ SƯ KIỂM ĐỊNH TBYT</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã ký nghiệm thu]</div>
                    <div className="font-bold">KS. Đặng Văn Nam</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">ĐIỀU DƯỠNG TRƯỞNG TIẾP NHẬN</div>
                    <div className="italic text-slate-500">(Ký, họ tên)</div>
                    <div className="h-16 flex items-center justify-center font-mono text-teal-800 font-bold">[Đã nhận máy]</div>
                    <div className="font-bold">ĐD. Lê Thị Thu</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Trạng thái: Đã đồng bộ với Sổ kiểm toán điện tử bất biến (HMAC-SHA256).</span>
          </div>
          {copyFeedback && (
            <span className="text-emerald-700 font-bold animate-in fade-in">{copyFeedback}</span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyHash('GENESIS_BLOCK_HOSPITAL_AUDIT_2026_LEGAL_VERIFIED')}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-medium"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép mã băm</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
