/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Kê Đơn Thuốc Điện Tử Chuẩn CPOE (TT 26/2025/TT-BYT)
 * Giao diện Workstation Mở Rộng 2 Cột, Đồng Bộ Kho Dược (Flat, Neutral Slate, Zero-Box)
 */

import React, { useRef, useState } from 'react';
import { X, Save, Stethoscope, AlertTriangle, ShieldAlert, Pill, User, Building2, Phone, Mail, Calendar, Plus, Trash2, Printer } from 'lucide-react';
import { PrescriptionOrder, PrescriptionType } from '../../../../types/cpoe';
import { MasterMedication } from '../../../../types/medication';
import { MedicationSearchAutocomplete } from '../../../Common/MedicationSearchAutocomplete';
import { useModalDismiss } from '../../../../hooks/useModalDismiss';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';
import { validatePrescriptionDraft } from '../../../../services/prescriptionValidation';
import { auditPrescriptionDdiApi } from '../../../../services/api';
import { PrescriptionPrintDocument } from './PrescriptionPrintDocument';

interface CpoeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (newOrder: PrescriptionOrder) => Promise<void>;
  doctorName?: string;
  onOpenSafetyGuide?: (medName: string) => void;
}

function formatDoctorDisplay(name?: string): string {
  if (!name) return 'BS. Trần Văn Hùng';
  const trimmed = name.trim();
  if (/^(bs[\.:\s]|bác sĩ|dr\.)/i.test(trimmed)) {
    return trimmed;
  }
  return `BS. ${trimmed}`;
}

export const CpoeOrderModal: React.FC<CpoeOrderModalProps> = ({
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

  type DraftMedication = { id: string; medicationName: string; activeIngredient: string; unit: string; route: string; quantity: number; dosage: string; frequency: string; instructions: string };
  const emptyMedication = (): DraftMedication => ({ id: 'rxi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), medicationName: '', activeIngredient: '', unit: 'Viên', route: '', quantity: 0, dosage: '', frequency: '', instructions: '' });
  const [medications, setMedications] = useState<DraftMedication[]>([emptyMedication()]);
  const [ddiAudit, setDdiAudit] = useState<{ pair_alerts: Array<{ severity: string; title: string; consequence: string; action: string; source: string }>; has_contraindication: boolean } | null>(null);
  const [ddiAuditUnavailable, setDdiAuditUnavailable] = useState(false);
  const [ddiAuditLoading, setDdiAuditLoading] = useState(false);
  const auditRevision = useRef(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const handlePrintDraft = () => {
    const documentNode = document.getElementById('prescription-print-document');
    if (!documentNode) { window.alert('Không tìm thấy bản xem trước đơn thuốc.'); return; }
    window.print();
  };

  if (!isOpen) return null;

  const handleSelectSamplePatient = (id: string) => {
    setSelectedPatientId(id);
    if (!id) return;
    const p = INITIAL_PATIENTS.find((item) => item.id === id);
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
      if (p.chronicConditions) {
        setDiagnosisText(p.chronicConditions.split(',')[0].trim());
        if (p.chronicConditions.toLowerCase().includes('tăng huyết áp')) setDiagnosisIcd10('I10');
        else if (p.chronicConditions.toLowerCase().includes('đái tháo đường')) setDiagnosisIcd10('E11');
        else if (p.chronicConditions.toLowerCase().includes('mạch vành')) setDiagnosisIcd10('I25');
        else if (p.chronicConditions.toLowerCase().includes('hen')) setDiagnosisIcd10('J45');
        else if (p.chronicConditions.toLowerCase().includes('loét')) setDiagnosisIcd10('K25');
        else if (p.chronicConditions.toLowerCase().includes('khớp')) setDiagnosisIcd10('M17');
        else if (p.chronicConditions.toLowerCase().includes('cảm cúm')) setDiagnosisIcd10('J11');
        else setDiagnosisIcd10('R69');
      }
    }
  };

  const refreshDdiAudit = async (items: DraftMedication[]) => {
    const revision = ++auditRevision.current;
    const ingredients = items.map((item) => item.activeIngredient || item.medicationName).filter(Boolean);
    if (ingredients.length < 2) { setDdiAudit(null); setDdiAuditUnavailable(false); setDdiAuditLoading(false); return; }
    setDdiAuditLoading(true);
    setDdiAudit(null); setDdiAuditUnavailable(false);
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
    const next = medications.map((item, itemIndex) => itemIndex === index ? { ...item, medicationName: med.brandName, activeIngredient: med.activeIngredient, unit: med.standardUnit, route: med.route } : item);
    setMedications(next); refreshDdiAudit(next);
  };
  const updateMedication = (index: number, field: keyof DraftMedication, value: string | number) => {
    const next = medications.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
    setMedications(next); refreshDdiAudit(next);
  };

  const normalizeRoute = (r: string): PrescriptionOrder['items'][0]['route'] =>
    r.includes('bắp') ? 'Tiêm bắp' : r.includes('Truyền') ? 'Truyền tĩnh mạch' : r.includes('Uống') ? 'Uống' : r.includes('Hít') ? 'Hít' : r.includes('Đặt') ? 'Đặt' : 'Tiêm tĩnh mạch';
  const normalizeUnit = (u: string): PrescriptionOrder['items'][0]['unit'] =>
    (u === 'Lọ' || u === 'Viên' || u === 'Chai' || u === 'Hộp' || u === 'Vỉ') ? u : 'Ống';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePrescriptionDraft({ patientName, diagnosisText, items: medications.map((med) => ({ medicationName: med.medicationName, dosage: med.dosage, frequency: med.frequency, route: med.route, quantity: med.quantity, durationDays: daysPrescribed })) });
    const patientAgeMonths = patientDob ? (Date.now() - new Date(patientDob).getTime()) / (1000 * 60 * 60 * 24 * 30.4375) : undefined;
    if (patientAgeMonths !== undefined && patientAgeMonths < 72 && !(Number(patientWeight) > 0)) errors.push('Bắt buộc ghi cân nặng người bệnh dưới 72 tháng tuổi theo mẫu Phụ lục I TT26.');
    setValidationErrors(errors);
    const medicationCount = medications.filter((med) => med.activeIngredient.trim() || med.medicationName.trim()).length;
    const auditRequired = medicationCount > 1;
    if (errors.length || (auditRequired && (ddiAudit?.has_contraindication || ddiAuditUnavailable || ddiAuditLoading || !ddiAudit))) {
      if (ddiAudit?.has_contraindication) setValidationErrors([...errors, 'Không thể lưu khi danh sách có cặp thuốc chống chỉ định.']);
      if (ddiAuditUnavailable) setValidationErrors([...errors, 'Chưa kết nối được bộ kiểm tra tương tác; hãy thử lại trước khi lưu.']);
      if (ddiAuditLoading) setValidationErrors([...errors, 'Đang kiểm tra tương tác thuốc; vui lòng chờ hoàn tất.']);
      return;
    }

    const matchedPatient = findPatientByNameOrQuery(patientName, INITIAL_PATIENTS);
    const finalPatientId = patientId || matchedPatient?.id || '';
    const finalCccd = patientCccd.trim() || matchedPatient?.cccd || '';
    const finalPhone = patientPhone.trim() || matchedPatient?.phone || undefined;
    const finalEmail = patientEmail.trim() || matchedPatient?.email || undefined;
    const finalDob = patientDob || matchedPatient?.dob || '';
    const finalGender = (patientGender || matchedPatient?.gender || '') as 'Nam' | 'Nữ' | '';
    const finalDept = department || '';

    try { await onSaveOrder({
      id: `DRAFT-${Date.now()}`,
      prescriptionType: rxType,
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
      items: medications.map((med) => ({ id: med.id, medicationName: med.medicationName, activeIngredient: med.activeIngredient, dosage: med.dosage.trim(), frequency: med.frequency.trim(), route: normalizeRoute(med.route), quantity: med.quantity, unit: normalizeUnit(med.unit), instructions: med.instructions.trim(), durationDays: daysPrescribed }))
    }); onClose(); }
    catch (error) { setValidationErrors([error instanceof Error ? error.message : 'Máy chủ chưa chấp nhận đơn thuốc.']); }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      {/* Container Mở Rộng Chuẩn Workstation CPOE (sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl h-[90vh]) */}
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] max-h-[920px] flex flex-col overflow-hidden text-slate-900">
        <div className="absolute -left-[10000px] top-0"><PrescriptionPrintDocument order={{ id: 'DRAFT-PREVIEW', prescriptionType: rxType, patientId, patientInsuranceId, patientName: patientName || '—', patientCccd, patientAddress, guardianName, patientPhone, patientDob, patientGender, patientWeight: patientWeight ? Number(patientWeight) : undefined, department, diagnosisIcd10, diagnosisText, isChronicDisease: isChronic, daysPrescribed, doctorName: formatDoctorDisplay(doctorName), doctorCertificate: '', prescribedAt: new Date().toLocaleDateString('vi-VN'), status: 'draft', items: medications.filter((m) => m.medicationName).map((m) => ({ ...m, route: normalizeRoute(m.route), unit: normalizeUnit(m.unit) })) }} /></div>
        
        {/* Header Chuẩn Kho Dược: Nền trắng, phẳng, viền slate-200 */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded">
                TT 26/2025/TT-BYT
              </span>
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-slate-800" />
                <h3 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
                  Kê đơn thuốc điều trị
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Bác sĩ chỉ định: <strong className="text-slate-800 font-semibold">{formatDoctorDisplay(doctorName)}</strong> · Trạm làm việc lâm sàng CPOE
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Phân loại đơn thuốc: Chuyển đổi Ngoại trú / Nội trú */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button type="button" onClick={handlePrintDraft}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition">
                <Printer className="w-4 h-4 inline mr-1" />In đơn
              </button>
              <button
                type="button"
                onClick={() => { setRxType('outpatient'); setDaysPrescribed(0); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                  rxType === 'outpatient'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                Ngoại trú (Đơn xuất viện)
              </button>
              <button
                type="button"
                onClick={() => { setRxType('inpatient_daily'); setDaysPrescribed(0); setIsChronic(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                  rxType === 'inpatient_daily'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                Nội trú (Y lệnh ngày)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng form kê đơn"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body 2 Cột Trái - Phải Chuẩn Workstation */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {validationErrors.length > 0 && (
            <div role="alert" className="px-5 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-900">
              <strong>Chưa thể lưu bản nháp:</strong> {validationErrors.join(' ')}
            </div>
          )}
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              
              {/* CỘT TRÁI: HÀNH CHÍNH NGƯỜI BỆNH & CHẨN ĐOÁN (lg:col-span-6) */}
              <div className="lg:col-span-6 p-5 sm:p-6 space-y-4.5 bg-white">
                
                {/* 1. Chọn nhanh bệnh nhân mẫu */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Chọn nhanh bệnh nhân mẫu (Bộ dữ liệu lâm sàng 14 BN)</span>
                    </label>
                    <span className="text-2xs font-mono text-slate-400">Tự động điền 1 chạm</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-slate-700">Cân nặng (bắt buộc với trẻ dưới 72 tháng), kg<input type="number" min="0" step="0.1" value={patientWeight} onChange={(e) => setPatientWeight(e.target.value)} className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-300 rounded-lg text-sm" /></label>
                    <label className="text-xs font-semibold text-slate-700">Mã số bảo hiểm y tế (nếu có)<input value={patientInsuranceId} onChange={(e) => setPatientInsuranceId(e.target.value)} className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-300 rounded-lg text-sm" /></label>
                  </div>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handleSelectSamplePatient(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 cursor-pointer transition"
                  >
                    <option value="">-- Bấm để chọn tự động điền hồ sơ bệnh nhân mẫu --</option>
                    {INITIAL_PATIENTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} · {p.fullName} ({p.gender}, {p.age} tuổi) - SĐT: {p.phone || 'Chưa có'} · {p.department || p.room}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Nhóm thông tin hành chính người bệnh */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Thông Tin Hành Chính Người Bệnh (Bắt Buộc TT 26)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Họ và tên người bệnh <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        value={patientName}
                        onChange={(e) => {
                          setPatientName(e.target.value);
                          const p = findPatientByNameOrQuery(e.target.value.toLowerCase(), INITIAL_PATIENTS);
                          if (p) {
                            setPatientPhone(p.phone || '');
                            setPatientEmail(p.email || '');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-semibold transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Số CCCD (12 chữ số định danh) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="001201019283"
                        value={patientCccd}
                        onChange={(e) => setPatientCccd(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-mono transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>Số điện thoại (Nhận SMS đơn thuốc) <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="09xxxxxxxx"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        onBlur={() => {
                          const p = findPatientByNameOrQuery(patientName.toLowerCase(), INITIAL_PATIENTS);
                          if (p) {
                            if (!patientPhone) setPatientPhone(p.phone || '');
                            if (!patientEmail) setPatientEmail(p.email || '');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-mono transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>Email nhận bản sao đơn thuốc</span>
                      </label>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="benhnhan@example.com"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Ngày sinh</span>
                      </label>
                      <input
                        type="date"
                        value={patientDob}
                        onChange={(e) => setPatientDob(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Giới tính
                      </label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value as 'Nam' | 'Nữ')}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 cursor-pointer transition"
                      >
                        <option value="">-- Chọn --</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>Khoa / Phòng</span>
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Khoa Khám Bệnh"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nơi cư trú</label>
                      <input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm" placeholder="Nơi thường trú/tạm trú/nơi ở hiện tại" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Người đưa trẻ dưới 72 tháng đến khám (nếu có)</label>
                      <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>

                {/* 3. Nhóm chẩn đoán y khoa & thời hạn */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Chẩn Đoán Lâm Sàng &amp; Thời Hạn Điều Trị
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mã ICD-10 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="VD: I10"
                        value={diagnosisIcd10}
                        onChange={(e) => setDiagnosisIcd10(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-mono uppercase font-semibold transition"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Chẩn đoán xác định <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nhập chẩn đoán lâm sàng..."
                        value={diagnosisText}
                        onChange={(e) => setDiagnosisText(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-medium transition"
                      />
                    </div>
                  </div>

                  {rxType === 'outpatient' && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                      <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChronic}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsChronic(checked);
                            if (!checked && daysPrescribed > 30) setDaysPrescribed(30);
                          }}
                          className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                        />
                        <span className="font-medium">
                          Người bệnh thuộc danh mục bệnh tại Phụ lục VII và đã điều trị ổn định (Kê tối đa 90 ngày)
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1 border-t border-slate-200/60">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="prescription-days">
                            Số ngày sử dụng đơn thuốc
                          </label>
                          <input
                            id="prescription-days"
                            type="number"
                            min={0}
                            max={isChronic ? 90 : 30}
                            value={daysPrescribed}
                            onChange={(e) =>
                              setDaysPrescribed(Math.max(0, Math.min(isChronic ? 90 : 30, Number(e.target.value) || 0)))
                            }
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </div>
                        <p className="text-2xs text-slate-500 leading-relaxed">
                          {isChronic ? '• Kê tối đa 90 ngày theo tình trạng lâm sàng (TT 26).' : '• Kê tối đa 30 ngày cho đơn ngoại trú thông thường.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT PHẢI: CHỈ ĐỊNH DƯỢC LÝ & AN TOÀN LÂM SÀNG CDSS (lg:col-span-6) */}
              <div className="lg:col-span-6 p-5 sm:p-6 space-y-4.5 bg-slate-50/50">
                
                <div className={"flex justify-between items-center"}>
                  <h4 className="text-xs font-bold uppercase">Danh sách thuốc kê đơn</h4>
                  <button type="button" onClick={() => setMedications((xs) => [...xs, emptyMedication()])} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs"><Plus className="w-4 h-4 inline"/> Thêm thuốc</button>
                </div>
                {medications.map((medication, index) => (
                  <section key={medication.id} className="p-3 border rounded-xl bg-white space-y-3">
                    <div className="flex justify-between"><b>Thuốc {index + 1}</b>{medications.length > 1 && <button type="button" aria-label={"Xóa thuốc " + (index + 1)} onClick={() => { const next = medications.filter((_, i) => i !== index); setMedications(next); refreshDdiAudit(next); }}><Trash2 className="w-4 h-4"/></button>}</div>
                    <MedicationSearchAutocomplete selectedMedicationName={medication.medicationName} onSelect={(med) => handleSelectMed(index, med)} defaultOnlyCrashCart={false} placeholder="Tìm biệt dược hoặc hoạt chất"/>
                    <p className="text-xs">Hoạt chất: {medication.activeIngredient}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-700">Liều mỗi lần<input aria-label="Liều mỗi lần" placeholder="Ví dụ: 1 viên (500 mg)" value={medication.dosage} onChange={(e) => updateMedication(index, "dosage", e.target.value)} className="border rounded p-2 w-full mt-1"/></label>
                      <label className="text-xs text-slate-700">Tần suất dùng<input aria-label="Tần suất" placeholder="Ví dụ: ngày 2 lần, mỗi 12 giờ" value={medication.frequency} onChange={(e) => updateMedication(index, "frequency", e.target.value)} className="border rounded p-2 w-full mt-1"/></label>
                      <select aria-label="Đường dùng" value={medication.route} onChange={(e) => updateMedication(index, "route", e.target.value)} className="border rounded p-2"><option value="">Đường dùng</option><option>Uống</option><option>Tiêm bắp</option><option>Tiêm tĩnh mạch</option><option>Truyền tĩnh mạch</option><option>Đặt</option><option>Hít</option></select>
                      <input aria-label="Số lượng" type="number" min="1" value={medication.quantity} onChange={(e) => updateMedication(index, "quantity", Number(e.target.value) || 0)} className="border rounded p-2"/>
                      <select aria-label="Đơn vị" value={medication.unit} onChange={(e) => updateMedication(index, "unit", e.target.value)} className="border rounded p-2">{["Viên","Ống","Lọ","Chai","Hộp","Vỉ"].map((u) => <option key={u}>{u}</option>)}</select>
                      <label className="text-xs text-slate-700">Thời điểm / cách dùng<input aria-label="Hướng dẫn sử dụng" placeholder="Ví dụ: sau ăn; uống với nước" value={medication.instructions} onChange={(e) => updateMedication(index, "instructions", e.target.value)} className="border rounded p-2 w-full mt-1"/></label>
                    </div>
                  </section>
                ))}
                {(ddiAuditUnavailable || ddiAudit?.has_contraindication || (ddiAudit?.pair_alerts?.length ?? 0) > 0) && <div role="alert" className="p-3 border rounded text-xs"><b>{ddiAuditUnavailable ? "Chưa kiểm tra được tương tác" : ddiAudit?.has_contraindication ? "Chống chỉ định phối hợp — không thể lưu đơn" : "Cảnh báo tương tác cần rà soát"}</b>{ddiAudit?.pair_alerts?.map((a, i) => <p key={i}>{a.title} ({a.severity}) — {a.consequence}; Xử trí: {a.action}; Nguồn: {a.source}</p>)}</div>}
                {/* 6. Cảnh báo an toàn lâm sàng CDSS */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi chú lâm sàng cho Dược sĩ / Điều dưỡng phát thuốc (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Ghi chú theo dõi đặc biệt, xét nghiệm lại chức năng gan/thận..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Sticky Workstation Footer: Nền trắng, phẳng, viền slate-200 */}
          <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
              <span>Bác sĩ chỉ định: <strong className="text-slate-900 font-semibold">{formatDoctorDisplay(doctorName)}</strong></span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Bản nháp; chưa ký số hoặc phát hành</span>
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
  );
};
