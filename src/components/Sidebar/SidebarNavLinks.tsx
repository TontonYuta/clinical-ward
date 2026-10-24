/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Boxes, Wrench, Stethoscope, Thermometer, Building2 } from 'lucide-react';
import { DashboardTab } from '../RightPane/Dashboard';

interface SidebarNavLinksProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  allowedTabs: string[];
  isCollapsed: boolean;
  onCloseMobile?: () => void;
  debtCount: number;
  urgentTicketsCount: number;
  nearExpiryAndLowStockCount: number;
  coldChainTemp?: number;
  isColdAlarm?: boolean;
  misallocatedAssetsCount?: number;
}

interface NavDef {
  tab: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
}

export const SidebarNavLinks: React.FC<SidebarNavLinksProps> = ({
  currentTab,
  onTabChange,
  allowedTabs,
  isCollapsed,
  onCloseMobile,
  debtCount,
  urgentTicketsCount,
  nearExpiryAndLowStockCount,
  coldChainTemp = 4.5,
  isColdAlarm = false,
  misallocatedAssetsCount = 0,
}) => {
  const handleSelectTab = (tab: DashboardTab) => {
    onTabChange(tab);
    onCloseMobile?.();
  };

  const pharmacyDefs: NavDef[] = [
    {
      tab: 'cpoe',
      label: 'Kê đơn thuốc điện tử',
      icon: Stethoscope,
      title: 'Kê đơn thuốc điện tử ngoại trú và nội trú (TT 26/2025/TT-BYT)'
    },
    {
      tab: 'debt',
      label: 'Sổ nợ thuốc tủ trực',
      icon: FileText,
      title: 'Sổ theo dõi nợ thuốc và hoàn trả vỏ thuốc gây nghiện (TT 18/2026/TT-BYT)',
      badge: debtCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
          {debtCount}
        </span>
      ) : null
    },
    {
      tab: 'fefo',
      label: 'Quản lý kho dược FEFO',
      icon: Boxes,
      title: 'Quản lý hạn dùng FEFO và dự trù cơ số tồn kho (TT 36/2018 GSP)',
      badge: nearExpiryAndLowStockCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
          {nearExpiryAndLowStockCount}
        </span>
      ) : null
    },
    {
      tab: 'coldchain',
      label: 'Giám sát chuỗi lạnh',
      icon: Thermometer,
      title: 'Theo dõi nhiệt độ tủ bảo quản vắc xin 2.0°C - 8.0°C (WHO PQS & TT 36)',
      badge: (
        <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border tabular-nums ${
          isColdAlarm ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-cyan-50 text-cyan-800 border-cyan-200'
        }`}>
          {coldChainTemp.toFixed(1)}°C
        </span>
      )
    }
  ];

  const equipmentDefs: NavDef[] = [
    {
      tab: 'equipment',
      label: 'Sự cố trang thiết bị',
      icon: Wrench,
      title: 'Quản lý sự cố và kiểm định an toàn thiết bị y tế (NĐ 04/2025 & NĐ 98/2021)',
      badge: urgentTicketsCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
          {urgentTicketsCount}
        </span>
      ) : null
    },
    {
      tab: 'asset_audit',
      label: 'Kiểm kê tài sản công',
      icon: Building2,
      title: 'Kiểm kê và điều chuyển tài sản thiết bị định kỳ (NĐ 151/2017 & NĐ 114/2024)',
      badge: misallocatedAssetsCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
          {misallocatedAssetsCount} lệch
        </span>
      ) : null
    }
  ];

  const renderNavList = (title: string, defs: NavDef[]) => {
    const visibleDefs = defs.filter(d => allowedTabs.includes(d.tab));
    if (visibleDefs.length === 0) return null;

    return (
      <div>
        {!isCollapsed && (
          <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}
          </div>
        )}
        <div className="space-y-1">
          {visibleDefs.map(({ tab, label, icon: Icon, title: tooltip, badge }) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleSelectTab(tab)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] sm:text-[15px] transition cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={tooltip}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{label}</span>
                    {badge}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderNavList('Dược lâm sàng & chuỗi lạnh', pharmacyDefs)}
      {renderNavList('Thiết bị & tài sản y tế', equipmentDefs)}
    </>
  );
};
