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
  Building2
} from 'lucide-react';
import { UserRole } from '../types/clinical';
import { USER_PROFILES } from '../data/initialData';
import { DashboardTab } from './RightPane/Dashboard';

interface HeaderProps {
  currentTab: DashboardTab;
  currentUserRole: UserRole;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  coldChainAlarm: boolean;
}

const TAB_METADATA: Record<DashboardTab, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  debt: {
    title: 'Sổ Nợ Tủ Trực Cấp Cứu',
    subtitle: 'Ghi nợ thuốc & vật tư ca đêm · Thu hồi vỏ ống Morphin trước giao ban 07:00 sáng',
    icon: FileText
  },
  equipment: {
    title: 'Sự Cố & Kiểm Định Thiết Bị Y Tế',
    subtitle: 'Giám sát sẵn sàng máy thở, máy sốc tim loại D · Cảnh báo hạn tem kiểm định an toàn',
    icon: Wrench
  },
  fefo: {
    title: 'Kho Dược – Hạn Dùng & Định Mức',
    subtitle: 'Xuất kho ưu tiên hạn dùng gần (FEFO) · Cảnh báo chạm ngưỡng tối thiểu',
    icon: Boxes
  },
  coldchain: {
    title: 'Giám Sát Chuỗi Lạnh Vắc Xin',
    subtitle: 'Cảm biến Datalogger tự động chuẩn 2.0°C - 8.0°C · Ứng phó mất điện khẩn cấp',
    icon: ThermometerSnowflake
  },
  asset_audit: {
    title: 'Kiểm Kê Định Kỳ & Quản Lý Tài Sản',
    subtitle: 'Đối soát thiết bị buồng phòng qua QR · Tự động gom danh sách kiến nghị thanh lý',
    icon: Building2
  }
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUserRole,
  isSidebarCollapsed,
  onToggleSidebar,
  isAudioMuted,
  onToggleAudio,
  coldChainAlarm,
}) => {
  const currentProfile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = currentProfile.allowedTabs || ['debt'];
  const tabInfo = TAB_METADATA[currentTab] || TAB_METADATA.debt;
  const TabIcon = tabInfo.icon;

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-3 sm:px-5 flex items-center justify-between shrink-0 select-none z-20 shadow-2xs">
      {/* 1. Left: Sidebar Toggle & Active Section Breadcrumb */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
          title={isSidebarCollapsed ? 'Mở rộng thanh menu bên trái' : 'Thu gọn thanh menu bên trái'}
        >
          <Menu className="w-5 h-5 text-slate-700 md:hidden" />
          <div className="hidden md:block">
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-slate-700" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/70 flex items-center justify-center text-teal-700 shrink-0 shadow-2xs">
            <TabIcon className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 truncate tracking-tight">
                {tabInfo.title}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate hidden md:block">
              {tabInfo.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Right: RBAC Badge, System Status, Audio Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* RBAC Scope Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200/80">
          <Shield className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            Phân quyền: <strong className="text-slate-900 font-semibold">{currentProfile.roleName}</strong> ({allowedTabs.length}/5 phân hệ)
          </span>
        </div>

        {/* Cold Chain Alarm or Healthy Status */}
        {coldChainAlarm ? (
          <div className="flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold animate-pulse shadow-2xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">Quá nhiệt 11.0°C!</span>
          </div>
        ) : (
          <div className="hidden xl:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
            <span>Hệ thống ổn định</span>
          </div>
        )}

        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Bật âm thanh cảnh báo lâm sàng' : 'Tắt âm thanh cảnh báo'}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 border border-slate-200 text-slate-600 transition shrink-0 cursor-pointer"
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
