/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Màn hình Chào Mừng & Hướng Dẫn Năng Lực Trợ Lý Lâm Sàng (Zero-Dummy Data) (<=120 LOC)
 */

import React from 'react';
import { ShieldAlert, Activity, CalendarClock, BookOpen, Sparkles, Terminal } from 'lucide-react';
import { UserRole } from '../../types/clinical';

interface ShiftBriefingEmptyStateProps {
  currentUserRole?: UserRole;
  pendingDebtsCount?: number;
  urgentTicketsCount?: number;
  lowStockCount?: number;
  onChipClick?: (prompt: string) => void;
}

export const ShiftBriefingEmptyState: React.FC<ShiftBriefingEmptyStateProps> = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3.5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6.5 h-6.5 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-800">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">Trợ Lý AI Lâm Sàng & Dược Viện</h4>
            <p className="text-2xs text-slate-500">Sẵn sàng hỗ trợ kíp trực 24/7 theo quy chuẩn Bộ Y tế</p>
          </div>
        </div>
        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
          Gemini CDSS
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-rose-800">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="text-2xs font-bold">Thẩm Định Đơn Thuốc & Dị Ứng</span>
          </div>
          <p className="text-2xs text-slate-600 leading-relaxed">
            Phát hiện dị ứng chéo, chống chỉ định và tương tác thuốc mức độ nặng theo QĐ 5948/QĐ-BYT.
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-800">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="text-2xs font-bold">Hiệu Chỉnh Liều Suy Thận</span>
          </div>
          <p className="text-2xs text-slate-600 leading-relaxed">
            Tính toán độ thanh thải Cockcroft-Gault (CrCl/eGFR) và khuyến cáo Dược Thư Quốc Gia 2015.
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-teal-800">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span className="text-2xs font-bold">Lịch Dặn Dò & Nhắc Uống Thuốc</span>
          </div>
          <p className="text-2xs text-slate-600 leading-relaxed">
            Soạn phiếu dặn dò chia cữ sáng/trưa/tối, lưu trữ CSDL bệnh án EHR và gửi email nhắc lịch.
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-800">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="text-2xs font-bold">Tra Cứu Dược Thư & Pháp Lý</span>
          </div>
          <p className="text-2xs text-slate-600 leading-relaxed">
            Tra cứu 54.885 thuốc Cục QLD, Thông tư 20 (thuốc gây nghiện), TT 22 (tủ trực), TT 51 (phản vệ).
          </p>
        </div>
      </div>

      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
        <span className="flex items-center gap-1">
          <Terminal className="w-3 h-3 text-slate-400" />
          <span>Gõ lệnh trực tiếp hoặc dùng dấu <code className="px-1 py-0.2 rounded bg-slate-100 font-mono text-teal-800 font-bold">/</code> để gọi macro</span>
        </span>
        <span className="font-medium text-teal-700">Không có dữ liệu mẫu</span>
      </div>
    </div>
  );
};
