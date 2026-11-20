import React from 'react';
import { BarChart3, Users, KeyRound, Radio, Coins, ShieldAlert, Server, SlidersHorizontal, FileText } from 'lucide-react';
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
    {
      id: 'telemetry' as AdminTab,
      label: 'Giám sát vận hành',
      desc: 'Telemetry, Cache & Token',
      icon: BarChart3,
    },
    {
      id: 'staff_management' as AdminTab,
      label: 'Quản lý nhân viên',
      desc: 'Hồ sơ, phân quyền & ca trực',
      icon: Users,
    },
    {
      id: 'document_ingestion' as AdminTab,
      label: 'Nạp tài liệu & RAG',
      desc: 'Bóc tách PDF & Vector',
      icon: FileText,
      badge: 'PDF',
    },
    {
      id: 'key_vault' as AdminTab,
      label: 'Bể khóa API',
      desc: 'Quản lý key & Failover',
      icon: KeyRound,
      badge: `${activeKeyCount} Keys`,
    },
    {
      id: 'integrations' as AdminTab,
      label: 'Cổng viễn thông',
      desc: 'eSMS & Google Script',
      icon: Radio,
      badge: (typeof esmsBalance === 'number' && !isNaN(esmsBalance)) ? `${esmsBalance.toLocaleString('vi-VN')} đ` : 'eSMS',
    },
    {
      id: 'budget_cap' as AdminTab,
      label: 'Ngân sách Token',
      desc: 'Hạn mức & Tự chuyển 0đ',
      icon: Coins,
      badge: `${todayUsagePct}%`,
    },
    {
      id: 'safety_audit' as AdminTab,
      label: 'Nhật ký an toàn',
      desc: 'Chặn DDI & Guardrails',
      icon: ShieldAlert,
    },
    { id: 'feature_flags' as AdminTab, label: 'Chức năng app', desc: 'Bật/ẩn các tab Clinical Ward', icon: SlidersHorizontal },
  ];

  return (
    <aside className="w-60 lg:w-68 bg-white border-r border-slate-200/80 p-3.5 flex flex-col justify-between shrink-0 h-full select-none">
      <div className="space-y-1">
        <div className="px-2 py-1 text-2xs font-semibold text-slate-400 uppercase tracking-wider">
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
              className={`w-full text-left p-2.5 rounded-lg transition cursor-pointer flex items-center justify-between group ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-1.5 rounded-md shrink-0 transition ${
                    isActive ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs lg:text-sm font-semibold truncate">{t.label}</div>
                  <div className="text-2xs text-slate-400 truncate">{t.desc}</div>
                </div>
              </div>

              {t.badge && (
                <span className="text-2xs font-mono text-slate-400 shrink-0">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-3 border-t border-slate-100 space-y-2 px-1">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-teal-700" />
            Hạ Tầng Dịch Vụ
          </span>
          <span className="inline-flex items-center gap-1 text-2xs text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Ổn định
          </span>
        </div>
        <div className="text-2xs text-slate-500 space-y-1 pt-0.5">
          <div className="flex justify-between items-center">
            <span>Backend API:</span>
            <span className="text-slate-700 font-medium font-mono">Cloud Active</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Vector DB:</span>
            <span className="text-slate-700 font-medium font-mono">Ready (ĐDVN V)</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Phiên bản:</span>
            <span className="text-slate-400 font-mono">v2.4.0 (Prod)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
