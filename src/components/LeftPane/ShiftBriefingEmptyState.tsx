/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Màn hình Chào Mừng & Hướng Dẫn Kịch Bản Lâm Sàng Từ CSDL Thực Tế (<=150 LOC)
 */

import React from 'react';
import { ShieldAlert, Activity, CalendarClock, BookOpen, Sparkles, Zap } from 'lucide-react';
import { UserRole } from '../../types/clinical';

interface ShiftBriefingEmptyStateProps {
  currentUserRole?: UserRole;
  pendingDebtsCount?: number;
  urgentTicketsCount?: number;
  lowStockCount?: number;
  onChipClick?: (prompt: string) => void;
}

const SAMPLE_SCENARIOS = [
  { label: 'Dị ứng BN Võ Minh Trí', query: 'Kiểm tra tiền sử dị ứng cho bệnh nhân Võ Minh Trí, dùng Penicillin hoặc Augmentin được không?' },
  { label: 'Chỉnh liều BN Đặng Thị Lan', query: 'Chức năng thận BN Đặng Thị Lan eGFR 52 dùng Metformin và Ciprofloxacin thế nào?' },
  { label: 'Tương kỵ Ceftriaxon - Ringer', query: 'Ceftriaxon có truyền cùng Ringer Lactat chứa Calci được không theo Dược thư?' },
  { label: 'Vancomycin Red Man', query: 'Bệnh nhân Nguyễn Quốc Bảo truyền Vancomycin bị đỏ bừng mặt, xử trí thế nào?' },
  { label: 'Nước bưởi & Atorvastatin', query: 'Đơn xuất viện RX-2026-012 Võ Minh Trí: Atorvastatin có được uống cùng nước ép bưởi không?' },
  { label: 'Kali clorid 10% High-Alert', query: 'Thuốc Kali clorid 10% có được tiêm tĩnh mạch trực tiếp không và cách pha truyền?' },
  { label: 'Quy chế trả vỏ Morphin', query: 'Quy chế thu hồi vỏ ống Morphin ca đêm và quy đổi sang Fentanyl theo TT 20/2017?' },
  { label: 'Adrenalin phản vệ TT 51', query: 'Phác đồ cấp cứu tiêm bắp Adrenalin phản vệ theo Thông tư 51/2017/TT-BYT?' },
  { label: 'Tồn kho Morphin ca đêm', query: 'Kho viện còn bao nhiêu ống Morphin hydroclorid và lưu ở tủ nào?' },
  { label: 'Sự cố chuỗi lạnh Vaxigrip', query: 'Nhiệt độ tủ bảo quản vắc xin Vaxigrip vượt quá 8 độ C thì xử trí cách ly thế nào?' },
  { label: 'Xem đơn thuốc Võ Minh Trí', query: 'Xem đơn thuốc của bệnh nhân Võ Minh Trí RX-2026-001' },
];

export const ShiftBriefingEmptyState: React.FC<ShiftBriefingEmptyStateProps> = ({ onChipClick }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-3.5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6.5 h-6.5 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-800">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">Trợ Lý AI Lâm Sàng & Dược Viện</h4>
            <p className="text-2xs text-slate-500">Dữ liệu thực từ CSDL bệnh nhân, kho dược & Dược thư Quốc gia 2015</p>
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
            <span className="text-2xs font-bold">Tra Cứu Dược Thư & Biệt Dược</span>
          </div>
          <p className="text-2xs text-slate-600 leading-relaxed">
            Tra cứu cơ sở dữ liệu 54.885 thuốc Cục Quản Lý Dược, biệt dược gốc, nồng độ và dạng dùng.
          </p>
        </div>
      </div>

      {/* Hàng nút kịch bản mẫu lâm sàng lấy trực tiếp từ CSDL */}
      <div className="pt-2 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center gap-1.5 text-2xs font-bold text-slate-700">
          <Zap className="w-3 h-3 text-amber-600" />
          <span>Kịch bản kiểm chứng từ CSDL (Bấm để hỏi nhanh):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_SCENARIOS.map((sc, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChipClick?.(sc.query)}
              className="px-2.5 py-1 text-2xs font-medium rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200/70 hover:border-teal-300 transition cursor-pointer active:scale-95"
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
