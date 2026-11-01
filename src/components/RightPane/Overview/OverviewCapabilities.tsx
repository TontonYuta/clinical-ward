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
      title: 'Kê đơn thuốc điện tử',
      summary: 'Kê đơn & tự động kiểm tra tương tác thuốc',
      tag: 'Kê đơn'
    },
    {
      id: 'registry',
      tab: 'fefo' as DashboardTab,
      title: 'Tra cứu thuốc & Dược thư',
      summary: '55.000 thuốc & liều dùng an toàn',
      tag: 'Dược thư'
    },
    {
      id: 'debt',
      tab: 'debt' as DashboardTab,
      title: 'Tủ trực & Thuốc gây nghiện',
      summary: 'Cơ số cấp cứu & quản lý nợ vỏ thuốc',
      tag: 'Tủ trực'
    },
    {
      id: 'coldchain',
      tab: 'coldchain' as DashboardTab,
      title: 'Kho dược & Chuỗi lạnh',
      summary: 'Hạn dùng thuốc & nhiệt độ 2°C - 8°C',
      tag: 'Kho & nhiệt độ'
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
              <div className="flex items-center justify-between text-2xs text-slate-500 mb-1 font-medium">
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
