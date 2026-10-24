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
  Bot,
  Stethoscope
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

const TAB_METADATA: Record<DashboardTab, { title: string; shortTitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  cpoe: {
    title: 'Kê đơn thuốc điện tử (CPOE)',
    shortTitle: 'Kê đơn',
    icon: Stethoscope
  },
  debt: {
    title: 'Sổ theo dõi nợ vỏ thuốc',
    shortTitle: 'Sổ nợ',
    icon: FileText
  },
  equipment: {
    title: 'Sự cố thiết bị y tế',
    shortTitle: 'Thiết bị',
    icon: Wrench
  },
  fefo: {
    title: 'Kho dược & Hạn dùng (FEFO)',
    shortTitle: 'Kho dược',
    icon: Boxes
  },
  coldchain: {
    title: 'Giám sát chuỗi lạnh',
    shortTitle: 'Chuỗi lạnh',
    icon: ThermometerSnowflake
  },
  asset_audit: {
    title: 'Kiểm kê tài sản',
    shortTitle: 'Kiểm kê',
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
          className="p-2 rounded-md text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition cursor-pointer shrink-0"
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
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 truncate tracking-tight">
            <span className="sm:hidden">{tabInfo.shortTitle}</span>
            <span className="hidden sm:inline">{tabInfo.title}</span>
          </h1>
        </div>
      </div>

      {/* 2. Right: Role Switcher, System Status & Audio Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Interactive Role Switcher for both Desktop & Mobile */}
        {onSelectUserRole ? (
          <div className="flex items-center">
            <div className="relative flex items-center">
              <Shield className="w-4 h-4 text-teal-700 absolute left-2.5 pointer-events-none hidden sm:block" />
              <select
                value={currentUserRole}
                onChange={(e) => onSelectUserRole(e.target.value as UserRole)}
                className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-xs sm:text-sm font-medium rounded-lg pl-2 sm:pl-8.5 pr-2 sm:pr-3.5 py-1.5 focus:outline-hidden focus:border-teal-700 cursor-pointer transition truncate max-w-[100px] sm:max-w-none"
                title={`${currentProfile.name} (${currentProfile.roleName}) - ${currentProfile.responsibilities}`}
              >
                <option value="nurse">ĐD. Thu (Điều dưỡng)</option>
                <option value="biomedical_engineer">KS. Nam (Kỹ sư BME)</option>
                <option value="pharmacist">DS. Ngọc (Dược sĩ)</option>
                <option value="doctor">BS. Hùng (Bác sĩ)</option>
                <option value="director">GĐ. An (Giám đốc)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 text-slate-800 text-sm font-medium border border-slate-200">
            <Shield className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="font-semibold">{currentProfile.roleName}</span>
          </div>
        )}

        {/* Cold Chain Alarm Badge */}
        {coldChainAlarm && (
          <div className="flex items-center gap-1 h-8 px-2 rounded-md bg-rose-600 text-white text-xs font-bold animate-pulse shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="hidden sm:inline">Quá nhiệt</span>
            <span>11.0°C</span>
          </div>
        )}

        {/* AI Copilot Toggle - Single Canonical Access Point */}
        {onToggleCopilot && (
          <button
            onClick={onToggleCopilot}
            aria-label="Trợ lý AI lâm sàng"
            className={`h-8.5 px-2.5 sm:px-3 rounded-md border text-xs sm:text-sm font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              isCopilotOpen
                ? 'bg-teal-800 text-white border-teal-800 font-semibold'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title="Bật/tắt trợ lý AI lâm sàng"
          >
            <Bot className={`w-4 h-4 shrink-0 ${isCopilotOpen ? 'text-white' : 'text-teal-700'}`} />
            <span className="hidden md:inline">Trợ lý AI</span>
          </button>
        )}

        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Bật âm thanh cảnh báo' : 'Tắt âm thanh cảnh báo'}
          className="w-8.5 h-8.5 flex items-center justify-center rounded-md hover:bg-slate-100 border border-slate-200 text-slate-600 transition shrink-0 cursor-pointer shadow-2xs"
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
