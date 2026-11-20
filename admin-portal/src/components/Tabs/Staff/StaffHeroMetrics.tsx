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
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Tổng nhân sự</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {total} <span className="text-xs font-normal text-slate-400 font-sans">nhân sự</span>
        </div>
      </div>

      {/* KPI 2: Bác sĩ điều trị */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Bác sĩ lâm sàng</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {doctorCount} <span className="text-xs font-normal text-slate-400 font-sans">bác sĩ</span>
        </div>
      </div>

      {/* KPI 3: Điều dưỡng & Dược sĩ */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Điều dưỡng &amp; Dược</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {nurseCount + pharmacistCount} <span className="text-xs font-normal text-slate-400 font-sans">nhân sự</span>
        </div>
      </div>

      {/* KPI 4: Trạng thái công tác */}
      <div className="p-3.5 sm:px-5 sm:py-4">
        <div className="text-2xs font-medium text-slate-400 uppercase tracking-wider">Đang công tác</div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {activeCount} <span className="text-xs font-normal text-slate-400 font-sans">sẵn sàng</span>
        </div>
      </div>
    </div>
  );
};
