/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Send, CheckCheck, X } from 'lucide-react';

interface TelegramToastProps {
  isOpen: boolean;
  onClose: () => void;
  debtCount: number;
}

export const TelegramToast: React.FC<TelegramToastProps> = ({ isOpen, onClose, debtCount }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        onClose();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-600 flex items-center justify-center text-white">
              <Send className="w-3 h-3" />
            </div>
            <div>
              <span className="text-xs font-semibold block text-white">Nhắc bù nợ tủ trực 07:00</span>
              <span className="text-[10px] text-slate-400">Kênh Điều Dưỡng Lâm Sàng</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-2">
          Ca trực còn <strong className="text-amber-400">{debtCount} khoản nợ</strong> chưa hoàn bù. Đề nghị nộp đơn thuốc lên Kho Dược trước 08:30 sáng.
        </p>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800">
          <span className="flex items-center gap-1 text-teal-400">
            <CheckCheck className="w-3 h-3" />
            Đã gửi kíp trực
          </span>
          <button
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
