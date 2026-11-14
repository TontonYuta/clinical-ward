/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Boxes, Wrench, Stethoscope, Thermometer, Building2, LayoutDashboard, ShieldAlert, BookOpen } from 'lucide-react';
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
    { tab: 'overview', label: 'Tổng quan', icon: LayoutDashboard, title: 'Tổng quan vận hành' },
    { tab: 'cpoe', label: 'Kê đơn thuốc', icon: Stethoscope, title: 'Kê đơn thuốc nội trú & ngoại trú' },
    { tab: 'bhyt_audit', label: 'Giám định BHYT', icon: ShieldAlert, title: 'Kiểm tra đơn & cảnh báo xuất toán BHYT' },
    // Tạm thời comment tính năng Sổ nợ vỏ theo yêu cầu người dùng
    // {
    //   tab: 'debt',
    //   label: 'Sổ nợ vỏ',
    //   icon: FileText,
    //   title: 'Sổ theo dõi nợ vỏ thuốc tủ trực',
    //   badge: debtCount > 0 ? (
    //     <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
    //       {debtCount}
    //     </span>
    //   ) : null
    // },
    {
      tab: 'fefo',
      label: 'Kho dược',
      icon: Boxes,
      title: 'Quản lý kho dược nội trú & ngoại trú',
      // Tạm thời comment badge Cận hạn & Chạm min theo yêu cầu người dùng
      // badge: nearExpiryAndLowStockCount > 0 ? (
      //   <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
      //     {nearExpiryAndLowStockCount}
      //   </span>
      // ) : null
    },
    { tab: 'documents', label: 'Tài liệu', icon: BookOpen, title: 'Thư viện tài liệu y tế' },
    // Tạm thời comment tab Chuỗi lạnh theo yêu cầu người dùng (chỉ giữ 4 tab)
    // {
    //   tab: 'coldchain',
    //   label: 'Chuỗi lạnh',
    //   icon: Thermometer,
    //   title: 'Giám sát nhiệt độ tủ vắc xin',
    //   badge: (
    //     <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border tabular-nums ${
    //       isColdAlarm ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-cyan-50 text-cyan-800 border-cyan-200'
    //     }`}>
    //       {coldChainTemp.toFixed(1)}°C
    //     </span>
    //   )
    // }
  ];

  // Tạm thời comment tính năng TBYT và Kiểm kê tài sản theo yêu cầu người dùng
  // const equipmentDefs: NavDef[] = [
  //   {
  //     tab: 'equipment',
  //     label: 'Sự cố thiết bị',
  //     icon: Wrench,
  //     title: 'Quản lý báo hỏng và sửa chữa',
  //     badge: urgentTicketsCount > 0 ? (
  //       <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
  //         {urgentTicketsCount}
  //       </span>
  //     ) : null
  //   },
  //   {
  //     tab: 'asset_audit',
  //     label: 'Kiểm kê tài sản',
  //     icon: Building2,
  //     title: 'Kiểm kê và điều chuyển tài sản',
  //     badge: misallocatedAssetsCount > 0 ? (
  //       <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
  //         {misallocatedAssetsCount}
  //       </span>
  //     ) : null
  //   }
  // ];

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
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 text-slate-950 font-semibold border-l-2 border-slate-900 rounded-l-none'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={tooltip}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-slate-800' : 'text-slate-400'}`} />
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
    <div className="space-y-4">
      {renderNavList('Nghiệp vụ', pharmacyDefs)}
    </div>
  );
};
