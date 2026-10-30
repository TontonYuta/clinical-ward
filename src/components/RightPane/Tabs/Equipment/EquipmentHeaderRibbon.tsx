/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ sự cố thiết bị y tế theo phong cách Kho Dược
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
    <div className="shrink-0 overflow-x-auto thin-scrollbar">
      <div className="flex min-w-max items-center gap-2 rounded-lg bg-white p-1">
        {/* Ô tìm kiếm thiết bị & sự cố */}
        <div className="relative w-[min(24rem,32vw)] min-w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên máy thở, sốc tim, số serial hoặc khoa phòng..."
            aria-label="Tìm sự cố thiết bị y tế"
            className="w-full min-h-11 pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-500 focus:bg-white text-slate-900 placeholder-slate-500 transition"
          />
        </div>

        {/* Dropdown bộ lọc trạng thái sự cố thiết bị */}
        <select
          aria-label="Trạng thái sự cố thiết bị"
          value={selectedUrgency}
          onChange={(e) => setSelectedUrgency(e.target.value)}
          className="min-h-11 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700 cursor-pointer"
        >
          <option value="all">Tất cả sự cố ({totalCount})</option>
          <option value="urgent">Khẩn cấp ({urgentCount})</option>
          <option value="in_progress">Đang sửa chữa ({inProgressCount})</option>
          <option value="resolved">Đã nghiệm thu ({resolvedCount})</option>
        </select>

        {/* Nút hành động chính: Báo hỏng thiết bị */}
        <button
          type="button"
          onClick={onOpenIncidentModal}
          className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer transition whitespace-nowrap shadow-xs"
          title="Lập phiếu báo hỏng sự cố trang thiết bị y tế"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Báo hỏng</span>
        </button>
      </div>
    </div>
  );
};
