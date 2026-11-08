/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header Tối Giản Trạm Làm Việc Lâm Sàng (<=200 LOC)
 */

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { UserRole } from '../../../types/clinical';

interface OverviewHeaderProps {
  currentUserRole: UserRole;
  roleTitle: string;
  onOpenCopilot?: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  roleTitle
}) => {
  const [currentTime, setCurrentTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh'
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          Tổng quan - {roleTitle}
        </h1>
        <div className="text-sm sm:text-base text-slate-600 mt-1 flex flex-wrap items-center gap-2">
          <span className="capitalize">{dateStr}</span>
          <span className="text-slate-300">·</span>
          <span data-testid="live-clock" className="inline-flex items-center gap-1.5 font-mono font-semibold text-teal-800 bg-teal-50/90 px-2.5 py-0.5 rounded-md border border-teal-200/60 text-xs sm:text-sm shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
            {currentTime}
          </span>
        </div>
      </div>
    </div>
  );
};
