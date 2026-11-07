import React from 'react';
import { BarChart3, KeyRound, Radio, Coins, ShieldAlert, Server } from 'lucide-react';
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
      label: 'Giám Sát Vận Hành',
      desc: 'Telemetry, Cache & BHYT',
      icon: BarChart3,
    },
    {
      id: 'key_vault' as AdminTab,
      label: 'Bể Khóa API Key',
      desc: 'Multi-Key Pool & Failover',
      icon: KeyRound,
      badge: `${activeKeyCount} Keys`,
    },
    {
      id: 'integrations' as AdminTab,
      label: 'Cổng Viễn Thông & GAS',
      desc: 'eSMS Brandname & Google Script',
      icon: Radio,
      badge: (typeof esmsBalance === 'number' && !isNaN(esmsBalance)) ? `${esmsBalance.toLocaleString('vi-VN')} đ` : 'eSMS',
    },
    {
      id: 'budget_cap' as AdminTab,
      label: 'Ngân Sách Token',
      desc: 'Hạn mức ngày & Tự chuyển 0đ',
      icon: Coins,
      badge: `${todayUsagePct}%`,
    },
    {
      id: 'safety_audit' as AdminTab,
      label: 'Nhật Ký An Toàn',
      desc: 'DDI Block & Guardrails',
      icon: ShieldAlert,
    },
  ];

  return (
    <aside className="w-64 lg:w-72 bg-white border-r border-slate-200/80 p-4 flex flex-col justify-between shrink-0 h-full select-none">
      <div className="space-y-1.5">
        <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
          Phân Hệ Theo Dõi
        </div>

        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = currentTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`w-full text-left p-3 rounded-xl transition cursor-pointer flex items-center justify-between group ${
                isActive
                  ? 'bg-teal-50/90 text-teal-900 font-semibold border border-teal-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-lg shrink-0 transition ${
                    isActive ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{t.label}</div>
                  <div className="text-xs text-slate-500 truncate">{t.desc}</div>
                </div>
              </div>

              {t.badge && (
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md shrink-0 border ${
                    isActive
                      ? 'bg-white text-teal-800 border-teal-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Server className="w-4 h-4 text-teal-700" />
          <span>Trạng Thái Hạ Tầng</span>
        </div>
        <div className="text-xs text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span>FastAPI Core:</span>
            <span className="text-emerald-700 font-semibold font-mono">8000 (Online)</span>
          </div>
          <div className="flex justify-between">
            <span>Admin Portal:</span>
            <span className="text-teal-700 font-semibold font-mono">3001 (Active)</span>
          </div>
          <div className="flex justify-between">
            <span>Clinical App:</span>
            <span className="text-slate-700 font-semibold font-mono">3000 (Connected)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
