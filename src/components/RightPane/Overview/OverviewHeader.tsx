/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header Tối Giản Trạm Làm Việc Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import type { UserRole } from '../../../types/clinical';

interface OverviewHeaderProps {
  currentUserRole: UserRole;
  roleTitle: string;
  onOpenCopilot?: () => void;
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          Tổng quan trạm làm việc
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1 capitalize">
          {roleTitle} · {dateStr}
        </p>
      </div>
    </div>
  );
};
