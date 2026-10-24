/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText,
  Boxes,
  Wrench,
  Stethoscope,
  Thermometer,
  Building2,
  Bot
} from 'lucide-react';
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
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
}

const TAB_CONFIG: Record<DashboardTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  cpoe: { label: 'Kê đơn', icon: Stethoscope },
  debt: { label: 'Tủ trực', icon: FileText },
  fefo: { label: 'Kho FEFO', icon: Boxes },
  equipment: { label: 'Sự cố', icon: Wrench },
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
  onToggleCopilot,
  isCopilotOpen
}) => {
  const profile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = profile.allowedTabs || ['debt'];
  // Display up to top 4 allowed tabs on mobile for ergonomic touch targets
  const displayTabs = allowedTabs.slice(0, 4);

  const getBadge = (tab: DashboardTab) => {
    if (tab === 'debt' && debtCount > 0) return { count: debtCount, color: 'bg-amber-500' };
    if (tab === 'equipment' && urgentTicketsCount > 0) return { count: urgentTicketsCount, color: 'bg-rose-500' };
    if (tab === 'fefo' && lowStockCount > 0) return { count: lowStockCount, color: 'bg-amber-500' };
    if (tab === 'coldchain' && isColdAlarm) return { count: '!', color: 'bg-rose-500' };
    if (tab === 'asset_audit' && misallocatedAssetsCount > 0) return { count: misallocatedAssetsCount, color: 'bg-blue-500' };
    return null;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around select-none print:hidden shadow-lg">
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
              isActive ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-teal-700 stroke-[2.5]' : 'text-slate-500'}`} />
              {badge && (
                <span
                  className={`absolute -top-1.5 -right-2 text-white text-[10px] font-bold px-1 rounded-full ring-1 ring-white ${badge.color}`}
                >
                  {badge.count}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium">{config.label}</span>
          </button>
        );
      })}

      {/* Floating AI Copilot Trigger Button */}
      {onToggleCopilot && (
        <button
          onClick={onToggleCopilot}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition cursor-pointer relative ${
            isCopilotOpen ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Bot className={`w-5 h-5 ${isCopilotOpen ? 'text-teal-700 stroke-[2.5]' : 'text-slate-600'}`} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 ring-1 ring-white" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Trợ lý AI</span>
        </button>
      )}
    </nav>
  );
};
