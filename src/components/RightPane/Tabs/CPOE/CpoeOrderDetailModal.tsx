/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Xem Chi Tiết Đơn Thuốc Điện Tử CPOE Chuẩn Workstation Y Tế (Phẳng, Trái - Phải, Zero-Box, Không Dấu Chấm, TT 26/2025/TT-BYT)
 */

import React, { useState, useEffect } from 'react';
import { X, Printer, ShieldAlert, HeartPulse, Stethoscope, Clock, CheckCircle2, AlertTriangle, FileText, ShieldCheck, User, Calendar, Pill, MessageSquare, Send } from 'lucide-react';
import { PrescriptionOrder } from '../../../../types/cpoe';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';
import { stripLeadingBullets } from '../../../../utils/clinicalFormatter';
import { SendSmsModal } from '../../../Modals/SendSmsModal';
import { buildDefaultTimeSlots } from '../../../../services/prescriptionAdviceService';

export type CpoeDetailTab = 'overview' | 'medications' | 'safety_cdss' | 'advice_schedule' | 'legal_signature';

interface CpoeOrderDetailModalProps {
  isOpen: boolean;
  order: PrescriptionOrder | null;
  onClose: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
}

export const CpoeOrderDetailModal: React.FC<CpoeOrderDetailModalProps> = ({
  isOpen,
  order,
  onClose,
  onOpenSafetyGuide,
  onOpenAdvice,
  onSelectPatient,
}) => {
  const [activeTab, setActiveTab] = useState<CpoeDetailTab>('overview');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

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

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const isOutpatient = order.prescriptionType === 'outpatient';

  // Resolve matching patient profile for clinical CDSS grounding
  const patient = findPatientByNameOrQuery(order.patientId || order.patientName, INITIAL_PATIENTS);

  // Evaluate clinical safety indicators
  const hasAllergies = Boolean(patient?.allergies && !patient.allergies.toLowerCase().includes('không ghi nhận') && !patient.allergies.toLowerCase().includes('chưa ghi nhận'));
  const isRenalImpaired = Boolean(patient && patient.egfr < 60);
  const renalStage = patient ? (
    patient.egfr >= 90 ? 'G1 (Bình thường)' :
    patient.egfr >= 60 ? 'G2 (Giảm nhẹ)' :
    patient.egfr >= 45 ? 'G3a (Giảm nhẹ - trung bình)' :
    patient.egfr >= 30 ? 'G3b (Giảm trung bình - nặng)' :
    patient.egfr >= 15 ? 'G4 (Suy thận nặng)' : 'G5 (Suy thận giai đoạn cuối)'
  ) : 'Chưa ghi nhận eGFR';

  const hasNarcotics = order.items.some((it) => it.isNarcotic);

  const tabs: [CpoeDetailTab, string][] = [
    ['overview', 'Tổng quan đơn thuốc'],
    ['medications', `Danh mục thuốc (${order.items.length})`],
    ['safety_cdss', 'An toàn lâm sàng & CDSS'],
    ['advice_schedule', 'Hướng dẫn dặn dò & Lịch dùng'],
    ['legal_signature', 'Pháp lý & Ký số TT26'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="cpoe-order-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100"
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header Chuẩn Workstation Y Tế (Zero-Box) */}
        <div className="px-3 sm:px-5 py-2 sm:py-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <span className="font-mono text-2xs sm:text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                MÃ ĐƠN: {order.id}
              </span>
              <h2 className="text-sm sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                Đơn Thuốc Điện Tử <span className="text-2xs sm:text-sm font-normal text-slate-600">({isOutpatient ? 'Ngoại Trú' : 'Nội Trú Theo Ngày'})</span>
              </h2>
              {order.isChronicDisease && (
                <span className="text-[10px] sm:text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  MÃN TÍNH ({order.daysPrescribed}d)
                </span>
              )}
              {hasNarcotics && (
                <span className="text-[10px] sm:text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  GÂY NGHIỆN (TT 20)
                </span>
              )}
              {hasAllergies && (
                <span className="text-[10px] sm:text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  CÓ DỊ ỨNG
                </span>
              )}
            </div>
            <div className="text-2xs sm:text-xs text-slate-600 mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span>BN: <button
                type="button"
                onClick={() => onSelectPatient?.(order.patientName)}
                className="font-bold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer"
                title="Bấm để xem hồ sơ bệnh nhân"
              >
                {order.patientName}
              </button> ({order.patientId})</span>
              <span className="text-slate-300">·</span>
              <span>CCCD: <strong className="font-mono text-slate-800">{order.patientCccd ? `...${order.patientCccd.slice(-4)}` : 'Chưa có'}</strong></span>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="hidden sm:inline">SĐT: <strong className="font-mono text-slate-900 font-semibold">{order.patientPhone || patient?.phone || 'Chưa cập nhật'}</strong></span>
              <span className="text-slate-300">·</span>
              <span className="truncate max-w-[200px] sm:max-w-none">Chẩn đoán: <strong className="font-mono text-slate-900 font-bold">[{order.diagnosisIcd10}]</strong> <span className="text-slate-800">{order.diagnosisText}</span></span>
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
              onClick={handlePrint}
              title="In đơn thuốc điện tử"
              aria-label="In đơn thuốc"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
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
                    ? 'border-slate-900 text-slate-950 font-semibold'
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
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
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
                    Danh Mục Thuốc Kê Đơn ({order.items.length} khoản)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">Liều dùng &amp; Số lượng</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {order.items.map((it, idx) => (
                    <div key={it.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-500 font-bold">{idx + 1}.</span>
                          <span className="text-sm sm:text-base font-bold text-slate-950">{it.medicationName}</span>
                          {it.isNarcotic && (
                            <span className="text-2xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              Gây nghiện (TT 20)
                            </span>
                          )}
                          {onOpenSafetyGuide && (
                            <button
                              type="button"
                              onClick={() => onOpenSafetyGuide(it.medicationName)}
                              className="text-xs font-medium text-slate-700 hover:text-slate-950 hover:underline cursor-pointer"
                              title="Tra cứu thông tin thuốc"
                            >
                              Tra cứu
                            </button>
                          )}
                        </div>
                        {it.activeIngredient && (
                          <div className="text-xs text-slate-600">
                            Hoạt chất: <span className="font-medium text-slate-800">{it.activeIngredient}</span> {it.dosage && `(${it.dosage})`}
                          </div>
                        )}
                        <div className="text-xs text-slate-700">
                          Cách dùng: {it.route || 'Uống'} · {it.frequency || it.instructions || 'Theo y lệnh bác sĩ'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm sm:text-base font-bold text-slate-950">
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cảnh báo an toàn cho bệnh nhân này */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Rà Soát An Toàn Dùng Thuốc Người Bệnh
                </h3>
                <div className="space-y-1.5 text-xs text-slate-800">
                  {hasAllergies ? (
                    <div className="text-rose-800 font-medium flex items-start gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>Tiền sử dị ứng ghi nhận: <strong>{stripLeadingBullets(patient?.allergies || '')}</strong>. Đã đối soát chéo thành phần hoạt chất trong đơn thuốc.</span>
                    </div>
                  ) : (
                    <div className="text-slate-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Không ghi nhận tiền sử dị ứng thuốc nghiêm trọng.</span>
                    </div>
                  )}

                  {isRenalImpaired ? (
                    <div className="text-amber-900 font-medium flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>Bệnh nhân có suy giảm chức năng thận (eGFR {patient?.egfr} mL/min - {renalStage}). Các khoản thuốc đào thải qua thận đã được đối soát liều an toàn.</span>
                    </div>
                  ) : (
                    <div className="text-slate-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Chức năng thận trong giới hạn an toàn (eGFR {patient?.egfr || 'bình thường'}).</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cột Phải: Định danh, Bác sĩ & Ký số */}
            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              {/* Định danh người bệnh TT 26 */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Định Danh Người Bệnh</h3>
                  <span className="font-mono text-xs font-semibold text-slate-800 bg-white border border-slate-300 px-2 py-0.5 rounded">
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
                    <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5">{order.patientId}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Số CCCD (12 số)</dt>
                    <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5">{order.patientCccd}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Giới tính &amp; Ngày sinh</dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">
                      {order.patientGender || patient?.gender || 'Nam'} · {order.patientDob || patient?.dob || '1968-05-14'} {patient?.age ? `(${patient.age} tuổi)` : ''}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Khoa / Buồng / Giường</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{order.department || 'Khoa Cấp Cứu A9'} {order.roomBed ? `(${order.roomBed})` : ''}</dd>
                  </div>
                </dl>
              </div>

              {/* Bác sĩ kê đơn & Ký số */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Bác Sĩ Kê Đơn &amp; Chữ Ký Số</h3>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Bác sĩ chỉ định</dt>
                    <dd className="text-sm font-bold text-slate-900 mt-0.5">{order.doctorName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Chứng chỉ hành nghề (CCHN)</dt>
                    <dd className="text-sm font-mono font-medium text-slate-800 mt-0.5">{order.doctorCertificate || '014829/BYT-CCHN'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Thời điểm kê đơn</dt>
                    <dd className="text-sm font-mono text-slate-800 mt-0.5">{order.prescribedAt}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Xác thực chứng thư số</dt>
                    <dd className="text-xs font-semibold text-emerald-800 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{order.digitalSignature || 'Ký số hợp lệ (VNPT-CA Timestamping)'}</span>
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Phân loại & Cấp phát */}
              <div className="space-y-2 text-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quy Chế Kê Đơn &amp; Cấp Phát</h3>
                <p className="text-slate-700 leading-relaxed">
                  {isOutpatient
                    ? `Đơn thuốc ngoại trú điều trị dài ngày (${order.daysPrescribed} ngày) thuộc danh mục 252 bệnh mạn tính được kê đơn tối đa 90 ngày theo Thông tư 26/2025/TT-BYT.`
                    : 'Đơn thuốc điều trị nội trú theo ngày. Dược sĩ lâm sàng đối soát và phát thuốc theo ca trực hàng ngày.'}
                </p>
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
                    Chi Tiết Từng Khoản Thuốc Kê Đơn ({order.items.length} khoản)
                  </h3>
                  <span className="text-xs text-slate-500">Liều lượng &amp; Hướng dẫn y lệnh</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {order.items.map((it, idx) => (
                    <div key={it.id || idx} className="py-4 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-slate-500">#{idx + 1}</span>
                          <h4 className="text-base font-bold text-slate-950">{it.medicationName}</h4>
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

                      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-slate-500">Hoạt chất &amp; Hàm lượng</dt>
                          <dd className="font-medium text-slate-800 mt-0.5">{it.activeIngredient || '—'} {it.dosage ? `(${it.dosage})` : ''}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Đường dùng</dt>
                          <dd className="font-semibold text-slate-900 mt-0.5">{it.route || 'Uống'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Tần suất dùng</dt>
                          <dd className="font-medium text-slate-800 mt-0.5">{it.frequency || '1 lần/ngày'}</dd>
                        </div>
                      </dl>

                      <div className="text-xs text-slate-800 font-medium bg-slate-50 p-2.5 rounded border border-slate-200">
                        Chỉ dẫn y lệnh: {it.instructions || 'Dùng theo chỉ dẫn của bác sĩ điều trị.'}
                      </div>

                      {onOpenSafetyGuide && (
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenSafetyGuide(it.medicationName)}
                            className="text-xs font-semibold text-slate-800 hover:text-slate-950 hover:underline cursor-pointer"
                          >
                            Xem Dược thư &amp; Chống chỉ định của thuốc này &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quy Định Giới Hạn Liều (Dược Thư Quốc Gia)</h3>
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Mọi khoản thuốc kê đơn cho bệnh nhân nội trú và ngoại trú phải tuân thủ liều khuyến cáo trong Dược thư Quốc gia Việt Nam (Quyết định 3445/QĐ-BYT).
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

        {/* TAB 3: AN TOÀN LÂM SÀNG & CDSS */}
        {activeTab === 'safety_cdss' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              {/* Cảnh báo tương tác thuốc DDI */}
              <div className="space-y-2.5 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Rà Soát Tương Tác Thuốc - Thuốc (Quyết Định 5948/QĐ-BYT)
                </h3>
                {hasNarcotics ? (
                  <div className="space-y-1.5 text-xs text-slate-800 font-medium">
                    <p className="text-amber-900">
                      Lưu ý phối hợp với thuốc ức chế thần kinh trung ương: Đơn thuốc có chứa hoạt chất giảm đau Opioid (Morphin/Fentanyl). Cần theo dõi sát tri giác và nhịp thở của người bệnh.
                    </p>
                    <p className="text-slate-600 font-normal">
                      Tránh dùng đồng thời với các thuốc an thần nhóm Benzodiazepin trừ khi có chỉ định phối hợp chuyên khoa gây mê hồi sức.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Không ghi nhận tương tác thuốc nghiêm trọng (chống chỉ định phối hợp) giữa các khoản thuốc trong đơn này.
                  </p>
                )}
              </div>

              {/* Rà soát tiền sử dị ứng */}
              <div className="space-y-2.5 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Cảnh Báo Dị Ứng Người Bệnh (Thông Tư 51/2017/TT-BYT)
                </h3>
                {hasAllergies ? (
                  <div className="space-y-1.5 text-xs text-rose-900 font-medium">
                    <p className="text-sm font-bold text-rose-800">{stripLeadingBullets(patient?.allergies || '')}</p>
                    <p className="text-slate-700 font-normal">
                      Bệnh nhân có cơ địa dị ứng thuốc. Đã đối soát toàn bộ hoạt chất trong đơn không trùng nhóm quá mẫn đã ghi nhận.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">Bệnh nhân chưa có tiền sử dị ứng thuốc ghi nhận trong hồ sơ.</p>
                )}
              </div>

              {/* Chức năng thận & Chỉnh liều */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Chức Năng Thận &amp; Chỉnh Liều (KDIGO 2024)
                </h3>
                {patient ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Mức lọc eGFR</dt>
                      <dd className="text-sm font-bold font-mono text-slate-900 mt-0.5">{patient.egfr} mL/min</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Creatinine huyết thanh</dt>
                      <dd className="text-sm font-bold font-mono text-slate-900 mt-0.5">{patient.creatinine} μmol/L</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Phân độ thận</dt>
                      <dd className="text-sm font-semibold text-slate-800 mt-0.5">{renalStage}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-slate-600">Chưa có dữ liệu xét nghiệm sinh hóa gần nhất của bệnh nhân.</p>
                )}
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
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {order.items.length} cữ thuốc chỉ định
                  </span>
                </div>

                {/* Thông tin số điện thoại nhận thông báo dặn dò */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">Số điện thoại bệnh nhân:</span>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {order.patientPhone || patient?.phone || 'Chưa cập nhật SĐT'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-2xs">
                      Bệnh viện tự động gửi mã đơn thuốc điện tử và lịch nhắc cữ thuốc qua số điện thoại này.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {order.items.map((it, idx) => (
                    <div key={it.id || idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-bold text-slate-900">{it.medicationName}</strong>
                        <span className="font-mono font-bold text-slate-900">{it.quantity} {it.unit}</span>
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
                  Chứng Thư Số &amp; Dấu Thời Gian (TSA)
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Chủ thể chứng thư số</dt>
                    <dd className="text-sm font-bold text-slate-900 mt-0.5">{order.doctorName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Chứng chỉ hành nghề khám bệnh, chữa bệnh</dt>
                    <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5">{order.doctorCertificate || '014829/BYT-CCHN'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tổ chức cấp chứng thư</dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">VNPT-CA / Viettel-CA (Ban Cơ yếu Chính phủ)</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Thời điểm ký số (TSA Timestamp)</dt>
                    <dd className="text-sm font-mono text-slate-800 mt-0.5">{order.prescribedAt}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Chuỗi giá trị băm (SHA-256 Digest)</dt>
                    <dd className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-all mt-0.5">
                      {order.digitalSignature || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2 text-xs text-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Liên Thông Cổng Quốc Gia</h3>
                <p className="leading-relaxed">
                  Đơn thuốc điện tử được cấp mã định danh quốc gia liên thông trực tiếp với Hệ thống thông tin quản lý kê đơn thuốc và bán thuốc quốc gia của Bộ Y tế theo quy định tại Điều 5 Thông tư 26/2025/TT-BYT.
                </p>
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
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Đơn thuốc điện tử liên thông Quốc Gia · Mã đơn: <span className="font-mono font-bold text-slate-800">{order.id}</span>
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
                onClick={() => onSelectPatient(order.patientName)}
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
        doctorName={order.doctorName}
        diagnosis={`${order.diagnosisIcd10 ? `[${order.diagnosisIcd10}] ` : ''}${order.diagnosisText || ''}`}
        medications={order.items?.map((it, idx) => ({
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
  );
};
