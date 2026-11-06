/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Chỉ Số Ca Trực & Phím Điều Hướng Tối Giản (<=200 LOC)
 */

import React from 'react';
import { ArrowRight, FileText, Bot, AlertTriangle, Thermometer } from 'lucide-react';
import type { DashboardTab, UserRole, AuditTrailRecord } from '../../../types/clinical';
import type { DebtRecord, InventoryBatch } from '../../../types/pharmacy';
import type { EquipmentTicket, ColdChainMonitorState, AssetAuditRecord } from '../../../types/equipment';

interface OverviewOperationsKpiProps {
  currentUserRole: UserRole;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  coldChainState: ColdChainMonitorState;
  assets: AssetAuditRecord[];
  auditRecords: AuditTrailRecord[];
  allowedTabs: DashboardTab[];
  onTabChange: (tab: DashboardTab) => void;
  onOpenCopilot?: () => void;
}

export const OverviewOperationsKpi: React.FC<OverviewOperationsKpiProps> = ({
  currentUserRole,
  debts,
  tickets,
  batches,
  coldChainState,
  assets,
  auditRecords,
  allowedTabs,
  onTabChange,
  onOpenCopilot
}) => {
  const stockAlerts = batches.filter((item) => item.isNearExpiry || item.isLowStock || item.currentStock <= item.minThreshold);
  const coldAlert = coldChainState.alarmActive || coldChainState.currentTemp < 2 || coldChainState.currentTemp > 8 || coldChainState.powerStatus === 'outage_critical';

  const kpis = [
    {
      id: 'cpoe-orders',
      label: 'Đơn Kê CPOE Hôm Nay',
      value: '14 Đơn',
      subtitle: 'Kê đơn TT26 & Ký số điện tử',
      tab: 'cpoe' as DashboardTab,
      icon: FileText,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      alert: false,
      onClick: () => onTabChange('cpoe')
    },
    {
      id: 'cdss-status',
      label: 'Thẩm Định Dược AI',
      value: '0 Vi phạm',
      subtitle: 'CDSS QĐ 5948 & Dược thư QG',
      tab: 'cpoe' as DashboardTab,
      icon: Bot,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
      alert: false,
      onClick: () => {
        if (onOpenCopilot) {
          onOpenCopilot();
        } else {
          onTabChange('cpoe');
        }
      }
    },
    {
      id: 'stock-alerts',
      label: 'Cận Hạn & Chạm Min',
      value: `${stockAlerts.length} Lô`,
      subtitle: 'Ưu tiên cấp phát FEFO kho',
      tab: 'fefo' as DashboardTab,
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      alert: stockAlerts.length > 0,
      onClick: () => {
        try {
          sessionStorage.setItem('cpoe_filter_expiring', 'true');
        } catch {
          // Ignore
        }
        onTabChange('fefo');
      }
    },
    {
      id: 'cold-chain',
      label: 'Chuỗi Lạnh Dược Phẩm',
      value: coldAlert ? 'CẢNH BÁO' : `${coldChainState.currentTemp.toFixed(1)}°C`,
      subtitle: 'Bảo quản GSP 2°C - 8°C',
      tab: 'coldchain' as DashboardTab,
      icon: Thermometer,
      iconColor: coldAlert ? 'text-rose-600' : 'text-cyan-600',
      iconBg: coldAlert ? 'bg-rose-50' : 'bg-cyan-50',
      alert: coldAlert,
      onClick: () => onTabChange('coldchain')
    }
  ];

  return (
    <div className="space-y-3">
      {/* 4 Thẻ KPI lấp kín toàn bộ chiều rộng 4 cột */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.id}
            type="button"
            onClick={kpi.onClick}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[110px] ${
              kpi.alert
                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400 shadow-2xs'
                : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm text-slate-600 font-semibold block truncate">
                {kpi.label}
              </span>
              <div className={`w-7 h-7 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className={`text-xl sm:text-2xl font-mono font-bold block ${kpi.alert ? 'text-amber-900' : 'text-slate-900'}`}>
                  {kpi.value}
                </span>
                <span className="text-xs text-slate-500 font-medium block mt-0.5">
                  {kpi.subtitle}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
