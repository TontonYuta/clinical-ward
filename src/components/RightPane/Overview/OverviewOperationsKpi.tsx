/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Chỉ Số Giám Sát Vận Hành & Cảnh Báo Ca Trực (<=200 LOC)
 */

import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Thermometer, Wrench, Boxes, FileText, ClipboardList } from 'lucide-react';
import type { DashboardTab, UserRole, AuditTrailRecord } from '../../../types/clinical';
import type { DebtRecord, InventoryBatch } from '../../../types/pharmacy';
import type { EquipmentTicket, ColdChainMonitorState, AssetAuditRecord } from '../../../types/equipment';
import { filterOverviewActions } from '../overviewModel';

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
  const misplacedAssets = assets.filter((item) => item.isMisallocated);
  const coldAlert = coldChainState.alarmActive || coldChainState.currentTemp < 2 || coldChainState.currentTemp > 8 || coldChainState.powerStatus === 'outage_critical';

  const quickActionDefs: Array<{ tab: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { tab: 'cpoe', label: 'Kê đơn & rà soát DDI', icon: ClipboardList },
    { tab: 'debt', label: 'Xử lý sổ nợ tủ trực', icon: FileText },
    { tab: 'fefo', label: 'Kiểm tra kho & FEFO', icon: Boxes },
    { tab: 'equipment', label: 'Báo sự cố thiết bị', icon: Wrench },
    { tab: 'coldchain', label: 'Theo dõi chuỗi lạnh', icon: Thermometer },
  ];
  const quickActions = filterOverviewActions(quickActionDefs, allowedTabs);

  const priorities = [
    ...(coldAlert ? [{ tab: 'coldchain' as DashboardTab, title: 'Cảnh báo chuỗi lạnh vắc xin', detail: coldChainState.alarmMessage || `Nhiệt độ hiện tại ${coldChainState.currentTemp.toFixed(1)}°C`, count: 1 }] : []),
    ...(urgentTickets.length ? [{ tab: 'equipment' as DashboardTab, title: 'Sự cố thiết bị khẩn cấp', detail: 'Cần kỹ sư thiết bị y tế kiểm tra xử lý', count: urgentTickets.length }] : []),
    ...(pendingDebts.length ? [{ tab: 'debt' as DashboardTab, title: 'Phiếu nợ tủ trực chưa bù', detail: 'Theo dõi hoàn trả vỏ ống rỗng và cơ số', count: pendingDebts.length }] : []),
    ...(stockAlerts.length ? [{ tab: 'fefo' as DashboardTab, title: 'Lô thuốc cận hạn / Chạm Min', detail: 'Cần ưu tiên cấp phát FEFO hoặc lập dự trù', count: stockAlerts.length }] : []),
    ...(misplacedAssets.length && allowedTabs.includes('asset_audit') ? [{ tab: 'asset_audit' as DashboardTab, title: 'Tài sản lệch vị trí kiểm kê', detail: 'Thiết bị đang khác khoa phòng đăng ký', count: misplacedAssets.length }] : []),
  ].filter((item) => allowedTabs.includes(item.tab));

  const kpis = [
    { label: 'Nợ Tủ Trực Buồng Bệnh', value: pendingDebts.length, sub: 'phiếu nợ cần bù', tab: 'debt' as DashboardTab, alert: pendingDebts.length > 0 },
    { label: 'Thuốc Cận Hạn & Chạm Min', value: stockAlerts.length, sub: 'lô cần ưu tiên FEFO', tab: 'fefo' as DashboardTab, alert: stockAlerts.length > 0 },
    { label: 'Sự Cố Thiết Bị Y Tế Khẩn', value: urgentTickets.length, sub: 'phiếu đang mở', tab: 'equipment' as DashboardTab, alert: urgentTickets.length > 0 },
    { label: 'Nhiệt Độ Chuỗi Lạnh', value: coldAlert ? 'CẢNH BÁO' : `${coldChainState.currentTemp.toFixed(1)}°C`, sub: 'chuẩn GSP 2°C - 8°C', tab: 'coldchain' as DashboardTab, alert: coldAlert },
  ].filter((item) => allowedTabs.includes(item.tab));

  return (
    <div className="space-y-4">
      {/* 1. Việc cần chú ý khẩn (Priorities) */}
      {priorities.length > 0 ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Việc Cần Ưu Tiên Xử Lý Trong Ca Trực ({priorities.length} Mục)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {priorities.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onTabChange(item.tab)}
                className="p-3 rounded-xl border border-rose-100 bg-rose-50/60 hover:bg-rose-100/70 text-left transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-rose-600 text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
                    {item.count}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-rose-950 truncate">{item.title}</div>
                    <div className="text-2xs text-rose-800 truncate opacity-90">{item.detail}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-600 group-hover:translate-x-0.5 transition shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-4 flex items-center gap-3 text-emerald-900">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Ca trực bình thường, không ghi nhận cảnh báo nguy cấp.</span>
            <span className="text-emerald-700 ml-1.5">Tất cả thông số cơ số tủ trực và chuỗi lạnh đang trong giới hạn an toàn.</span>
          </div>
        </div>
      )}

      {/* 2. Thẻ KPI Vận Hành */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onTabChange(kpi.tab)}
            className={`p-3.5 sm:p-4 rounded-2xl border text-left transition shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between ${
              kpi.alert ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300' : 'bg-white border-slate-200 hover:border-teal-300'
            }`}
          >
            <div>
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
                {kpi.label}
              </span>
              <span className={`text-xl sm:text-2xl font-mono font-bold mt-1.5 block ${kpi.alert ? 'text-amber-900' : 'text-slate-900'}`}>
                {kpi.value}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-2xs">
              <span className="text-slate-500 truncate">{kpi.sub}</span>
              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* 3. Thao tác nhanh (Quick Actions) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Phím Điều Hướng Nhanh Đến Phân Hệ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {quickActions.map(({ tab, label, icon: Icon }) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left text-xs font-semibold text-slate-800 hover:text-teal-950 transition cursor-pointer flex items-center gap-2 group shadow-2xs"
            >
              <Icon className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="truncate flex-1">{label}</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
