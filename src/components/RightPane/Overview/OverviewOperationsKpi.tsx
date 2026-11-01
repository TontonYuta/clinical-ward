/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Chỉ Số Ca Trực & Phím Điều Hướng Tối Giản (<=200 LOC)
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
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
  onTabChange
}) => {
  const pendingDebts = debts.filter((item) => item.status === 'debt');
  const urgentTickets = tickets.filter((item) => item.urgency === 'urgent' && item.status !== 'resolved');
  const stockAlerts = batches.filter((item) => item.isNearExpiry || item.isLowStock || item.currentStock <= item.minThreshold);
  const coldAlert = coldChainState.alarmActive || coldChainState.currentTemp < 2 || coldChainState.currentTemp > 8 || coldChainState.powerStatus === 'outage_critical';

  const kpis = [
    { label: 'Nợ Tủ Trực', value: pendingDebts.length, tab: 'debt' as DashboardTab, alert: pendingDebts.length > 0 },
    { label: 'Cận Hạn & Chạm Min', value: stockAlerts.length, tab: 'fefo' as DashboardTab, alert: stockAlerts.length > 0 },
    { label: 'Sự Cố Thiết Bị Khẩn', value: urgentTickets.length, tab: 'equipment' as DashboardTab, alert: urgentTickets.length > 0 },
    { label: 'Chuỗi Lạnh Vắc Xin', value: coldAlert ? 'CẢNH BÁO' : `${coldChainState.currentTemp.toFixed(1)}°C`, tab: 'coldchain' as DashboardTab, alert: coldAlert },
  ].filter((item) => allowedTabs.includes(item.tab));

  return (
    <div className="space-y-3">
      {/* 1. Thẻ KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onTabChange(kpi.tab)}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              kpi.alert ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div>
              <span className="text-2xs text-slate-500 font-medium block">
                {kpi.label}
              </span>
              <span className={`text-lg font-mono font-bold mt-0.5 block ${kpi.alert ? 'text-amber-900' : 'text-slate-900'}`}>
                {kpi.value}
              </span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
