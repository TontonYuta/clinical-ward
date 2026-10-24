/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển kiểm kê tài sản & đối soát QR theo NĐ 151 (<=200 LOC)
 */

import React from 'react';
import { Search, QrCode, Printer } from 'lucide-react';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface AssetAuditHeaderRibbonProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterMode: 'all' | 'misallocated' | 'liquidation';
  setFilterMode: (m: 'all' | 'misallocated' | 'liquidation') => void;
  totalCount: number;
  misallocatedCount: number;
  liquidationCount: number;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  onScanClick: () => void;
}

export const AssetAuditHeaderRibbon: React.FC<AssetAuditHeaderRibbonProps> = ({
  searchQuery,
  setSearchQuery,
  filterMode,
  setFilterMode,
  totalCount,
  misallocatedCount,
  liquidationCount,
  onOpenPrintForm,
  onScanClick,
}) => {
  return (
    <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-lg border border-slate-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
      {/* Left: Search Input & Status Filter Pills */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã tài sản, tên máy, khoa..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
          />
        </div>

        <div className="flex items-center gap-1 text-sm bg-slate-100 p-1 rounded-md overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setFilterMode('misallocated')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 ${
              filterMode === 'misallocated'
                ? 'bg-white text-amber-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Lệch khoa ({misallocatedCount})
          </button>
          <button
            onClick={() => setFilterMode('liquidation')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm transition cursor-pointer shrink-0 ${
              filterMode === 'liquidation'
                ? 'bg-white text-rose-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Kiến nghị thanh lý ({liquidationCount})
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0 justify-end">
        <button
          onClick={() => onOpenPrintForm?.('TSC_ANNUAL_AUDIT')}
          className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-medium transition cursor-pointer"
          title="In Biên bản kiểm kê định kỳ Mẫu 05-TSC"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">Mẫu 05</span>
        </button>

        <button
          onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER')}
          className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-medium transition cursor-pointer"
          title="In Biên bản bàn giao, điều chuyển tài sản Mẫu 01/TSC"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">Mẫu 01</span>
        </button>

        <button
          onClick={onScanClick}
          className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition shrink-0 cursor-pointer active:scale-98 shadow-xs"
          title="Mô phỏng máy đọc mã vạch QR kiểm đếm máy thở tại buồng bệnh"
        >
          <QrCode className="w-3.5 h-3.5 text-teal-400" />
          <span>Quét QR đối soát</span>
        </button>
      </div>
    </div>
  );
};
