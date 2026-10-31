import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, FileText, Thermometer, Wrench, CheckCircle2 } from 'lucide-react';
import type { DashboardTab, UserRole, AuditTrailRecord } from '../../types/clinical';
import type { DebtRecord, InventoryBatch } from '../../types/pharmacy';
import type { EquipmentTicket, ColdChainMonitorState, AssetAuditRecord } from '../../types/equipment';
import { filterOverviewActions } from './overviewModel';
import { canSearchMedications, canSearchPatients, normalizeLookupQuery } from './flatDashboardModel';

interface OperationsOverviewProps {
  currentUserRole: UserRole;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  coldChainState: ColdChainMonitorState;
  assets: AssetAuditRecord[];
  auditRecords: AuditTrailRecord[];
  allowedTabs: DashboardTab[];
  onTabChange: (tab: DashboardTab) => void;
  onOpenPatient: (query: string) => void;
  onOpenMedication: (query: string) => void;
}

type Tone = 'rose' | 'amber' | 'cyan' | 'blue' | 'emerald';
const toneClasses: Record<Tone, string> = {
  rose: 'border-rose-200 bg-rose-50 text-rose-900', amber: 'border-amber-200 bg-amber-50 text-amber-900',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900', blue: 'border-blue-200 bg-blue-50 text-blue-900', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export const OperationsOverview: React.FC<OperationsOverviewProps> = ({ currentUserRole, debts, tickets, batches, coldChainState, assets, auditRecords, allowedTabs, onTabChange, onOpenPatient, onOpenMedication }) => {
  const [patientQuery, setPatientQuery] = useState('');
  const [medicationQuery, setMedicationQuery] = useState('');
  const pendingDebts = debts.filter((item) => item.status === 'debt');
  const urgentTickets = tickets.filter((item) => item.urgency === 'urgent' && item.status !== 'resolved');
  const stockAlerts = batches.filter((item) => item.isNearExpiry || item.isLowStock || item.currentStock <= item.minThreshold);
  const misplacedAssets = assets.filter((item) => item.isMisallocated);
  const coldAlert = coldChainState.alarmActive || coldChainState.currentTemp < 2 || coldChainState.currentTemp > 8 || coldChainState.powerStatus === 'outage_critical';
  const roleLabels: Record<UserRole, string> = { nurse: 'điều dưỡng', doctor: 'bác sĩ', pharmacist: 'dược sĩ', biomedical_engineer: 'kỹ sư thiết bị', director: 'ban giám đốc' };
  const quickActionDefs: Array<{ tab: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { tab: 'cpoe', label: 'Kê đơn và rà soát DDI', icon: ClipboardList }, { tab: 'debt', label: 'Xử lý sổ nợ tủ trực', icon: FileText },
    { tab: 'fefo', label: 'Kiểm tra kho và FEFO', icon: Boxes }, { tab: 'equipment', label: 'Báo cáo sự cố thiết bị', icon: Wrench }, { tab: 'coldchain', label: 'Theo dõi chuỗi lạnh', icon: Thermometer },
  ];
  const quickActions = filterOverviewActions(quickActionDefs, allowedTabs);
  const priorities = [
    ...(coldAlert ? [{ tab: 'coldchain' as DashboardTab, tone: 'rose' as Tone, title: 'Cảnh báo chuỗi lạnh', detail: coldChainState.alarmMessage || ('Nhiệt độ hiện tại ' + coldChainState.currentTemp.toFixed(1) + '°C'), count: 1 }] : []),
    ...(urgentTickets.length ? [{ tab: 'equipment' as DashboardTab, tone: 'rose' as Tone, title: 'Sự cố thiết bị khẩn', detail: 'Cần kiểm tra và cập nhật trạng thái xử lý', count: urgentTickets.length }] : []),
    ...(pendingDebts.length ? [{ tab: 'debt' as DashboardTab, tone: 'amber' as Tone, title: 'Phiếu nợ chưa hoàn tất', detail: 'Theo dõi hoàn trả vỏ và hoàn bù thuốc', count: pendingDebts.length }] : []),
    ...(stockAlerts.length ? [{ tab: 'fefo' as DashboardTab, tone: 'amber' as Tone, title: 'Kho cần ưu tiên xử lý', detail: 'Lô cận hạn hoặc tồn dưới định mức', count: stockAlerts.length }] : []),
    ...(misplacedAssets.length && allowedTabs.includes('asset_audit') ? [{ tab: 'asset_audit' as DashboardTab, tone: 'blue' as Tone, title: 'Tài sản cần đối soát', detail: 'Thiết bị đang khác vị trí đăng ký', count: misplacedAssets.length }] : []),
  ].filter((item) => allowedTabs.includes(item.tab));
  const cards = [
    { label: 'Nợ tủ trực', value: pendingDebts.length, tab: 'debt' as DashboardTab, tone: pendingDebts.length ? 'amber' as Tone : 'emerald' as Tone },
    { label: 'Kho cần chú ý', value: stockAlerts.length, tab: 'fefo' as DashboardTab, tone: stockAlerts.length ? 'amber' as Tone : 'emerald' as Tone },
    { label: 'Sự cố khẩn', value: urgentTickets.length, tab: 'equipment' as DashboardTab, tone: urgentTickets.length ? 'rose' as Tone : 'emerald' as Tone },
    { label: 'Chuỗi lạnh', value: coldAlert ? 'CẢNH BÁO' : coldChainState.currentTemp.toFixed(1) + '°C', tab: 'coldchain' as DashboardTab, tone: coldAlert ? 'rose' as Tone : 'cyan' as Tone },
  ].filter((item) => allowedTabs.includes(item.tab));
  const canViewAudit = currentUserRole === 'pharmacist' || currentUserRole === 'director';
  const canViewAssets = allowedTabs.includes('asset_audit');

  const submitPatient = (event: React.FormEvent) => { event.preventDefault(); const query = normalizeLookupQuery(patientQuery); if (query) onOpenPatient(query); };
  const submitMedication = (event: React.FormEvent) => { event.preventDefault(); const query = normalizeLookupQuery(medicationQuery); if (query) onOpenMedication(query); };
  return <div className="h-full overflow-y-auto bg-slate-50 p-3 sm:p-5"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 border-b border-slate-300 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Trung tâm vận hành</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Tổng quan hôm nay</h1><p className="mt-1 text-sm text-slate-600">Chào {roleLabels[currentUserRole]}. Tra cứu trước, xử lý sau.</p></div><div className="border-l-2 border-slate-300 px-3 py-1 text-xs text-slate-500">Dữ liệu phiên thử nghiệm · trạng thái hiện tại của app</div></header>
    <section className="grid gap-4 border-b border-slate-300 pb-5 lg:grid-cols-2" aria-label="Tra cứu nhanh">
      {canSearchPatients(currentUserRole) && <form onSubmit={submitPatient} className="border-l-4 border-teal-600 bg-white p-4 shadow-sm"><label htmlFor="overview-patient-search" className="block text-sm font-semibold text-slate-900">Tra cứu bệnh nhân</label><p className="mt-1 text-xs text-slate-500">Mã bệnh nhân hoặc họ tên</p><div className="mt-3 flex gap-2"><input id="overview-patient-search" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Ví dụ: BN-8820 hoặc Nguyễn Văn An" className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" /><button type="submit" className="border border-teal-700 bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Mở hồ sơ</button></div></form>}
      {canSearchMedications(currentUserRole) && <form onSubmit={submitMedication} className="border-l-4 border-blue-600 bg-white p-4 shadow-sm"><label htmlFor="overview-medication-search" className="block text-sm font-semibold text-slate-900">Tra cứu thuốc</label><p className="mt-1 text-xs text-slate-500">Tên thuốc, hoạt chất hoặc số đăng ký</p><div className="mt-3 flex gap-2"><input id="overview-medication-search" value={medicationQuery} onChange={(event) => setMedicationQuery(event.target.value)} placeholder="Ví dụ: Ceftriaxon, Paracetamol" className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" /><button type="submit" className="border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Xem thông tin</button></div></form>}
    </section>
    {priorities.length > 0 ? <section aria-labelledby="priority-title" className="border-y border-slate-300 bg-white p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /><h2 id="priority-title" className="font-semibold text-slate-900">Việc cần chú ý</h2></div><div className="divide-y divide-slate-200 border-y border-slate-200">{priorities.map((item) => <button key={item.title} onClick={() => allowedTabs.includes(item.tab) && onTabChange(item.tab)} className={'flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50 ' + toneClasses[item.tone]}><span className="min-w-8 text-lg font-bold tabular-nums">{item.count}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span><span className="block truncate text-xs opacity-80">{item.detail}</span></span><ArrowRight className="h-4 w-4 shrink-0" /></button>)}</div></section> : <section className="flex items-center gap-3 border-y border-emerald-300 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="h-5 w-5" /><div><h2 className="font-semibold">Không có cảnh báo trong phạm vi vai trò này</h2><p className="text-xs opacity-80">Các trạng thái được hiển thị trong phiên hiện tại đang ở mức bình thường.</p></div></section>}
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map((card) => <button key={card.label} onClick={() => allowedTabs.includes(card.tab) && onTabChange(card.tab)} className={'border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ' + toneClasses[card.tone]}><span className="block text-xs font-medium opacity-75">{card.label}</span><span className="mt-2 block text-xl font-bold tabular-nums sm:text-2xl">{card.value}</span><span className="mt-1 flex items-center gap-1 text-xs opacity-75">Mở phân hệ <ArrowRight className="h-3 w-3" /></span></button>)}</section>
    <section className="border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-900">Thao tác nhanh</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map(({ tab, label, icon: Icon }) => <button key={tab} onClick={() => onTabChange(tab)} className="flex items-center gap-3 border border-slate-200 px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"><Icon className="h-5 w-5 text-teal-700" /><span className="flex-1">{label}</span><ArrowRight className="h-4 w-4 text-slate-400" /></button>)}</div></section>
    <section className="grid gap-3 md:grid-cols-2">{canViewAssets && <div className="border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Tài sản cần đối soát</p><p className="mt-1 text-xl font-bold text-slate-900">{misplacedAssets.length}</p></div>}{canViewAudit && <div className="border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Sổ kiểm toán gần đây</p><p className="mt-1 text-xl font-bold text-slate-900">{auditRecords.length} bản ghi trong phiên</p></div>}<div className="border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Nguồn dữ liệu</p><p className="mt-1 text-sm font-semibold text-slate-900">Trạng thái nội bộ và dữ liệu thử nghiệm</p><p className="mt-1 text-xs text-slate-500">Xác nhận lại trên từng phân hệ trước khi dùng cho quyết định lâm sàng.</p></div></section>
  </div></div>;
};
