/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, Shield, FileText, Pill } from 'lucide-react';
import { DebtRecord } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { ClinicalMacroAutocomplete } from '../Common/ClinicalMacroAutocomplete';
import { ClinicalMacro, CLINICAL_MACROS } from '../../data/clinicalMacros';

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="min-h-14 py-3 px-3.5 sm:px-5 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Pill className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold truncate">Lập Phiếu Mượn Khẩn Thuốc / Vật Tư Tủ Trực</h2>
              <span className="text-[11px] text-slate-400 font-mono truncate block">
                Kho Dược Lâm Sàng · Điều 10 Thông tư 22/2011/TT-BYT
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} noValidate className="p-3 sm:p-5 overflow-y-auto space-y-3.5 text-xs text-slate-700 flex-1">
          {validationError && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Preset Selector */}
          <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">⚡</span> Chọn nhanh cơ số cấp cứu ca trực:
              </label>
              {selectedPreset !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedPreset(null)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer underline"
                >
                  Nhập tự do
                </button>
              )}
            </div>

            {/* Presets Horizontal Scroll with Visual Badges */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mx-0.5 px-0.5">
              {COMMON_EMERGENCY_ITEMS.map((item, idx) => {
                const isSelected = selectedPreset === idx;
                const isNarcotic = item.type === 'Thuốc gây nghiện';
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleSelectPreset(idx)}
                    className={`inline-flex flex-col text-left p-2 rounded-xl text-xs transition cursor-pointer shrink-0 border shadow-2xs min-w-[155px] max-w-[210px] ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600/30'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full mb-1">
                      <span
                        className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-semibold ${
                          isNarcotic
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : item.type === 'Thuốc cấp cứu'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                        {item.defaultQty}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900 truncate w-full text-xs" title={item.name}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">
                      {item.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Item details */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
            <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-slate-500">
              1. Cơ số thuốc &amp; Vật tư mượn khẩn
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-800 block text-xs">
                  Tên thuốc / Vật tư y tế <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  placeholder="VD: Morphin sulfat 10mg/1ml"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-300 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-hidden font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 block text-xs">
                  Số lượng <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  placeholder="VD: 2 ống"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-300 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-hidden font-mono font-bold text-teal-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 block text-xs">Phân loại danh mục:</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-300 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-hidden font-medium"
                >
                  <option value="Thuốc gây nghiện">Thuốc gây nghiện (Bắt buộc thu hồi vỏ TT 20)</option>
                  <option value="Thuốc cấp cứu">Thuốc cấp cứu tối khẩn</option>
                  <option value="Thuốc hướng thần">Thuốc hướng thần</option>
                  <option value="Vật tư tiêu hao">Vật tư tiêu hao</option>
                  <option value="Vật tư phẫu thuật">Vật tư phẫu thuật</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 block text-xs">
                  Bác sĩ ra y lệnh cấp cứu:
                </label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-300 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-hidden font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Patient Details */}
          <div className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2.5">
            <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-slate-500">
              2. Bệnh nhân thụ hưởng cơ số khẩn
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã bệnh nhân:</label>
                <input
                  type="text"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-mono font-medium focus:outline-hidden focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Họ và tên bệnh nhân:</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Vị trí buồng bệnh / Giường cấp cứu:
              </label>
              <input
                type="text"
                value={patientRoom}
                onChange={(e) => setPatientRoom(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Section 3: Clinical Reason with Smart ICD-10 Macro Autocomplete */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 block text-xs sm:text-sm">
                3. Chỉ định lâm sàng / Lý do mượn khẩn <span className="text-slate-400 font-normal">(Gõ tắt ICD-10)</span>:
              </label>
              <span className="text-[11px] text-teal-700 font-medium hidden sm:inline">Chuẩn HL7 FHIR</span>
            </div>

            <ClinicalMacroAutocomplete
              currentText={clinicalReason}
              onSelectMacro={(macro) => {
                if (!clinicalReason.trim()) {
                  setClinicalReason(macro.expansion);
                } else {
                  const words = clinicalReason.trimEnd().split(/\s+/);
                  const lastWord = words[words.length - 1];
                  if (
                    lastWord &&
                    (lastWord.toLowerCase() === macro.shortcut.toLowerCase() ||
                      macro.shortcut.toLowerCase().startsWith(lastWord.toLowerCase().replace(/^\//, '')))
                  ) {
                    words[words.length - 1] = macro.expansion;
                    setClinicalReason(words.join(' ') + ' ');
                  } else {
                    setClinicalReason((prev) => prev + '; ' + macro.expansion);
                  }
                }
              }}
              placement="top"
              showQuickBar={true}
            />

            <textarea
              rows={2}
              value={clinicalReason}
              onChange={(e) => setClinicalReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  const words = clinicalReason.trimEnd().split(/\s+/);
                  if (words.length > 0) {
                    const lastWord = words[words.length - 1]?.replace(/^\//, '').toUpperCase();
                    const matched = CLINICAL_MACROS.find((m) => m.shortcut.toUpperCase() === lastWord);
                    if (matched) {
                      e.preventDefault();
                      words[words.length - 1] = matched.expansion;
                      setClinicalReason(words.join(' ') + ' ');
                    }
                  }
                }
              }}
              placeholder="VD: Nhập THA, NMCT, PUV, COPD... hoặc chọn từ phím tắt phía trên"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-hidden resize-none"
            />
          </div>

          {/* Legal Notice */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11.5px]">
              <strong>Quy định hoàn bù (Điều 10 Thông tư 22/2011/TT-BYT):</strong> Mọi cơ số mượn khẩn ca trực phải được Bác sĩ kê đơn bù và hoàn trả cho tủ trực trước <strong>07:00 sáng hôm sau</strong>.
              {itemType === 'Thuốc gây nghiện' && (
                <span className="text-rose-700 block font-semibold mt-1">
                  * Thuốc gây nghiện: Sau khi tiêm phải thu hồi vỏ ống nguyên vẹn vào khay niêm phong (Điều 15 TT 20/2017).
                </span>
              )}
            </div>
          </div>

          {/* Footer buttons - Clean Responsive Touch Bar */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] truncate">Xác thực mã PIN y tế / Thẻ chuyên môn</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial h-10 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="flex-2 sm:flex-initial h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Ký Lập Phiếu Mượn</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
