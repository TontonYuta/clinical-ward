/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header Tối Giản Trạm Làm Việc Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import type { UserRole } from '../../../types/clinical';

interface OverviewHeaderProps {
  currentUserRole: UserRole;
  roleTitle: string;
  onOpenCopilot?: () => void;
  onOpenCpoe?: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  roleTitle,
  onOpenCopilot,
  onOpenCpoe
}) => {
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          Tổng quan trạm làm việc
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1 capitalize">
          {roleTitle} · {dateStr}
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl transition shadow-2xs cursor-pointer active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>Trợ lý CDSS</span>
          </button>
        )}

        {onOpenCpoe && (
          <button
            type="button"
            onClick={onOpenCpoe}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer active:scale-98"
          >
            <FileText className="w-4 h-4" />
            <span>Mở Kê Đơn CPOE</span>
          </button>
        )}
      </div>
    </div>
  );
};
