/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc kho, phân loại thuốc/vật tư và hành động nhanh (<=200 LOC)
 */

import React from 'react';
import { Search, PackagePlus, Building2, Store } from 'lucide-react';

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
  warehouse, setWarehouse, commodity, setCommodity, status, setStatus,
  searchQuery, setSearchQuery, totalCount, nearExpiryCount, lowStockCount, onOpenRestock,
}) => {
  return (
    <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shrink-0 space-y-2 sm:space-y-2.5 shadow-2xs">
      {/* Mobile Bar (< md) */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên thuốc, số lô..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:border-teal-700 text-slate-900 placeholder-slate-400"
            />
          </div>
          {lowStockCount > 0 && (
            <button onClick={onOpenRestock} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-teal-800 text-white font-bold text-xs shrink-0 cursor-pointer">
              <PackagePlus className="w-3.5 h-3.5 text-teal-300" />
              <span>Dự trù ({lowStockCount})</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5 text-xs">
          <button onClick={() => setWarehouse('all')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${warehouse === 'all' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Tất cả</button>
          <button onClick={() => setWarehouse('inpatient')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${warehouse === 'inpatient' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Nội trú</button>
          <button onClick={() => setWarehouse('outpatient')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${warehouse === 'outpatient' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Ngoại trú</button>
          <span className="text-slate-300">|</span>
          <button onClick={() => setCommodity(commodity === 'medication' ? 'all' : 'medication')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${commodity === 'medication' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Thuốc</button>
          <button onClick={() => setCommodity(commodity === 'medical_supply' ? 'all' : 'medical_supply')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${commodity === 'medical_supply' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Vật tư</button>
          <span className="text-slate-300">|</span>
          <button onClick={() => setStatus(status === 'near_expiry' ? 'all' : 'near_expiry')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${status === 'near_expiry' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Cận hạn ({nearExpiryCount})</button>
          <button onClick={() => setStatus(status === 'low_stock' ? 'all' : 'low_stock')} className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${status === 'low_stock' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Dưới min ({lowStockCount})</button>
        </div>
      </div>

      {/* Desktop Bar (>= md) */}
      <div className="hidden md:block space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-bold">
            <button onClick={() => setWarehouse('all')} className={`px-3 py-1.5 rounded-md cursor-pointer ${warehouse === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>Tất cả kho</button>
            <button onClick={() => setWarehouse('inpatient')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer ${warehouse === 'inpatient' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600'}`}><Building2 className="w-3.5 h-3.5" /> Kho nội trú</button>
            <button onClick={() => setWarehouse('outpatient')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer ${warehouse === 'outpatient' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600'}`}><Store className="w-3.5 h-3.5" /> Kho ngoại trú</button>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium">
            <button onClick={() => setCommodity('all')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'}`}>Tất cả</button>
            <button onClick={() => setCommodity('medication')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'medication' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'text-slate-600'}`}>Thuốc</button>
            <button onClick={() => setCommodity('medical_supply')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'medical_supply' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'}`}>Vật tư</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm tên thuốc, số lô, vị trí..." className="w-full pl-9 pr-3.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:border-teal-700 text-slate-900 placeholder-slate-400" />
            </div>
            <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-md">
              <button onClick={() => setStatus('all')} className={`px-2.5 py-1 rounded-md cursor-pointer ${status === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'}`}>Tất cả ({totalCount})</button>
              <button onClick={() => setStatus('near_expiry')} className={`px-2.5 py-1 rounded-md cursor-pointer ${status === 'near_expiry' ? 'bg-white text-rose-800 font-bold shadow-xs' : 'text-slate-600'}`}>Cận hạn ({nearExpiryCount})</button>
              <button onClick={() => setStatus('low_stock')} className={`px-2.5 py-1 rounded-md cursor-pointer ${status === 'low_stock' ? 'bg-white text-amber-900 font-bold shadow-xs' : 'text-slate-600'}`}>Dưới min ({lowStockCount})</button>
            </div>
          </div>
          {lowStockCount > 0 && (
            <button onClick={onOpenRestock} className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0">
              <PackagePlus className="w-3.5 h-3.5 text-teal-300" />
              <span>Dự trù ({lowStockCount})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
