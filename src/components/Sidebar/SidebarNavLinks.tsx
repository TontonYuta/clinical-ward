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
      label: 'Chỉ Định & Kê Đơn CPOE',
      icon: Stethoscope,
      title: 'Chỉ định Y lệnh & Kê đơn điện tử (TT 26/2025/TT-BYT)'
    },
    {
      tab: 'debt',
      label: 'Sổ Nợ Tủ Trực',
      icon: FileText,
      title: 'Sổ nợ tủ trực cấp cứu (TT 22 & TT 20)',
      badge: debtCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
          {debtCount}
        </span>
      ) : null
    },
    {
      tab: 'fefo',
      label: 'Kho Dược & Tủ Trực',
      icon: Boxes,
      title: 'Kho Dược - Hạn dùng FEFO & Định mức (TT 36 GSP)',
      badge: nearExpiryAndLowStockCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
          {nearExpiryAndLowStockCount}
        </span>
      ) : null
    },
    {
      tab: 'coldchain',
      label: 'Chuỗi Lạnh Vắc Xin',
      icon: Thermometer,
      title: 'Chuỗi Lạnh Datalogger 2.0°C - 8.0°C (WHO PQS & TT 36)',
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
      label: 'Sự Cố & Kiểm Định',
      icon: Wrench,
      title: 'Sự cố & Kiểm định trang thiết bị y tế (NĐ 04/2025 & NĐ 98/2021)',
      badge: urgentTicketsCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
          {urgentTicketsCount}
        </span>
      ) : null
    },
    {
      tab: 'asset_audit',
      label: 'Kiểm Kê Tài Sản 31/12',
      icon: Building2,
      title: 'Kiểm Kê & Điều Chuyển Tài Sản Công (NĐ 151/2017 & TT 23/2023)',
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
      {renderNavList('Dược Lâm Sàng & Chuỗi Lạnh', pharmacyDefs)}
      {renderNavList('Thiết Bị & Tài Sản Công', equipmentDefs)}
    </>
  );
};
