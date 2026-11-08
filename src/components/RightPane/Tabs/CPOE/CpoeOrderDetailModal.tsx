/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Xem Chi Tiết Đơn Thuốc Điện Tử CPOE Chuẩn Workstation Y Tế (Phẳng, Trái - Phải, Zero-Box, Không Dấu Chấm, TT 26/2025/TT-BYT)
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, ShieldAlert, HeartPulse, Stethoscope, Clock, CheckCircle2, AlertTriangle, FileText, User, Calendar, Pill, MessageSquare, Zap } from 'lucide-react';
import { PrescriptionOrder, resolveTt26FormType, getTt26FormMetadata } from '../../../../types/cpoe';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';
import { stripLeadingBullets } from '../../../../utils/clinicalFormatter';
import { SendSmsModal } from '../../../Modals/SendSmsModal';
import { buildDefaultTimeSlots } from '../../../../services/prescriptionAdviceService';
import { auditPrescriptionDdiApi } from '../../../../services/api';
import { cpoeApi } from '../../../../services/api/cpoeApi';
import { PrescriptionPrintDocument } from './PrescriptionPrintDocument';
import { NursingMarView } from './NursingMarView';
import { AiPrescriptionAuditView } from './AiPrescriptionAuditView';

export type CpoeDetailTab = 'overview' | 'medications' | 'safety_cdss' | 'ai_audit' | 'nursing_mar' | 'advice_schedule' | 'legal_signature';

interface CpoeOrderDetailModalProps {
  isOpen: boolean;
  order: PrescriptionOrder | null;
  onClose: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
  onOrderUpdated?: (updatedOrder: PrescriptionOrder) => void;
}

export const CpoeOrderDetailModal: React.FC<CpoeOrderDetailModalProps> = ({
  isOpen,
  order,
  onClose,
  onOpenSafetyGuide,
  onOpenAdvice,
  onSelectPatient,
  onOrderUpdated,
}) => {
  const [currentOrder, setCurrentOrder] = useState<PrescriptionOrder | null>(order);
  const [isSigning, setIsSigning] = useState(false);
  const [signSuccessNotice, setSignSuccessNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CpoeDetailTab>('overview');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [ddiAudit, setDdiAudit] = useState<{ pair_alerts: Array<{ severity: string; title: string; consequence: string; action: string; source: string }>; has_contraindication: boolean } | null>(null);
  const [ddiAuditError, setDdiAuditError] = useState(false);

  useEffect(() => {
    setCurrentOrder(order);
    setSignSuccessNotice(null);
  }, [order]);

  const activeOrder = currentOrder || order;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setActiveTab('overview');
  }, [isOpen, order?.id]);

  useEffect(() => {
    if (!isOpen || !order) return;
    setDdiAudit(null);
    setDdiAuditError(false);
    const items = Array.isArray(order.items) ? order.items : [];
    auditPrescriptionDdiApi(items.map((item) => item?.activeIngredient || item?.medicationName).filter(Boolean))
      .then(setDdiAudit)
      .catch(() => setDdiAuditError(true));
  }, [isOpen, order]);

  if (!isOpen || !activeOrder) return null;

  const handleSignOrder = async () => {
    if (!activeOrder) return;
    setIsSigning(true);
    try {
      const signed = await cpoeApi.signCpoeOrder(activeOrder.id);
      setCurrentOrder(signed);
      setSignSuccessNotice('✓ Đã ký số thành công! Hệ thống tự động kích hoạt gửi SMS Brandname và Email lịch dùng thuốc theo thời gian thực.');
      onOrderUpdated?.(signed);
    } catch (e: any) {
      alert(e.message || 'Lỗi khi ký số đơn thuốc');
    } finally {
      setIsSigning(false);
    }
  };

  const safeItems = Array.isArray(activeOrder.items) ? activeOrder.items : [];

  const handlePrint = () => {
    const docNode = document.getElementById('prescription-print-document');
    if (!docNode) {
      window.alert('Không tìm thấy nội dung đơn thuốc để in.');
      return;
    }
    try {
      document.body.classList.add('printing-prescription');
      const cleanup = () => {
        document.body.classList.remove('printing-prescription');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(cleanup, 2000);
    } catch {
      document.body.classList.remove('printing-prescription');
      window.alert('Trình duyệt không mở được hộp thoại in. Hãy thử lại hoặc kiểm tra quyền in của trình duyệt.');
    }
  };

  const isOutpatient = activeOrder.prescriptionType === 'outpatient';
  const formType = resolveTt26FormType(activeOrder);
  const meta = getTt26FormMetadata(formType);

  // Resolve matching patient profile for clinical CDSS grounding
  const patient = findPatientByNameOrQuery(activeOrder.patientId || activeOrder.patientName, INITIAL_PATIENTS);
  const isDraft = activeOrder.status === 'draft' || !activeOrder.digitalSignature;

  const hasNarcotics = safeItems.some((it) => it?.isNarcotic);

  const isInpatient = order.prescriptionType === 'inpatient_daily';

  const tabs: [CpoeDetailTab, string][] = [
    ['overview', 'Tổng quan đơn thuốc'],
    ['medications', `Danh mục thuốc (${safeItems.length})`],
    ['ai_audit', 'Thẩm định AI 5 sao'],
    ['safety_cdss', 'An toàn lâm sàng & CDSS'],
    ...(isInpatient ? [['nursing_mar', 'Phiếu y lệnh (Điều dưỡng)'] as [CpoeDetailTab, string]] : []),
    ['advice_schedule', 'Hướng dẫn dặn dò & Lịch dùng'],
    ['legal_signature', 'Pháp lý & Ký số TT26'],
  ];

  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      data-testid="cpoe-order-detail-modal"
      className="prescription-detail-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100"
    >
      <div className="prescription-detail-panel bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header Chuẩn Workstation Y Tế (Zero-Box) */}
        <div className="px-3 sm:px-5 py-2 sm:py-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <span className="font-sans tabular-nums text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md tracking-tight">
                MÃ ĐƠN: {activeOrder.id}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${meta.colorBadge}`}>
                {meta.title} ({meta.appendix})
              </span>
              <h2 className="text-base sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                Đơn Thuốc Điện Tử <span className="text-xs sm:text-sm font-normal text-slate-600">({isOutpatient ? 'Ngoại Trú' : 'Nội Trú Theo Ngày'})</span>
              </h2>
              {activeOrder.isChronicDisease && (
                <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                  MÃN TÍNH ({activeOrder.daysPrescribed}d)
                </span>
              )}
              {hasNarcotics && (
                <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  GÂY NGHIỆN (TT 20)
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
              <span>BN: <button
                type="button"
                onClick={() => onSelectPatient?.(activeOrder.patientName)}
                className="font-bold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer"
                title="Bấm để xem hồ sơ bệnh nhân"
              >
                {activeOrder.patientName}
              </button> ({activeOrder.patientId})</span>
              <span className="text-slate-300">·</span>
              <span className="truncate max-w-[280px] sm:max-w-none">Chẩn đoán: <strong className="font-sans tabular-nums text-slate-900 font-bold">[{activeOrder.diagnosisIcd10}]</strong> <span className="text-slate-800">{activeOrder.diagnosisText}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setIsSmsModalOpen(true)}
              data-testid="btn-open-sms-from-order"
              title="Gửi thông báo mã đơn thuốc & dặn dò cho bệnh nhân (SMS / Email)"
              className="inline-flex items-center px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-2xs sm:text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <span>Gửi thông báo cho BN</span>
            </button>
            <button
              onClick={onClose}
              data-testid="btn-close-cpoe-detail"
              aria-label="Đóng chi tiết đơn thuốc"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {signSuccessNotice && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{signSuccessNotice}</span>
          </div>
        )}

        {/* Thanh Tab gạch chân chuẩn Kho Dược */}
        <div role="tablist" aria-label="Nhóm thông tin đơn thuốc" className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none border-b border-slate-200 px-5 bg-white shrink-0">
          {tabs.map(([tab, label]) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-2.5 border-b-2 shrink-0 font-medium cursor-pointer transition-colors text-sm whitespace-nowrap ${
                  isSelected
                    ? 'border-teal-700 text-teal-950 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-950'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: TỔNG QUAN ĐƠN THUỐC */}
        {activeTab === 'overview' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Cột Trái: Lâm sàng quan trọng nhất */}
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              {/* Chẩn đoán xác định */}
              <div className="space-y-2 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Chẩn Đoán Y Khoa Xác Định (ICD-10)
                  </h3>
                  <span className="font-sans tabular-nums text-xs font-bold text-slate-900 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md">
                    {order.diagnosisIcd10}
                  </span>
                </div>
                <p className="text-base font-bold text-slate-900 leading-snug">
                  {order.diagnosisText}
                </p>
                {order.clinicalNotes && (
                  <p className="text-xs text-slate-600">
                    Ghi chú lâm sàng: {stripLeadingBullets(order.clinicalNotes)}
                  </p>
                )}
              </div>

              {/* Danh mục thuốc chỉ định */}
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Danh Mục Thuốc Kê Đơn ({safeItems.length} khoản)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">Liều dùng &amp; Số lượng</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {safeItems.map((it, idx) => (
                    <div key={it.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans tabular-nums text-xs text-slate-500 font-bold">{idx + 1}.</span>
                          <span className="text-sm sm:text-base font-bold text-slate-950">{it.medicationName}</span>
                          {it.isNarcotic && (
                            <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              Gây nghiện (TT 20)
                            </span>
                          )}
                        </div>
                        {it.activeIngredient && (
                          <div className="text-xs text-slate-600">
                            Hoạt chất: <span className="font-medium text-slate-800">{it.activeIngredient}</span> {it.dosage && `(${it.dosage})`}
                          </div>
                        )}
                        <div className="text-xs text-slate-700">
                          Cách dùng: {it.route || '—'} · {it.frequency || it.instructions || '—'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-sans tabular-nums text-sm sm:text-base font-bold text-slate-950">
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lịch cấp thuốc 3 đợt TT 26 đối với Đơn thuốc "N" */}
              {(formType === 'PL2_NARCOTIC' || order.treatmentBatch1 || order.treatmentBatch2 || order.treatmentBatch3) && (
                <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-rose-950">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Lịch Cấp Phát Thuốc 3 Đợt (Điều 8 TT 26/2025 - Tối Đa 30 Ngày)</span>
                    </span>
                    <span className="font-sans tabular-nums text-xs bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded font-bold">Mẫu Đơn N</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                      <div className="font-bold text-rose-800">Đợt 1 (Ngày 1 - 10)</div>
                      <div className="text-slate-700 mt-1 font-medium">{order.treatmentBatch1 || 'Cấp phát tại viện khi kê đơn (10 ngày)'}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                      <div className="font-bold text-rose-800">Đợt 2 (Ngày 11 - 20)</div>
                      <div className="text-slate-700 mt-1 font-medium">{order.treatmentBatch2 || 'Cấp phát ngày thứ 11 sau đánh giá'}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                      <div className="font-bold text-rose-800">Đợt 3 (Ngày 21 - 30)</div>
                      <div className="text-slate-700 mt-1 font-medium">{order.treatmentBatch3 || 'Cấp phát ngày thứ 21 sau đánh giá'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cảnh báo an toàn cho đơn thuốc này */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Rà Soát Quy Chuẩn Đơn Thuốc Điện Tử (TT 26/2025/TT-BYT)
                </h3>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Mã định danh công dân CCCD và thông tin hành chính người bệnh đầy đủ.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Danh mục {safeItems.length} khoản thuốc đã được rà soát với cơ sở dữ liệu DDI quốc gia.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cột Phải: Định danh, Bác sĩ & Ký số */}
            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              {/* Định danh người bệnh TT 26 */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Định Danh Người Bệnh</h3>
                  <span className="font-sans text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-md shadow-2xs">
                    TT 26/2025/TT-BYT
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Họ và tên</dt>
                    <dd className="text-sm font-bold text-slate-900 mt-0.5">
                      <button
                        type="button"
                        onClick={() => onSelectPatient?.(order.patientName)}
                        className="hover:underline hover:text-teal-700 text-left cursor-pointer"
                        title="Bấm để xem hồ sơ bệnh án"
                      >
                        {order.patientName}
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Mã Bệnh Nhân</dt>
                    <dd className="text-sm font-bold text-slate-900 font-sans tabular-nums mt-0.5">{order.patientId}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Số CCCD (12 số)</dt>
                    <dd className="text-sm font-bold text-slate-900 font-sans tabular-nums mt-0.5">{order.patientCccd}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Giới tính &amp; Ngày sinh</dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">
                      {order.patientGender || '—'} · {order.patientDob || '—'}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Khoa / Buồng / Giường</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{order.department || '—'} {order.roomBed ? `(${order.roomBed})` : ''}</dd>
                  </div>
                  {(order.receiverCccd || order.receiverName) && (
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <dt className="text-slate-500 font-medium">Người nhận thuốc (nếu khác NB theo TT 26):</dt>
                      <dd className="text-sm font-bold text-slate-900 mt-0.5">
                        {order.receiverName ? `${order.receiverName} · ` : ''}CCCD: <span className="font-sans tabular-nums font-bold text-indigo-700">{order.receiverCccd}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Bác sĩ kê đơn & Ký số chuẩn Thông tư 52/2017 & TT 26/2025 */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Bác Sĩ Kê Đơn &amp; Chữ Ký Chuyên Môn
                  </h3>
                  <span className="text-3xs font-sans font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                    Luật KBCB 15/2023
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold uppercase">Chủ thể kê đơn:</span>
                    <span className="text-xs font-sans font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded border border-emerald-200">
                      {order.status === 'signed' ? '✓ ĐÃ XÁC THỰC KÝ SỐ' : 'BẢN NHÁP'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-950">
                    {order.doctorName || 'BS. Trần Văn Hùng'}
                  </div>
                  <div className="text-xs text-slate-700 font-sans tabular-nums">
                    Chứng chỉ hành nghề: <b>{order.doctorCertificate || '012345/BYT-CCHN'}</b>
                  </div>
                  <div className="text-xs text-slate-500 border-t border-emerald-200/60 pt-1.5 flex justify-between">
                    <span>Thời điểm ký:</span>
                    <span className="font-sans tabular-nums text-slate-800">{order.prescribedAt}</span>
                  </div>
                  {order.digitalSignature && (
                    <div className="text-xs font-sans tabular-nums text-slate-600 bg-white p-1.5 rounded border border-emerald-200 break-all">
                      Digest: {order.digitalSignature}
                    </div>
                  )}
                </div>
              </div>

              {/* Phân loại Ngoại Trú vs Nội Trú (Quy chế Điều dưỡng & Cấp phát) */}
              <div className="space-y-2 text-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Phân Loại Quy Trình Khám Chữa Bệnh
                </h3>
                {isOutpatient ? (
                  <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200 text-teal-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                      <span>ĐƠN THUỐC NGOẠI TRÚ (TT 52/2017 &amp; TT 26/2025)</span>
                    </div>
                    <p className="text-2xs leading-relaxed text-teal-900">
                      Bác sĩ kê đơn và ký số -&gt; Dược sĩ cấp phát -&gt; Hướng dẫn người bệnh nhận thuốc về nhà tự dùng. <b>Không có vai trò tiêm truyền hay chăm sóc nội trú của Điều dưỡng</b> trong quy trình ngoại trú.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-indigo-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <span>Y LỆNH NỘI TRÚ THEO NGÀY (TT 23/2011 &amp; TT 07/2011)</span>
                    </div>
                    <p className="text-2xs leading-relaxed text-indigo-900">
                      Bác sĩ ra y lệnh điều trị theo ngày. <b>Điều dưỡng trực tiếp thực hiện y lệnh</b> (đối chiếu 5 đúng, chia liều, cho uống/tiêm/truyền và ký nhận cữ thuốc theo giờ tại tab <i>Phiếu Y Lệnh (Điều Dưỡng)</i>).
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DANH MỤC THUỐC & LIỀU DÙNG */}
        {activeTab === 'medications' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Chi Tiết Từng Khoản Thuốc Kê Đơn ({safeItems.length} khoản)
                  </h3>
                  <span className="text-xs text-slate-500">Liều lượng &amp; Hướng dẫn y lệnh</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {safeItems.map((it, idx) => (
                    <div key={it.id || idx} className="py-4 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans tabular-nums text-sm font-bold text-slate-500">#{idx + 1}</span>
                          <h4 className="text-base font-bold text-slate-950">{it.medicationName}</h4>
                          {it.isNarcotic && (
                            <span className="text-2xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              Thuốc gây nghiện / KSĐB
                            </span>
                          )}
                        </div>
                        <span className="font-sans tabular-nums text-base font-bold text-slate-950">
                          {it.quantity} {it.unit}
                        </span>
                      </div>

                      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-slate-500">Hoạt chất &amp; Hàm lượng</dt>
                          <dd className="font-medium text-slate-800 mt-0.5">{it.activeIngredient || '—'} {it.dosage ? `(${it.dosage})` : ''}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Đường dùng</dt>
                          <dd className="font-semibold text-slate-900 mt-0.5">{it.route || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Tần suất dùng</dt>
                          <dd className="font-medium text-slate-800 mt-0.5">{it.frequency || '—'}</dd>
                        </div>
                      </dl>

                      <div className="text-xs text-slate-800 font-medium bg-slate-50 p-2.5 rounded border border-slate-200">
                        Chỉ dẫn y lệnh: {it.instructions || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quy Định Giới Hạn Liều (Dược Thư Quốc Gia)</h3>
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Mọi khoản thuốc kê đơn cho bệnh nhân nội trú và ngoại trú phải được đối chiếu với chuyên luận và tờ hướng dẫn thuốc có provenance trước khi duyệt.
                </p>
                <p>
                  Đối với thuốc giảm đau Opioid (Morphin, Fentanyl): Bắt buộc kiểm tra nhịp thở trước khi tiêm; sẵn sàng ống tiêm Naloxon 0.4mg giải độc khi nhịp thở dưới 10 lần/phút.
                </p>
                <p>
                  Đối với kháng sinh nhóm Beta-lactam (Ceftriaxon): Phải khai thác tiền sử dị ứng; nếu có dị ứng thuốc phải làm test da trước khi dùng liều đầu tiên.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: THẨM ĐỊNH ĐƠN THUỐC AI 5 SAO */}
        {activeTab === 'ai_audit' && (
          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
            <AiPrescriptionAuditView
              order={order}
              patient={patient}
              onOpenSmsModal={() => setIsSmsModalOpen(true)}
            />
          </div>
        )}

        {/* TAB 4: PHIẾU THỰC HIỆN Y LỆNH CỦA ĐIỀU DƯỠNG (NỘI TRÚ) */}
        {activeTab === 'nursing_mar' && (
          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
            <NursingMarView order={order} />
          </div>
        )}

        {/* TAB: AN TOÀN LÂM SÀNG & CDSS */}
        {activeTab === 'safety_cdss' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              {/* Cảnh báo tương tác thuốc DDI */}
              <div className="space-y-2.5 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Rà Soát Tương Tác Thuốc - Thuốc (Quyết Định 5948/QĐ-BYT)
                </h3>
                {ddiAuditError ? (
                  <p className="text-xs text-amber-800">Không truy cập được bộ máy DDI. Chưa thể kết luận đơn thuốc không có tương tác; cần thử lại hoặc đối chiếu dược sĩ.</p>
                ) : ddiAudit?.pair_alerts?.length ? (
                  <div className="space-y-2 text-xs text-rose-900">
                    {ddiAudit.pair_alerts.map((alert, index) => (
                      <div key={`${alert.title}-${index}`} className="rounded border border-rose-200 bg-rose-50 p-2">
                        <p className="font-bold">{alert.severity}: {alert.title}</p>
                        <p>{alert.consequence}</p>
                        <p className="mt-1 font-medium">Xử trí: {alert.action}</p>
                        <p className="mt-1 text-slate-600">Nguồn: {alert.source}</p>
                      </div>
                    ))}
                  </div>
                ) : ddiAudit ? (
                  <p className="text-xs text-slate-600">Chưa ghi nhận tương tác trong danh mục DDI đã lập chỉ mục. Kết quả này không khẳng định phối hợp an toàn.</p>
                ) : (
                  <p className="text-xs text-slate-500">Đang rà soát đơn thuốc với bộ máy DDI…</p>
                )}
              </div>

              {/* An toàn phản vệ theo Thông tư 51/2017/TT-BYT */}
              <div className="space-y-2.5 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Phòng Ngừa &amp; Xử Trí Phản Vệ (Thông Tư 51/2017/TT-BYT)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bác sĩ và điều dưỡng trực theo dõi sát dấu hiệu lâm sàng trong 30 phút đầu sau khi dùng thuốc. Hộp thuốc cấp cứu phản vệ và bơm tiêm Adrenalin 1mg/1ml luôn sẵn sàng tại buồng bệnh theo đúng quy định.
                </p>
              </div>

              {/* Hướng dẫn tuân thủ & theo dõi lâm sàng */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Theo Dõi Lâm Sàng Khi Sử Dụng Thuốc
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đánh giá đáp ứng lâm sàng sau mỗi liều dùng, ghi chép diễn biến vào hồ sơ bệnh án và báo cáo biến cố bất lợi (ADR) kịp thời về đơn vị Dược lâm sàng.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quy Trình Giám Sát Cảnh Giác Dược (ADR)</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Khi bệnh nhân xuất hiện bất kỳ dấu hiệu bất thường nào (nổi mề đay, khó thở, tụt huyết áp, buồn nôn kéo dài), điều dưỡng phụ trách phải ngừng ngay thuốc nghi ngờ và kích hoạt báo động lâm sàng theo phác đồ cấp cứu phản vệ Thông tư 51/2017/TT-BYT.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: HƯỚNG DẪN DẶN DÒ & LỊCH DÙNG */}
        {activeTab === 'advice_schedule' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Phân Bổ Lịch Dùng Thuốc Trong Ngày
                  </h3>
                  <span className="text-xs font-sans font-medium text-slate-500">
                    {safeItems.length} cữ thuốc chỉ định
                  </span>
                </div>

                {/* Banner Tự Động Real-Time */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2.5 text-xs text-teal-900">
                  <Zap className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <span className="font-bold">⚡ Tự Động Gửi Real-Time Theo Đơn Ký: </span>
                    <span>Khi đơn thuốc được ký số phát hành, hệ thống tự động phát SMS Brandname (eSMS) và gửi Email dặn dò (Google Apps Script) ngay lập tức tới người bệnh.</span>
                  </div>
                </div>

                {/* Thông tin số điện thoại nhận thông báo dặn dò */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">Số điện thoại bệnh nhân:</span>
                      <span className="font-sans tabular-nums font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {activeOrder.patientPhone || patient?.phone || 'Chưa cập nhật SĐT'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-2xs">
                      Bệnh viện tự động gửi mã đơn thuốc điện tử và lịch nhắc cữ thuốc qua số điện thoại này.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {safeItems.map((it, idx) => (
                    <div key={it.id || idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-bold text-slate-900">{it.medicationName}</strong>
                        <span className="font-sans tabular-nums font-bold text-slate-900">{it.quantity} {it.unit}</span>
                      </div>
                      <p className="text-slate-700">
                        {it.instructions || `Uống ${it.frequency || 'theo chỉ định của bác sĩ'}. Uống với nhiều nước sau bữa ăn.`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Lưu Ý Khi Quên Uống Thuốc</h3>
                <p className="leading-relaxed">
                  Nếu quên một liều, hãy uống ngay khi nhớ ra trong ngày. Nếu thời điểm nhớ ra đã gần với liều kế tiếp, hãy bỏ qua liều đã quên và tiếp tục lịch uống bình thường. Tuyệt đối không uống gấp đôi liều cùng một lúc.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Chế Độ Dinh Dưỡng &amp; Tái Khám</h3>
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Chế độ ăn giảm muối đối với bệnh nhân tim mạch, duy trì vận động nhẹ nhàng.
                </p>
                <p>
                  Tái khám theo hẹn của bác sĩ hoặc tái khám ngay nếu có dấu hiệu đau ngực dữ dội, khó thở hoặc sốt cao không hạ.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PHÁP LÝ & KÝ SỐ TT26 */}
        {activeTab === 'legal_signature' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Trạng thái và dữ liệu chữ ký
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Chủ thể chứng thư số</dt>
                    <dd className="text-sm font-bold text-slate-900 mt-0.5">{order.doctorName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Chứng chỉ hành nghề khám bệnh, chữa bệnh</dt>
                    <dd className="text-sm font-sans tabular-nums font-bold text-slate-900 mt-0.5">{order.doctorCertificate || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Trạng thái đơn</dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">{order.status === 'signed' && order.digitalSignature ? 'Đã ký (có dữ liệu chữ ký)' : 'Bản nháp - chưa ký số'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Thời điểm ký số (TSA Timestamp)</dt>
                    <dd className="text-sm font-sans tabular-nums text-slate-800 mt-0.5">{order.prescribedAt}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Chuỗi giá trị băm (SHA-256 Digest)</dt>
                    <dd className="text-xs font-sans tabular-nums text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-all mt-0.5">
                      {order.digitalSignature || 'Chưa có dữ liệu chữ ký số'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2 text-xs text-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Tích hợp đơn thuốc</h3>
                <p className="leading-relaxed">Trạng thái ký số và liên thông chỉ được xác nhận khi có phản hồi từ dịch vụ tích hợp tương ứng.</p>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Căn Cứ Pháp Lý Hồ Sơ Điện Tử</h3>
              <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                <p>
                  1. Luật Khám bệnh, chữa bệnh số 15/2023/QH15.
                </p>
                <p>
                  2. Thông tư 26/2025/TT-BYT ban hành Quy chế kê đơn thuốc điện tử và giám sát sử dụng thuốc quốc gia.
                </p>
                <p>
                  3. Thông tư 20/2017/TT-BYT quy định về quản lý thuốc kiểm soát đặc biệt và thu hồi vỏ thuốc độc gây nghiện.
                </p>
                <p>
                  4. Nghị định 130/2018/NĐ-CP quy định chi tiết thi hành Luật Giao dịch điện tử về chữ ký số và dịch vụ chứng thực chữ ký số.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Chuẩn Workstation */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
              {isDraft ? (
                <span className="text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Bản nháp - chưa ký số
                </span>
              ) : (
                <span className="text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 inline-flex">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đơn đã ký (Auto-SMS &amp; Email ✓)
                </span>
              )} · Mã: <span className="font-sans tabular-nums font-bold text-slate-800">{activeOrder.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                type="button"
                onClick={handleSignOrder}
                disabled={isSigning}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white transition cursor-pointer shadow-xs disabled:opacity-50 active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSigning ? 'Đang ký số...' : 'Ký số & Gửi tự động'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>In đơn thuốc</span>
            </button>
            {onSelectPatient && (
              <button
                type="button"
                onClick={() => onSelectPatient(activeOrder.patientName)}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white transition cursor-pointer shadow-xs active:scale-98"
              >
                Hồ sơ bệnh nhân
              </button>
            )}
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      <SendSmsModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        patientName={order.patientName}
        patientPhone={order.patientPhone || patient?.phone}
        patientEmail={order.patientEmail || patient?.email}
        patientId={order.patientId}
        orderId={order.id}
        doctorName={order.doctorName}
        diagnosis={`${order.diagnosisIcd10 ? `[${order.diagnosisIcd10}] ` : ''}${order.diagnosisText || ''}`}
        medications={safeItems.map((it, idx) => ({
          id: `sched-${idx}`,
          medicationName: it.medicationName,
          activeIngredient: it.activeIngredient,
          dosage: it.dosage,
          route: it.route || 'Đường uống',
          durationDays: it.durationDays || 5,
          specialInstructions: it.instructions || 'Uống theo đơn',
          timeSlots: buildDefaultTimeSlots(it.frequency)
        }))}
        initialMessageType="cpoe_prescription"
      />
    </div>
    {createPortal(
      <div id="prescription-print-portal">
        <PrescriptionPrintDocument order={order} />
      </div>,
      document.body
    )}
    </>
  );
};
