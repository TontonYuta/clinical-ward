/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc kho, phân loại thuốc/vật tư và hành động nhanh
 */

import React from 'react';
import { Search, Printer, PackagePlus, Building2, Store } from 'lucide-react';

export type WarehouseFilter = 'all' | 'inpatient' | 'outpatient';
export type CommodityFilter = 'all' | 'medication' | 'medical_supply';
export type StatusFilter = 'all' | 'near_expiry' | 'low_stock';

interface PharmacyHeaderRibbonProps {
  warehouse: WarehouseFilter;
  setWarehouse: (w: WarehouseFilter) => void;
  commodity: CommodityFilter;
  setCommodity: (c: CommodityFilter) => void;
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  totalCount: number;
  nearExpiryCount: number;
  lowStockCount: number;
  onOpenPrintForm?: (type: 'TT22_RESTOCK_PROPOSAL') => void;
  onOpenRestock: () => void;
}

export const PharmacyHeaderRibbon: React.FC<PharmacyHeaderRibbonProps> = ({
  warehouse,
  setWarehouse,
  commodity,
  setCommodity,
  status,
  setStatus,
  searchQuery,
  setSearchQuery,
  totalCount,
  nearExpiryCount,
  lowStockCount,
  onOpenPrintForm,
  onOpenRestock,
}) => {
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shrink-0 space-y-2.5 shadow-2xs">
      {/* Hàng 1: Phân tách Kho Nội Trú / Kho Ngoại Trú / Toàn bộ & Bóc tách Thuốc vs Vật tư */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        {/* Phân hệ Kho Dược */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
          <button
            onClick={() => setWarehouse('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              warehouse === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả kho
          </button>
          <button
            onClick={() => setWarehouse('inpatient')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              warehouse === 'inpatient' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Kho Dược Nội Trú & Tủ Trực Cấp Cứu (VBHN 07 & TT 18/2026)"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Kho Nội Trú & Tủ Trực</span>
          </button>
          <button
            onClick={() => setWarehouse('outpatient')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              warehouse === 'outpatient' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Kho Dược Ngoại Trú BHYT & Kê Đơn Điện Tử (TT 26/2025/TT-BYT)"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Kho Ngoại Trú BHYT</span>
          </button>
        </div>

        {/* Bóc tách Thuốc vs Vật tư y tế */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
          <button
            onClick={() => setCommodity('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
              commodity === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
            }`}
          >
            Tất cả loại
          </button>
          <button
            onClick={() => setCommodity('medication')}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
              commodity === 'medication' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'text-slate-600'
            }`}
          >
            Dược phẩm
          </button>
          <button
            onClick={() => setCommodity('medical_supply')}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
              commodity === 'medical_supply' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
            }`}
          >
            Vật tư y tế
          </button>
        </div>
      </div>

      {/* Hàng 2: Tìm kiếm, Bộ lọc trạng thái FEFO/Min & Nút tác vụ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên thuốc, số lô, vị trí..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-md overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setStatus('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                status === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              onClick={() => setStatus('near_expiry')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                status === 'near_expiry' ? 'bg-white text-rose-800 font-bold shadow-xs' : 'text-slate-600'
              }`}
            >
              Cận hạn &lt; 60 ngày ({nearExpiryCount})
            </button>
            <button
              onClick={() => setStatus('low_stock')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                status === 'low_stock' ? 'bg-white text-amber-900 font-bold shadow-xs' : 'text-slate-600'
              }`}
            >
              Dưới định mức ({lowStockCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            onClick={() => onOpenPrintForm?.('TT22_RESTOCK_PROPOSAL')}
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
            title="In phiếu dự trù bổ sung thuốc (Mẫu 01/TT22 & VBHN 07)"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">In dự trù Mẫu 01</span>
          </button>

          {lowStockCount > 0 && (
            <button
              onClick={onOpenRestock}
              className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition cursor-pointer active:scale-98 shadow-xs"
            >
              <PackagePlus className="w-3.5 h-3.5 text-teal-300" />
              <span>Lập dự trù ({lowStockCount})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
