/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ sổ nợ vỏ thuốc
 */

import React from 'react';
import { Search, Flame, Printer, PlusCircle } from 'lucide-react';

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
  onOpenPrintForm,
  onOpenBorrowModal,
}) => {
  return (
    <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-lg border border-slate-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
      {/* Search & Status Filters */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm thuốc, bệnh nhân, buồng..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
          />
        </div>

        <div className="flex items-center gap-1 text-sm bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
              filterStatus === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('debt')}
            className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
              filterStatus === 'debt' ? 'bg-white text-amber-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Đang nợ ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('narcotics')}
            className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
              filterStatus === 'narcotics' ? 'bg-white text-rose-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Thuốc gây nghiện ({narcoticsCount})
            {pendingAmpoulesCount > 0 && (
              <span className="ml-1 text-xs font-bold text-rose-600">· {pendingAmpoulesCount} nợ vỏ</span>
            )}
          </button>
          <button
            onClick={() => setFilterStatus('settled')}
            className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
              filterStatus === 'settled' ? 'bg-white text-slate-800 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Đã hoàn bù ({settledCount})
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 shrink-0 justify-end">
        {returnedAmpoulesCount > 0 && (
          <button
            onClick={onOpenDestruction}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-semibold transition cursor-pointer"
            title="Hội đồng tiêu hủy vỏ ống thuốc gây nghiện TT 18/2026/TT-BYT"
          >
            <Flame className="w-4 h-4 text-rose-600" />
            <span>Hủy vỏ ({returnedAmpoulesCount})</span>
          </button>
        )}

        <button
          onClick={() => onOpenPrintForm?.('TT20_AMPOULE_DESTRUCTION')}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium transition cursor-pointer"
          title="In biểu mẫu hành chính A4"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline">In biểu mẫu</span>
        </button>

        <button
          onClick={onOpenBorrowModal}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold transition cursor-pointer active:scale-98"
          title="Lập phiếu mượn khẩn thuốc / vật tư (VBHN 07)"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Mượn Khẩn</span>
        </button>
      </div>
    </div>
  );
};
