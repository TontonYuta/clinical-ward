/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Banner quy chuẩn nghiệp vụ Điều dưỡng: Nợ vỏ Morphin & Cơ số tủ trực
 */

import React from 'react';
import { ShieldAlert, FileText } from 'lucide-react';

export const DebtLegalBanner: React.FC = () => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 flex items-start justify-between gap-3 shrink-0 shadow-2xs">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              Nghiệp vụ Điều dưỡng &amp; Quản lý Thuốc Kiểm Soát Đặc Biệt
            </span>
            <span className="bg-slate-200/90 text-slate-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-slate-300">
              TT 18/2026/TT-BYT &amp; VBHN 07
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Thu hồi 100% vỏ ống thuốc gây nghiện (Morphin, Fentanyl) nộp vào khay bàn giao ca trực. Hội đồng 4 thành phần thực hiện tiêu hủy vỏ ống định kỳ và lập biên bản lưu 2 năm theo Thông tư 18/2026/TT-BYT.
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shrink-0 text-[11px] font-semibold">
        <FileText className="w-3.5 h-3.5 text-slate-500" />
        <span>Giao ban 07:00 &amp; 19:00</span>
      </div>
    </div>
  );
};
