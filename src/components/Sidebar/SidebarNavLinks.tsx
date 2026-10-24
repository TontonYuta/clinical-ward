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
      label: 'Kê đơn CPOE',
      icon: Stethoscope,
      title: 'Kê đơn thuốc điện tử'
    },
    {
      tab: 'debt',
      label: 'Sổ nợ vỏ',
      icon: FileText,
      title: 'Sổ theo dõi nợ vỏ thuốc tủ trực',
      badge: debtCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
          {debtCount}
        </span>
      ) : null
    },
    {
      tab: 'fefo',
      label: 'Kho dược FEFO',
      icon: Boxes,
      title: 'Quản lý hạn dùng FEFO & tồn kho',
      badge: nearExpiryAndLowStockCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
          {nearExpiryAndLowStockCount}
        </span>
      ) : null
    },
    {
      tab: 'coldchain',
      label: 'Chuỗi lạnh',
      icon: Thermometer,
      title: 'Giám sát nhiệt độ tủ vắc xin',
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
      label: 'Sự cố thiết bị',
      icon: Wrench,
      title: 'Quản lý báo hỏng và sửa chữa',
      badge: urgentTicketsCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
          {urgentTicketsCount}
        </span>
      ) : null
    },
    {
      tab: 'asset_audit',
      label: 'Kiểm kê tài sản',
      icon: Building2,
      title: 'Kiểm kê và điều chuyển tài sản',
      badge: misallocatedAssetsCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
          {misallocatedAssetsCount}
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
      {renderNavList('Dược lâm sàng', pharmacyDefs)}
      {renderNavList('Thiết bị y tế', equipmentDefs)}
    </>
  );
};
