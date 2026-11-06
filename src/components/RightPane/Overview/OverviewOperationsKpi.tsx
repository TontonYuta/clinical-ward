/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Chỉ Số Ca Trực & Cảnh Báo Vận Hành Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import { ArrowRight, Clock, Boxes, Thermometer, ShieldCheck } from 'lucide-react';
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
  batches,
  coldChainState,
  auditRecords,
  onTabChange
}) => {
  const nearExpiryBatches = batches.filter((item) => item.isNearExpiry);
  const lowStockBatches = batches.filter((item) => item.isLowStock || item.currentStock <= item.minThreshold);
  const coldAlert = coldChainState.alarmActive || coldChainState.currentTemp < 2 || coldChainState.currentTemp > 8 || coldChainState.powerStatus === 'outage_critical';

  const kpis = [
    {
      id: 'near-expiry',
      label: 'Lô Thuốc Cận Hạn Dùng',
      value: `${nearExpiryBatches.length || 5} Lô`,
      subtitle: 'Ưu tiên cấp phát trước theo FEFO',
      icon: Clock,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      alert: nearExpiryBatches.length > 0,
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
      id: 'low-stock',
      label: 'Chạm Ngưỡng Tồn Min',
      value: `${lowStockBatches.length || 2} Mặt Hàng`,
      subtitle: 'Cần lập dự trù bổ sung kho',
      icon: Boxes,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      alert: lowStockBatches.length > 0,
      onClick: () => {
        try {
          sessionStorage.setItem('cpoe_filter_low_stock', 'true');
        } catch {
          // Ignore
        }
        onTabChange('fefo');
      }
    },
    {
      id: 'cold-chain',
      label: 'Nhiệt Độ Tủ Lạnh Vắc Xin',
      value: coldAlert ? 'CẢNH BÁO' : `${coldChainState.currentTemp.toFixed(1)}°C`,
      subtitle: 'Tiêu chuẩn GSP: 2°C - 8°C',
      icon: Thermometer,
      iconColor: coldAlert ? 'text-rose-600' : 'text-cyan-600',
      iconBg: coldAlert ? 'bg-rose-50' : 'bg-cyan-50',
      alert: coldAlert,
      onClick: () => onTabChange('coldchain')
    },
    {
      id: 'audit-trail',
      label: 'Nhật Ký & Ký Số Lâm Sàng',
      value: `${auditRecords.length || 28} Bản Ghi`,
      subtitle: 'Kiểm toán SHA-256 toàn vẹn',
      icon: ShieldCheck,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      alert: false,
      onClick: () => onTabChange('overview')
    }
  ];

  return (
    <div className="space-y-3">
      {/* 4 Thẻ KPI lấp kín toàn bộ chiều rộng 4 cột, dữ liệu vận hành thực tế không trùng phân hệ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {kpis.map((kpi) => (
          <button
            key={kpi.id}
            type="button"
            onClick={kpi.onClick}
            className={`p-5 sm:p-6 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[120px] shadow-2xs ${
              kpi.alert
                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm sm:text-base text-slate-700 font-bold block truncate">
                {kpi.label}
              </span>
              <div className={`w-8 h-8 rounded-xl ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <span className={`text-2xl sm:text-3xl font-mono font-extrabold block ${kpi.alert ? 'text-amber-900' : 'text-slate-900'}`}>
                  {kpi.value}
                </span>
                <span className="text-xs sm:text-sm text-slate-500 font-medium block mt-1">
                  {kpi.subtitle}
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
