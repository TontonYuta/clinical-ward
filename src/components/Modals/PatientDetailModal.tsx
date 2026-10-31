/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Chi Tiết Hồ Sơ Bệnh Nhân Lâm Sàng Chuẩn Workstation Y Tế (Phẳng, Trái - Phải, Zero-Box, Không Dấu Chấm)
 */

import React, { useState, useEffect } from 'react';
import { X, Printer, ShieldAlert, HeartPulse, User, Phone, Mail, Stethoscope, Clock, CheckCircle2, AlertTriangle, FileText, Send, MessageSquare } from 'lucide-react';
import { PatientProfile, findPatientByNameOrQuery, findPatientsByQuery, INITIAL_PATIENTS } from '../../services/patientService';
import { INITIAL_PRESCRIPTIONS } from '../../data/mockCpoeData';
import { INITIAL_DEBT_RECORDS } from '../../data/initialData';
import { stripLeadingBullets } from '../../utils/clinicalFormatter';
import { SendSmsModal } from './SendSmsModal';

export type PatientDetailTab = 'overview' | 'allergies' | 'renal' | 'comorbidities' | 'prescriptions' | 'administrative';

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: PatientProfile | null;
  patientIdOrName?: string;
  onOpenPrescriptionOrder?: (patient: PatientProfile) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen,
  onClose,
  patient: directPatient,
  patientIdOrName,
  onOpenPrescriptionOrder,
}) => {
  const [activeTab, setActiveTab] = useState<PatientDetailTab>('overview');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [hospitalNoticeStatus, setHospitalNoticeStatus] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const handleSendHospitalNotice = (phoneNum?: string) => {
    setIsSmsModalOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) { setActiveTab('overview'); setSelectedPatientId(null); }
  }, [isOpen, patientIdOrName]);

  // Find related active prescriptions from cached CPOE or INITIAL_PRESCRIPTIONS
  const activePrescriptionsList = React.useMemo(() => {
    try {
      const cached = localStorage.getItem('clinical_cached_cpoe');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((o: any) => o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604');
        }
      }
    } catch {}
    return INITIAL_PRESCRIPTIONS;
  }, [isOpen]);

  if (!isOpen) return null;

  // Resolve patient from query or direct object
  const matches = directPatient ? [directPatient] : (patientIdOrName ? findPatientsByQuery(patientIdOrName, INITIAL_PATIENTS) : []);
  const patient: PatientProfile = directPatient || 
    (selectedPatientId ? matches.find((item) => item.id === selectedPatientId) : findPatientByNameOrQuery(patientIdOrName || '', INITIAL_PATIENTS)) ||
    ({ id: '', fullName: '', gender: 'Chưa rõ', email: '', room: 'Chưa có dữ liệu', allergies: 'Chưa có dữ liệu bệnh nhân phù hợp', chronicConditions: 'Chưa có dữ liệu', egfr: 0, creatinine: 0, weightKg: 0 } as PatientProfile);

  const patientNotFound = !patient.id;
  const patientAmbiguous = !directPatient && !selectedPatientId && matches.length > 1;

  const relatedPrescriptions = activePrescriptionsList.filter(
    (p: any) => p.patientId === patient.id || p.patientName.toLowerCase().includes(patient.fullName.toLowerCase())
  );

  // Find related debts in ward
  const relatedDebts = INITIAL_DEBT_RECORDS.filter(
    (d) => d.patientName.toLowerCase().includes(patient.fullName.toLowerCase()) || d.patientName.includes(patient.id)
  );

  // Evaluate clinical safety alerts
  const hasAllergies = Boolean(patient.allergies && !patient.allergies.toLowerCase().includes('không ghi nhận') && !patient.allergies.toLowerCase().includes('chưa ghi nhận'));
  const isRenalImpaired = patient.egfr < 60;
  const renalStage = patient.egfr >= 90 ? 'G1 (Bình thường)' :
                     patient.egfr >= 60 ? 'G2 (Giảm nhẹ)' :
                     patient.egfr >= 45 ? 'G3a (Giảm nhẹ - trung bình)' :
                     patient.egfr >= 30 ? 'G3b (Giảm trung bình - nặng)' :
                     patient.egfr >= 15 ? 'G4 (Suy thận nặng)' : 'G5 (Suy thận giai đoạn cuối)';

  if (patientNotFound) {
    if (patientAmbiguous) {
      return <div role="dialog" aria-modal="true" data-testid="patient-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <section className="w-full max-w-2xl border border-slate-300 bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Có nhiều bệnh nhân phù hợp</h2><p className="mt-2 text-sm text-slate-600">Chọn đúng hồ sơ bằng mã bệnh nhân, ngày sinh hoặc khoa/phòng trước khi xem dữ liệu lâm sàng.</p></div><button type="button" onClick={onClose} aria-label="Đóng" className="border border-slate-300 p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">{matches.map((item) => <button key={item.id} type="button" onClick={() => setSelectedPatientId(item.id)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-50"><span className="font-mono text-sm font-semibold text-slate-800">{item.id}</span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-950">{item.fullName}</span><span className="block text-xs text-slate-600">{item.dob || 'Chưa có ngày sinh'} · {item.gender} · {item.department || item.room}</span></span></button>)}</div></section>
      </div>;
    }
    return <div role="dialog" aria-modal="true" data-testid="patient-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <section className="w-full max-w-lg border border-slate-300 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Không tìm thấy bệnh nhân phù hợp</h2><p className="mt-2 text-sm text-slate-600">Không có hồ sơ khớp duy nhất với “{patientIdOrName}”. Hãy tìm bằng mã bệnh nhân hoặc họ tên đầy đủ.</p></div><button type="button" onClick={onClose} aria-label="Đóng" className="border border-slate-300 p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      </section>
    </div>;
  }

  const tabs: [PatientDetailTab, string][] = [
    ['overview', 'Tổng quan lâm sàng'],
    ['allergies', 'Tiền sử dị ứng & Phản vệ'],
    ['renal', 'Chức năng thận & Chỉnh liều'],
    ['comorbidities', 'Bệnh nền & Chẩn đoán'],
    ['prescriptions', `Đơn thuốc (${relatedPrescriptions.length}) & Nợ (${relatedDebts.length})`],
    ['administrative', 'Hồ sơ hành chính & CCCD TT26'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="patient-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        
        {/* Header Chuẩn Workstation Y Tế */}
        <div className="px-3 sm:px-5 py-2 sm:py-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <span className="font-mono text-2xs sm:text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                MÃ BN: {patient.id}
              </span>
              <h2 className="text-sm sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                {patient.fullName} <span className="text-2xs sm:text-sm font-normal text-slate-500">({patient.gender}, {patient.age} tuổi)</span>
              </h2>
              {hasAllergies && (
                <span className="text-[10px] sm:text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  CÓ DỊ ỨNG
                </span>
              )}
              {isRenalImpaired && (
                <span className="text-[10px] sm:text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  eGFR {patient.egfr}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsSmsModalOpen(true)}
              data-testid="btn-open-sms-from-patient"
              title="Gửi thông báo y tế cho bệnh nhân (SMS / Email)"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-2xs sm:text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <Send className="w-3.5 h-3.5 text-slate-600" />
              <span>Gửi thông báo cho BN</span>
            </button>
            <button
              onClick={() => window.print()}
              title="In tóm tắt hồ sơ bệnh án"
              aria-label="In tóm tắt hồ sơ"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              data-testid="btn-close-patient-detail"
              aria-label="Đóng hồ sơ bệnh nhân"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh Tab gạch chân chuẩn Kho Dược / CPOE */}
        <div role="tablist" aria-label="Nhóm thông tin bệnh nhân" className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none border-b border-slate-200 px-5 bg-white shrink-0">
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

        {/* Nội Dung Theo Từng Tab: Bố Cục Trái - Phải Chuẩn Y Tế (Zero-Box, Phẳng, Không Dấu Chấm) */}

        {/* TAB 1: TỔNG QUAN LÂM SÀNG */}
        {activeTab === 'overview' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Cột Trái: Lâm sàng an toàn quan trọng nhất */}
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              {/* 1. Cảnh Báo Dị Ứng Thuốc */}
              <div className="space-y-2 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                    Cảnh Báo Dị Ứng Thuốc &amp; Phản Vệ (TT 51/2017/TT-BYT)
                  </h3>
                  {hasAllergies && (
                    <span className="text-xs font-bold text-rose-700">Tuyệt đối không chỉ định</span>
                  )}
                </div>
                <div className="text-sm text-slate-900 leading-relaxed font-medium">
                  {hasAllergies ? (
                    <div className="space-y-1 text-rose-800">
                      <p>{stripLeadingBullets(patient.allergies)}</p>
                      <p className="text-xs text-rose-700 font-normal">
                        Kê đơn cần rà soát chéo hoạt chất và cảnh báo DDI/Dược thư tự động trước khi ký số duyệt phát sinh.
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-600">Hiện chưa ghi nhận tiền sử dị ứng thuốc nghiêm trọng hoặc sốc phản vệ.</p>
                  )}
                </div>
              </div>

              {/* 2. Chức Năng Thận & Nguy Cơ Chỉnh Liều */}
              <div className="space-y-2.5 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Chức Năng Thận &amp; Thể Trọng (KDIGO 2024 / Cockcroft-Gault)
                  </h3>
                  <span className={`text-xs font-semibold ${isRenalImpaired ? 'text-amber-800' : 'text-slate-700'}`}>
                    {renalStage}
                  </span>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <dt className="text-slate-500">Mức lọc eGFR</dt>
                    <dd className={`text-sm font-bold font-mono mt-0.5 ${isRenalImpaired ? 'text-amber-800' : 'text-slate-900'}`}>
                      {patient.egfr} <span className="text-2xs font-normal text-slate-500">mL/min</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Creatinine huyết thanh</dt>
                    <dd className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      {patient.creatinine} <span className="text-2xs font-normal text-slate-500">μmol/L</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cân nặng</dt>
                    <dd className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      {patient.weightKg} <span className="text-2xs font-normal text-slate-500">kg</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Khuyến cáo chỉnh liều</dt>
                    <dd className="text-sm font-semibold text-slate-800 mt-0.5">
                      {isRenalImpaired ? 'Chỉnh liều kháng sinh' : 'Liều chuẩn người lớn'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 3. Bệnh Nền Mạn Tính */}
              <div className="space-y-2 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Bệnh Nền Mạn Tính &amp; Chẩn Đoán Xác Định
                </h3>
                <div className="text-sm text-slate-800 leading-relaxed font-medium">
                  <p>{stripLeadingBullets(patient.chronicConditions)}</p>
                </div>
              </div>

              {/* 4. Đơn Thuốc Đang Điều Trị */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Đơn Thuốc Điện Tử CPOE Đang Điều Trị ({relatedPrescriptions.length})
                  </h3>
                  {onOpenPrescriptionOrder && (
                    <button
                      type="button"
                      onClick={() => onOpenPrescriptionOrder(patient)}
                      className="text-xs font-semibold text-slate-900 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      Kê đơn mới cho BN
                    </button>
                  )}
                </div>
                {relatedPrescriptions.length === 0 ? (
                  <p className="text-sm text-slate-500">Hiện chưa có đơn thuốc nội trú/ngoại trú nào đang kích hoạt.</p>
                ) : (
                  <div className="space-y-3">
                    {relatedPrescriptions.map((order) => (
                      <div key={order.id} className="space-y-1.5 pb-2.5 border-b border-slate-50 last:border-b-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{order.id}</span>
                            <span className="text-slate-500">{order.prescribedAt}</span>
                          </div>
                          <span className="font-semibold text-slate-700">[{order.diagnosisIcd10}] {order.diagnosisText}</span>
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed">
                          {order.items.map((it, idx) => (
                            <span key={it.id || idx}>
                              {it.medicationName} ({it.quantity} {it.unit})
                              {idx < order.items.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cột Phải: Hành chính, Buồng giường, Tủ trực & Bác sĩ */}
            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              {/* Định danh CCCD */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Định Danh Công Dân</h3>
                  <span className="font-mono text-xs font-semibold text-slate-800 bg-white border border-slate-300 px-2 py-0.5 rounded">
                    TT 26/2025/TT-BYT
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Mã Bệnh Nhân</dt>
                    <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5">{patient.id}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Số CCCD / Mã ĐDCN</dt>
                    <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5">{patient.cccd || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ngày sinh</dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">{patient.dob || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Giới tính &amp; Tuổi</dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">{patient.gender} · {patient.age} tuổi</dd>
                  </div>
                </dl>
              </div>

              {/* Vị trí điều trị */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Vị Trí Nhập Viện &amp; Buồng Bệnh</h3>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Khoa / Buồng / Giường</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.room}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Bác sĩ phụ trách điều trị</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.primaryDoctor || 'BS. Trần Văn Hùng (Khoa Cấp Cứu)'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Trạng thái cấp cứu (Code Status)</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.codeStatus || 'Hồi sinh tim phổi toàn diện'}</dd>
                  </div>
                </dl>
              </div>

              {/* Phiếu Nợ Cơ Số Tủ Trực (TT 20/2017) */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Nợ Cơ Số Tủ Trực Cấp Cứu</h3>
                  <span className="text-xs font-semibold text-slate-700">{relatedDebts.length} khoản</span>
                </div>
                {relatedDebts.length === 0 ? (
                  <p className="text-xs text-slate-500">Không có khoản nợ cơ số tủ trực hoặc nợ vỏ thuốc gây nghiện.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {relatedDebts.map((debt) => (
                      <div key={debt.id} className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 last:border-b-0">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{debt.code}</span>
                          <span className="text-slate-700 ml-1.5">{debt.itemName} ({debt.quantity})</span>
                        </div>
                        <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${debt.status === 'debt' ? 'text-amber-800 bg-amber-50' : 'text-slate-600 bg-slate-100'}`}>
                          {debt.status === 'debt' ? 'Đang nợ' : 'Đã bù'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Thông tin liên hệ & Nhận tin nhắn Bệnh viện */}
              <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Thông Tin Liên Hệ &amp; Nhận Tin Nhắn Bệnh Viện
                  </h3>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Kênh SMS/Zalo BV
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-mono font-bold text-sm text-slate-900">{patient.phone || 'Chưa cập nhật SĐT'}</span>
                    <span className="text-2xs text-slate-500">(Bệnh viện gửi thông tin về ĐT)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{patient.email || 'patient@hospital.vn'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    Bệnh viện tự động gửi mã đơn thuốc điện tử, biên lai tạm ứng viện phí và lịch dặn dò cữ uống thuốc trực tiếp về số điện thoại và email của người bệnh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TIỀN SỬ DỊ ỨNG & PHẢN VỆ */}
        {activeTab === 'allergies' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Tiền Sử Dị Ứng Thuốc Lâm Sàng
                </h3>
                {hasAllergies ? (
                  <div className="space-y-2 text-sm text-slate-900 font-medium leading-relaxed">
                    <p className="text-rose-800 text-base font-bold">{stripLeadingBullets(patient.allergies)}</p>
                    <p className="text-slate-700">
                      Cảnh báo phản ứng dị ứng thuốc (Allergic Drug Reaction) có thể diễn tiến thành phản vệ cấp tính. Tuyệt đối không chỉ định lại cùng nhóm kháng sinh / NSAIDs nếu chưa làm test da hoặc hội chẩn chuyên khoa dị ứng.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Bệnh nhân chưa có tiền sử dị ứng thuốc ghi nhận trong hồ sơ bệnh án.</p>
                )}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Phác Đồ Xử Trí Cấp Cứu Phản Vệ (Thông tư 51/2017/TT-BYT)
                </h3>
                <div className="space-y-2 text-sm text-slate-800 leading-relaxed">
                  <p>
                    Thuốc thiết yếu hàng đầu: <strong>Adrenalin 1 mg/ml (1 ống)</strong> tiêm bắp ngay lập tức khi phát hiện phản vệ từ Độ II trở lên.
                  </p>
                  <p>
                    Vị trí tiêm: Mặt trước ngoài đùi, lặp lại liều mỗi 3 đến 5 phút nếu huyết áp hoặc hô hấp chưa cải thiện.
                  </p>
                  <p>
                    Cơ số Adrenalin sẵn có tại tủ trực cấp cứu: Khay thuốc chống sốc phản vệ đạt chuẩn Thông tư 51.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quy Định Giám Sát Cảnh Giác Dược</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Mọi biến cố bất lợi có hại của thuốc (ADR) hoặc phản ứng dị ứng phát sinh trong quá trình điều trị phải được lập Báo cáo ADR quốc gia gửi về Trung tâm DI &amp; ADR Quốc gia theo quy định của Bộ Y tế.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: CHỨC NĂNG THẬN & CHỈNH LIỀU */}
        {activeTab === 'renal' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Chỉ Số Sinh Hóa Thận &amp; Phân Độ KDIGO
                  </h3>
                  <span className="text-xs font-bold text-slate-800">{renalStage}</span>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <dt className="text-slate-500">Mức Lọc Cầu Thận eGFR</dt>
                    <dd className="text-base font-bold font-mono text-slate-900 mt-0.5">{patient.egfr} mL/min/1.73m²</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Creatinine Huyết Thanh</dt>
                    <dd className="text-base font-bold font-mono text-slate-900 mt-0.5">{patient.creatinine} μmol/L</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Thể Trọng Đánh Giá</dt>
                    <dd className="text-base font-bold font-mono text-slate-900 mt-0.5">{patient.weightKg} kg</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Khuyến Cáo Hiệu Chỉnh Liều Thuốc Đào Thải Qua Thận
                </h3>
                <div className="space-y-2 text-sm text-slate-800 leading-relaxed">
                  {patient.egfr < 50 ? (
                    <div className="text-amber-900 space-y-1 font-medium">
                      <p>eGFR dưới 50 mL/min: Bắt buộc chỉnh liều hoặc giãn khoảng cách dùng cho các kháng sinh Vancomycin, Ceftriaxon, Meropenem và Metformin.</p>
                      <p className="text-xs text-slate-600 font-normal">Theo dõi sát nồng độ Creatinine định kỳ mỗi 48 giờ tại khoa lâm sàng.</p>
                    </div>
                  ) : (
                    <p className="text-slate-700">Chức năng lọc thận bảo tồn tốt (eGFR &gt; 60 mL/min), không cần giảm liều theo phác đồ thường quy.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Công Thức Tính CrCl Chuẩn</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Độ thanh thải Creatinine được ước tính theo công thức Cockcroft-Gault:
                <br /><br />
                <code className="font-mono bg-white p-1 rounded border border-slate-300 block text-xs">
                  CrCl = [(140 - tuổi) × cân nặng] / [72 × Cr(mg/dL)] {patient.gender === 'Nữ' ? '× 0.85' : ''}
                </code>
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: BỆNH NỀN & CHẨN ĐOÁN */}
        {activeTab === 'comorbidities' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Hồ Sơ Bệnh Lý Mạn Tính &amp; Yếu Tố Nguy Cơ
                </h3>
                <div className="text-sm text-slate-900 font-medium leading-relaxed">
                  <p>{stripLeadingBullets(patient.chronicConditions)}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Mã Hóa ICD-10 Chuẩn Bộ Y Tế</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Danh mục bệnh nền được liên thông trực tiếp với cổng Bảo hiểm Y tế và hệ thống CPOE kê đơn điện tử theo Quyết định 3618/QĐ-BHXH.
              </p>
            </div>
          </div>
        )}

        {/* TAB 5: ĐƠN THUỐC & NỢ TỦ TRỰC */}
        {activeTab === 'prescriptions' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Chi Tiết Đơn Thuốc Đã Kê ({relatedPrescriptions.length})
                </h3>
                {relatedPrescriptions.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có đơn thuốc nào được ghi nhận cho bệnh nhân này.</p>
                ) : (
                  <div className="space-y-4">
                    {relatedPrescriptions.map((order) => (
                      <div key={order.id} className="space-y-2 pb-4 border-b border-slate-100 last:border-b-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span className="font-mono font-bold text-slate-900 text-sm">{order.id}</span>
                          <span className="font-medium text-slate-600">{order.doctorName} · {order.prescribedAt}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">
                          Chẩn đoán: <span className="font-mono font-bold text-slate-900">[{order.diagnosisIcd10}]</span> {order.diagnosisText}
                        </p>
                        <div className="space-y-1 text-xs text-slate-700">
                          {order.items.map((it, idx) => (
                            <div key={it.id || idx} className="flex items-center justify-between">
                              <span>{idx + 1}. {it.medicationName}</span>
                              <span className="font-mono font-bold text-slate-900">{it.quantity} {it.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Phiếu Nợ Vỏ Thuốc Cấp Cứu ({relatedDebts.length})</h3>
              {relatedDebts.length === 0 ? (
                <p className="text-xs text-slate-500">Không có phiếu nợ vỏ thuốc gây nghiện.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {relatedDebts.map((debt) => (
                    <div key={debt.id} className="space-y-0.5 pb-2 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{debt.code}</span>
                        <span className="text-slate-500">{debt.borrowTime}</span>
                      </div>
                      <p className="font-semibold text-slate-800">{debt.itemName} ({debt.quantity})</p>
                      <p className="text-2xs text-slate-500">Buồng: {debt.patientRoom}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: HỒ SƠ HÀNH CHÍNH & CCCD TT26 */}
        {activeTab === 'administrative' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Thông Tin Hành Chính &amp; Định Danh Theo Thông Tư 26/2025/TT-BYT
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-slate-500">Mã Bệnh Nhân (Patient ID)</dt>
                  <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5">{patient.id}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Họ và tên đầy đủ</dt>
                  <dd className="text-sm font-bold text-slate-900 mt-0.5">{patient.fullName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Số Căn Cước Công Dân (CCCD 12 số)</dt>
                  <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5">{patient.cccd || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ngày sinh &amp; Tuổi</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.dob || '—'} ({patient.age} tuổi)</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Giới tính</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.gender}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Khoa lâm sàng điều trị</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.department || 'Khoa Cấp Cứu A9'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Buồng bệnh &amp; Số giường</dt>
                  <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.room}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Số điện thoại di động (Bệnh viện gửi thông tin)</dt>
                  <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                    <span>{patient.phone || 'Chưa cập nhật SĐT'}</span>
                    {patient.phone && (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Đã kết nối SMS/Zalo
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email nhận hồ sơ &amp; dặn dò</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.email || 'patient@hospital.vn'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Thời điểm nhập viện</dt>
                  <dd className="text-sm font-mono text-slate-800 mt-0.5">{patient.admissionDate || '2026-10-24 01:15'}</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Căn Cứ Pháp Lý Hồ Sơ Điện Tử</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Hồ sơ bệnh nhân được quản lý bảo mật theo Luật Khám bệnh, chữa bệnh 2023 và quy chế kê đơn thuốc điện tử quốc gia Thông tư 26/2025/TT-BYT.
              </p>

              <div className="space-y-2 pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Dịch Vụ Gửi Tin Nhắn Y Tế Về Điện Thoại
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bệnh viện triển khai dịch vụ tự động gửi thông tin lâm sàng và hành chính về số điện thoại di động của người bệnh:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Mã đơn thuốc điện tử:</strong> Nhận link tra cứu đơn thuốc điện tử liên thông Cổng Quốc gia theo Thông tư 26/2025/TT-BYT.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Lịch dặn dò bác sĩ:</strong> Thông báo cữ uống thuốc sáng - trưa - tối và theo dõi phản ứng phụ tại nhà.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Viện phí &amp; Tái khám:</strong> Nhận thông báo xác nhận tạm ứng viện phí và lịch hẹn khám định kỳ.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Hồ sơ người bệnh nội trú bệnh viện · Mã đối soát: <span className="font-mono font-bold text-slate-800">{patient.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPrescriptionOrder && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenPrescriptionOrder(patient); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs"
              >
                Kê đơn thuốc mới
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
        patient={patient}
        diagnosis={patient?.diagnosis}
        initialMessageType="hospital_notice"
      />
    </div>
  );
};
