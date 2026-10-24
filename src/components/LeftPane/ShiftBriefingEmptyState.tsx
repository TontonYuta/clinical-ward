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
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4.5 h-4.5 text-slate-700" />
          <span className="text-sm font-bold text-slate-900">Bảng Giao Ban Ca Trực</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Ưu tiên phiên làm việc
        </span>
      </div>

      <div className="space-y-2">
        {currentUserRole === 'nurse' && (
          <>
            <div
              onClick={() => onChipClick('Mượn 2 ống Morphin sulfat buồng cấp cứu 3')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Mượn khẩn thuốc cấp cứu</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800 font-mono">
                    {pendingDebtsCount} phiếu nợ
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Ghi nợ thuốc ca đêm theo Điều 10 TT 22/2011/TT-BYT.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>

            <div
              onClick={() => onChipClick('Báo hỏng máy thở PB840 phòng mổ 2 bị xì khí')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Báo hỏng máy thở phòng mổ</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                    Loại D
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Tự động điều phối dây thở dự phòng theo Điều 34 NĐ 98/2021.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>
          </>
        )}

        {currentUserRole === 'pharmacist' && (
          <>
            <div
              onClick={() => onChipClick('Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày theo FEFO')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Tra cứu hạn dùng FEFO</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800 font-mono">
                    {lowStockCount} lô
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Xuất kho lô cận hạn trước theo Thông tư 36/2018/TT-BYT GSP.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>

            <div
              onClick={() => onChipClick('Kiểm tra nhiệt độ tủ lạnh vắc xin và chỉ số MKT')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Dây chuyền lạnh GSP</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Giám sát chuỗi lạnh vắc xin 2°C - 8°C và quy trình ứng phó mất điện.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>
          </>
        )}

        {currentUserRole === 'biomedical_engineer' && (
          <>
            <div
              onClick={() => onChipClick('Kiểm tra danh sách thiết bị y tế đang hỏng')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Tiếp nhận sửa máy khẩn</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                    {urgentTicketsCount} ca
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Ưu tiên sửa chữa &amp; dán tem kiểm định đo lường theo NĐ 98/2021.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>

            <div
              onClick={() => onChipClick('Kiểm kê tài sản 31/12 bằng mã QR')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Quét mã QR kiểm kê</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Đối chiếu số serial, vị trí buồng bệnh thực tế và tỷ lệ hao mòn tài sản.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>
          </>
        )}

        {currentUserRole === 'director' && (
          <>
            <div
              onClick={() => onChipClick('Kiểm tra tính toàn vẹn sổ kiểm toán chuỗi băm HMAC-SHA256')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Giám sát pháp lý toàn viện</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Tuân thủ TT 22, TT 20 thuốc gây nghiện, NĐ 98 thiết bị y tế &amp; NĐ 151 tài sản công.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>

            <div
              onClick={() => onChipClick('Mặt hàng nào đang chạm ngưỡng cạn kho cần duyệt dự trù Mẫu 01?')}
              className="p-2.5 sm:p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Dự trù cơ số &amp; thanh lý</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Ký phê duyệt tờ trình thanh lý trang thiết bị hỏng nát ngưng dùng trên 12 tháng.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0 mt-0.5 transition" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
