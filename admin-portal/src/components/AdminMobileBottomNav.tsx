import React from 'react';
import { BarChart3, Users, FileCheck, Settings, Menu } from 'lucide-react';
import { AdminTab } from '../types/admin';

interface AdminMobileBottomNavProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onOpenMenu: () => void;
  activeKeyCount: number;
  todayUsagePct: number;
}

export const AdminMobileBottomNav: React.FC<AdminMobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenMenu,
  activeKeyCount,
  todayUsagePct,
}) => {
  const isTelemetry = currentTab === 'telemetry' || currentTab === 'budget_cap';
  const isStaff = currentTab === 'staff_management';
  const isBhyt = currentTab === 'bhyt_audit' || currentTab === 'safety_audit';
  const isSettings = currentTab === 'settings_integrations' || currentTab === 'key_vault' || currentTab === 'integrations' || currentTab === 'feature_flags';
  const isOther = currentTab === 'document_ingestion';

  return (
    <nav
      role="navigation"
      aria-label="Thanh điều hướng di động"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
    >
      {/* 1. Tổng quan & Telemetry */}
      <button
        type="button"
        onClick={() => onTabChange('telemetry')}
        className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
          isTelemetry ? 'text-teal-900 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className="relative">
          <BarChart3 className={`w-5 h-5 transition-transform ${isTelemetry ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
          {todayUsagePct > 85 && (
            <span className="absolute -top-1 -right-2 text-white bg-rose-500 text-[9px] font-mono font-bold px-1 rounded-full ring-1 ring-white">
              {todayUsagePct}%
            </span>
          )}
        </div>
        <span className="text-3xs mt-1 tracking-tight font-medium">Tổng quan</span>
      </button>

      {/* 2. Nhân sự CSDL */}
      <button
        type="button"
        onClick={() => onTabChange('staff_management')}
        className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
          isStaff ? 'text-teal-900 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Users className={`w-5 h-5 transition-transform ${isStaff ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
        <span className="text-3xs mt-1 tracking-tight font-medium">Nhân sự</span>
      </button>

      {/* 3. Giám định BHYT */}
      <button
        type="button"
        onClick={() => onTabChange('bhyt_audit')}
        className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
          isBhyt ? 'text-teal-900 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <FileCheck className={`w-5 h-5 transition-transform ${isBhyt ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
        <span className="text-3xs mt-1 tracking-tight font-medium">BHYT</span>
      </button>

      {/* 4. Cài đặt & Cổng */}
      <button
        type="button"
        onClick={() => onTabChange('settings_integrations')}
        className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
          isSettings ? 'text-teal-900 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className="relative">
          <Settings className={`w-5 h-5 transition-transform ${isSettings ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
          {activeKeyCount > 0 && (
            <span className="absolute -top-1 -right-1.5 text-white bg-teal-600 text-[9px] font-mono font-bold px-1 rounded-full ring-1 ring-white">
              {activeKeyCount}
            </span>
          )}
        </div>
        <span className="text-3xs mt-1 tracking-tight font-medium">Cài đặt</span>
      </button>

      {/* 5. Menu Drawer (Mở RAG, Audit chi tiết, Logout, ...) */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Mở menu tính năng"
        className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer relative ${
          isOther ? 'text-teal-900 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className="relative">
          <Menu className={`w-5 h-5 transition-transform ${isOther ? 'text-teal-700 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
          {isOther && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-teal-600 ring-1 ring-white" />
          )}
        </div>
        <span className="text-3xs mt-1 tracking-tight font-medium">Menu</span>
      </button>
    </nav>
  );
};
