import React from 'react';
import { Boxes, Stethoscope, Thermometer, LayoutGrid } from 'lucide-react';
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
export const SidebarNavLinks: React.FC<SidebarNavLinksProps> = ({
  currentTab,
  onTabChange,
  allowedTabs,
  isCollapsed,
  onCloseMobile,
  nearExpiryAndLowStockCount,
  coldChainTemp = 4.5,
  isColdAlarm,
}) => {
  const links = [
    { tab: 'overview', label: 'Tổng quan', icon: LayoutGrid },
    { tab: 'cpoe', label: 'Đơn thuốc', icon: Stethoscope },
    { tab: 'fefo', label: 'Kho dược', icon: Boxes, badge: nearExpiryAndLowStockCount || undefined },
    {
      tab: 'coldchain',
      label: 'Chuỗi lạnh',
      icon: Thermometer,
      badge: isColdAlarm ? '!' : `${coldChainTemp.toFixed(1)}°`,
    },
  ] as const;
  return (
    <nav aria-label="Nghiệp vụ">
      {!isCollapsed && <p className="sidebar-section-label">Không gian làm việc</p>}
      {links
        .filter((link) => allowedTabs.includes(link.tab))
        .map(({ tab, label, icon: Icon, ...rest }) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              onTabChange(tab);
              onCloseMobile?.();
            }}
            aria-current={currentTab === tab ? 'page' : undefined}
            title={label}
            className={`sidebar-nav-item ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <Icon size={18} strokeWidth={1.6} />
            {!isCollapsed && (
              <>
                <span className="flex-1">{label}</span>
                {'badge' in rest && rest.badge !== undefined && (
                  <span className="nav-badge">{rest.badge}</span>
                )}
              </>
            )}
          </button>
        ))}
    </nav>
  );
};
