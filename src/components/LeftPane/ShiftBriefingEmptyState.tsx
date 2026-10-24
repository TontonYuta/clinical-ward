/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { UserRole } from '../../types/clinical';

interface ShiftBriefingEmptyStateProps {
  currentUserRole: UserRole;
  pendingDebtsCount: number;
  urgentTicketsCount: number;
  lowStockCount: number;
  onChipClick: (prompt: string) => void;
}

export const ShiftBriefingEmptyState: React.FC<ShiftBriefingEmptyStateProps> = ({
  currentUserRole,
  pendingDebtsCount,
  urgentTicketsCount,
  lowStockCount,
  onChipClick
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-700" />
          <span className="text-sm font-bold text-slate-900">Giao ban ca trực</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          Gợi ý nhanh
        </span>
      </div>

      <div className="space-y-1.5">
        {currentUserRole === 'nurse' && (
          <>
            <div
              onClick={() => onChipClick('Mượn 2 ống Morphin sulfat buồng cấp cứu 3')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Mượn khẩn thuốc cấp cứu</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 font-mono shrink-0">
                    {pendingDebtsCount} nợ
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Ghi nợ thuốc ca trực cấp cứu.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>

            <div
              onClick={() => onChipClick('Báo hỏng máy thở PB840 phòng mổ 2 bị xì khí')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Báo hỏng máy thở</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono shrink-0">
                    Loại D
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Báo hỏng và điều phối thiết bị dự phòng.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>
          </>
        )}

        {currentUserRole === 'pharmacist' && (
          <>
            <div
              onClick={() => onChipClick('Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày theo FEFO')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Hạn dùng FEFO</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 font-mono shrink-0">
                    {lowStockCount} lô
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Lọc các lô thuốc cận hạn ưu tiên xuất trước.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>

            <div
              onClick={() => onChipClick('Kiểm tra nhiệt độ tủ lạnh vắc xin và chỉ số MKT')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Chuỗi lạnh bảo quản</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Kiểm tra nhiệt độ bảo quản 2°C – 8°C.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>
          </>
        )}

        {currentUserRole === 'biomedical_engineer' && (
          <>
            <div
              onClick={() => onChipClick('Kiểm tra danh sách thiết bị y tế đang hỏng')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Sửa máy khẩn</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono shrink-0">
                    {urgentTicketsCount} ca
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Tiếp nhận sửa chữa thiết bị khẩn cấp.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>

            <div
              onClick={() => onChipClick('Kiểm kê tài sản 31/12 bằng mã QR')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Quét mã QR kiểm kê</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Quét mã đối chiếu vị trí và số lượng.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>
          </>
        )}

        {currentUserRole === 'director' && (
          <>
            <div
              onClick={() => onChipClick('Kiểm tra tính toàn vẹn sổ kiểm toán chuỗi băm HMAC-SHA256')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Giám sát pháp lý</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Kiểm tra toàn vẹn sổ kiểm toán và chữ ký số.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>

            <div
              onClick={() => onChipClick('Mặt hàng nào đang chạm ngưỡng cạn kho cần duyệt dự trù Mẫu 01?')}
              className="p-2 sm:p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">Dự trù &amp; thanh lý</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Duyệt dự trù cơ số và danh mục thanh lý.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 transition" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
