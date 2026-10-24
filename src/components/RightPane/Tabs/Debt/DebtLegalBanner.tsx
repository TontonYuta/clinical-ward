/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Banner quy chuẩn nghiệp vụ Điều dưỡng: Nợ vỏ Morphin & Cơ số tủ trực
 */

import React from 'react';
import { ShieldAlert, FileText } from 'lucide-react';

export const DebtLegalBanner: React.FC = () => {
  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950 flex items-start justify-between gap-3 shrink-0">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-950">
              Nghiệp vụ Điều dưỡng &amp; Quản lý Thuốc Kiểm Soát Đặc Biệt
            </span>
            <span className="bg-amber-200/80 text-amber-900 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
              TT 18/2026/TT-BYT &amp; VBHN 07
            </span>
          </div>
          <p className="text-amber-800 leading-relaxed">
            Thu hồi 100% vỏ ống thuốc gây nghiện (Morphin, Fentanyl) nộp vào khay bàn giao ca trực. Hội đồng 4 thành phần thực hiện tiêu hủy vỏ ống định kỳ và lập biên bản lưu 2 năm theo Thông tư 18/2026/TT-BYT.
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg shrink-0 text-[11px] font-bold">
        <FileText className="w-3.5 h-3.5" />
        <span>Giao ban 07:00 &amp; 19:00</span>
      </div>
    </div>
  );
};
