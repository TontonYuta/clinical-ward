import React from 'react';
import { Cross, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
interface SidebarHeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}
export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}) => (
  <div className="sidebar-brand">
    <button
      type="button"
      onClick={onToggleCollapse}
      className="brand-mark"
      aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
      title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
    >
      {isCollapsed ? <PanelLeftOpen size={19} /> : <Cross size={21} strokeWidth={1.7} />}
    </button>
    {!isCollapsed && (
      <div className="min-w-0">
        <span className="brand-name">
          Clinical Ward<span className="brand-sub">Trạm lâm sàng</span>
        </span>
      </div>
    )}
    {!isCollapsed && (
      <button
        type="button"
        className="sidebar-collapse hidden md:block"
        onClick={onToggleCollapse}
        aria-label="Thu gọn menu"
      >
        <PanelLeftClose size={16} />
      </button>
    )}
    {onCloseMobile && (
      <button
        type="button"
        onClick={onCloseMobile}
        className="sidebar-collapse md:hidden"
        aria-label="Đóng menu"
      >
        <X size={20} />
      </button>
    )}
  </div>
);
