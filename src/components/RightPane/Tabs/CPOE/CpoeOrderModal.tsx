/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Kê Đơn Thuốc Điện Tử Chuẩn CPOE (TT 26/2025/TT-BYT)
 * Giao diện Workstation Mở Rộng 2 Cột, Đồng Bộ Kho Dược (Flat, Neutral Slate, Zero-Box)
 */

import React, { useState } from 'react';
import { X, Save, Stethoscope, AlertTriangle, ShieldAlert, Pill, User, Building2, Phone, Mail, Calendar } from 'lucide-react';
import { PrescriptionOrder, PrescriptionType } from '../../../../types/cpoe';
import { MasterMedication } from '../../../../types/medication';
import { MedicationSearchAutocomplete } from '../../../Common/MedicationSearchAutocomplete';
import { useModalDismiss } from '../../../../hooks/useModalDismiss';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';
import { validatePrescriptionDraft } from '../../../../services/prescriptionValidation';

interface CpoeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (newOrder: PrescriptionOrder) => void;
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

  // Thông số thuốc kê đơn
  const [medName, setMedName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [unit, setUnit] = useState('Viên');
  const [route, setRoute] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');

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

  const handleSelectMed = (med: MasterMedication) => {
    setMedName(med.brandName);
    setActiveIngredient(med.activeIngredient);
    setUnit(med.standardUnit);
    setRoute(med.route);
    setQuantity(0);
    setDosage('');
    setFrequency('');
    setInstructions('');
  };

  const hasDdiWarning = medName.toLowerCase().includes('morphin') && diagnosisText.toLowerCase().includes('suy hô hấp');
  const isHighAlertMed = /morphin|fentanyl|adrenalin|kali clorid|kcl/i.test(medName);

  const normalizeRoute = (r: string): PrescriptionOrder['items'][0]['route'] =>
    r.includes('bắp') ? 'Tiêm bắp' : r.includes('Truyền') ? 'Truyền tĩnh mạch' : r.includes('Uống') ? 'Uống' : r.includes('Hít') ? 'Hít' : r.includes('Đặt') ? 'Đặt' : 'Tiêm tĩnh mạch';
  const normalizeUnit = (u: string): PrescriptionOrder['items'][0]['unit'] =>
    (u === 'Lọ' || u === 'Viên' || u === 'Chai' || u === 'Hộp' || u === 'Vỉ') ? u : 'Ống';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePrescriptionDraft({ patientName, diagnosisText, items: [{ medicationName: medName, dosage, frequency, route, quantity, durationDays: daysPrescribed }] });
    setValidationErrors(errors);
    if (errors.length) return;

    const matchedPatient = findPatientByNameOrQuery(patientName, INITIAL_PATIENTS);
    const finalPatientId = patientId || matchedPatient?.id || '';
    const finalCccd = patientCccd.trim() || matchedPatient?.cccd || '';
    const finalPhone = patientPhone.trim() || matchedPatient?.phone || undefined;
    const finalEmail = patientEmail.trim() || matchedPatient?.email || undefined;
    const finalDob = patientDob || matchedPatient?.dob || '';
    const finalGender = (patientGender || matchedPatient?.gender || '') as 'Nam' | 'Nữ' | '';
    const finalDept = department || '';

    onSaveOrder({
      id: `DRAFT-${Date.now()}`,
      prescriptionType: rxType,
      patientId: finalPatientId,
      patientName: patientName.trim(),
      patientPhone: finalPhone,
      patientEmail: finalEmail,
      patientCccd: finalCccd,
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
      items: [{
        id: `rxi-${Date.now()}`,
        medicationName: medName,
        activeIngredient: activeIngredient,
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        route: normalizeRoute(route),
        quantity,
        unit: normalizeUnit(unit),
        instructions: instructions.trim(), durationDays: daysPrescribed
      }]
    });
    onClose();
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
                
                {/* 4. Tra cứu thuốc Cổng Dược Quốc Gia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-slate-700" />
                    <span>Tìm và chỉ định thuốc (Cổng Dược quốc gia) <span className="text-rose-500">*</span></span>
                  </label>
                  <MedicationSearchAutocomplete
                    selectedMedicationName={medName}
                    onSelect={handleSelectMed}
                    defaultOnlyCrashCart={false}
                    placeholder="Gõ tìm biệt dược, hoạt chất (adre, mor, ceftri, kcl)..."
                  />
                </div>

                {/* 5. Thông số hoạt chất, liều lượng & đường dùng */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Quy Cách, Đường Dùng &amp; Số Lượng Kê
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hoạt chất / Tên gốc
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={activeIngredient}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100/80 text-slate-800 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Đường dùng
                      </label>
                      <select
                        value={route}
                        onChange={(e) => setRoute(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition font-medium"
                      >
                        <option value="">-- Chọn đường dùng --</option>
                        <option value="Uống">Đường uống</option>
                        <option value="Tiêm tĩnh mạch">Tiêm tĩnh mạch (IV)</option>
                        <option value="Tiêm bắp">Tiêm bắp (IM)</option>
                        <option value="Truyền tĩnh mạch">Truyền tĩnh mạch (IV Infusion)</option>
                        <option value="Đặt">Đặt trực tràng</option>
                        <option value="Hít">Khí dung / Hít</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Đơn vị tính
                      </label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition font-medium"
                      >
                        <option value="Viên">Viên</option>
                        <option value="Ống">Ống</option>
                        <option value="Lọ">Lọ</option>
                        <option value="Chai">Chai</option>
                        <option value="Hộp">Hộp</option>
                        <option value="Vỉ">Vỉ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Số lượng cấp phát <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Liều mỗi lần dùng
                      </label>
                      <input
                        type="text"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        placeholder="VD: 1 viên/lần, 1 ống/lần"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tần suất chỉ định
                      </label>
                      <input
                        type="text"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        placeholder="VD: 2 lần/ngày (Sáng - Chiều)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hướng dẫn sử dụng &amp; Dặn dò người bệnh
                    </label>
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="VD: Uống sau khi ăn no 30 phút, uống nhiều nước"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>
                </div>

                {/* 6. Cảnh báo an toàn lâm sàng CDSS */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  {hasDdiWarning && (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-start gap-2.5 text-rose-900 text-xs font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Cảnh báo CDSS nghiêm trọng:</strong> Chống chỉ định dùng Morphin trên người bệnh suy hô hấp!
                      </div>
                    </div>
                  )}

                  {isHighAlertMed && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs font-medium">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Thuốc cảnh báo cao (High-Alert / TT 20):</strong> Yêu cầu điều dưỡng kiểm tra chéo (Double-check) trước khi cấp phát và hoàn trả vỏ thuốc đúng quy trình.
                      </div>
                    </div>
                  )}

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
