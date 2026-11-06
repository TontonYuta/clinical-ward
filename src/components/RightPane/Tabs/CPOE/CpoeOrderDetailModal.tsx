/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Xem Chi Tiết Đơn Thuốc Điện Tử CPOE Chuẩn Workstation Y Tế (Phẳng, Trái - Phải, Zero-Box, Không Dấu Chấm, TT 26/2025/TT-BYT)
 */

import { prescriptionState } from '../../../ui/workspaceStatus';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  ShieldAlert,
  HeartPulse,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  Pill,
  MessageSquare,
  Send,
} from 'lucide-react';
import {
  PrescriptionOrder,
  resolveTt26FormType,
  getTt26FormMetadata,
} from '../../../../types/cpoe';
import { findPatientByNameOrQuery, type PatientProfile } from '../../../../services/patientService';
import { stripLeadingBullets } from '../../../../utils/clinicalFormatter';
import { SendSmsModal } from '../../../Modals/SendSmsModal';
import { buildDefaultTimeSlots } from '../../../../services/prescriptionAdviceService';
import { auditPrescriptionDdiApi } from '../../../../services/api';
import { PrescriptionPrintDocument } from './PrescriptionPrintDocument';
import { NursingMarView } from './NursingMarView';
import { AiPrescriptionAuditView } from './AiPrescriptionAuditView';

export type CpoeDetailTab =
  | 'overview'
  | 'medications'
  | 'safety_cdss'
  | 'ai_audit'
  | 'nursing_mar'
  | 'advice_schedule'
  | 'legal_signature';

interface CpoeOrderDetailModalProps {
  patients?: PatientProfile[];
  isOpen: boolean;
  order: PrescriptionOrder | null;
  onClose: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
}

export const CpoeOrderDetailModal: React.FC<CpoeOrderDetailModalProps> = ({
  patients = [],
  isOpen,
  order,
  onClose,
  onOpenSafetyGuide,
  onOpenAdvice,
  onSelectPatient,
}) => {
  const [activeTab, setActiveTab] = useState<CpoeDetailTab>('overview');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [ddiAudit, setDdiAudit] = useState<{
    pair_alerts: Array<{
      severity: string;
      title: string;
      consequence: string;
      action: string;
      source: string;
    }>;
    has_contraindication: boolean;
  } | null>(null);
  const [ddiAuditError, setDdiAuditError] = useState(false);

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
    auditPrescriptionDdiApi(
      items.map((item) => item?.activeIngredient || item?.medicationName).filter(Boolean),
    )
      .then(setDdiAudit)
      .catch(() => setDdiAuditError(true));
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const safeItems = Array.isArray(order.items) ? order.items : [];

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
      window.alert(
        'Trình duyệt không mở được hộp thoại in. Hãy thử lại hoặc kiểm tra quyền in của trình duyệt.',
      );
    }
  };

  const isOutpatient = order.prescriptionType === 'outpatient';
  const formType = resolveTt26FormType(order);
  const meta = getTt26FormMetadata(formType);

  // Resolve matching patient profile for clinical CDSS grounding
  const patient = findPatientByNameOrQuery(order.patientId || order.patientName, patients);
  const isDraft = order.status === 'draft' || !order.digitalSignature;

  const hasNarcotics = safeItems.some((it) => it?.isNarcotic);

  const isInpatient = order.prescriptionType === 'inpatient_daily';

  const group = ['overview', 'medications'].includes(activeTab)
    ? 'order'
    : ['safety_cdss', 'ai_audit'].includes(activeTab)
      ? 'safety'
      : 'followup';
  const groups = [
    { id: 'order', label: 'Thông tin', first: 'overview' },
    { id: 'safety', label: 'An toàn', first: 'safety_cdss' },
    { id: 'followup', label: 'Theo dõi', first: 'advice_schedule' },
  ] as const;
  const tabs: [CpoeDetailTab, string][] =
    group === 'order'
      ? [
          ['overview', 'Tóm tắt'],
          ['medications', `Thuốc (${safeItems.length})`],
        ]
      : group === 'safety'
        ? [
            ['safety_cdss', 'Thông tin lâm sàng'],
            ['ai_audit', 'Thẩm định'],
          ]
        : [
            ['advice_schedule', 'Dặn dò & lịch dùng'],
            ...(isInpatient
              ? [['nursing_mar', 'Thực hiện y lệnh'] as [CpoeDetailTab, string]]
              : []),
            ['legal_signature', 'Thông tin ký đơn'],
          ];

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        data-testid="cpoe-order-detail-modal"
        className="clinical-modal-overlay prescription-detail-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100"
      >
        <div className="prescription-detail-panel bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden text-slate-900">
          {/* Header Chuẩn Workstation Y Tế (Zero-Box) */}
          <div className="px-3 sm:px-5 py-2 sm:py-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                <span className="font-mono text-2xs sm:text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                  MÃ ĐƠN: {order.id}
                </span>
                <span
                  className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded border ${meta.colorBadge}`}
                >
                  {meta.title} ({meta.appendix})
                </span>
                <h2 className="text-sm sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                  Đơn Thuốc Điện Tử{' '}
                  <span className="text-2xs sm:text-sm font-normal text-slate-600">
                    ({isOutpatient ? 'Ngoại Trú' : 'Nội Trú Theo Ngày'})
                  </span>
                </h2>
                {order.isChronicDisease && (
                  <span className="text-[10px] sm:text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    MÃN TÍNH ({order.daysPrescribed}d)
                  </span>
                )}
                {hasNarcotics && (
                  <span className="text-[10px] sm:text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    THUỐC GÂY NGHIỆN
                  </span>
                )}
              </div>
              <div className="text-2xs sm:text-xs text-slate-600 mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span>
                  BN:{' '}
                  <button
                    type="button"
                    onClick={() => onSelectPatient?.(order.patientName)}
                    className="font-bold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer"
                    title="Bấm để xem hồ sơ bệnh nhân"
                  >
                    {order.patientName}
                  </button>{' '}
                  ({order.patientId})
                </span>
                <span className="text-slate-300">·</span>
                <span className="truncate max-w-[280px] sm:max-w-none">
                  Chẩn đoán:{' '}
                  <strong className="font-mono text-slate-900 font-bold">
                    [{order.diagnosisIcd10}]
                  </strong>{' '}
                  <span className="text-slate-800">{order.diagnosisText}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-auto shrink-0">
              <button
                onClick={() => setIsSmsModalOpen(true)}
                data-testid="btn-open-sms-from-order"
                title="Gửi thông báo mã đơn thuốc & dặn dò cho bệnh nhân (SMS / Email)"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-2xs sm:text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <Send className="w-3.5 h-3.5 text-slate-600" />
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

          <div className="detail-navigation">
            <div className="segment-control" aria-label="Nhóm thông tin đơn thuốc">
              {groups.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  aria-pressed={group === g.id}
                  onClick={() => setActiveTab(g.first)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div role="tablist" aria-label="Chi tiết nhóm" className="detail-subtabs">
              {tabs.map(([tab, label]) => (
                <button
                  type="button"
                  role="tab"
                  key={tab}
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: TỔNG QUAN ĐƠN THUỐC */}
          {activeTab === 'overview' && (
            <div role="tabpanel" className="detail-overview-scroll">
              <section className="detail-clinical-summary">
                <h3>{order.diagnosisText}</h3>
                <span className="record-sub record-mono">
                  {order.diagnosisIcd10} · {order.prescribedAt}
                </span>
                <div className="flex flex-wrap items-center gap-3 mt-5">
                  <span className="status-pill">
                    {isOutpatient ? 'Ngoại trú' : 'Nội trú theo ngày'}
                  </span>
                  <span className="record-sub !mt-0">
                    {safeItems.length} thuốc · {order.daysPrescribed} ngày
                  </span>
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => setActiveTab('medications')}
                  >
                    Xem đầy đủ thuốc & cách dùng →
                  </button>
                </div>
              </section>
              <div className="detail-info-grid">
                <section>
                  <p className="section-kicker">Người bệnh</p>
                  <h3>
                    <button
                      type="button"
                      className="record-link !text-lg"
                      onClick={() => onSelectPatient?.(order.patientId)}
                    >
                      {order.patientName}
                    </button>
                  </h3>
                  <dl className="detail-facts">
                    <div>
                      <dt>Mã hồ sơ</dt>
                      <dd>{order.patientId}</dd>
                    </div>
                    <div>
                      <dt>Giới tính / Ngày sinh</dt>
                      <dd>
                        {order.patientGender || '—'} · {order.patientDob || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Định danh (nếu có)</dt>
                      <dd>{order.patientCccd || 'Chưa ghi nhận'}</dd>
                    </div>
                    {order.patientInsuranceId && (
                      <div>
                        <dt>BHYT (nếu có)</dt>
                        <dd>{order.patientInsuranceId}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Khoa / Buồng giường</dt>
                      <dd>
                        {order.department || '—'} {order.roomBed || ''}
                      </dd>
                    </div>
                    {order.patientAddress && (
                      <div>
                        <dt>Địa chỉ</dt>
                        <dd>{order.patientAddress}</dd>
                      </div>
                    )}
                    {order.guardianName && (
                      <div>
                        <dt>Người đại diện</dt>
                        <dd>{order.guardianName}</dd>
                      </div>
                    )}
                    {order.patientWeight && (
                      <div>
                        <dt>Cân nặng</dt>
                        <dd>{order.patientWeight} kg</dd>
                      </div>
                    )}
                  </dl>
                </section>
                <section>
                  <p className="section-kicker">Người chỉ định</p>
                  <h3 className="text-lg font-medium">{order.doctorName || 'Chưa ghi nhận'}</h3>
                  <dl className="detail-facts">
                    <div>
                      <dt>Giấy phép / CCHN</dt>
                      <dd>{order.doctorCertificate || 'Chưa ghi nhận'}</dd>
                    </div>
                    <div>
                      <dt>Trạng thái hồ sơ</dt>
                      <dd>{prescriptionState(order).label}</dd>
                    </div>
                    <div>
                      <dt>Mẫu đơn</dt>
                      <dd>
                        {meta.title} · {meta.appendix}
                      </dd>
                    </div>
                    {(order.receiverName || order.receiverCccd) && (
                      <div>
                        <dt>Người nhận thuốc</dt>
                        <dd>
                          {order.receiverName} · {order.receiverCccd || '—'}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="record-sub mt-6">
                    Trạng thái hồ sơ không thay thế việc kiểm tra chữ ký điện tử hoặc rà soát chuyên
                    môn.
                  </p>
                </section>
              </div>
              {order.clinicalNotes && (
                <section className="detail-clinical-summary mb-5">
                  <p className="eyebrow">Ghi chú lâm sàng</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {order.clinicalNotes}
                  </p>
                </section>
              )}
              {(order.treatmentBatch1 || order.treatmentBatch2 || order.treatmentBatch3) && (
                <section className="detail-clinical-summary">
                  <p className="eyebrow">Lịch cấp thuốc theo đợt</p>
                  <dl className="detail-facts">
                    {[order.treatmentBatch1, order.treatmentBatch2, order.treatmentBatch3].map(
                      (value, i) =>
                        value && (
                          <div key={i}>
                            <dt>Đợt {i + 1}</dt>
                            <dd className="whitespace-pre-wrap">{value}</dd>
                          </div>
                        ),
                    )}
                  </dl>
                </section>
              )}
            </div>
          )}

          {activeTab === 'medications' && (
            <div
              role="tabpanel"
              className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
            >
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Chi Tiết Từng Khoản Thuốc Kê Đơn ({safeItems.length} khoản)
                    </h3>
                    <span className="text-xs text-slate-500">
                      Liều lượng &amp; Hướng dẫn y lệnh
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {safeItems.map((it, idx) => (
                      <div key={it.id || idx} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-slate-500">
                              #{idx + 1}
                            </span>
                            <h4 className="text-base font-bold text-slate-950">
                              {it.medicationName}
                            </h4>
                            {it.isNarcotic && (
                              <span className="text-2xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                Thuốc gây nghiện / KSĐB
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-base font-bold text-slate-950">
                            {it.quantity} {it.unit}
                          </span>
                        </div>

                        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          <div>
                            <dt className="text-slate-500">Hoạt chất</dt>
                            <dd className="font-medium text-slate-800 mt-0.5">
                              {it.activeIngredient || '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Liều kê</dt>
                            <dd className="font-medium text-slate-800 mt-0.5">{it.dosage || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Đường dùng</dt>
                            <dd className="font-semibold text-slate-900 mt-0.5">
                              {it.route || '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Tần suất dùng</dt>
                            <dd className="font-medium text-slate-800 mt-0.5">
                              {it.frequency || '—'}
                            </dd>
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Cần đối chiếu trước khi duyệt
                </h3>
                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <p>
                    Mọi khoản thuốc kê đơn cho bệnh nhân nội trú và ngoại trú phải được đối chiếu
                    với chuyên luận và tờ hướng dẫn của đúng thuốc có nguồn xác nhận trước khi duyệt.
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
            <div
              role="tabpanel"
              className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
            >
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
                {/* Cảnh báo tương tác thuốc DDI */}
                <div className="space-y-2.5 pb-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Rà Soát Tương Tác Thuốc - Thuốc (Quyết Định 5948/QĐ-BYT)
                  </h3>
                  {ddiAuditError ? (
                    <p className="text-xs text-amber-800">
                      Không truy cập được bộ máy DDI. Chưa thể kết luận đơn thuốc không có tương
                      tác; cần thử lại hoặc đối chiếu dược sĩ.
                    </p>
                  ) : ddiAudit?.pair_alerts?.length ? (
                    <div className="space-y-2 text-xs text-rose-900">
                      {ddiAudit.pair_alerts.map((alert, index) => (
                        <div
                          key={`${alert.title}-${index}`}
                          className="rounded border border-rose-200 bg-rose-50 p-2"
                        >
                          <p className="font-bold">
                            {alert.severity}: {alert.title}
                          </p>
                          <p>{alert.consequence}</p>
                          <p className="mt-1 font-medium">Xử trí: {alert.action}</p>
                          <p className="mt-1 text-slate-600">Nguồn: {alert.source}</p>
                        </div>
                      ))}
                    </div>
                  ) : ddiAudit ? (
                    <p className="text-xs text-slate-600">
                      Chưa ghi nhận tương tác trong danh mục DDI đã lập chỉ mục. Kết quả này không
                      khẳng định phối hợp an toàn.
                    </p>
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
                    Bác sĩ và điều dưỡng trực theo dõi sát dấu hiệu lâm sàng trong 30 phút đầu sau
                    khi dùng thuốc. Hộp thuốc cấp cứu phản vệ và bơm tiêm Adrenalin 1mg/1ml luôn sẵn
                    sàng tại buồng bệnh theo đúng quy định.
                  </p>
                </div>

                {/* Hướng dẫn tuân thủ & theo dõi lâm sàng */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Theo Dõi Lâm Sàng Khi Sử Dụng Thuốc
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Đánh giá đáp ứng lâm sàng sau mỗi liều dùng, ghi chép diễn biến vào hồ sơ bệnh
                    án và báo cáo biến cố bất lợi (ADR) kịp thời về đơn vị Dược lâm sàng.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Quy Trình Giám Sát Cảnh Giác Dược (ADR)
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Khi bệnh nhân xuất hiện bất kỳ dấu hiệu bất thường nào (nổi mề đay, khó thở, tụt
                  huyết áp, buồn nôn kéo dài), điều dưỡng phụ trách phải ngừng ngay thuốc nghi ngờ
                  và kích hoạt báo động lâm sàng theo phác đồ cấp cứu phản vệ Thông tư
                  51/2017/TT-BYT.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: HƯỚNG DẪN DẶN DÒ & LỊCH DÙNG */}
          {activeTab === 'advice_schedule' && (
            <div
              role="tabpanel"
              className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
            >
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
                <div className="space-y-3 pb-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Phân Bổ Lịch Dùng Thuốc Trong Ngày
                    </h3>
                    <span className="text-xs font-mono font-medium text-slate-500">
                      {safeItems.length} cữ thuốc chỉ định
                    </span>
                  </div>

                  {/* Thông tin số điện thoại nhận thông báo dặn dò */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          Số điện thoại bệnh nhân:
                        </span>
                        <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {order.patientPhone || patient?.phone || 'Chưa cập nhật SĐT'}
                        </span>
                      </div>
                      <p className="text-slate-500 text-2xs">
                        Bệnh viện tự động gửi mã đơn thuốc điện tử và lịch nhắc cữ thuốc qua số điện
                        thoại này.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {safeItems.map((it, idx) => (
                      <div
                        key={it.id || idx}
                        className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-bold text-slate-900">
                            {it.medicationName}
                          </strong>
                          <span className="font-mono font-bold text-slate-900">
                            {it.quantity} {it.unit}
                          </span>
                        </div>
                        <p className="text-slate-700">
                          {it.instructions ||
                            `Uống ${it.frequency || 'theo chỉ định của bác sĩ'}. Uống với nhiều nước sau bữa ăn.`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Lưu Ý Khi Quên Uống Thuốc
                  </h3>
                  <p className="leading-relaxed">
                    Nếu quên một liều, hãy uống ngay khi nhớ ra trong ngày. Nếu thời điểm nhớ ra đã
                    gần với liều kế tiếp, hãy bỏ qua liều đã quên và tiếp tục lịch uống bình thường.
                    Tuyệt đối không uống gấp đôi liều cùng một lúc.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Chế Độ Dinh Dưỡng &amp; Tái Khám
                </h3>
                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <p>Chế độ ăn giảm muối đối với bệnh nhân tim mạch, duy trì vận động nhẹ nhàng.</p>
                  <p>
                    Tái khám theo hẹn của bác sĩ hoặc tái khám ngay nếu có dấu hiệu đau ngực dữ dội,
                    khó thở hoặc sốt cao không hạ.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PHÁP LÝ & KÝ SỐ TT26 */}
          {activeTab === 'legal_signature' && (
            <div
              role="tabpanel"
              className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
            >
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
                <div className="space-y-3 pb-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Trạng thái và dữ liệu chữ ký
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Chủ thể chứng thư số</dt>
                      <dd className="text-sm font-bold text-slate-900 mt-0.5">
                        {order.doctorName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Chứng chỉ hành nghề khám bệnh, chữa bệnh</dt>
                      <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                        {order.doctorCertificate || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Trạng thái đơn</dt>
                      <dd className="text-sm font-medium text-slate-800 mt-0.5">
                        {prescriptionState(order).label}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Thời điểm ký số (TSA Timestamp)</dt>
                      <dd className="text-sm font-mono text-slate-800 mt-0.5">
                        {order.prescribedAt}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500">Chuỗi giá trị băm (SHA-256 Digest)</dt>
                      <dd className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-all mt-0.5">
                        {order.digitalSignature || 'Chưa có dữ liệu chữ ký số'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-2 text-xs text-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Tích hợp đơn thuốc
                  </h3>
                  <p className="leading-relaxed">
                    Trạng thái ký số và liên thông chỉ được xác nhận khi có phản hồi từ dịch vụ tích
                    hợp tương ứng.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Căn Cứ Pháp Lý Hồ Sơ Điện Tử
                </h3>
                <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  <p>1. Luật Khám bệnh, chữa bệnh số 15/2023/QH15.</p>
                  <p>
                    2. Thông tư 26/2025/TT-BYT ban hành Quy chế kê đơn thuốc điện tử và giám sát sử
                    dụng thuốc quốc gia.
                  </p>
                  <p>
                    3. Thông tư 20/2017/TT-BYT quy định về quản lý thuốc kiểm soát đặc biệt và thu
                    hồi vỏ thuốc độc gây nghiện.
                  </p>
                  <p>
                    4. Nghị định 130/2018/NĐ-CP quy định chi tiết thi hành Luật Giao dịch điện tử về
                    chữ ký số và dịch vụ chứng thực chữ ký số.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer Chuẩn Workstation */}
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500">
              {prescriptionState(order).label} · Mã nội bộ:{' '}
              <span className="font-mono font-bold text-slate-800">{order.id}</span>
            </div>
            <div className="flex items-center gap-2">
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
                  onClick={() => onSelectPatient(order.patientId || order.patientName)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs"
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
          orderStatus={order.status}
          facilityName={order.facilityName}
          department={order.department}
          prescribedAt={order.prescribedAt}
          clinicalNotes={order.clinicalNotes}
          doctorName={order.doctorName}
          diagnosis={`${order.diagnosisIcd10 ? `[${order.diagnosisIcd10}] ` : ''}${order.diagnosisText || ''}`}
          medications={safeItems.map((it, idx) => ({
            id: `sched-${idx}`,
            medicationName: it.medicationName,
            activeIngredient: it.activeIngredient,
            dosage: it.dosage, frequency: it.frequency,
            route: it.route || '',
            durationDays: it.durationDays || order.daysPrescribed || 0,
            specialInstructions: it.instructions || undefined,
            timeSlots: buildDefaultTimeSlots(it.frequency),
          }))}
          initialMessageType="cpoe_prescription"
        />
      </div>
      {createPortal(
        <div id="prescription-print-portal">
          <PrescriptionPrintDocument order={order} />
        </div>,
        document.body,
      )}
    </>
  );
};
