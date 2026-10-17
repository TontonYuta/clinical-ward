/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, Shield, FileText, Pill } from 'lucide-react';
import { DebtRecord } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';

interface ManualBorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmBorrow: (newRecord: Omit<DebtRecord, 'id' | 'code' | 'borrowDate' | 'borrowTime' | 'status'>) => void;
  isAudioMuted: boolean;
}

const COMMON_EMERGENCY_ITEMS = [
  { name: 'Morphin sulfat 10mg/1ml', type: 'Thuốc gây nghiện' as const, defaultQty: '2 ống', note: 'Kèm theo dõi thu hồi vỏ ống' },
  { name: 'Fentanyl 0.1mg/2ml', type: 'Thuốc gây nghiện' as const, defaultQty: '1 ống', note: 'Kèm theo dõi thu hồi vỏ ống' },
  { name: 'Adrenalin (Epinephrine) 1mg/1ml', type: 'Thuốc cấp cứu' as const, defaultQty: '3 ống', note: 'Cấp cứu sốc phản vệ / ngừng tim' },
  { name: 'Noradrenalin 1mg/ml', type: 'Thuốc cấp cứu' as const, defaultQty: '2 ống', note: 'Nâng huyết áp trong sốc nhiễm khuẩn' },
  { name: 'Ceftriaxone 1g (Lọ bột tiêm)', type: 'Thuốc cấp cứu' as const, defaultQty: '2 lọ', note: 'Kháng sinh phổ rộng cấp bách' },
  { name: 'Bơm tiêm điện 50ml vô khuẩn', type: 'Vật tư tiêu hao' as const, defaultQty: '3 cái', note: 'Gắn máy tiêm thuốc vận mạch' },
  { name: 'Bộ dây truyền dịch áp lực cao', type: 'Vật tư tiêu hao' as const, defaultQty: '2 bộ', note: 'Truyền dịch khẩn' }
];

export const ManualBorrowModal: React.FC<ManualBorrowModalProps> = ({
  isOpen,
  onClose,
  onConfirmBorrow,
  isAudioMuted
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [itemName, setItemName] = useState<string>(COMMON_EMERGENCY_ITEMS[0].name);
  const [itemType, setItemType] = useState<DebtRecord['itemType']>(COMMON_EMERGENCY_ITEMS[0].type);
  const [quantity, setQuantity] = useState<string>(COMMON_EMERGENCY_ITEMS[0].defaultQty);
  const [patientCode, setPatientCode] = useState<string>('BN-2026-9042');
  const [patientName, setPatientName] = useState<string>('Nguyễn Văn An');
  const [patientRoom, setPatientRoom] = useState<string>('ICU - Buồng 03 (Giường 01)');
  const [doctorName, setDoctorName] = useState<string>('BS.CKII Nguyễn Minh Tuấn');
  const [clinicalReason, setClinicalReason] = useState<string>('Hội chứng vành cấp ST chênh lên, đau thắt ngực dữ dội');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx);
    const item = COMMON_EMERGENCY_ITEMS[idx];
    setItemName(item.name);
    setItemType(item.type);
    setQuantity(item.defaultQty);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity.trim() || !patientName.trim() || !patientRoom.trim()) {
      setValidationError('Vui lòng điền đầy đủ các thông tin bắt buộc (Tên thuốc, số lượng, tên bệnh nhân, buồng cấp cứu).');
      return;
    }

    if (!isAudioMuted) clinicalAudio.playSuccessChime();

    onConfirmBorrow({
      itemName,
      itemType,
      quantity,
      patientName: `${patientName} (${patientCode})`,
      patientRoom,
      borrowerName: `ĐD Trực (Y lệnh: ${doctorName})`,
      note: `Lý do cấp cứu: ${clinicalReason}`,
      legalBasis: itemType === 'Thuốc gây nghiện'
        ? 'Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT'
        : 'Thông tư 22/2011/TT-BYT - Điều 9 & 10',
      ampouleReturned: itemType === 'Thuốc gây nghiện' ? false : undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 px-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Lập Phiếu Mượn Khẩn Thuốc / Vật Tư Tủ Trực</h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Kho Dược Lâm Sàng · Căn cứ Thông tư 22/2011 &amp; TT 20/2017/TT-BYT
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} noValidate className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {validationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Preset Selector */}
          <div>
            <label className="font-bold text-slate-900 block mb-1.5">
              Chọn nhanh cơ số thuốc cấp cứu thường gặp:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMON_EMERGENCY_ITEMS.map((item, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectPreset(idx)}
                  className={`text-left p-2 rounded border transition cursor-pointer flex flex-col ${
                    selectedPreset === idx
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] px-1 rounded bg-slate-200/80 text-slate-700 font-mono">
                      {item.defaultQty}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">{item.type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Item details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-900 block">
                Tên thuốc / Vật tư y tế <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">
                Số lượng mượn <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="VD: 2 ống"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">Phân loại danh mục:</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden"
              >
                <option value="Thuốc gây nghiện">Thuốc gây nghiện (Bắt buộc nộp vỏ ống TT 20)</option>
                <option value="Thuốc cấp cứu">Thuốc cấp cứu tối khẩn</option>
                <option value="Thuốc hướng thần">Thuốc hướng thần</option>
                <option value="Vật tư tiêu hao">Vật tư tiêu hao</option>
                <option value="Vật tư phẫu thuật">Vật tư phẫu thuật</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">
                Bác sĩ ra y lệnh cấp cứu:
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Patient Details */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <span className="font-bold text-slate-900 block text-xs">
              Thông tin bệnh nhân thụ hưởng cơ số khẩn:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">Mã bệnh nhân:</label>
                <input
                  type="text"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">Họ và tên bệnh nhân:</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-medium"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                Vị trí buồng bệnh / Giường cấp cứu:
              </label>
              <input
                type="text"
                value={patientRoom}
                onChange={(e) => setPatientRoom(e.target.value)}
                required
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
              />
            </div>
          </div>

          {/* Clinical Reason */}
          <div className="space-y-1">
            <label className="font-bold text-slate-900 block">
              Chỉ định lâm sàng / Lý do mượn khẩn:
            </label>
            <textarea
              rows={2}
              value={clinicalReason}
              onChange={(e) => setClinicalReason(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden resize-none"
            />
          </div>

          {/* Legal Notice */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Quy định hoàn bù (Điều 10 Thông tư 22/2011/TT-BYT):</strong> Mọi cơ số mượn khẩn ca trực phải được Bác sĩ kê đơn bù và hoàn trả cho tủ trực trước <strong>07:00 sáng hôm sau</strong>.
              {itemType === 'Thuốc gây nghiện' && (
                <span className="text-rose-700 block font-semibold mt-1">
                  * Thuốc gây nghiện: Sau khi tiêm phải thu hồi vỏ ống nguyên vẹn vào khay niêm phong (Điều 15 TT 20/2017).
                </span>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              <span>Xác nhận bằng mã PIN / Thẻ nhân viên chuyên môn</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-98"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Ký Lập Phiếu Mượn</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
