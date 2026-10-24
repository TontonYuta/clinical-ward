/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Mượn Khẩn Thuốc & Vật Tư Tủ Trực (VBHN 07 & TT 18/2026/TT-BYT) (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, Shield, Pill } from 'lucide-react';
import { DebtRecord } from '../../types/clinical';
import { MasterMedication } from '../../types/medication';
import { ALL_MASTER_MEDICATIONS } from '../../data/medicationMasterData';
import { MedicationSearchAutocomplete } from '../Common/MedicationSearchAutocomplete';
import { clinicalAudio } from '../../utils/audio';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface ManualBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmBorrow: (record: Omit<DebtRecord, 'id' | 'code' | 'borrowDate' | 'borrowTime' | 'status'>) => void;
  isAudioMuted: boolean;
  onOpenSafetyGuide?: (medName: string) => void;
}

const QUICK_EMERGENCY_CHIPS = [
  { label: 'Adrenalin 1mg', id: 'med-em-01' }, { label: 'Morphin 10mg', id: 'med-ctrl-01' },
  { label: 'Fentanyl 0.1mg', id: 'med-ctrl-02' }, { label: 'Noradrenalin 1mg', id: 'med-em-02' },
  { label: 'Diazepam 10mg', id: 'med-em-07' },
];

export const ManualBorrowModal: React.FC<ManualBorrowModalProps> = ({
  isOpen, onClose, onConfirmBorrow, isAudioMuted, onOpenSafetyGuide,
}) => {
  useModalDismiss(isOpen, onClose);
  const def = ALL_MASTER_MEDICATIONS[0];
  const [itemName, setItemName] = useState(def.brandName);
  const [itemType, setItemType] = useState<DebtRecord['itemType']>('Thuốc cấp cứu');
  const [quantity, setQuantity] = useState(`${def.defaultDoseQty} ${def.standardUnit}`);
  const [patientCode, setPatientCode] = useState('BN-2026-9042');
  const [patientName, setPatientName] = useState('Nguyễn Văn An');
  const [patientRoom, setPatientRoom] = useState('ICU - Buồng 03 (Giường 01)');
  const [doctorName, setDoctorName] = useState('BS.CKII Nguyễn Minh Tuấn');
  const [clinicalReason, setClinicalReason] = useState('Sốc phản vệ độ III / Hội chứng vành cấp');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectMed = (med: MasterMedication) => {
    setItemName(med.brandName);
    const isValid = ['Thuốc gây nghiện', 'Thuốc hướng thần', 'Vật tư tiêu hao'].includes(med.group);
    setItemType(isValid ? (med.group as DebtRecord['itemType']) : 'Thuốc cấp cứu');
    setQuantity(`${med.defaultDoseQty} ${med.standardUnit}`);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity.trim() || !patientName.trim() || !patientRoom.trim()) {
      setValidationError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    if (!isAudioMuted) clinicalAudio.playSuccessChime();

    onConfirmBorrow({
      itemName, itemType, quantity, patientRoom,
      patientName: `${patientName} (${patientCode})`,
      borrowerName: `ĐD trực (Bác sĩ chỉ định: ${doctorName})`,
      note: `Cấp cứu: ${clinicalReason}`,
      legalBasis: itemType === 'Thuốc gây nghiện' ? 'Thông tư 18/2026/TT-BYT & VBHN 07/VBHN-BYT' : 'Văn bản hợp nhất 07/VBHN-BYT & TT 23/2011',
      ampouleReturned: itemType === 'Thuốc gây nghiện' ? false : undefined,
    });
    onClose();
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="h-14 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Mượn khẩn thuốc &amp; vật tư tủ trực</h2>
              <span className="text-[11px] text-slate-400 font-mono">VBHN 07 &amp; TT 18/2026/TT-BYT</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs text-slate-700 flex-1">
          {validationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Master Data Drug Search */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900">1. Tra cứu dược lâm sàng (tủ trực &amp; toàn viện) *:</label>
              {onOpenSafetyGuide && (
                <button
                  type="button"
                  onClick={() => onOpenSafetyGuide(itemName)}
                  className="text-[10.5px] text-teal-800 font-bold bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-300 transition cursor-pointer"
                  title="Tra cứu thông tin thuốc & Dược thư"
                >
                  Thông tin thuốc
                </button>
              )}
            </div>
            <MedicationSearchAutocomplete selectedMedicationName={itemName} onSelect={handleSelectMed} defaultOnlyCrashCart={true} />
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
              <span className="text-[10px] text-slate-400 shrink-0">Chọn nhanh:</span>
              {QUICK_EMERGENCY_CHIPS.map((chip) => (
                <button
                  type="button" key={chip.id}
                  onClick={() => { const f = ALL_MASTER_MEDICATIONS.find((m) => m.id === chip.id); if (f) handleSelectMed(f); }}
                  className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 transition shrink-0 cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-800 block mb-1">Tên thuốc đã chọn *:</label>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} required className="w-full px-3 py-1.5 border rounded-lg font-bold text-slate-900 bg-slate-50" />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">Số lượng *:</label>
                <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-teal-900" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="font-semibold text-slate-800 block mb-1">Phân loại quản lý:</label>
                <select value={itemType} onChange={(e) => setItemType(e.target.value as any)} className="w-full px-2.5 py-1.5 border rounded-lg font-medium">
                  <option value="Thuốc gây nghiện">Thuốc gây nghiện (Thu hồi vỏ TT 18/2026)</option>
                  <option value="Thuốc cấp cứu">Thuốc cấp cứu tối khẩn</option>
                  <option value="Thuốc hướng thần">Thuốc hướng thần</option>
                  <option value="Vật tư tiêu hao">Vật tư tiêu hao</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">Bác sĩ chỉ định:</label>
                <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg font-medium" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">2. Người bệnh thụ hưởng</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-slate-700 block mb-1">Mã BN:</label>
                <input type="text" value={patientCode} onChange={(e) => setPatientCode(e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg font-mono" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-700 block mb-1">Họ tên người bệnh *:</label>
                <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} required className="w-full px-3 py-1.5 border rounded-lg font-semibold" />
              </div>
            </div>
            <div>
              <label className="text-slate-700 block mb-1">Buồng / Giường cấp cứu *:</label>
              <input type="text" value={patientRoom} onChange={(e) => setPatientRoom(e.target.value)} required className="w-full px-3 py-1.5 border rounded-lg" />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-900 block mb-1">3. Lý do lâm sàng cấp cứu:</label>
            <textarea rows={2} value={clinicalReason} onChange={(e) => setClinicalReason(e.target.value)} placeholder="Nhập lý do lâm sàng..." className="w-full px-3 py-1.5 border rounded-lg resize-none" />
          </div>
        </div>

        {/* Pinned Modal Footer */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-slate-500 text-[11px] hidden sm:flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" /> Xác thực theo TT 18/2026/TT-BYT
          </span>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium cursor-pointer">
              Hủy
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs">
              <PlusCircle className="w-3.5 h-3.5" /> Ký lập phiếu mượn
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};
