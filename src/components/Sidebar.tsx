/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DashboardTab } from './RightPane/Dashboard';
import { UserRole } from '../types/clinical';
import { USER_PROFILES } from '../data/initialData';
import { SidebarHeader } from './Sidebar/SidebarHeader';
import { SidebarNavLinks } from './Sidebar/SidebarNavLinks';
import { SidebarLegalLinks } from './Sidebar/SidebarLegalLinks';
import { SidebarFooter } from './Sidebar/SidebarFooter';
import type { AppFontScale } from '../utils/storage/appStatePersistence';

export interface SidebarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  currentUserRole: UserRole;
  onSelectUserRole?: (role: UserRole) => void;
  onLogout?: () => Promise<void>;
  isAuthenticated: boolean;
  username?: string;
  fontScale: AppFontScale;
  onFontScaleChange: (scale: AppFontScale) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  debtCount: number;
  urgentTicketsCount: number;
  nearExpiryAndLowStockCount: number;
  coldChainTemp: number;
  isColdAlarm: boolean;
  misallocatedAssetsCount: number;
  onOpenLegalDocs: () => void;
  onOpenAuditTrail: () => void;
  onOpenUserGuide: () => void;
  onOpenPrintableForms?: () => void;
  onOpenMedicationSafety?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  currentUserRole,
  onSelectUserRole,
  onLogout,
  isAuthenticated, username, fontScale, onFontScaleChange,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  debtCount,
  urgentTicketsCount,
  nearExpiryAndLowStockCount,
  coldChainTemp = 4.5,
  isColdAlarm = false,
  misallocatedAssetsCount = 0,
  onOpenLegalDocs,
  onOpenAuditTrail,
  onOpenUserGuide,
  onOpenPrintableForms,
  onOpenMedicationSafety,
}) => {
  const currentProfile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = currentProfile.allowedTabs || ['debt'];

  return (
    <aside
      className={`clinical-sidebar h-full flex flex-col shrink-0 z-30 transition-all duration-200 select-none ${
        isCollapsed ? 'is-collapsed' : ''
      }`}
    >
      <SidebarHeader isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} onCloseMobile={onCloseMobile} />

      <div
        data-testid="clinical-nav-tabs"
        className="flex-1 overflow-y-auto pb-3 thin-scrollbar"
      >
        <SidebarNavLinks
          currentTab={currentTab}
          onTabChange={onTabChange}
          allowedTabs={allowedTabs}
          isCollapsed={isCollapsed}
          onCloseMobile={onCloseMobile}
          debtCount={debtCount}
          urgentTicketsCount={urgentTicketsCount}
          nearExpiryAndLowStockCount={nearExpiryAndLowStockCount}
          coldChainTemp={coldChainTemp}
          isColdAlarm={isColdAlarm}
          misallocatedAssetsCount={misallocatedAssetsCount}
        />

        <SidebarLegalLinks
          isCollapsed={isCollapsed}
          onCloseMobile={onCloseMobile}
          onOpenAuditTrail={onOpenAuditTrail}
          onOpenLegalDocs={onOpenLegalDocs}
          onOpenUserGuide={onOpenUserGuide}
          onOpenPrintableForms={onOpenPrintableForms}
          onOpenMedicationSafety={onOpenMedicationSafety}
        />
        {!isCollapsed && <p className="sidebar-note">Thông tin đúng lúc.<br/>Tập trung vào điều cần làm.</p>}
      </div>

      <SidebarFooter isCollapsed={isCollapsed} currentUserRole={currentUserRole} onSelectUserRole={onSelectUserRole} onLogout={onLogout} isAuthenticated={isAuthenticated} username={username} fontScale={fontScale} onFontScaleChange={onFontScaleChange} onCloseMobile={onCloseMobile} />
    </aside>
  );
};
