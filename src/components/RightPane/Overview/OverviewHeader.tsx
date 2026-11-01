/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header Tối Giản Trạm Làm Việc Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import type { UserRole } from '../../../types/clinical';

interface OverviewHeaderProps {
  currentUserRole: UserRole;
  roleTitle: string;
  onOpenCopilot?: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  roleTitle,
  onOpenCopilot
}) => {
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          Tổng Quan Trạm Làm Việc Hôm Nay
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {roleTitle} · {dateStr}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCopilot}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white transition cursor-pointer shadow-2xs"
          title="Mở trợ lý AI lâm sàng"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Trợ Lý Lâm Sàng Y Khoa Thông Minh</span>
        </button>
      </div>
    </div>
  );
};
