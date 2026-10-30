/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ sổ nợ vỏ thuốc
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
    <div className="bg-white p-2 sm:px-3 sm:py-2 rounded-lg border border-slate-200 shrink-0 flex items-center gap-2 overflow-x-auto">
      {/* Search & Status Filters */}
      <div className="flex items-center gap-2 flex-1 min-w-0 flex-nowrap">
        <div className="relative w-72 min-w-56 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên thuốc, người bệnh, buồng bệnh..."
            aria-label="Tìm trong sổ theo dõi nợ"
            className="w-full min-h-10 pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
          />
        </div>

        <div role="group" aria-label="Lọc trạng thái phiếu" className="flex items-center gap-1 text-sm border border-slate-200 p-1 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setFilterStatus('all')}
            aria-pressed={filterStatus === 'all'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              filterStatus === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('debt')}
            aria-pressed={filterStatus === 'debt'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              filterStatus === 'debt' ? 'bg-white text-amber-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Đang nợ ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('narcotics')}
            aria-pressed={filterStatus === 'narcotics'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              filterStatus === 'narcotics' ? 'bg-white text-rose-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Gây nghiện ({narcoticsCount})
            {pendingAmpoulesCount > 0 && (
              <span className="ml-1 text-xs font-bold text-rose-600">· {pendingAmpoulesCount} nợ vỏ</span>
            )}
          </button>
          <button
            onClick={() => setFilterStatus('settled')}
            aria-pressed={filterStatus === 'settled'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              filterStatus === 'settled' ? 'bg-white text-slate-800 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Đã bù ({settledCount})
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 shrink-0 justify-end">
        {returnedAmpoulesCount > 0 && (
          <button
            onClick={onOpenDestruction}
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            title="Tiêu hủy vỏ ống thuốc gây nghiện"
          >
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Hủy vỏ ({returnedAmpoulesCount})</span>
          </button>
        )}

        <button
          onClick={onOpenBorrowModal}
          className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-[0.98] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          title="Lập phiếu mượn khẩn thuốc / vật tư"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Mượn thuốc</span>
        </button>
      </div>
    </div>
  );
};
