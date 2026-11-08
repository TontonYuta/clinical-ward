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
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../services/patientService';

interface ManualBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmBorrow: (record: Omit<DebtRecord, 'id' | 'code' | 'borrowDate' | 'borrowTime' | 'status'>) => void;
  isAudioMuted: boolean;
  onOpenSafetyGuide?: (medName: string) => void;
}

export const ManualBorrowModal: React.FC<ManualBorrowModalProps> = ({
  isOpen, onClose, onConfirmBorrow, isAudioMuted, onOpenSafetyGuide,
}) => {
  useModalDismiss(isOpen, onClose);
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<DebtRecord['itemType']>('Thuốc cấp cứu');
  const [quantity, setQuantity] = useState('');
  const [patientCode, setPatientCode] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientRoom, setPatientRoom] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [clinicalReason, setClinicalReason] = useState('');
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
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
              <Pill className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-sans text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md">
                  TT 18/2026 &amp; VBHN 07
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight truncate">
                  Mượn khẩn thuốc &amp; vật tư tủ trực
                </h2>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-800 block mb-1">Tên thuốc đã chọn *:</label>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} required placeholder="Nhập hoặc tìm chọn thuốc..." className="w-full px-3 py-1.5 border rounded-lg font-bold text-slate-900 bg-slate-50" />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">Số lượng *:</label>
                <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} required placeholder="Ví dụ: 1 ống" className="w-full px-3 py-1.5 border rounded-lg font-sans tabular-nums font-bold text-teal-900" />
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
                <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Nhập tên bác sĩ..." className="w-full px-3 py-1.5 border rounded-lg font-medium" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">2. Người bệnh thụ hưởng</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-slate-700 block mb-1">Mã BN:</label>
                <input
                  type="text"
                  value={patientCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPatientCode(val);
                    const p = findPatientByNameOrQuery(val, INITIAL_PATIENTS);
                    if (p) {
                      setPatientName(p.fullName);
                      setPatientRoom(p.room);
                      setPatientPhone(p.phone || '');
                    }
                  }}
                  placeholder="BN-..."
                  className="w-full px-2.5 py-1.5 border rounded-lg font-sans tabular-nums font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-700 block mb-1">Họ tên người bệnh *:</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPatientName(val);
                    const p = findPatientByNameOrQuery(val, INITIAL_PATIENTS);
                    if (p) {
                      setPatientCode(p.id);
                      setPatientRoom(p.room);
                      setPatientPhone(p.phone || '');
                    }
                  }}
                  required
                  placeholder="Nhập họ tên người bệnh..."
                  className="w-full px-3 py-1.5 border rounded-lg font-semibold"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-700 block mb-1">Buồng / Giường cấp cứu *:</label>
                <input type="text" value={patientRoom} onChange={(e) => setPatientRoom(e.target.value)} required placeholder="Ví dụ: ICU - Giường 01" className="w-full px-3 py-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">SĐT nhận tin BV:</label>
                <input type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="09xxxxxxxx" className="w-full px-3 py-1.5 border rounded-lg font-sans tabular-nums" />
              </div>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-900 block mb-1">3. Lý do lâm sàng cấp cứu:</label>
            <textarea rows={2} value={clinicalReason} onChange={(e) => setClinicalReason(e.target.value)} placeholder="Nhập lý do lâm sàng..." className="w-full px-3 py-1.5 border rounded-lg resize-none" />
          </div>
        </div>

        {/* Pinned Modal Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-slate-500 text-xs hidden sm:flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-teal-600" /> Xác thực theo TT 18/2026/TT-BYT
          </span>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs sm:text-sm cursor-pointer transition">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition">
              <PlusCircle className="w-3.5 h-3.5" /> Ký lập phiếu mượn
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};
