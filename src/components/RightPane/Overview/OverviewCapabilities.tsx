/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bản Đồ Năng Lực Trạm Làm Việc Lâm Sàng Tối Giản (<=200 LOC)
 */

import React from 'react';
import { ArrowRight, Lock, FileText, Package, Bot, Thermometer } from 'lucide-react';
import type { DashboardTab } from '../../../types/clinical';

interface OverviewCapabilitiesProps {
  allowedTabs: DashboardTab[];
  onTabChange: (tab: DashboardTab) => void;
  onOpenCopilot?: () => void;
}

export const OverviewCapabilities: React.FC<OverviewCapabilitiesProps> = ({
  allowedTabs,
  onTabChange,
  onOpenCopilot
}) => {
  const capabilities = [
    {
      id: 'cpoe',
      tab: 'cpoe' as DashboardTab,
      title: 'Kê đơn thuốc điện tử',
      summary: 'Kê đơn nội trú, ngoại trú, ký số SHA-256 và tự động kiểm tra dị ứng',
      tag: 'Kê đơn',
      icon: FileText,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50'
    },
    {
      id: 'registry',
      tab: 'fefo' as DashboardTab,
      title: 'Quản lý Kho Dược & FEFO',
      summary: 'Kiểm soát xuất nhập tồn, cấp bù tủ trực và cấp phát ưu tiên theo hạn dùng',
      tag: 'Kho Dược',
      icon: Package,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50'
    },
    {
      id: 'cdss',
      tab: 'cpoe' as DashboardTab,
      title: 'Thẩm định Đơn thuốc AI',
      summary: 'Hệ thống CDSS phát hiện tương tác chống chỉ định QĐ 5948 & gợi ý thay thế',
      tag: 'CDSS QĐ 5948',
      icon: Bot,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
      customAction: onOpenCopilot
    },
    {
      id: 'coldchain',
      tab: 'coldchain' as DashboardTab,
      title: 'Giám sát Chuỗi Lạnh IoT',
      summary: 'Cảm biến nhiệt độ 2°C - 8°C, giám sát liên tục tủ vắc xin và cảnh báo mất điện',
      tag: 'Chuỗi Lạnh',
      icon: Thermometer,
      iconColor: 'text-cyan-600',
      iconBg: 'bg-cyan-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {capabilities.map((cap) => {
        const isAllowed = allowedTabs.includes(cap.tab);
        return (
          <button
            key={cap.id}
            type="button"
            disabled={!isAllowed}
            onClick={() => {
              if (!isAllowed) return;
              if (cap.customAction) {
                cap.customAction();
              } else {
                onTabChange(cap.tab);
              }
            }}
            className={`p-6 rounded-2xl border text-left transition flex flex-col justify-between min-h-[185px] shadow-2xs ${
              isAllowed
                ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer group'
                : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs sm:text-sm mb-3 font-bold text-slate-500">
                <span className="uppercase tracking-wider">{cap.tag}</span>
                {!isAllowed ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <div className={`w-9 h-9 rounded-xl ${cap.iconBg} flex items-center justify-center shrink-0`}>
                    <cap.icon className={`w-5 h-5 ${cap.iconColor}`} />
                  </div>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug group-hover:text-blue-900">
                {cap.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                {cap.summary}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-sm sm:text-base font-bold text-blue-700">
              <span>{isAllowed ? 'Mở phân hệ' : 'Khóa'}</span>
              {isAllowed && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />}
            </div>
          </button>
        );
      })}
    </div>
  );
};
