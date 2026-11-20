import React from 'react';
import { BarChart3, Users, KeyRound, Radio, Coins, ShieldAlert, SlidersHorizontal, FileText } from 'lucide-react';
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
  activeKeyCount,
  todayUsagePct,
  esmsBalance
}) => {
  const tabs = [
    { id: 'telemetry' as AdminTab, label: 'Giám sát vận hành', icon: BarChart3 },
    { id: 'staff_management' as AdminTab, label: 'Quản lý nhân viên', icon: Users },
    { id: 'document_ingestion' as AdminTab, label: 'Nạp tài liệu & RAG', icon: FileText },
    { id: 'key_vault' as AdminTab, label: 'Kho khóa API', icon: KeyRound },
    { id: 'integrations' as AdminTab, label: 'Cổng viễn thông', icon: Radio },
    { id: 'budget_cap' as AdminTab, label: 'Ngân sách Token', icon: Coins },
    { id: 'safety_audit' as AdminTab, label: 'Nhật ký an toàn', icon: ShieldAlert },
    { id: 'feature_flags' as AdminTab, label: 'Chức năng app', icon: SlidersHorizontal },
  ];

  return (
    <aside className="w-56 lg:w-60 bg-white border-r border-slate-200/80 p-3 flex flex-col justify-between shrink-0 h-full select-none">
      <div className="space-y-0.5">
        <div className="px-2.5 py-1.5 text-2xs font-semibold text-slate-400 uppercase tracking-wider">
          Phân hệ giám sát
        </div>

        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = currentTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-2.5 ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
              <span className="text-xs sm:text-sm truncate">{t.label}</span>
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
