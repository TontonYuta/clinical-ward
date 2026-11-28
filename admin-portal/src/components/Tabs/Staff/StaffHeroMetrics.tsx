import React from 'react';
import { Users, Stethoscope, HeartPulse, ShieldCheck } from 'lucide-react';
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
      {/* KPI 1: Tổng nhân sự */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng nhân sự</span>
          <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
          {total} <span className="text-sm font-normal text-slate-500 font-sans">nhân sự</span>
        </div>
      </div>

      {/* KPI 2: Bác sĩ điều trị */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bác sĩ lâm sàng</span>
          <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
          {doctorCount} <span className="text-sm font-normal text-slate-500 font-sans">bác sĩ</span>
        </div>
      </div>

      {/* KPI 3: Điều dưỡng & Dược sĩ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Điều dưỡng &amp; Dược</span>
          <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <HeartPulse className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-3 leading-none">
          {nurseCount + pharmacistCount} <span className="text-sm font-normal text-slate-500 font-sans">nhân sự</span>
        </div>
      </div>

      {/* KPI 4: Trạng thái công tác */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[126px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đang công tác</span>
          <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums leading-none">
            {activeCount} <span className="text-sm font-normal text-slate-500 font-sans">sẵn sàng</span>
          </div>
          {suspendedCount > 0 && (
            <span className="text-2xs font-medium text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
              {suspendedCount} tạm ngưng
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
