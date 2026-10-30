/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Kê Đơn Thuốc Điện Tử Chuẩn CPOE (TT 26/2025/TT-BYT) (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, CheckCircle2, Stethoscope, AlertTriangle } from 'lucide-react';
import { PrescriptionOrder, PrescriptionType } from '../../../../types/cpoe';
import { MasterMedication } from '../../../../types/medication';
import { MedicationSearchAutocomplete } from '../../../Common/MedicationSearchAutocomplete';
import { useModalDismiss } from '../../../../hooks/useModalDismiss';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';

interface CpoeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (newOrder: PrescriptionOrder) => void;
  doctorName?: string;
  onOpenSafetyGuide?: (medName: string) => void;
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
  const [patientName, setPatientName] = useState('');
  const [patientCccd, setPatientCccd] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [diagnosisIcd10, setDiagnosisIcd10] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [isChronic, setIsChronic] = useState(false);
  const [daysPrescribed, setDaysPrescribed] = useState(30);
  const [medName, setMedName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [unit, setUnit] = useState('Ống');
  const [route, setRoute] = useState('Tiêm tĩnh mạch');
  const [quantity, setQuantity] = useState(1);

  if (!isOpen) return null;

  const handleSelectMed = (med: MasterMedication) => {
    setMedName(med.brandName);
    setActiveIngredient(med.activeIngredient);
    setUnit(med.standardUnit);
    setRoute(med.route);
    setQuantity(med.defaultDoseQty);
  };

  const hasDdiWarning = medName.toLowerCase().includes('morphin') && diagnosisText.toLowerCase().includes('suy hô hấp');

  const normalizeRoute = (r: string): PrescriptionOrder['items'][0]['route'] =>
    r.includes('bắp') ? 'Tiêm bắp' : r.includes('Truyền') ? 'Truyền tĩnh mạch' : r.includes('Uống') ? 'Uống' : r.includes('Hít') ? 'Hít' : r.includes('Đặt') ? 'Đặt' : 'Tiêm tĩnh mạch';
  const normalizeUnit = (u: string): PrescriptionOrder['items'][0]['unit'] =>
    (u === 'Lọ' || u === 'Viên' || u === 'Chai' || u === 'Hộp' || u === 'Vỉ') ? u : 'Ống';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    onSaveOrder({
      id: `RX-2026-${Math.floor(100 + Math.random() * 900)}`,
      prescriptionType: rxType,
      patientId: `BN-${Math.floor(8800 + Math.random() * 100)}`,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim() || undefined,
      patientEmail: patientEmail.trim() || undefined,
      patientCccd: patientCccd.trim() || '001201019283',
      patientDob: '1980-01-01', patientGender: 'Nam',
      department: rxType === 'outpatient' ? 'Khoa Khám Bệnh' : 'Hồi Sức Cấp Cứu',
      diagnosisIcd10: diagnosisIcd10.trim().toUpperCase(),
      diagnosisText: diagnosisText.trim(),
      isChronicDisease: rxType === 'outpatient' && isChronic, daysPrescribed, doctorName,
      doctorCertificate: '009125/BYT-CCHN',
      prescribedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      digitalSignature: `SHA256:${Math.random().toString(36).substring(2, 10)}... (Đã ký số)`,
      status: 'signed',
      items: [{
        id: `rxi-${Date.now()}`,
        medicationName: medName,
        activeIngredient: activeIngredient || medName.split(' ')[0],
        dosage: 'Chuẩn', frequency: '1 lần/ngày',
        route: normalizeRoute(route), quantity, unit: normalizeUnit(unit),
        instructions: 'Dùng theo phác đồ chỉ định của bác sĩ'
      }]
    });
    onClose();
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        <div className="h-14 px-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-sm sm:text-base">Kê đơn thuốc điều trị</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10 text-slate-300 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs sm:text-sm">
          <div className="flex gap-2">
            <button
              type="button" onClick={() => { setRxType('inpatient_daily'); setDaysPrescribed(1); setIsChronic(false); }}
              className={`flex-1 py-1.5 rounded-md font-semibold border cursor-pointer transition ${rxType === 'inpatient_daily' ? 'bg-blue-50 text-blue-900 border-blue-500 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              🏥 Đơn thuốc Nội trú (Y lệnh ngày)
            </button>
            <button
              type="button" onClick={() => { setRxType('outpatient'); setDaysPrescribed(30); }}
              className={`flex-1 py-1.5 rounded-md font-semibold border cursor-pointer transition ${rxType === 'outpatient' ? 'bg-emerald-50 text-emerald-900 border-emerald-500 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              🏪 Đơn thuốc Ngoại trú (Xuất viện)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Tên người bệnh *</label>
              <input type="text" required placeholder="Nguyễn Văn A" value={patientName} onChange={(e) => { setPatientName(e.target.value); const p = findPatientByNameOrQuery(e.target.value.toLowerCase(), INITIAL_PATIENTS); if (p) { setPatientPhone(p.phone || ''); setPatientEmail(p.email || ''); } }} className="w-full px-2.5 py-2 border rounded-md text-sm" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Số CCCD (TT 26) *</label>
              <input type="text" placeholder="001201019283" value={patientCccd} onChange={(e) => setPatientCccd(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-md font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Số điện thoại</label>
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} onBlur={() => { const p = findPatientByNameOrQuery(patientName.toLowerCase(), INITIAL_PATIENTS); if (p) { if (!patientPhone) setPatientPhone(p.phone || ''); if (!patientEmail) setPatientEmail(p.email || ''); } }} className="w-full px-2.5 py-2 border rounded-md text-sm" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Email nhận dặn dò</label>
              <input type="email" autoComplete="email" placeholder="benhnhan@example.com" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="w-full px-2.5 py-2 border rounded-md text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Mã ICD-10 *</label>
              <input type="text" placeholder="VD: I10" value={diagnosisIcd10} onChange={(e) => setDiagnosisIcd10(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-md font-mono uppercase" />
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-0.5">Chẩn đoán xác định *</label>
              <input type="text" placeholder="Nhập chẩn đoán lâm sàng..." value={diagnosisText} onChange={(e) => setDiagnosisText(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-md" />
            </div>
          </div>
          {rxType === 'outpatient' && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={isChronic} onChange={(event) => { const checked = event.target.checked; setIsChronic(checked); if (!checked && daysPrescribed > 30) setDaysPrescribed(30); }} className="mt-0.5" />
                <span>Người bệnh thuộc danh mục bệnh tại Phụ lục VII và đã điều trị ổn định</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5" htmlFor="prescription-days">Số ngày sử dụng</label>
                  <input id="prescription-days" type="number" min={1} max={isChronic ? 90 : 30} value={daysPrescribed} onChange={(event) => setDaysPrescribed(Math.max(1, Math.min(isChronic ? 90 : 30, Number(event.target.value) || 1)))} className="w-full px-2.5 py-1.5 border rounded-md" />
                </div>
                <p className="text-xs text-slate-500 pb-2">{isChronic ? 'Tối đa 90 ngày theo tình trạng lâm sàng.' : 'Tối đa 30 ngày.'}</p>
              </div>
            </div>
          )}

          {/* Smart Medication Search */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">Tìm và chỉ định thuốc (Cổng Dược quốc gia) *</label>
              {onOpenSafetyGuide && (
                <button
                  type="button"
                  onClick={() => onOpenSafetyGuide(medName)}
                  className="text-[11px] text-teal-800 font-bold bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-300 transition cursor-pointer"
                  title="Tra cứu thông tin thuốc & Dược thư"
                >
                  Thông tin thuốc
                </button>
              )}
            </div>
            <MedicationSearchAutocomplete
              selectedMedicationName={medName}
              onSelect={handleSelectMed}
              defaultOnlyCrashCart={false}
              placeholder="Gõ tìm biệt dược, hoạt chất (adre, mor, ceftri, kcl)..."
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-0.5">Hoạt chất / Đường dùng</label>
              <input type="text" readOnly value={`${activeIngredient} (${route})`} className="w-full px-2.5 py-1.5 border rounded-md bg-slate-50 text-slate-600 font-medium" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Số lượng ({unit})</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full px-2.5 py-1.5 border rounded-md font-bold text-teal-900" />
            </div>
          </div>

          {hasDdiWarning && (
            <div className="p-2 bg-rose-50 border border-rose-300 rounded-md flex items-center gap-2 text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Cảnh báo CDSS: Chống chỉ định dùng Morphin trên bệnh nhân suy hô hấp!</span>
            </div>
          )}

          <div className="pt-2.5 border-t flex items-center justify-between">
            <span className="text-xs text-slate-500">Bác sĩ: <strong>{doctorName}</strong></span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded-md text-slate-700 cursor-pointer">Hủy</button>
              <button type="submit" className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-md font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ký số ban hành đơn</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
