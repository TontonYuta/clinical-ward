/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Boxes, Wrench, Stethoscope, Thermometer, Building2 } from 'lucide-react';
import { DashboardTab, UserRole } from '../../types/clinical';
import { USER_PROFILES } from '../../data/initialData';

interface MobileBottomNavProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  currentUserRole: UserRole;
  debtCount: number;
  urgentTicketsCount: number;
  lowStockCount: number;
  coldChainTemp: number;
  isColdAlarm: boolean;
  misallocatedAssetsCount: number;
}

const TAB_CONFIG: Record<DashboardTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  cpoe: { label: 'Kê đơn', icon: Stethoscope },
  debt: { label: 'Sổ nợ', icon: FileText },
  fefo: { label: 'Kho dược', icon: Boxes },
  equipment: { label: 'Thiết bị', icon: Wrench },
  coldchain: { label: 'Chuỗi lạnh', icon: Thermometer },
  asset_audit: { label: 'Kiểm kê', icon: Building2 }
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  currentUserRole,
  debtCount,
  urgentTicketsCount,
  lowStockCount,
  coldChainTemp,
  isColdAlarm,
  misallocatedAssetsCount,
}) => {
  const profile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = profile.allowedTabs || ['debt'];
  
  const displayTabs = React.useMemo(() => {
    const filtered = (Object.keys(TAB_CONFIG) as DashboardTab[]).filter(t => allowedTabs.includes(t));
    return filtered.length > 0 ? filtered : allowedTabs.slice(0, 4);
  }, [allowedTabs]);

  const getBadge = (tab: DashboardTab) => {
    if (tab === 'debt' && debtCount > 0) return { count: debtCount, color: 'bg-amber-500' };
    if (tab === 'equipment' && urgentTicketsCount > 0) return { count: urgentTicketsCount, color: 'bg-rose-500' };
    if (tab === 'fefo' && lowStockCount > 0) return { count: lowStockCount, color: 'bg-amber-500' };
    if (tab === 'coldchain' && isColdAlarm) return { count: '!', color: 'bg-rose-500' };
    if (tab === 'asset_audit' && misallocatedAssetsCount > 0) return { count: misallocatedAssetsCount, color: 'bg-blue-500' };
    return null;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none print:hidden shadow-lg">
      {displayTabs.map((tab) => {
        const config = TAB_CONFIG[tab];
        if (!config) return null;
        const Icon = config.icon;
        const isActive = currentTab === tab;
        const badge = getBadge(tab);

        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition cursor-pointer relative ${
              isActive ? 'text-blue-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'text-slate-500'}`} />
              {badge && (
                <span
                  className={`absolute -top-1.5 -right-2 text-white text-[10px] font-bold px-1 rounded-full ring-1 ring-white ${badge.color}`}
                >
                  {badge.count}
                </span>
              )}
            </div>
            <span className="text-xs mt-0.5 tracking-tight font-bold">{config.label}</span>
          </button>
        );
      })}

    </nav>
  );
};
