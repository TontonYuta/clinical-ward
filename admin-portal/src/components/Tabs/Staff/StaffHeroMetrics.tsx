import React from 'react';
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
    <div className="bg-white border border-slate-200/90 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* KPI 1: Tổng nhân sự */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Tổng nhân sự</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {total} <span className="text-xs font-normal text-slate-400 font-sans">nhân sự</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-slate-400">
          SQLite
        </span>
      </div>

      {/* KPI 2: Bác sĩ điều trị */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Bác sĩ lâm sàng</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {doctorCount} <span className="text-xs font-normal text-slate-400 font-sans">bác sĩ</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-slate-400">
          Kê đơn CPOE
        </span>
      </div>

      {/* KPI 3: Điều dưỡng & Dược sĩ */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Điều dưỡng &amp; Dược</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {nurseCount + pharmacistCount} <span className="text-xs font-normal text-slate-400 font-sans">nhân sự</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-slate-400">
          {nurseCount} ĐD · {pharmacistCount} DS
        </span>
      </div>

      {/* KPI 4: Trạng thái công tác */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Đang công tác</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {activeCount} <span className="text-xs font-normal text-slate-400 font-sans">sẵn sàng</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-slate-400">
          {suspendedCount > 0 ? `${suspendedCount} tạm ngưng` : '100% hoạt động'}
        </span>
      </div>
    </div>
  );
};
