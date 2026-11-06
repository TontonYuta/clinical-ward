/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header Tối Giản Trạm Làm Việc Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import { Activity } from 'lucide-react';
import type { UserRole } from '../../../types/clinical';

interface OverviewHeaderProps {
  currentUserRole: UserRole;
  roleTitle: string;
  onOpenCopilot?: () => void;
  onOpenCpoe?: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  roleTitle
}) => {
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          Tổng quan trạm làm việc
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-1.5 capitalize font-medium">
          {roleTitle} · {dateStr}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-sm font-semibold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Ca trực sẵn sàng · Trạm cấp cứu A9</span>
        </div>
      </div>
    </div>
  );
};
