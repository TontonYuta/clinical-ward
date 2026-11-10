/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Biên Bản Thẩm Định Đơn Thuốc BHYT & An Toàn Lâm Sàng (Mẫu In A4 / Xuất PDF Chuẩn)
 * Căn cứ: Quyết định 130/QĐ-BYT, Quyết định 3618/QĐ-BHXH & Thông tư 20/2022/TT-BYT
 */

import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import {
  BhytPrescriptionPayload,
  BhytAuditReport,
  HospitalRank,
  TreatmentType
} from '../../../types/bhyt';
import { DrugResolutionResult } from '../../../services/api/bhytApi';

interface ClinicalCategoryItem {
  id: number;
  title: string;
  subtitle: string;
  status: 'PASS' | 'WARNING' | 'ALERT';
  statusLabel: string;
  details: string[];
}

interface BhytAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: BhytPrescriptionPayload;
  auditReport: BhytAuditReport;
  resolutionMap: Record<string, DrugResolutionResult>;
  clinicalCategories: ClinicalCategoryItem[];
  hospitalRank: HospitalRank;
  treatmentType: TreatmentType;
}

const HOSPITAL_RANK_LABELS: Record<HospitalRank, string> = {
  HANG_DAC_BIET: 'Hạng Đặc Biệt (Tuyến Trung Ương)',
  HANG_I: 'Hạng I (Tuyến Tỉnh / Trung Ương)',
  HANG_II: 'Hạng II (Tuyến Tỉnh)',
  HANG_III: 'Hạng III (Tuyến Huyện)',
  HANG_IV: 'Hạng IV (Tuyến Xã)'
};

export const BhytAuditReportModal: React.FC<BhytAuditReportModalProps> = ({
  isOpen,
  onClose,
  prescription,
  auditReport,
  resolutionMap,
  clinicalCategories,
  hospitalRank,
  treatmentType
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const docEl = document.getElementById('printable-bhyt-audit-document');
    if (!docEl) return;
    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Bien_Ban_Giam_Dinh_BHYT_${prescription.prescriptionId || 'RX'}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm 12mm 14mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Times New Roman', Times, serif; font-size: 12px; line-height: 1.4; }
    #printable-bhyt-audit-document { width: 100%; max-width: 100%; margin: 0 auto; padding: 0; box-sizing: border-box; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th, td { border: 1px solid #000; padding: 5px 6px; font-size: 11.5px; vertical-align: middle; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .sig-table td { border: none; vertical-align: top; text-align: center; font-size: 11.5px; }
  </style>
</head>
<body>
  <div id="printable-bhyt-audit-document">
    ${docEl.innerHTML}
  </div>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bien_Ban_Giam_Dinh_BHYT_${prescription.prescriptionId || 'RX'}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPrescriptionCost = prescription.items.reduce(
    (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
    0
  );
  const totalRejectionRisk = auditReport.atRiskCostVnd || 0;
  const approvedCost = Math.max(0, totalPrescriptionCost - totalRejectionRisk);

  return (
    <div
      onClick={onClose}
      data-testid="bhyt-audit-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200 print:static print:p-0 print:bg-white print:block"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-5xl h-[95vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 print:h-auto print:max-w-none print:w-full print:border-none print:shadow-none print:overflow-visible print:rounded-none"
      >
        {/* Thanh công cụ trên cùng (Ẩn khi in ấn) */}
        <div className="px-5 py-3 bg-teal-800 text-white flex items-center justify-between shrink-0 print:hidden gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-teal-700 flex items-center justify-center text-teal-100 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base leading-tight truncate">
                BIÊN BẢN GIÁM ĐỊNH ĐƠN THUỐC BHYT
              </h3>
              <p className="text-xs text-teal-200 truncate mt-0.5">
                Căn cứ TT 20/2022/TT-BYT, QĐ 130/QĐ-BYT &amp; QĐ 3618/QĐ-BHXH
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold cursor-pointer transition flex items-center gap-1.5"
              title="Tải văn bản HTML lưu trữ"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Lưu HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-md text-sm font-bold shadow-xs cursor-pointer transition flex items-center gap-2"
              title="In trực tiếp hoặc Lưu dưới dạng PDF qua trình duyệt"
            >
              <Printer className="w-4 h-4" />
              <span>In A4 / Lưu PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-md hover:bg-teal-700/60 text-teal-200 hover:text-white transition cursor-pointer flex items-center justify-center ml-1"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Khung mô phỏng trang giấy A4 (Cuộn được) */}
        <div className="flex-1 overflow-auto bg-slate-200/70 p-4 sm:p-6 flex justify-center items-start print:overflow-visible print:p-0 print:bg-transparent print:block">
          <div
            id="printable-bhyt-audit-document"
            className="w-[210mm] max-w-[210mm] bg-white text-black p-8 sm:p-10 shadow-xl border border-slate-300 text-xs sm:text-[13px] leading-relaxed font-serif my-2 print:p-0 print:shadow-none print:border-none print:my-0"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {/* Header Quốc hiệu & Đơn vị y tế */}
            <header className="border-b-2 border-black pb-3 mb-3.5">
              <div className="flex justify-between items-start text-xs sm:text-[13px]">
                <div className="text-center w-[48%] space-y-0.5">
                  <div className="font-bold uppercase tracking-tight text-xs sm:text-[13px]">SỞ Y TẾ TP. HÀ NỘI</div>
                  <div className="font-bold uppercase tracking-tight text-xs sm:text-[13px]">BỆNH VIỆN ĐA KHOA XANH PÔN</div>
                  <div className="font-semibold text-xs text-slate-700">HỘI ĐỒNG THUỐC VÀ ĐIỀU TRỊ</div>
                  <div className="text-xs italic">Số: {prescription.prescriptionId || 'RX-2026'}/BB-GĐBHYT</div>
                </div>

                <div className="text-center w-[48%] space-y-0.5">
                  <div className="font-bold uppercase tracking-tight text-xs sm:text-[13px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="font-bold text-xs sm:text-[13px]">Độc lập - Tự do - Hạnh phúc</div>
                  <div className="text-xs text-slate-600">--------o0o--------</div>
                  <div className="text-xs italic">
                    Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </div>
                </div>
              </div>

              <div className="text-center mt-3.5 pt-2.5 border-t border-slate-300">
                <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">
                  BIÊN BẢN THẨM ĐỊNH ĐƠN THUỐC BHYT &amp; AN TOÀN LÂM SÀNG
                </h1>
                <p className="text-xs italic text-slate-700 mt-0.5">
                  (Căn cứ: Quyết định số 130/QĐ-BYT, QĐ 3618/QĐ-BHXH &amp; Thông tư số 20/2022/TT-BYT của Bộ Y tế)
                </p>
              </div>
            </header>

            {/* PHẦN I: THÔNG TIN HÀNH CHÍNH & HỒ SƠ KHÁM CHỮA BỆNH */}
            <section className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-1.5 flex items-center gap-1">
                <span>I. THÔNG TIN HÀNH CHÍNH &amp; HỒ SƠ KHÁM CHỮA BỆNH</span>
              </h2>
              <table className="w-full border-collapse border border-black text-xs sm:text-[12.5px]">
                <tbody>
                  <tr>
                    <td className="w-1/4 font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Họ và tên người bệnh:</td>
                    <td className="w-1/4 font-bold border border-black px-2.5 py-1.5 uppercase">{prescription.patientName || 'NGUYỄN VĂN AN'}</td>
                    <td className="w-1/4 font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Tuổi / Năm sinh:</td>
                    <td className="w-1/4 border border-black px-2.5 py-1.5">{prescription.patientAge ? `${prescription.patientAge} tuổi` : '54 tuổi'}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Mã số thẻ BHYT:</td>
                    <td className="font-sans tabular-nums font-bold border border-black px-2.5 py-1.5">{prescription.insuranceCardNumber || 'DN4010123456789'}</td>
                    <td className="font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Hình thức điều trị:</td>
                    <td className="border border-black px-2.5 py-1.5">{treatmentType === 'NGOAI_TRU' ? 'KCB Ngoại trú' : 'Điều trị Nội trú'}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Tuyến kỹ thuật KCB:</td>
                    <td className="border border-black px-2.5 py-1.5 font-semibold">{HOSPITAL_RANK_LABELS[hospitalRank] || HOSPITAL_RANK_LABELS.HANG_I || 'Hạng I'}</td>
                    <td className="font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Mã đơn thuốc:</td>
                    <td className="font-sans tabular-nums border border-black px-2.5 py-1.5">{prescription.prescriptionId || 'RX-20261107-001'}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-slate-50 border border-black px-2.5 py-1.5">Chẩn đoán chính (ICD-10):</td>
                    <td colSpan={3} className="border border-black px-2.5 py-1.5">
                      <strong className="font-sans tabular-nums text-teal-900 font-bold">{prescription.primaryIcd10 || 'J20.9'}</strong> — {prescription.primaryDiagnosis || 'Viêm phế quản cấp'}
                      {Array.isArray(prescription.secondaryIcd10s) && prescription.secondaryIcd10s.length > 0 && (
                        <span className="ml-2 text-slate-600 italic">
                          (Kèm theo: {prescription.secondaryIcd10s.join(', ')})
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* PHẦN II: DANH MỤC THUỐC KÊ ĐƠN & ĐỐI SOÁT CSDL DƯỢC QUỐC GIA (DAV) */}
            <section className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-1.5 flex items-center justify-between">
                <span>II. DANH MỤC THUỐC &amp; ĐỐI SOÁT CSDL DƯỢC QUỐC GIA (54.885 MẶT HÀNG)</span>
                <span className="text-xs font-normal normal-case italic text-slate-600">Đơn thuốc gồm {prescription.items.length} khoản</span>
              </h2>
              <table className="w-full border-collapse border border-black text-xs sm:text-[12px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-black px-2 py-1.5 w-8">STT</th>
                    <th className="border border-black px-2.5 py-1.5 text-left">Tên biệt dược &amp; Hoạt chất INN</th>
                    <th className="border border-black px-2 py-1.5 w-24">Số ĐK / Mã DAV</th>
                    <th className="border border-black px-2 py-1.5 w-18">Hàm lượng</th>
                    <th className="border border-black px-2 py-1.5 w-16">Đường dùng</th>
                    <th className="border border-black px-1.5 py-1.5 w-12">Ngày</th>
                    <th className="border border-black px-1.5 py-1.5 w-10">SL</th>
                    <th className="border border-black px-2 py-1.5 w-24 text-right">Đơn giá</th>
                    <th className="border border-black px-2 py-1.5 w-28 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.items.map((it, idx) => {
                    const res = resolutionMap[it.id];
                    const lineTotal = (it.quantity || 0) * (it.unitPrice || 0);

                    return (
                      <tr key={it.id || idx}>
                        <td className="border border-black text-center font-sans tabular-nums py-1.5">{idx + 1}</td>
                        <td className="border border-black px-2.5 py-1.5">
                          <div className="font-bold">{it.drugName}</div>
                          <div className="text-[11px] text-slate-600 italic">
                            INN: {it.activeIngredient || res?.matched_dav?.active_ingredient || 'Chưa phân giải'}
                          </div>
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center font-sans tabular-nums text-[11px]">
                          {it.drugCode || res?.matched_dav?.national_code || 'DAV-KCB'}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center font-sans tabular-nums">
                          {it.dosage || res?.detected_concentration || '—'}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center">{it.route || 'Uống'}</td>
                        <td className="border border-black px-1.5 py-1.5 text-center font-sans tabular-nums">{it.daysSupply || 7}</td>
                        <td className="border border-black px-1.5 py-1.5 text-center font-bold font-sans tabular-nums">{it.quantity}</td>
                        <td className="border border-black px-2 py-1.5 text-right font-sans tabular-nums">
                          {(it.unitPrice || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right font-bold font-sans tabular-nums">
                          {lineTotal.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-slate-50">
                    <td colSpan={8} className="border border-black px-2.5 py-1.5 text-right uppercase">
                      Tổng giá trị đơn thuốc:
                    </td>
                    <td className="border border-black px-2 py-1.5 text-right font-sans tabular-nums text-sm">
                      {totalPrescriptionCost.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            {/* PHẦN III: KẾT QUẢ RÀ SOÁT 7 TIÊU CHUẨN AN TOÀN LÂM SÀNG */}
            <section className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-1.5">
                III. KẾT QUẢ ĐÁNH GIÁ 7 TIÊU CHUẨN AN TOÀN LÂM SÀNG (CDSS)
              </h2>
              <table className="w-full border-collapse border border-black text-xs sm:text-[12px]">
                <thead>
                  <tr className="bg-slate-100 font-bold">
                    <th className="border border-black px-2 py-1.5 w-10 text-center">STT</th>
                    <th className="border border-black px-2.5 py-1.5 text-left w-1/3">Tiêu chuẩn an toàn lâm sàng</th>
                    <th className="border border-black px-2.5 py-1.5 text-center w-28">Đánh giá</th>
                    <th className="border border-black px-2.5 py-1.5 text-left">Kết luận chi tiết &amp; Khuyến nghị</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicalCategories.map((cat, idx) => {
                    const isAlert = cat.status === 'ALERT';
                    const isWarning = cat.status === 'WARNING';

                    return (
                      <tr key={cat.id || idx}>
                        <td className="border border-black text-center font-sans tabular-nums py-1.5">{idx + 1}</td>
                        <td className="border border-black px-2.5 py-1.5 font-semibold">{cat.title}</td>
                        <td className="border border-black px-2.5 py-1.5 text-center font-bold">
                          {isAlert ? (
                            <span className="text-red-700">CẢNH BÁO</span>
                          ) : isWarning ? (
                            <span className="text-amber-700">LƯU Ý</span>
                          ) : (
                            <span className="text-emerald-800">ĐẠT CHUẨN</span>
                          )}
                        </td>
                        <td className="border border-black px-2.5 py-1.5 text-[11px] leading-relaxed">
                          {cat.details.join('; ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* PHẦN IV: THẨM ĐỊNH KINH TẾ Y TẾ & NGUY CƠ XUẤT TOÁN BHYT */}
            <section className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-1.5">
                IV. THẨM ĐỊNH KINH TẾ &amp; NGUY CƠ XUẤT TOÁN BHYT (THÔNG TƯ 20/2022/TT-BYT)
              </h2>

              <div className="grid grid-cols-3 gap-2.5 mb-2.5 text-center text-xs sm:text-[13px]">
                <div className="p-2.5 border border-black bg-slate-50">
                  <div className="text-[11px] text-slate-600 uppercase font-semibold">Tổng tiền đơn thuốc</div>
                  <div className="font-bold text-sm sm:text-base font-sans tabular-nums mt-0.5">{totalPrescriptionCost.toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="p-2.5 border border-black bg-emerald-50/60">
                  <div className="text-[11px] text-emerald-900 uppercase font-semibold">BHYT thanh toán hợp lệ</div>
                  <div className="font-bold text-sm sm:text-base text-emerald-800 font-sans tabular-nums mt-0.5">{approvedCost.toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="p-2.5 border border-black bg-rose-50/70">
                  <div className="text-[11px] text-rose-900 uppercase font-semibold">Nguy cơ xuất toán</div>
                  <div className="font-bold text-sm sm:text-base text-rose-700 font-sans tabular-nums mt-0.5">-{totalRejectionRisk.toLocaleString('vi-VN')} đ</div>
                </div>
              </div>

              {auditReport.violations.length === 0 ? (
                <div className="p-2.5 border border-black bg-emerald-50 text-center font-bold text-emerald-800 text-xs sm:text-sm">
                  Đơn thuốc hợp lệ 100%. Không phát hiện vi phạm quy định thanh toán BHYT.
                </div>
              ) : (
                <table className="w-full border-collapse border border-black text-xs sm:text-[12px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-black px-2 py-1.5 w-8 text-center">STT</th>
                      <th className="border border-black px-2.5 py-1.5 text-left">Thuốc vi phạm</th>
                      <th className="border border-black px-2.5 py-1.5 text-left">Nội dung vi phạm &amp; Căn cứ pháp lý</th>
                      <th className="border border-black px-2.5 py-1.5 text-right w-24">Tiền xuất toán</th>
                      <th className="border border-black px-2.5 py-1.5 text-left w-36">Giải pháp xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditReport.violations.map((v, vIdx) => (
                      <tr key={v.id || vIdx}>
                        <td className="border border-black text-center font-sans tabular-nums py-1.5">{vIdx + 1}</td>
                        <td className="border border-black px-2.5 py-1.5 font-bold">
                          {v.drugName} ({v.activeIngredient})
                        </td>
                        <td className="border border-black px-2.5 py-1.5">
                          <div>{v.detail}</div>
                          <div className="text-[11px] italic text-slate-600 mt-0.5">
                            Căn cứ: {v.legalRef.docTitle} ({v.legalRef.section})
                          </div>
                        </td>
                        <td className="border border-black px-2.5 py-1.5 text-right font-sans tabular-nums font-bold text-rose-700">
                          -{v.rejectionRiskVnd.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="border border-black px-2.5 py-1.5 italic text-[11px]">{v.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* PHẦN V: KẾT LUẬN & CHỮ KÝ */}
            <section className="pt-2.5 border-t border-black">
              <div className="mb-4 text-xs sm:text-[12.5px]">
                <strong className="text-sm font-bold uppercase">V. KẾT LUẬN CỦA HỘI ĐỒNG GIÁM ĐỊNH:</strong>
                <p className="mt-1.5 italic leading-relaxed text-slate-800">
                  Đơn thuốc đã được rà soát đối chiếu toàn diện qua Hệ thống Giám định tự động BHYT.
                  {auditReport.violations.length === 0
                    ? ' Toàn bộ danh mục thuốc đủ điều kiện đề nghị Cơ quan BHXH thanh toán theo chế độ.'
                    : ` Đề nghị Bác sĩ điều trị và Khoa Dược hoàn thiện biên bản giải trình cho ${auditReport.violations.length} khoản thuốc trước khi gửi dữ liệu lên Cổng tiếp nhận Hệ thống Thông tin Giám định BHYT.`}
                </p>
              </div>

              <table className="w-full sig-table text-xs sm:text-[12px] mt-6">
                <tbody>
                  <tr>
                    <td className="w-1/3 text-center">
                      <div className="font-bold uppercase text-xs sm:text-[12.5px]">BÁC SĨ KÊ ĐƠN</div>
                      <div className="text-[11px] italic text-slate-600">(Ký và ghi rõ họ tên)</div>
                      <div className="h-16"></div>
                      <div className="font-bold text-xs sm:text-[12.5px]">BS. CKII. TRẦN THANH HẢI</div>
                    </td>
                    <td className="w-1/3 text-center">
                      <div className="font-bold uppercase text-xs sm:text-[12.5px]">DƯỢC SĨ LÂM SÀNG</div>
                      <div className="text-[11px] italic text-slate-600">(Ký và ghi rõ họ tên)</div>
                      <div className="h-16"></div>
                      <div className="font-bold text-xs sm:text-[12.5px]">DS. NGUYỄN THỊ THU HÀ</div>
                    </td>
                    <td className="w-1/3 text-center">
                      <div className="font-bold uppercase text-xs sm:text-[12.5px]">GIÁM ĐỊNH VIÊN BHYT</div>
                      <div className="text-[11px] italic text-slate-600">(Ký, đóng dấu xác nhận)</div>
                      <div className="h-16"></div>
                      <div className="font-bold text-xs sm:text-[12.5px]">LÊ VĂN ĐỨC</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
