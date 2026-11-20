import React from 'react';
import { Users, Stethoscope, Pill, ShieldCheck } from 'lucide-react';
import { StaffItem } from '../../../types/staff';

interface StaffHeroMetricsProps {
  total: number;
  activeCount: number;
  suspendedCount: number;
  items: StaffItem[];
}

export const StaffHeroMetrics: React.FC<StaffHeroMetricsProps> = ({
  total,
  activeCount,
  suspendedCount,
  items,
}) => {
  const doctorCount = items.filter((u) => u.role === 'doctor').length;
  const nurseCount = items.filter((u) => u.role === 'nurse').length;
  const pharmacistCount = items.filter((u) => u.role === 'pharmacist').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-4">
      {/* KPI 1: Tổng nhân sự */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng nhân sự bệnh viện</span>
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
          {total} <span className="text-sm font-medium text-slate-400 font-sans">nhân sự</span>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between pt-0.5 border-t border-slate-100">
          <span>Lưu trữ CSDL thực tế</span>
          <span className="text-2xs font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-semibold">
            SQLite Users
          </span>
        </div>
      </div>

      {/* KPI 2: Bác sĩ điều trị */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bác sĩ &amp; Lâm sàng</span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Stethoscope className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-blue-700 tracking-tight font-mono tabular-nums">
          {doctorCount} <span className="text-sm font-medium text-slate-400 font-sans">bác sĩ</span>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between pt-0.5 border-t border-slate-100">
          <span>Phân quyền kê đơn CPOE</span>
          <span className="text-2xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
            Ký số y tế
          </span>
        </div>
      </div>

      {/* KPI 3: Điều dưỡng & Dược sĩ */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Điều dưỡng &amp; Dược sĩ</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Pill className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
          {nurseCount + pharmacistCount} <span className="text-sm font-medium text-slate-400 font-sans">nhân sự</span>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between pt-0.5 border-t border-slate-100">
          <span>{nurseCount} ĐD · {pharmacistCount} Dược sĩ</span>
          <span className="text-2xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
            Kho &amp; Tủ trực
          </span>
        </div>
      </div>

      {/* KPI 4: Trạng thái công tác */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái công tác</span>
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-emerald-700 tracking-tight font-mono tabular-nums">
          {activeCount} <span className="text-sm font-medium text-slate-400 font-sans">sẵn sàng trực</span>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between pt-0.5 border-t border-slate-100">
          <span>{suspendedCount} tạm ngưng</span>
          <span className="text-2xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
            {total > 0 ? ((activeCount / total) * 100).toFixed(0) : 100}% hoạt động
          </span>
        </div>
      </div>
    </div>
  );
};
