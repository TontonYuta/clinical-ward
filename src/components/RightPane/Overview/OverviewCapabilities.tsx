/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bản Đồ Năng Lực Trạm Làm Việc Lâm Sàng (App Capabilities Map, <=200 LOC)
 */

import React from 'react';
import { ClipboardList, Database, ShieldAlert, Thermometer, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import type { DashboardTab } from '../../../types/clinical';

interface OverviewCapabilitiesProps {
  allowedTabs: DashboardTab[];
  onTabChange: (tab: DashboardTab) => void;
}

export const OverviewCapabilities: React.FC<OverviewCapabilitiesProps> = ({
  allowedTabs,
  onTabChange
}) => {
  const capabilities = [
    {
      id: 'cpoe',
      tab: 'cpoe' as DashboardTab,
      badge: 'Nghiệp Vụ Bác Sĩ & Điều Dưỡng',
      title: 'Kê Đơn Thuốc CPOE & CDSS Đối Soát',
      description: 'Soạn thảo đơn thuốc điện tử chuẩn Thông tư 26/2025/TT-BYT (PL I, Đơn N gây nghiện 3 đợt, Đơn H hướng thần, Mạn tính 90 ngày). Tự động chặn đứng tương tác chống chỉ định (QĐ 5948/BYT) và đối soát dị ứng người bệnh.',
      highlights: ['Biểu mẫu TT 26/2025/TT-BYT', 'CDSS chặn cặp chống chỉ định', 'Ký số y tế & In đơn chuẩn A4'],
      icon: ClipboardList,
      color: 'teal',
      accentBorder: 'border-teal-200 hover:border-teal-400 bg-white',
      badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
      iconBg: 'bg-teal-50 text-teal-700',
      btnText: 'Mở Phân Hệ Kê Đơn CPOE'
    },
    {
      id: 'registry',
      tab: 'fefo' as DashboardTab,
      badge: 'Tra Cứu Dược Lâm Sàng',
      title: 'Dược Thư & 55.000 Biệt Dược Quốc Gia',
      description: 'Tra cứu tức thì 54.885 số đăng ký biệt dược Cục Quản lý Dược (DAV). Tích hợp toàn văn Dược Thư Quốc Gia Việt Nam: liều trần, đường dùng, tương tác, độc tính và cảnh báo High-Alert / Thuốc kiểm soát đặc biệt.',
      highlights: ['54.885 thuốc Cục QLD (DAV)', 'Chuyên luận Dược Thư Quốc Gia', 'Nhận diện High-Alert & Liều trần'],
      icon: Database,
      color: 'blue',
      accentBorder: 'border-blue-200 hover:border-blue-400 bg-white',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-700',
      btnText: 'Mở Tra Cứu Kho Dược & Dược Thư'
    },
    {
      id: 'debt',
      tab: 'debt' as DashboardTab,
      badge: 'Tủ Trực Cấp Cứu & Gây Nghiện',
      title: 'Quản Lý Cơ Số Tủ Trực & Thuốc Gây Nghiện',
      description: 'Quản lý hạn mức Min - Max cơ số tủ trực cấp cứu (VBHN 07/BYT). Theo dõi sổ nợ mượn thuốc cấp cứu, cơ chế khóa niêm phong nợ vỏ rỗng morphin (TT 20/2017 & TT 18/2026) và quy trình giao ban ca trực.',
      highlights: ['Hạn mức Min - Max tủ trực', 'Khóa nợ vỏ rỗng Morphin', 'Giao ban & tiêu hủy có hội đồng'],
      icon: ShieldAlert,
      color: 'amber',
      accentBorder: 'border-amber-200 hover:border-amber-400 bg-white',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-700',
      btnText: 'Mở Sổ Nợ Tủ Trực Cấp Cứu'
    },
    {
      id: 'coldchain',
      tab: 'coldchain' as DashboardTab,
      badge: 'Kho Dược & Thiết Bị IoT',
      title: 'Kiểm Soát Hạn FEFO & Chuỗi Lạnh Vắc Xin',
      description: 'Quản lý kho dược theo nguyên tắc FEFO (hạn ngắn dùng trước), cảnh báo cận hạn dưới 60 ngày. Giám sát từ xa cảm biến IoT nhiệt độ chuỗi lạnh 2°C – 8°C và quy trình xử lý sự cố thiết bị y tế theo NĐ 98/2021.',
      highlights: ['Nguyên tắc xuất kho FEFO', 'Cảm biến chuỗi lạnh 2°C - 8°C', 'Sự cố thiết bị theo NĐ 98/2021'],
      icon: Thermometer,
      color: 'indigo',
      accentBorder: 'border-indigo-200 hover:border-indigo-400 bg-white',
      badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      iconBg: 'bg-indigo-50 text-indigo-700',
      btnText: 'Mở Theo Dõi Chuỗi Lạnh & Kho'
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Năng Lực Trạm Làm Việc Lâm Sàng</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
              4 Trụ Cột Nghiệp Vụ
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Tổng quan những nghiệp vụ trọng yếu hệ thống cung cấp cho nhân viên y tế trong ca trực.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {capabilities.map((cap) => {
          const isAllowed = allowedTabs.includes(cap.tab);
          const Icon = cap.icon;
          return (
            <div
              key={cap.id}
              className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition flex flex-col justify-between ${cap.accentBorder}`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${cap.badgeColor}`}>
                    {cap.badge}
                  </span>
                  <div className={`p-2 rounded-xl ${cap.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-950 leading-snug">
                    {cap.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {cap.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {cap.highlights.map((h, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{h}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between">
                {isAllowed ? (
                  <button
                    type="button"
                    onClick={() => onTabChange(cap.tab)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer group"
                  >
                    <span>{cap.btnText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold text-slate-400">
                    <Lock className="w-3 h-3" />
                    <span>Không thuộc phân quyền vai trò hiện tại</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
