/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header & Trợ Lý AI Lâm Sàng Nổi Bật (<=200 LOC)
 */

import React from 'react';
import { Bot, Sparkles, ArrowRight } from 'lucide-react';
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
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* 1. Header trạm làm việc với typography rộng rãi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
            Tổng quan trạm làm việc
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1 capitalize">
            {roleTitle} · {dateStr}
          </p>
        </div>
      </div>

      {/* 2. Banner Trợ lý AI nổi bật trung tâm */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenCopilot}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenCopilot?.();
          }
        }}
        className="cursor-pointer rounded-2xl bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 p-4 sm:p-5 text-white shadow-md hover:shadow-lg transition border border-teal-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0 group-hover:scale-105 transition">
            <Bot className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Trợ lý AI Lâm Sàng Y Khoa
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-500/30 text-teal-200 border border-teal-400/30 rounded-full">
                Sẵn sàng hỗ trợ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              Hỏi đáp dược thư, tra cứu tương tác thuốc &amp; hỗ trợ an toàn kê đơn
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCopilot?.();
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow transition cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>Mở Trợ lý AI (⌘K)</span>
          <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-0.5 transition" />
        </button>
      </div>
    </div>
  );
};
