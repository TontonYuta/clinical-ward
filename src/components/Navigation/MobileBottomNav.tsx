/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Boxes,
  Wrench,
  Stethoscope,
  Thermometer,
  Building2,
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  MoreHorizontal,
  X,
  ChevronRight
} from 'lucide-react';
import { DashboardTab, UserRole } from '../../types/clinical';
import type { FeatureFlagPayload } from '../../services/featureFlags';
import { getEffectiveAllowedTabs } from '../../services/featureFlags';

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
  featureFlags?: FeatureFlagPayload | null;
}

const TAB_CONFIG: Record<DashboardTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  overview: { label: 'Tổng quan', icon: LayoutDashboard },
  cpoe: { label: 'Kê đơn', icon: Stethoscope },
  bhyt_audit: { label: 'Giám định BHYT', icon: ShieldAlert },
  documents: { label: 'Tài liệu', icon: BookOpen },
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
  featureFlags = null,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const allowedTabs = getEffectiveAllowedTabs(currentUserRole, featureFlags);
  
  const displayTabs = React.useMemo(() => {
    const filtered = (Object.keys(TAB_CONFIG) as DashboardTab[])
      .filter(t => allowedTabs.includes(t));
    return filtered.length > 0 ? filtered : (['overview', 'cpoe'] as DashboardTab[]);
  }, [allowedTabs]);

  const getBadge = (tab: DashboardTab) => {
    if (tab === 'debt' && debtCount > 0) return { count: debtCount, color: 'bg-amber-500' };
    if (tab === 'equipment' && urgentTicketsCount > 0) return { count: urgentTicketsCount, color: 'bg-rose-500' };
    if (tab === 'coldchain' && isColdAlarm) return { count: '!', color: 'bg-rose-500' };
    if (tab === 'asset_audit' && misallocatedAssetsCount > 0) return { count: misallocatedAssetsCount, color: 'bg-blue-500' };
    return null;
  };

  const useMoreMenu = displayTabs.length > 5;
  const primaryTabs = useMoreMenu ? displayTabs.slice(0, 4) : displayTabs;
  const moreTabs = useMoreMenu ? displayTabs.slice(4) : [];
  const isMoreTabActive = moreTabs.includes(currentTab);

  // Check if any more tab has an alert badge
  const moreHasAlert = moreTabs.some(t => Boolean(getBadge(t)));

  const handleSelectTab = (tab: DashboardTab) => {
    onTabChange(tab);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Bottom Sheet for "More" tabs */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Drawer */}
          <div className="relative z-50 bg-white rounded-t-2xl border-t border-slate-200 p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom duration-250 max-h-[75vh] overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Phân Hệ Lâm Sàng &amp; Vận Hành</h3>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Đóng menu"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreTabs.map((tab) => {
                const config = TAB_CONFIG[tab];
                if (!config) return null;
                const Icon = config.icon;
                const isActive = currentTab === tab;
                const badge = getBadge(tab);

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleSelectTab(tab)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-teal-50 border-teal-300 text-teal-950 font-bold shadow-xs'
                        : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isActive ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {badge && (
                        <span className={`absolute -top-1 -right-1 text-white text-[9px] font-bold px-1 rounded-full ring-1 ring-white ${badge.color}`}>
                          {badge.count}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight truncate">{config.label}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">Mô-đun lâm sàng</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Sticky Bottom Nav */}
      <nav
        role="navigation"
        aria-label="Điều hướng lâm sàng di động"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none print:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      >
        {primaryTabs.map((tab) => {
          const config = TAB_CONFIG[tab];
          if (!config) return null;
          const Icon = config.icon;
          const isActive = currentTab === tab;
          const badge = getBadge(tab);

          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
                isActive ? 'text-teal-950 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
                {badge && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-white text-[9px] font-bold px-1 rounded-full ring-1 ring-white ${badge.color}`}
                  >
                    {badge.count}
                  </span>
                )}
              </div>
              <span className="text-3xs mt-1 tracking-tight font-medium">{config.label}</span>
            </button>
          );
        })}

        {/* 5th slot: "Thêm" if > 5 tabs */}
        {useMoreMenu && (
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-label="Thêm phân hệ"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
              isMoreTabActive ? 'text-teal-950 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <MoreHorizontal className={`w-5 h-5 transition-transform ${isMoreTabActive ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
              {(isMoreTabActive || moreHasAlert) && (
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${moreHasAlert ? 'bg-rose-500' : 'bg-teal-600'} ring-1 ring-white`} />
              )}
            </div>
            <span className="text-3xs mt-1 tracking-tight font-medium">
              {isMoreTabActive && TAB_CONFIG[currentTab] ? TAB_CONFIG[currentTab].label : 'Thêm'}
            </span>
          </button>
        )}
      </nav>
    </>
  );
};
