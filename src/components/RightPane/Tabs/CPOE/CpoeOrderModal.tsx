/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Kê Đơn Thuốc Điện Tử & Ra Y Lệnh CPOE (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, CheckCircle2, Stethoscope, AlertTriangle } from 'lucide-react';
import { PrescriptionOrder, PrescriptionType } from '../../../../types/cpoe';
import { useModalDismiss } from '../../../../hooks/useModalDismiss';

interface CpoeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (newOrder: PrescriptionOrder) => void;
  doctorName?: string;
}

export const CpoeOrderModal: React.FC<CpoeOrderModalProps> = ({
  isOpen,
  onClose,
  onSaveOrder,
  doctorName = 'BS. Trần Văn Hùng'
}) => {
  useModalDismiss(isOpen, onClose);
  const [rxType, setRxType] = useState<PrescriptionType>('outpatient');
  const [patientName, setPatientName] = useState('');
  const [patientCccd, setPatientCccd] = useState('');
  const [diagnosisIcd10, setDiagnosisIcd10] = useState('I10');
  const [diagnosisText, setDiagnosisText] = useState('Tăng huyết áp vô căn');
  const [isChronic, setIsChronic] = useState(false);
  const [daysPrescribed, setDaysPrescribed] = useState(30);
  const [medName, setMedName] = useState('Amlodipin 5mg');
  const [quantity, setQuantity] = useState(30);

  if (!isOpen) return null;

  const hasDdiWarning = medName.toLowerCase().includes('morphin') && diagnosisText.toLowerCase().includes('suy hô hấp');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    onSaveOrder({
      id: `RX-2026-${Math.floor(100 + Math.random() * 900)}`,
      prescriptionType: rxType,
      patientId: `BN-${Math.floor(8800 + Math.random() * 100)}`,
      patientName: patientName.trim(),
      patientCccd: patientCccd.trim() || '001201019283',
      patientDob: '1980-01-01',
      patientGender: 'Nam',
      department: rxType === 'outpatient' ? 'Khoa Khám Bệnh' : 'Hồi Sức Cấp Cứu',
      diagnosisIcd10: diagnosisIcd10.trim().toUpperCase(),
      diagnosisText: diagnosisText.trim(),
      isChronicDisease: isChronic,
      daysPrescribed,
      doctorName,
      doctorCertificate: '009125/BYT-CCHN',
      prescribedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      digitalSignature: `SHA256:${Math.random().toString(36).substring(2, 10)}... (Đã ký số)`,
      status: 'signed',
      items: [{
        id: `rxi-${Date.now()}`,
        medicationName: medName,
        activeIngredient: medName.split(' ')[0],
        dosage: 'Chuẩn',
        frequency: '1 lần/ngày',
        route: rxType === 'outpatient' ? 'Uống' : 'Tiêm tĩnh mạch',
        quantity,
        unit: rxType === 'outpatient' ? 'Viên' : 'Ống',
        instructions: 'Dùng theo hướng dẫn bác sĩ'
      }]
    });
    onClose();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        <div className="h-14 px-5 bg-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-300" />
            <h3 className="font-bold text-sm sm:text-base">Kê Đơn Thuốc Điện Tử (TT 26/2025/TT-BYT)</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs sm:text-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setRxType('outpatient'); setDaysPrescribed(30); }}
              className={`flex-1 py-1.5 rounded-lg font-semibold border ${rxType === 'outpatient' ? 'bg-teal-50 text-teal-900 border-teal-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              Đơn Ngoại Trú (BHYT)
            </button>
            <button
              type="button"
              onClick={() => { setRxType('inpatient_daily'); setDaysPrescribed(1); setIsChronic(false); }}
              className={`flex-1 py-1.5 rounded-lg font-semibold border ${rxType === 'inpatient_daily' ? 'bg-teal-50 text-teal-900 border-teal-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              Y Lệnh Nội Trú (Ngày)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Tên Người Bệnh *</label>
              <input type="text" required placeholder="Nguyễn Văn A" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Số CCCD (TT 26) *</label>
              <input type="text" placeholder="001201019283" value={patientCccd} onChange={(e) => setPatientCccd(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Mã ICD-10 *</label>
              <input type="text" value={diagnosisIcd10} onChange={(e) => setDiagnosisIcd10(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg font-mono uppercase" />
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-0.5">Chẩn Đoán Xác Định *</label>
              <input type="text" value={diagnosisText} onChange={(e) => setDiagnosisText(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg" />
            </div>
          </div>

          {rxType === 'outpatient' && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 text-xs">
                <input type="checkbox" checked={isChronic} onChange={(e) => { setIsChronic(e.target.checked); setDaysPrescribed(e.target.checked ? 60 : 30); }} />
                <span>Bệnh mạn tính ổn định (Phụ lục VII TT 26/2025 - Tối đa 90 ngày)</span>
              </label>
              <div className="text-xs text-slate-600 flex items-center justify-between">
                <span>Thời hạn kê: <strong>{daysPrescribed} ngày</strong></span>
                <input type="range" min="7" max={isChronic ? 90 : 30} step="7" value={daysPrescribed} onChange={(e) => setDaysPrescribed(Number(e.target.value))} className="w-28 accent-teal-700" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-0.5">Tên Thuốc Chỉ Định</label>
              <input type="text" value={medName} onChange={(e) => setMedName(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Số Lượng</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full px-2.5 py-1.5 border rounded-lg font-bold" />
            </div>
          </div>

          {hasDdiWarning && (
            <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg flex items-center gap-2 text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Cảnh báo CDSS: Chống chỉ định dùng Morphin trên bệnh nhân suy hô hấp!</span>
            </div>
          )}

          <div className="pt-2.5 border-t flex items-center justify-between">
            <span className="text-xs text-slate-500">Bác sĩ: <strong>{doctorName}</strong></span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded-lg text-slate-700">Hủy</button>
              <button type="submit" className="px-4 py-1.5 bg-teal-800 text-white rounded-lg font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ký Số Ban Hành</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
