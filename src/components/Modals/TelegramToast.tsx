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
      <div className="bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Send className="w-3 h-3" />
            </div>
            <div>
              <span className="text-sm font-semibold block text-slate-900">Nhắc bù nợ tủ trực 07:00</span>
              <span className="text-xs text-slate-500">Kênh Điều Dưỡng Lâm Sàng</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-2.5">
          Ca trực còn <strong className="text-amber-700 font-bold">{debtCount} khoản nợ</strong> chưa hoàn bù. Đề nghị nộp đơn thuốc lên Kho Dược trước 08:30 sáng.
        </p>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-teal-700 font-medium">
            <CheckCheck className="w-3.5 h-3.5" />
            Đã gửi kíp trực
          </span>
          <button
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white cursor-pointer font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
