/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Header và Thanh Thông Điệp Chỉ Huy Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import { Bot, Sparkles, Clock, ShieldCheck, Stethoscope } from 'lucide-react';
import type { UserRole } from '../../../types/clinical';

interface OverviewHeaderProps {
  currentUserRole: UserRole;
  roleTitle: string;
  onOpenCopilot?: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  currentUserRole,
  roleTitle,
  onOpenCopilot
}) => {
  const currentDateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* 1. Tiêu đề trạm làm việc & Thông tin ca trực */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200">
              <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
              <span>TRUNG TÂM VẬN HÀNH LÂM SÀNG &amp; AN TOÀN DƯỢC</span>
            </span>
            <span className="text-2xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Chuẩn TT 26/2025 · QĐ 5948 · Dược Thư QG
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
            Tổng Quan Trạm Làm Việc Hôm Nay
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Chào mừng <strong className="text-slate-900 font-semibold">{roleTitle}</strong>. Dữ liệu chuẩn hóa theo chứng cứ y khoa thực nghiệm và căn cứ pháp luật Y tế Việt Nam.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-slate-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
          <Clock className="w-4 h-4 text-teal-700" />
          <span className="capitalize">{currentDateStr}</span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-emerald-800 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Hệ thống sẵn sàng
          </span>
        </div>
      </div>

      {/* 2. Banner Trợ lý AI Lâm Sàng Grounded Copilot */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-sm border border-teal-700/40 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-44 h-44 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 shrink-0 text-teal-300">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  Trợ Lý Lâm Sàng Y Khoa Thông Minh (Physician Grounded Copilot)
                </span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-300/30">
                  Grounding 100% Dược Thư
                </span>
              </div>
              <p className="text-xs sm:text-sm text-teal-100/90 leading-relaxed">
                Hỗ trợ tra cứu nhanh liều dùng, đối soát tương tác thuốc chống chỉ định (QĐ 5948), phác đồ xử trí phản vệ Adrenalin (TT 51), tư vấn dùng thuốc theo mức lọc cầu thận eGFR và lập y lệnh điều trị an toàn.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 pt-1 md:pt-0">
            <button
              type="button"
              onClick={onOpenCopilot}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-teal-400 hover:bg-teal-300 text-teal-950 transition cursor-pointer shadow-xs active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-teal-950" />
              <span>Hỏi Trợ Lý AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
