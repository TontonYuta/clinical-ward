/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bản Đồ Năng Lực Trạm Làm Việc Lâm Sàng Tối Giản (<=200 LOC)
 */

import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';
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
      title: 'Kê Đơn Thuốc CPOE & CDSS Đối Soát',
      summary: 'Đơn điện tử TT 26/2025/TT-BYT · Chặn cặp tương tác chống chỉ định QĐ 5948',
      tag: 'CPOE & Ký số'
    },
    {
      id: 'registry',
      tab: 'fefo' as DashboardTab,
      title: 'Dược Thư & 55.000 Biệt Dược Quốc Gia',
      summary: '54.885 thuốc Cục QLD (DAV) · Toàn văn Dược Thư QG & cảnh báo High-Alert',
      tag: 'Dược Thư QG'
    },
    {
      id: 'debt',
      tab: 'debt' as DashboardTab,
      title: 'Quản Lý Cơ Số Tủ Trực & Thuốc Gây Nghiện',
      summary: 'Cơ số Min - Max VBHN 07 · Khóa niêm phong nợ vỏ rỗng Morphin TT 20 & TT 18',
      tag: 'Tủ trực cấp cứu'
    },
    {
      id: 'coldchain',
      tab: 'coldchain' as DashboardTab,
      title: 'Kiểm Soát Hạn FEFO & Chuỗi Lạnh Vắc Xin',
      summary: 'Xuất kho FEFO hạn ngắn trước · Cảm biến IoT nhiệt độ chuỗi lạnh 2°C - 8°C',
      tag: 'Kho & Chuỗi lạnh'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {capabilities.map((cap) => {
        const isAllowed = allowedTabs.includes(cap.tab);
        return (
          <button
            key={cap.id}
            type="button"
            disabled={!isAllowed}
            onClick={() => isAllowed && onTabChange(cap.tab)}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
              isAllowed
                ? 'bg-white border-slate-200 hover:border-teal-400 hover:shadow-2xs cursor-pointer group'
                : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-2xs text-slate-500 mb-1.5 font-medium">
                <span>{cap.tag}</span>
                {!isAllowed && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug group-hover:text-teal-900">
                {cap.title}
              </h3>
              <p className="text-2xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {cap.summary}
              </p>
            </div>

            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-2xs font-semibold text-teal-800">
              <span>{isAllowed ? 'Mở phân hệ' : 'Khóa'}</span>
              {isAllowed && <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />}
            </div>
          </button>
        );
      })}
    </div>
  );
};
