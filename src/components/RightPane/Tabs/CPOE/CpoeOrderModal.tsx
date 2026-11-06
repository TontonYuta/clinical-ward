/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Kê Đơn Thuốc Điện Tử Chuẩn CPOE (TT 26/2025/TT-BYT)
 * Giao diện Workstation Mở Rộng 2 Cột, Đồng Bộ Kho Dược (Flat, Neutral Slate, Zero-Box)
 */

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Save,
  Stethoscope,
  AlertTriangle,
  ShieldAlert,
  Pill,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  Plus,
  Trash2,
  Printer,
} from 'lucide-react';
import {
  PrescriptionOrder,
  PrescriptionType,
  Tt26FormType,
  getTt26FormMetadata,
} from '../../../../types/cpoe';
import { MasterMedication } from '../../../../types/medication';
import { MedicationSearchAutocomplete } from '../../../Common/MedicationSearchAutocomplete';
import { useModalDismiss } from '../../../../hooks/useModalDismiss';
import { findPatientByNameOrQuery, type PatientProfile } from '../../../../services/patientService';
import { validatePrescriptionDraft } from '../../../../services/prescriptionValidation';
import { auditPrescriptionDdiApi } from '../../../../services/api';
import { PrescriptionPrintDocument } from './PrescriptionPrintDocument';

interface CpoeOrderModalProps {
  patients?: PatientProfile[];
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (newOrder: PrescriptionOrder) => Promise<void>;
  doctorName?: string;
  onOpenSafetyGuide?: (medName: string) => void;
}

function formatDoctorDisplay(name?: string): string {
  return name?.trim() || '';
}

export const CpoeOrderModal: React.FC<CpoeOrderModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <CpoeOrderContent {...props} />;
};

const CpoeOrderContent: React.FC<CpoeOrderModalProps> = ({
  patients = [],
  isOpen,
  onClose,
  onSaveOrder,
  doctorName = 'BS. Trần Văn Hùng',
  onOpenSafetyGuide,
}) => {
  useModalDismiss(isOpen, onClose);
  const [rxType, setRxType] = useState<PrescriptionType>('outpatient');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientCccd, setPatientCccd] = useState('');
  const [patientWeight, setPatientWeight] = useState('');
  const [patientInsuranceId, setPatientInsuranceId] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientGender, setPatientGender] = useState<'Nam' | 'Nữ' | ''>('');
  const [department, setDepartment] = useState('');
  const [diagnosisIcd10, setDiagnosisIcd10] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [isChronic, setIsChronic] = useState(false);
  const [daysPrescribed, setDaysPrescribed] = useState(0);
  const [tt26FormType, setTt26FormType] = useState<Tt26FormType>('PL1_STANDARD');
  const [receiverCccd, setReceiverCccd] = useState('');
  const [treatmentBatch1, setTreatmentBatch1] = useState('');
  const [treatmentBatch2, setTreatmentBatch2] = useState('');
  const [treatmentBatch3, setTreatmentBatch3] = useState('');

  type DraftMedication = {
    id: string;
    medicationName: string;
    activeIngredient: string;
    unit: string;
    route: string;
    quantity: number;
    dosage: string;
    frequency: string;
    instructions: string;
  };
  const emptyMedication = (): DraftMedication => ({
    id: 'rxi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    medicationName: '',
    activeIngredient: '',
    unit: 'Viên',
    route: '',
    quantity: 0,
    dosage: '',
    frequency: '',
    instructions: '',
  });
  const [medications, setMedications] = useState<DraftMedication[]>([emptyMedication()]);
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
  const [ddiAuditUnavailable, setDdiAuditUnavailable] = useState(false);
  const [ddiAuditLoading, setDdiAuditLoading] = useState(false);
  const auditRevision = useRef(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const handlePrintDraft = () => {
    const documentNode = document.getElementById('prescription-print-document');
    if (!documentNode) {
      window.alert('Không tìm thấy bản xem trước đơn thuốc.');
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
      window.alert('Trình duyệt không mở được hộp thoại in.');
    }
  };

  if (!isOpen) return null;

  const handleSelectSamplePatient = (id: string) => {
    setSelectedPatientId(id);
    setPatientId('');
    setPatientName('');
    setPatientCccd('');
    setPatientPhone('');
    setPatientEmail('');
    setPatientAddress('');
    setPatientDob('');
    setPatientWeight('');
    setPatientGender('');
    setPatientInsuranceId('');
    setGuardianName('');
    setDepartment('');
    setDiagnosisText('');
    setDiagnosisIcd10('');
    if (!id) return;
    const p = patients.find((item) => item.id === id);
    if (p) {
      setPatientId(p.id);
      setPatientName(p.fullName);
      setPatientCccd(p.cccd || '');
      setPatientPhone(p.phone || '');
      setPatientEmail(p.email || '');
      setPatientAddress('');
      setPatientDob(p.dob || '');
      setPatientWeight(String(p.weightKg || ''));
      setPatientGender((p.gender as any) || '');
      setDepartment(p.department || p.room || '');
    }
  };

  const refreshDdiAudit = async (items: DraftMedication[]) => {
    const revision = ++auditRevision.current;
    const ingredients = items
      .map((item) => item.activeIngredient || item.medicationName)
      .filter(Boolean);
    if (ingredients.length < 2) {
      setDdiAudit(null);
      setDdiAuditUnavailable(false);
      setDdiAuditLoading(false);
      return;
    }
    setDdiAuditLoading(true);
    setDdiAudit(null);
    setDdiAuditUnavailable(false);
    try {
      const result = await auditPrescriptionDdiApi(ingredients);
      if (revision === auditRevision.current) setDdiAudit(result);
    } catch {
      if (revision === auditRevision.current) setDdiAuditUnavailable(true);
    } finally {
      if (revision === auditRevision.current) setDdiAuditLoading(false);
    }
  };
  const handleSelectMed = (index: number, med: MasterMedication) => {
    const next = medications.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            medicationName: med.brandName,
            activeIngredient: med.activeIngredient,
            unit: med.standardUnit,
            route: med.route,
          }
        : item,
    );
    setMedications(next);
    refreshDdiAudit(next);
    if (
      med.isControlled ||
      /\b(morphin|fentanyl|oxycodon|pethidin)\b/i.test(med.brandName + ' ' + med.activeIngredient)
    ) {
      setTt26FormType('PL2_NARCOTIC');
    } else if (
      /\b(diazepam|phenobarbital|clonazepam|zolpidem)\b/i.test(
        med.brandName + ' ' + med.activeIngredient,
      )
    ) {
      if (tt26FormType === 'PL1_STANDARD') setTt26FormType('PL3_PSYCHOTROPIC');
    }
  };
  const updateMedication = (
    index: number,
    field: keyof DraftMedication,
    value: string | number,
  ) => {
    const next = medications.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    setMedications(next);
    refreshDdiAudit(next);
  };

  const normalizeRoute = (r: string): PrescriptionOrder['items'][0]['route'] =>
    r.trim();
  const normalizeUnit = (u: string): PrescriptionOrder['items'][0]['unit'] =>
    u.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePrescriptionDraft({
      patientName,
      diagnosisText,
      items: medications.map((med) => ({
        medicationName: med.medicationName,
        dosage: med.dosage,
        frequency: med.frequency,
        route: med.route,
        quantity: med.quantity,
        durationDays: daysPrescribed,
      })),
    });
    const patientAgeMonths = patientDob
      ? (Date.now() - new Date(patientDob).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
      : undefined;
    if (patientAgeMonths !== undefined && patientAgeMonths < 72 && !(Number(patientWeight) > 0))
      errors.push('Bắt buộc ghi cân nặng người bệnh dưới 72 tháng tuổi theo mẫu Phụ lục I TT26.');
    setValidationErrors(errors);
    const medicationCount = medications.filter(
      (med) => med.activeIngredient.trim() || med.medicationName.trim(),
    ).length;
    const auditRequired = medicationCount > 1;
    if (
      errors.length ||
      (auditRequired &&
        (ddiAudit?.has_contraindication || ddiAuditUnavailable || ddiAuditLoading || !ddiAudit))
    ) {
      if (ddiAudit?.has_contraindication)
        setValidationErrors([
          ...errors,
          'Không thể lưu khi danh sách có cặp thuốc chống chỉ định.',
        ]);
      if (ddiAuditUnavailable)
        setValidationErrors([
          ...errors,
          'Chưa kết nối được bộ kiểm tra tương tác; hãy thử lại trước khi lưu.',
        ]);
      if (ddiAuditLoading)
        setValidationErrors([...errors, 'Đang kiểm tra tương tác thuốc; vui lòng chờ hoàn tất.']);
      return;
    }

    const matchedPatient = findPatientByNameOrQuery(patientName, patients);
    const finalPatientId = patientId || matchedPatient?.id || '';
    const finalCccd = patientCccd.trim() || matchedPatient?.cccd || '';
    const finalPhone = patientPhone.trim() || matchedPatient?.phone || undefined;
    const finalEmail = patientEmail.trim() || matchedPatient?.email || undefined;
    const finalDob = patientDob || matchedPatient?.dob || '';
    const finalGender = (patientGender || matchedPatient?.gender || '') as 'Nam' | 'Nữ' | '';
    const finalDept = department || '';

    const suffix =
      tt26FormType === 'PL2_NARCOTIC' ? 'N' : tt26FormType === 'PL3_PSYCHOTROPIC' ? 'H' : 'C';
    const orderId = `79001${Date.now().toString().slice(-7)}-${suffix}`;

    try {
      await onSaveOrder({
        id: orderId,
        prescriptionType: rxType,
        tt26FormType,
        receiverCccd: receiverCccd.trim() || undefined,
        treatmentBatch1: treatmentBatch1.trim() || undefined,
        treatmentBatch2: treatmentBatch2.trim() || undefined,
        treatmentBatch3: treatmentBatch3.trim() || undefined,
        patientId: finalPatientId,
        patientName: patientName.trim(),
        patientPhone: finalPhone,
        patientEmail: finalEmail,
        patientCccd: finalCccd,
        patientWeight: patientWeight ? Number(patientWeight) : undefined,
        patientInsuranceId: patientInsuranceId.trim() || undefined,
        patientAddress: patientAddress.trim(),
        guardianName: guardianName.trim(),
        patientDob: finalDob,
        patientGender: finalGender,
        department: finalDept,
        diagnosisIcd10: diagnosisIcd10.trim().toUpperCase(),
        diagnosisText: diagnosisText.trim(),
        isChronicDisease: rxType === 'outpatient' && isChronic,
        daysPrescribed,
        doctorName: formatDoctorDisplay(doctorName),
        doctorCertificate: '',
        prescribedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        status: 'draft',
        clinicalNotes: clinicalNotes.trim() || undefined,
        items: medications.map((med) => ({
          id: med.id,
          medicationName: med.medicationName,
          activeIngredient: med.activeIngredient,
          dosage: med.dosage.trim(),
          frequency: med.frequency.trim(),
          route: normalizeRoute(med.route),
          quantity: med.quantity,
          unit: normalizeUnit(med.unit),
          instructions: med.instructions.trim(),
          durationDays: daysPrescribed,
        })),
      });
      onClose();
    } catch (error) {
      setValidationErrors([
        error instanceof Error ? error.message : 'Máy chủ chưa chấp nhận đơn thuốc.',
      ]);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="clinical-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      >
        {/* Container Mở Rộng Chuẩn Workstation CPOE (sm:max-w-6xl xl:max-w-[1400px] h-[94vh]) */}
        <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-[1400px] h-[100dvh] sm:h-[94vh] max-h-[980px] flex flex-col overflow-hidden text-slate-900">
          <header className="composer-header">
            <div>
              <h2>Kê đơn thuốc</h2>
              <p className="record-sub">{formatDoctorDisplay(doctorName)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="button-secondary" onClick={handlePrintDraft}>
                <Printer size={16} />
                In đơn
              </button>
              <button
                type="button"
                className="icon-action"
                onClick={onClose}
                aria-label="Đóng form kê đơn"
              >
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="composer-options">
            <label>
              Điều trị
              <select
                className="workspace-select"
                aria-label="Loại điều trị"
                value={rxType}
                onChange={(e) => {
                  const value = e.target.value as PrescriptionType;
                  setRxType(value);
                  setDaysPrescribed(0);
                  if (value === 'inpatient_daily') setIsChronic(false);
                }}
              >
                <option value="outpatient">Ngoại trú</option>
                <option value="inpatient_daily">Nội trú · y lệnh ngày</option>
              </select>
            </label>
            <label>
              Mẫu đơn
              <select
                className="workspace-select"
                aria-label="Mẫu đơn thuốc"
                value={tt26FormType}
                onChange={(e) => {
                  const value = e.target.value as Tt26FormType;
                  setTt26FormType(value);
                  if (value === 'PL2_NARCOTIC' && daysPrescribed > 30) setDaysPrescribed(30);
                }}
              >
                <option value="PL1_STANDARD">Đơn thuốc · C</option>
                <option value="PL2_NARCOTIC">Gây nghiện · N</option>
                <option value="PL3_PSYCHOTROPIC">Hướng thần · H</option>
              </select>
            </label>
            <span className="record-sub">Thể thức kê đơn ngoại trú: TT 26/2025/TT-BYT</span>
          </div>

          {/* Form Body 2 Cột Trái - Phải Chuẩn Workstation */}
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {validationErrors.length > 0 && (
              <div
                role="alert"
                className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-900"
              >
                <strong>Chưa thể lưu bản nháp:</strong> {validationErrors.join(' ')}
              </div>
            )}
            <div className="flex-1 overflow-y-auto thin-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* CỘT TRÁI: HÀNH CHÍNH NGƯỜI BỆNH & CHẨN ĐOÁN (lg:col-span-5 xl:col-span-5) */}
                <div className="lg:col-span-5 xl:col-span-5 p-6 space-y-5 bg-white">
                  {/* 1. Chọn nhanh bệnh nhân mẫu */}
                  <div className="space-y-1.5 pb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Chọn hồ sơ người bệnh</span>
                    </label>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => handleSelectSamplePatient(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 cursor-pointer transition"
                    >
                      <option value="">-- Chọn hồ sơ người bệnh --</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id} · {p.fullName} ({p.gender}, {p.age} tuổi) ·{' '}
                          {p.department || p.room}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Nhóm thông tin hành chính người bệnh */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Thông tin hành chính
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Họ và tên người bệnh <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Nguyễn Văn A"
                          value={patientName}
                          onChange={(e) => {
                            const p = findPatientByNameOrQuery(
                              e.target.value.toLowerCase(),
                              patients,
                            );
                            handleSelectSamplePatient(p?.id || '');
                            setPatientName(e.target.value);
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-semibold transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Số định danh / CCCD (nếu có)
                        </label>
                        <input
                          type="text"
                          placeholder="001201019283"
                          value={patientCccd}
                          onChange={(e) => setPatientCccd(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>Số điện thoại liên hệ</span>
                        </label>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="09xxxxxxxx"
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          onBlur={() => {
                            const p = findPatientByNameOrQuery(
                              patientName.toLowerCase(),
                              patients,
                            );
                            if (p) {
                              if (!patientPhone) setPatientPhone(p.phone || '');
                              if (!patientEmail) setPatientEmail(p.email || '');
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>Email (tùy chọn)</span>
                        </label>
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="benhnhan@example.com"
                          value={patientEmail}
                          onChange={(e) => setPatientEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Ngày sinh</span>
                        </label>
                        <input
                          type="date"
                          value={patientDob}
                          onChange={(e) => setPatientDob(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Giới tính
                        </label>
                        <select
                          value={patientGender}
                          onChange={(e) => setPatientGender(e.target.value as 'Nam' | 'Nữ')}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 cursor-pointer transition"
                        >
                          <option value="">-- Chọn --</option>
                          <option value="Nam">Nam</option>
                          <option value="Nữ">Nữ</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>Khoa / Phòng</span>
                        </label>
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="Khoa Khám Bệnh"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Cân nặng (kg)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Bắt buộc với trẻ < 72 tháng"
                          value={patientWeight}
                          onChange={(e) => setPatientWeight(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Mã thẻ BHYT (nếu có)
                        </label>
                        <input
                          value={patientInsuranceId}
                          onChange={(e) => setPatientInsuranceId(e.target.value)}
                          placeholder="Số thẻ BHYT"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nơi cư trú
                        </label>
                        <input
                          value={patientAddress}
                          onChange={(e) => setPatientAddress(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                          placeholder="Địa chỉ cư trú"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Người giám hộ (trẻ &lt; 72 tháng)
                        </label>
                        <input
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                          placeholder="Họ tên cha / mẹ / người đưa trẻ đi khám"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2b. Chuyên biệt Phụ lục II (Đơn "N") & Phụ lục III (Đơn "H") theo TT 26 */}
                  {tt26FormType === 'PL2_NARCOTIC' && (
                    <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-rose-950">
                        <span className="flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>Đơn thuốc “N” (Gây nghiện - TT 26)</span>
                        </span>
                        <span className="text-2xs font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                          Mã: -N
                        </span>
                      </div>
                      <p className="text-2xs text-rose-800 leading-relaxed">
                        Kê tối đa 07 ngày cho bệnh cấp tính; tối đa 30 ngày chia làm 03 đợt điều trị
                        cho bệnh nhân ung thư.
                      </p>
                      <div className="space-y-1.5">
                        <label className="block text-2xs font-bold text-slate-700">
                          Phân bổ 3 đợt điều trị (nếu kê 30 ngày):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Đợt 1: Từ ngày ... đến ..."
                            value={treatmentBatch1}
                            onChange={(e) => setTreatmentBatch1(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="Đợt 2: Từ ngày ... đến ..."
                            value={treatmentBatch2}
                            onChange={(e) => setTreatmentBatch2(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="Đợt 3: Từ ngày ... đến ..."
                            value={treatmentBatch3}
                            onChange={(e) => setTreatmentBatch3(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-700 mb-1">
                          CCCD người nhận thuốc (nếu khác người bệnh):
                        </label>
                        <input
                          type="text"
                          placeholder="Số CCCD người nhận thuốc..."
                          value={receiverCccd}
                          onChange={(e) => setReceiverCccd(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-rose-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {tt26FormType === 'PL3_PSYCHOTROPIC' && (
                    <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                        <span className="flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-purple-600" />
                          <span>Đơn thuốc “H” (Hướng thần, tiền chất - TT 26)</span>
                        </span>
                        <span className="text-2xs font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                          Mã: -H
                        </span>
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-700 mb-1">
                          CCCD người nhận thuốc (nếu khác người bệnh):
                        </label>
                        <input
                          type="text"
                          placeholder="Số CCCD người nhận thuốc..."
                          value={receiverCccd}
                          onChange={(e) => setReceiverCccd(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-purple-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. Nhóm chẩn đoán y khoa & thời hạn */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Chẩn đoán lâm sàng
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Mã ICD-10 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="VD: I10"
                          value={diagnosisIcd10}
                          onChange={(e) => setDiagnosisIcd10(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono uppercase font-semibold transition"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Chẩn đoán xác định <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Nhập chẩn đoán lâm sàng..."
                          value={diagnosisText}
                          onChange={(e) => setDiagnosisText(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-medium transition"
                        />
                      </div>
                    </div>

                    {rxType === 'outpatient' && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChronic}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsChronic(checked);
                              if (!checked && daysPrescribed > 30) setDaysPrescribed(30);
                            }}
                            className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
                          />
                          <span className="font-medium">
                            Bệnh mạn tính ổn định theo Phụ lục VII (Kê tối đa 90 ngày)
                          </span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center pt-2 border-t border-slate-200/60">
                          <div>
                            <label
                              className="block text-xs font-semibold text-slate-700 mb-1"
                              htmlFor="prescription-days"
                            >
                              Số ngày dùng thuốc
                            </label>
                            <input
                              id="prescription-days"
                              type="number"
                              min={0}
                              max={isChronic ? 90 : 30}
                              value={daysPrescribed}
                              onChange={(e) =>
                                setDaysPrescribed(
                                  Math.max(
                                    0,
                                    Math.min(isChronic ? 90 : 30, Number(e.target.value) || 0),
                                  ),
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                            />
                          </div>
                          <p className="text-2xs text-slate-500 leading-relaxed">
                            {isChronic
                              ? '• Kê tối đa 90 ngày theo tình trạng bệnh (TT 26).'
                              : '• Kê tối đa 30 ngày cho đơn ngoại trú thông thường.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI: CHỈ ĐỊNH DƯỢC LÝ & AN TOÀN LÂM SÀNG CDSS (lg:col-span-7 xl:col-span-7) */}
                <div className="lg:col-span-7 xl:col-span-7 p-6 space-y-5 bg-slate-50/40">
                  <div className="flex justify-between items-center pb-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Danh mục thuốc điều trị
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">
                        ({medications.length} thuốc)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMedications((xs) => [...xs, emptyMedication()])}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm thuốc</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {medications.map((medication, index) => (
                      <section
                        key={medication.id}
                        className="p-4 sm:p-5 border border-slate-200 rounded-xl bg-white shadow-xs space-y-4 transition hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded">
                              #{String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {medication.medicationName || 'Thuốc mới'}
                            </span>
                          </div>
                          {medications.length > 1 && (
                            <button
                              type="button"
                              aria-label={'Xóa thuốc ' + (index + 1)}
                              onClick={() => {
                                const next = medications.filter((_, i) => i !== index);
                                setMedications(next);
                                refreshDdiAudit(next);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Xóa thuốc này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tên thuốc / Biệt dược <span className="text-rose-500">*</span>
                          </label>
                          <MedicationSearchAutocomplete
                            selectedMedicationName={medication.medicationName}
                            onSelect={(med) => handleSelectMed(index, med)}
                            defaultOnlyCrashCart={false}
                            placeholder="Tìm biệt dược hoặc hoạt chất"
                          />
                          {medication.activeIngredient && (
                            <p className="text-2xs text-slate-500 mt-1 font-medium">
                              Hoạt chất:{' '}
                              <strong className="text-slate-700">
                                {medication.activeIngredient}
                              </strong>
                            </p>
                          )}
                        </div>

                        {/* Liều lượng & Tần suất dùng */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Liều mỗi lần
                            </label>
                            <input
                              aria-label="Liều mỗi lần"
                              placeholder="Ví dụ: 1 viên (500 mg)"
                              value={medication.dosage}
                              onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Tần suất dùng
                            </label>
                            <input
                              aria-label="Tần suất"
                              placeholder="Ví dụ: ngày 2 lần, mỗi 12 giờ"
                              value={medication.frequency}
                              onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                            />
                          </div>
                        </div>

                        {/* Đường dùng, Số lượng, Đơn vị tính */}
                        <div className="grid grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Đường dùng
                            </label>
                            <select
                              aria-label="Đường dùng"
                              value={medication.route}
                              onChange={(e) => updateMedication(index, 'route', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 cursor-pointer transition"
                            >
                              <option value="">Đường dùng</option>
                              {medication.route && !['Uống', 'Tiêm bắp', 'Tiêm tĩnh mạch', 'Truyền tĩnh mạch', 'Đặt', 'Hít'].includes(medication.route) && <option value={medication.route}>{medication.route}</option>}
                              <option value="Uống">Uống</option>
                              <option value="Tiêm bắp">Tiêm bắp</option>
                              <option value="Tiêm tĩnh mạch">Tiêm tĩnh mạch</option>
                              <option value="Truyền tĩnh mạch">Truyền tĩnh mạch</option>
                              <option value="Đặt">Đặt</option>
                              <option value="Hít">Hít</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Số lượng
                            </label>
                            <input
                              aria-label="Số lượng"
                              type="number"
                              min="1"
                              value={medication.quantity}
                              onChange={(e) =>
                                updateMedication(index, 'quantity', Number(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Đơn vị
                            </label>
                            <select
                              aria-label="Đơn vị"
                              value={medication.unit}
                              onChange={(e) => updateMedication(index, 'unit', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 cursor-pointer transition"
                            >
                              {[...new Set(['Viên', 'Ống', 'Lọ', 'Chai', 'Hộp', 'Vỉ', 'Gói', medication.unit])].map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Hướng dẫn sử dụng */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Cách dùng / Dặn dò người bệnh
                          </label>
                          <input
                            aria-label="Hướng dẫn sử dụng"
                            placeholder="Ví dụ: sau ăn; uống với nước"
                            value={medication.instructions}
                            onChange={(e) =>
                              updateMedication(index, 'instructions', e.target.value)
                            }
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
                          />
                        </div>
                      </section>
                    ))}
                  </div>

                  {(ddiAuditUnavailable ||
                    ddiAudit?.has_contraindication ||
                    (ddiAudit?.pair_alerts?.length ?? 0) > 0) && (
                    <div
                      role="alert"
                      className={`p-4 border rounded-xl text-xs space-y-2 ${
                        ddiAudit?.has_contraindication
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}
                    >
                      <b className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {ddiAuditUnavailable
                            ? 'Chưa kiểm tra được tương tác'
                            : ddiAudit?.has_contraindication
                              ? 'Chống chỉ định phối hợp — không thể lưu đơn'
                              : 'Cảnh báo tương tác cần rà soát'}
                        </span>
                      </b>
                      {ddiAudit?.pair_alerts?.map((a, i) => (
                        <p key={i} className="text-2xs leading-relaxed pl-5">
                          • <strong>{a.title}</strong> ({a.severity}) — {a.consequence}; Xử trí:{' '}
                          {a.action}; Nguồn: {a.source}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* 6. Ghi chú lâm sàng CDSS */}
                  <div className="pt-3 border-t border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi chú lâm sàng cho Dược sĩ / Điều dưỡng phát thuốc (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Ghi chú theo dõi đặc biệt, xét nghiệm lại chức năng gan/thận..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Workstation Footer: Nền trắng, phẳng, viền slate-200 */}
            <div className="modal-action-footer px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-800">
                  Tổng số thuốc:{' '}
                  <strong className="text-teal-700 font-bold">
                    {medications.filter((m) => m.medicationName.trim()).length}
                  </strong>{' '}
                  khoản
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Bản nháp TT 26 (chưa ký số hoặc phát hành)</span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs cursor-pointer active:scale-98 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu bản nháp</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {/* Portal document outside modal clipping/scroll container */}
      {createPortal(
        <div id="prescription-print-portal">
          <PrescriptionPrintDocument
            order={{
              id: `79001${Date.now().toString().slice(-7)}-${tt26FormType === 'PL2_NARCOTIC' ? 'N' : tt26FormType === 'PL3_PSYCHOTROPIC' ? 'H' : 'C'}`,
              prescriptionType: rxType,
              tt26FormType,
              receiverCccd: receiverCccd.trim() || undefined,
              treatmentBatch1: treatmentBatch1.trim() || undefined,
              treatmentBatch2: treatmentBatch2.trim() || undefined,
              treatmentBatch3: treatmentBatch3.trim() || undefined,
              patientId,
              patientInsuranceId,
              patientName: patientName || '—',
              patientCccd,
              patientAddress,
              guardianName,
              patientPhone,
              patientDob,
              patientGender,
              patientWeight: patientWeight ? Number(patientWeight) : undefined,
              department,
              diagnosisIcd10,
              diagnosisText,
              isChronicDisease: isChronic,
              daysPrescribed,
              doctorName: formatDoctorDisplay(doctorName),
              doctorCertificate: '',
              prescribedAt: new Date().toLocaleDateString('vi-VN'),
              status: 'draft',
              clinicalNotes: clinicalNotes.trim() || undefined,
              items: medications
                .filter((m) => m.medicationName)
                .map((m) => ({
                  ...m,
                  route: normalizeRoute(m.route),
                  unit: normalizeUnit(m.unit),
                })),
            }}
          />
        </div>,
        document.body,
      )}
    </>
  );
};
