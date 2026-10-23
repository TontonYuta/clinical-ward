/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon, FileWarning, ShieldAlert } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendImageWithText: (imageTitle: string, imagePrompt: string) => void;
}

const PRESET_CLINICAL_IMAGES = [
  {
    id: 'img-1',
    title: 'Máy thở Puritan Bennett 840 xì khí ống dây thở',
    category: 'Sự cố thiết bị loại D (NĐ 98)',
    prompt: 'Báo hỏng dây thở máy thở Bennett phòng mổ 2 bị xì khí nứt khớp nối (kèm ảnh hiện trường)',
    description: 'Chụp ống silicon dây thở máy thở Bennett bị rách 2cm gần van thở ra phòng mổ 2',
    iconColor: 'bg-red-500 text-white',
    badge: 'Khẩn cấp P.Mổ 2'
  },
  {
    id: 'img-2',
    title: 'Tem kiểm định dán trên máy sốc tim Zoll R Series',
    category: 'Kiểm định kỹ thuật (NĐ 98)',
    prompt: 'Tra cứu hạn dán tem kiểm định máy sốc tim theo ảnh tem dán của NIEMET',
    description: 'Ảnh chụp cận cảnh tem kiểm định chất lượng Viện Trang thiết bị Y tế dán trên tay cầm máy',
    iconColor: 'bg-amber-500 text-white',
    badge: 'Hạn tem 11/2026'
  },
  {
    id: 'img-3',
    title: 'Hộp Chỉ phẫu thuật Catgut 3/0 Lô LOT-CG24-09A',
    category: 'Quản lý kho FEFO (TT 36)',
    prompt: 'Cần xuất 30 hộp chỉ phẫu thuật Catgut đối chiếu theo mã vạch trên ảnh chụp',
    description: 'Ảnh chụp mặt trước vỏ hộp Catgut dán nhãn hạn dùng EXP: 20/11/2026 (cận hạn 36 ngày)',
    iconColor: 'bg-blue-500 text-white',
    badge: 'Cận hạn 36 ngày'
  },
  {
    id: 'img-4',
    title: 'Lọ rỗng Morphin sulfat 10mg/1ml buồng cấp cứu 3',
    category: 'Biên bản bù nợ tủ trực (TT 22)',
    prompt: 'Ca đêm vừa lấy 2 lọ Morphin và 1 bộ dây truyền cấp cứu cho buồng 3 (kèm ảnh 2 vỏ ống)',
    description: 'Ảnh đối chiếu 2 vỏ ống Morphin sulfat đã tiêm cấp cứu để thủ kho kiểm tra trước khi bù',
    iconColor: 'bg-emerald-500 text-white',
    badge: 'Thuốc gây nghiện'
  }
];

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  onSendImageWithText
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('img-1');
  const [customFile, setCustomFile] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomFile(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmSend = () => {
    if (customFile) {
      onSendImageWithText(
        customFileName || 'Ảnh sự cố hiện trường',
        `Đính kèm ảnh chụp hiện trường [${customFileName}]: Báo hỏng thiết bị y tế cần kỹ sư kiểm tra gấp`
      );
    } else {
      const preset = PRESET_CLINICAL_IMAGES.find(p => p.id === selectedPreset);
      if (preset) {
        onSendImageWithText(preset.title, preset.prompt);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-2 bg-slate-800 rounded-lg shrink-0">
              <Camera className="w-5 h-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base truncate">Đính kèm ảnh hiện trường / Thiết bị</h3>
              <p className="text-[11px] text-slate-300 truncate">Báo hỏng phụ kiện, đối chiếu tem kiểm định &amp; vỏ thuốc</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <p className="text-xs text-slate-600 mb-3 font-semibold uppercase tracking-wider">
            Chọn mẫu ảnh chụp hiện trường lâm sàng có sẵn:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {PRESET_CLINICAL_IMAGES.map((item) => {
              const isSelected = selectedPreset === item.id && !customFile;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedPreset(item.id);
                    setCustomFile(null);
                  }}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-600 bg-cyan-50/70 shadow-sm ring-2 ring-cyan-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {item.badge}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-cyan-700 shrink-0" />}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Or upload custom photo */}
          <div className="pt-3 border-t border-slate-200">
            <label className="text-xs font-semibold text-slate-700 mb-2 block">
              Hoặc tải lên ảnh chụp từ điện thoại / máy tính:
            </label>
            <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-cyan-500 hover:bg-cyan-50/30 transition cursor-pointer text-slate-600 text-xs font-medium">
              <Upload className="w-4 h-4 text-cyan-600" />
              <span>{customFileName ? `Đã chọn: ${customFileName}` : 'Nhấn để chọn tệp hình ảnh (.jpg, .png)'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirmSend}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold transition"
          >
            <Check className="w-4 h-4" />
            <span>Đính kèm &amp; Gửi cho AI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
