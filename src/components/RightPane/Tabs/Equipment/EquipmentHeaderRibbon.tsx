/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ sự cố thiết bị y tế
 */

import React from 'react';
import { Search, PlusCircle } from 'lucide-react';

interface EquipmentHeaderRibbonProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedUrgency: string;
  setSelectedUrgency: (u: string) => void;
  totalCount: number;
  urgentCount: number;
  inProgressCount: number;
  resolvedCount: number;
  onOpenPrintForm?: (formType: 'EQUIPMENT_HANDOVER_INSPECT') => void;
  onOpenIncidentModal: () => void;
}

export const EquipmentHeaderRibbon: React.FC<EquipmentHeaderRibbonProps> = ({
  searchQuery,
  setSearchQuery,
  selectedUrgency,
  setSelectedUrgency,
  totalCount,
  urgentCount,
  inProgressCount,
  resolvedCount,
  onOpenIncidentModal,
}) => {
  return (
    <div className="bg-white p-2 sm:px-3 sm:py-2 rounded-lg border border-slate-200/80 shrink-0 flex items-center gap-2 shadow-sm overflow-x-auto">
      {/* Search & Filter pills */}
      <div className="flex items-center gap-2 flex-1 min-w-0 flex-nowrap">
        <div className="relative w-72 min-w-56 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm máy thở, sốc tim, serial..."
            aria-label="Tìm sự cố thiết bị y tế"
            className="w-full min-h-10 pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
          />
        </div>

        <div role="group" aria-label="Lọc trạng thái sự cố" className="flex items-center gap-1 text-sm bg-slate-100/80 p-1 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setSelectedUrgency('all')}
            aria-pressed={selectedUrgency === 'all'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              selectedUrgency === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setSelectedUrgency('urgent')}
            aria-pressed={selectedUrgency === 'urgent'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              selectedUrgency === 'urgent' ? 'bg-white text-rose-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Khẩn cấp ({urgentCount})
          </button>
          <button
            onClick={() => setSelectedUrgency('in_progress')}
            aria-pressed={selectedUrgency === 'in_progress'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              selectedUrgency === 'in_progress' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Đang sửa ({inProgressCount})
          </button>
          <button
            onClick={() => setSelectedUrgency('resolved')}
            aria-pressed={selectedUrgency === 'resolved'}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              selectedUrgency === 'resolved' ? 'bg-white text-emerald-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Đã sửa ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 shrink-0 justify-end">
        <button
          onClick={onOpenIncidentModal}
          className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-[0.98] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
          title="Lập phiếu báo hỏng sự cố thiết bị"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Báo hỏng</span>
        </button>
      </div>
    </div>
  );
};
