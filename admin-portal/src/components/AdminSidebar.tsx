import React from 'react';
import { BarChart3, Users, FileCheck, FileText, Settings } from 'lucide-react';
import { AdminTab } from '../types/admin';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  activeKeyCount: number;
  todayUsagePct: number;
  esmsBalance?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
  activeKeyCount = 0,
  todayUsagePct = 0,
  esmsBalance,
}) => {
  const tabs = [
    { id: 'telemetry' as AdminTab, label: 'Giám sát & Ngân sách AI', icon: BarChart3 },
    { id: 'bhyt_audit' as AdminTab, label: 'Giám định BHYT', icon: FileCheck },
    { id: 'staff_management' as AdminTab, label: 'Quản lý nhân viên', icon: Users },
    { id: 'document_ingestion' as AdminTab, label: 'Tri thức Y học & RAG', icon: FileText },
    { id: 'settings_integrations' as AdminTab, label: 'Cài đặt & Tích hợp', icon: Settings },
  ];

  return (
    <aside className="w-56 lg:w-60 bg-white border-r border-slate-200/80 p-3 flex flex-col justify-between shrink-0 h-full select-none">
      <div className="space-y-0.5">
        <div className="px-2.5 py-1.5 text-2xs font-semibold text-slate-400 uppercase tracking-wider">
          Phân hệ quản trị
        </div>

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
              onClick={() => onTabChange(t.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-between group ${
                isActive
                  ? 'bg-teal-50/90 text-teal-950 font-semibold border-l-2 border-teal-700 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-teal-800' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="text-xs sm:text-sm truncate">{t.label}</span>
              </div>
              {t.id === 'settings_integrations' && activeKeyCount > 0 && (
                <span className={`text-3xs font-mono px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                  isActive ? 'bg-teal-200/60 text-teal-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {activeKeyCount} key
                </span>
              )}
              {t.id === 'telemetry' && todayUsagePct > 0 && (
                <span className={`text-3xs font-mono px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                  todayUsagePct > 85 ? 'bg-rose-100 text-rose-700' : isActive ? 'bg-teal-200/60 text-teal-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {todayUsagePct}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-3 border-t border-slate-100 px-2 flex items-center justify-between text-2xs text-slate-400 font-mono">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Trực tuyến
        </span>
        <span>v2.4.0</span>
      </div>
    </aside>
  );
};
