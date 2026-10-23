/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Volume2,
  VolumeX,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Shield,
  FileText,
  Boxes,
  ThermometerSnowflake,
  Wrench,
  Building2,
  Bot
} from 'lucide-react';
import { UserRole } from '../types/clinical';
import { USER_PROFILES } from '../data/initialData';
import { DashboardTab } from './RightPane/Dashboard';

interface HeaderProps {
  currentTab: DashboardTab;
  currentUserRole: UserRole;
  onSelectUserRole?: (role: UserRole) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  coldChainAlarm: boolean;
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
}

const TAB_METADATA: Record<DashboardTab, { title: string; lawTag: string; icon: React.ComponentType<{ className?: string }> }> = {
  debt: {
    title: 'Sổ Nợ Tủ Trực',
    lawTag: 'TT 22 & TT 20',
    icon: FileText
  },
  equipment: {
    title: 'Thiết Bị & Sự Cố',
    lawTag: 'NĐ 98 & IEC 60601',
    icon: Wrench
  },
  fefo: {
    title: 'Kho Dược FEFO',
    lawTag: 'GSP TT 36',
    icon: Boxes
  },
  coldchain: {
    title: 'Chuỗi Lạnh Vắc Xin',
    lawTag: 'WHO PQS',
    icon: ThermometerSnowflake
  },
  asset_audit: {
    title: 'Kiểm Kê Tài Sản',
    lawTag: 'NĐ 151',
    icon: Building2
  }
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUserRole,
  onSelectUserRole,
  isSidebarCollapsed,
  onToggleSidebar,
  isAudioMuted,
  onToggleAudio,
  coldChainAlarm,
  isCopilotOpen,
  onToggleCopilot,
}) => {
  const currentProfile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = currentProfile.allowedTabs || ['debt'];
  const tabInfo = TAB_METADATA[currentTab] || TAB_METADATA.debt;
  const TabIcon = tabInfo.icon;

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-20 shadow-2xs gap-3">
      {/* 1. Left: Sidebar Toggle & Section Title */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition cursor-pointer shrink-0"
          title={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          <Menu className="w-5 h-5 text-slate-700 md:hidden" />
          <div className="hidden md:block">
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-slate-800" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-slate-600" />
            )}
          </div>
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <TabIcon className="w-5 h-5 text-teal-800 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
              {tabInfo.title}
            </h1>
            <span className="hidden sm:inline-flex text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shrink-0">
              {tabInfo.lawTag}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Right: Role Switcher, System Status & Audio Toggle */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Interactive Role Switcher for both Desktop & Mobile */}
        {onSelectUserRole ? (
          <div className="flex items-center">
            <div className="relative flex items-center">
              <Shield className="w-4 h-4 text-teal-700 absolute left-3 pointer-events-none hidden sm:block" />
              <select
                value={currentUserRole}
                onChange={(e) => onSelectUserRole(e.target.value as UserRole)}
                className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-sm font-medium rounded-lg pl-2.5 sm:pl-9 pr-3.5 py-1.5 focus:outline-hidden focus:border-teal-700 cursor-pointer transition truncate max-w-[140px] sm:max-w-none"
                title="Đổi vai trò lâm sàng (RBAC)"
              >
                <option value="nurse">ĐD. Lê Thị Thu (Điều Dưỡng)</option>
                <option value="biomedical_engineer">KS. Đặng Văn Nam (Kỹ Sư BME)</option>
                <option value="pharmacist">DS. Nguyễn Bích Ngọc (Dược Sĩ)</option>
                <option value="doctor">BS. Trần Văn Hùng (Bác Sĩ ICU)</option>
                <option value="director">TS. Nguyễn Văn An (Giám Đốc)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-800 text-sm font-medium border border-slate-200">
            <Shield className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="font-semibold">{currentProfile.roleName}</span>
          </div>
        )}

        {/* Cold Chain Alarm Badge - Solid Clear Warning Without Annoying Ping */}
        {coldChainAlarm && (
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
            <span>11.0°C Quá Nhiệt</span>
          </div>
        )}

        {/* AI Copilot Toggle - Single Canonical Access Point */}
        {onToggleCopilot && (
          <button
            onClick={onToggleCopilot}
            aria-label="Trợ Lý AI Lâm Sàng"
            className={`h-9 px-2.5 sm:px-3.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition cursor-pointer ${
              isCopilotOpen
                ? 'bg-teal-800 text-white border-teal-800 font-semibold'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title="Bật/Tắt Trợ Lý AI Lâm Sàng (Single Point of Entry)"
          >
            <Bot className={`w-4 h-4 shrink-0 ${isCopilotOpen ? 'text-white' : 'text-teal-700'}`} />
            <span className="hidden sm:inline">Trợ Lý AI</span>
          </button>
        )}

        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Bật âm thanh cảnh báo' : 'Tắt âm thanh cảnh báo'}
          className="w-8.5 h-8.5 flex items-center justify-center rounded-xl hover:bg-slate-100 border border-slate-200 text-slate-600 transition shrink-0 cursor-pointer shadow-2xs"
        >
          {isAudioMuted ? (
            <VolumeX className="w-4 h-4 text-rose-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-teal-700" />
          )}
        </button>
      </div>
    </header>
  );
};
