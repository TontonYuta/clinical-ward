import React from 'react';
import {
  BarChart3,
  Users,
  FileCheck,
  FileText,
  Settings,
  X,
  LogOut,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { AdminTab } from '../types/admin';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  activeKeyCount: number;
  todayUsagePct: number;
  esmsBalance?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobile?: () => void;
  authenticatedUsername?: string;
  onLogout?: () => Promise<void>;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
  activeKeyCount = 0,
  todayUsagePct = 0,
  isCollapsed = false,
  onToggleCollapse,
  isMobileDrawer = false,
  onCloseMobile,
  authenticatedUsername,
  onLogout,
}) => {
  const tabs = [
    { id: 'telemetry' as AdminTab, label: 'Giám sát & Chi phí', icon: BarChart3 },
    { id: 'bhyt_audit' as AdminTab, label: 'Giám định BHYT', icon: FileCheck },
    { id: 'staff_management' as AdminTab, label: 'Quản lý nhân viên', icon: Users },
    { id: 'document_ingestion' as AdminTab, label: 'Tri thức Y học & RAG', icon: FileText },
    { id: 'settings_integrations' as AdminTab, label: 'Cài đặt & Tích hợp', icon: Settings },
  ];

  const handleSelectTab = (tab: AdminTab) => {
    onTabChange(tab);
    if (isMobileDrawer && onCloseMobile) {
      onCloseMobile();
    }
  };

  const collapsed = !isMobileDrawer && isCollapsed;

  return (
    <aside
      className={`${
        isMobileDrawer
          ? 'w-72 max-w-[85vw] bg-white h-full p-4 flex flex-col justify-between select-none shadow-2xl relative z-50 overflow-y-auto'
          : `hidden lg:flex bg-white border-r border-slate-200/90 py-4 flex-col justify-between shrink-0 h-full select-none transition-all duration-200 ${
              collapsed ? 'w-16 px-2' : 'w-64 xl:w-[272px] px-3'
            }`
      }`}
    >
      <div className="space-y-2">
        {isMobileDrawer && (
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Phân hệ Quản trị</div>
                <div className="text-2xs text-slate-500">Clinical AI Monitor</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div
          className={`flex items-center ${
            collapsed ? 'justify-center pb-1' : 'justify-between px-3 pb-1'
          }`}
        >
          {!collapsed && (
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">
              Phân hệ quản trị
            </span>
          )}
          {!isMobileDrawer && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}
        </div>

        <nav className="space-y-1" aria-label="Điều hướng phân hệ quản trị">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive =
              currentTab === t.id ||
              (t.id === 'telemetry' && currentTab === 'budget_cap') ||
              (t.id === 'bhyt_audit' && currentTab === 'safety_audit') ||
              (t.id === 'settings_integrations' &&
                (currentTab === 'key_vault' || currentTab === 'integrations' || currentTab === 'feature_flags'));

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTab(t.id)}
                title={collapsed ? t.label : undefined}
                className={`w-full rounded-xl transition-colors cursor-pointer flex items-center group ${
                  collapsed ? 'justify-center p-2.5' : 'justify-between gap-2.5 px-3 py-2.5 text-left'
                } ${
                  isActive
                    ? 'bg-teal-50/90 text-teal-900 font-semibold ring-1 ring-inset ring-teal-200/70'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {!collapsed && <span className="text-sm whitespace-nowrap truncate">{t.label}</span>}
                </div>
                {!collapsed && t.id === 'settings_integrations' && activeKeyCount > 0 && (
                  <span
                    className={`text-2xs font-mono px-2 py-0.5 rounded-md shrink-0 font-semibold ${
                      isActive ? 'bg-teal-100 text-teal-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeKeyCount}
                  </span>
                )}
                {!collapsed && t.id === 'telemetry' && todayUsagePct > 0 && (
                  <span
                    className={`text-2xs font-mono px-2 py-0.5 rounded-md shrink-0 font-semibold ${
                      todayUsagePct > 85
                        ? 'bg-rose-100 text-rose-700'
                        : isActive
                        ? 'bg-teal-100 text-teal-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {todayUsagePct}%
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-3 border-t border-slate-100">
        {isMobileDrawer && authenticatedUsername && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-teal-700 text-white text-2xs font-bold flex items-center justify-center uppercase shrink-0">
                {authenticatedUsername.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 truncate">{authenticatedUsername}</div>
                <div className="text-2xs text-emerald-700 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Quản trị viên
                </div>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onCloseMobile?.();
                  void onLogout();
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div
          className={`flex items-center text-2xs text-slate-500 font-mono ${
            collapsed ? 'justify-center' : 'justify-between px-3'
          }`}
        >
          <span className="inline-flex items-center gap-1.5" title="Hệ thống trực tuyến">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {!collapsed && <span>Trực tuyến</span>}
          </span>
          {!collapsed && <span className="text-slate-400">v2.4.0</span>}
        </div>
      </div>
    </aside>
  );
};
