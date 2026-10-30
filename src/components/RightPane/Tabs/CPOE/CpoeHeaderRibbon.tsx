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
    <div className="shrink-0 overflow-x-auto thin-scrollbar">
      <div className="flex min-w-max items-center gap-2 rounded-lg bg-white p-1">
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

        {/* Nút hành động: Tra cứu Dược Thư & Hướng dẫn an toàn */}
        {onOpenSafetyGuide && (
          <button
            type="button"
            onClick={() => onOpenSafetyGuide()}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer transition whitespace-nowrap"
            title="Tra cứu chuyên luận Dược Thư Quốc Gia 2015/2022 & Cảnh báo an toàn"
          >
            <Stethoscope className="w-4 h-4 text-slate-600" />
            <span>Thông tin thuốc</span>
          </button>
        )}

        {/* Nút hành động chính: Kê đơn mới */}
        {canPrescribe ? (
          <button
            type="button"
            onClick={onOpenNewPrescription}
            className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer transition whitespace-nowrap shadow-xs"
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
  );
};
