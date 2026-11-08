/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ kê đơn điện tử CPOE theo phong cách Kho Dược
 */

import React from 'react';
import { Search, X, Stethoscope, Plus, ShieldAlert } from 'lucide-react';

interface CpoeHeaderRibbonProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterType: 'all' | 'outpatient' | 'inpatient_daily';
  setFilterType: (f: 'all' | 'outpatient' | 'inpatient_daily') => void;
  totalCount: number;
  outpatientCount: number;
  inpatientCount: number;
  canPrescribe: boolean;
  roleName: string;
  onOpenSafetyGuide?: (medName?: string) => void;
  onOpenNewPrescription: () => void;
}

export const CpoeHeaderRibbon: React.FC<CpoeHeaderRibbonProps> = ({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  totalCount,
  outpatientCount,
  inpatientCount,
  canPrescribe,
  roleName,
  onOpenSafetyGuide,
  onOpenNewPrescription,
}) => {
  return (
    <div className="shrink-0 bg-white border-b border-slate-200 rounded-lg">
      {/* Mobile View (< md): 2-row compact layout without horizontal scroll */}
      <div className="flex md:hidden flex-col gap-1.5 p-2">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã đơn, tên BN, thuốc..."
            aria-label="Tìm đơn thuốc điện tử"
            className="w-full h-8 pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 w-full">
          <select
            aria-label="Phân loại đơn thuốc"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="flex-1 h-8 bg-slate-50 border border-slate-300 rounded-md px-2 text-2xs text-slate-700 font-medium"
          >
            <option value="all">Tất cả ({totalCount})</option>
            <option value="inpatient_daily">Nội trú ({inpatientCount})</option>
            <option value="outpatient">Ngoại trú ({outpatientCount})</option>
          </select>
          {canPrescribe && (
            <button
              type="button"
              onClick={onOpenNewPrescription}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-2xs font-semibold shrink-0 cursor-pointer shadow-xs transition active:scale-98"
            >
              <Plus className="w-3 h-3" />
              <span>Kê đơn</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop View (>= md): 100% UNCHANGED */}
      <div className="hidden md:block overflow-x-auto thin-scrollbar">
        <div className="flex min-w-max items-center gap-2 p-1">
          {/* Ô tìm kiếm đơn thuốc CPOE */}
          <div className="relative w-[min(26rem,34vw)] min-w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã đơn, tên BN, CCCD, chẩn đoán, thuốc..."
              aria-label="Tìm đơn thuốc điện tử"
              className="w-full min-h-11 pl-10 pr-8 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-500 focus:bg-white text-slate-900 placeholder-slate-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown phân loại đơn thuốc */}
          <select
            aria-label="Phân loại đơn thuốc"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="min-h-11 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả đơn thuốc ({totalCount})</option>
            <option value="inpatient_daily">Đơn nội trú theo ngày ({inpatientCount})</option>
            <option value="outpatient">Đơn ngoại trú xuất viện ({outpatientCount})</option>
          </select>

          {/* Nút hành động chính: Kê đơn mới */}
          {canPrescribe ? (
            <button
              type="button"
              onClick={onOpenNewPrescription}
              className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold cursor-pointer transition whitespace-nowrap shadow-xs active:scale-98"
              title="Kê đơn thuốc điện tử mới (TT 26/2025/TT-BYT)"
            >
              <Plus className="w-4 h-4" />
              <span>Kê đơn mới</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 min-h-11 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200 select-none">
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Xem ({roleName})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
