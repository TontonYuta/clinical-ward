/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ sổ nợ vỏ thuốc theo phong cách Kho Dược
 */

import React from 'react';
import { Search, Flame, PlusCircle } from 'lucide-react';

interface DebtHeaderRibbonProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: 'all' | 'debt' | 'settled' | 'narcotics';
  setFilterStatus: (f: 'all' | 'debt' | 'settled' | 'narcotics') => void;
  totalCount: number;
  activeCount: number;
  narcoticsCount: number;
  pendingAmpoulesCount: number;
  settledCount: number;
  returnedAmpoulesCount: number;
  onOpenDestruction: () => void;
  onOpenPrintForm?: (formType: 'TT20_AMPOULE_DESTRUCTION') => void;
  onOpenBorrowModal: () => void;
}

export const DebtHeaderRibbon: React.FC<DebtHeaderRibbonProps> = ({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  totalCount,
  activeCount,
  narcoticsCount,
  pendingAmpoulesCount,
  settledCount,
  returnedAmpoulesCount,
  onOpenDestruction,
  onOpenBorrowModal,
}) => {
  return (
    <div className="shrink-0 overflow-x-auto thin-scrollbar">
      <div className="flex min-w-max items-center gap-2 rounded-lg bg-white p-1">
        {/* Ô tìm kiếm thông tin thuốc & người bệnh */}
        <div className="relative w-[min(24rem,32vw)] min-w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên thuốc, người bệnh, buồng bệnh hoặc mã phiếu..."
            aria-label="Tìm trong sổ theo dõi nợ"
            className="w-full min-h-11 pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-500 focus:bg-white text-slate-900 placeholder-slate-500 transition"
          />
        </div>

        {/* Bộ lọc trạng thái nợ & vỏ thuốc */}
        <select
          aria-label="Trạng thái sổ nợ"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="min-h-11 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700 cursor-pointer"
        >
          <option value="all">Tất cả phiếu ({totalCount})</option>
          <option value="debt">Đang nợ ({activeCount})</option>
          <option value="narcotics">
            Thuốc gây nghiện ({narcoticsCount}){pendingAmpoulesCount > 0 ? ` · ${pendingAmpoulesCount} nợ vỏ` : ''}
          </option>
          <option value="settled">Đã hoàn bù ({settledCount})</option>
        </select>

        {/* Nút hành động: Tiêu hủy vỏ ống (nếu có vỏ đã nộp) */}
        {returnedAmpoulesCount > 0 && (
          <button
            type="button"
            onClick={onOpenDestruction}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer transition whitespace-nowrap"
            title="Biên bản hội đồng tiêu hủy vỏ ống thuốc gây nghiện (TT 20/2017/TT-BYT)"
          >
            <Flame className="w-4 h-4 text-rose-600" />
            <span>Hủy vỏ ({returnedAmpoulesCount})</span>
          </button>
        )}

        {/* Nút hành động chính: Mượn thuốc khẩn cấp */}
        <button
          type="button"
          onClick={onOpenBorrowModal}
          className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer transition whitespace-nowrap shadow-xs"
          title="Lập phiếu mượn khẩn thuốc / vật tư tủ trực cấp cứu"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Mượn thuốc</span>
        </button>
      </div>
    </div>
  );
};
