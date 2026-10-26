/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tra cứu kho dược chuẩn hành chính Cục QLD (<=200 LOC)
 */

import React from 'react';
import { Search, PackagePlus, Database, Layers } from 'lucide-react';

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
  onOpenNationalRegistry?: () => void;
}

export const PharmacyHeaderRibbon: React.FC<PharmacyHeaderRibbonProps> = ({
  warehouse, setWarehouse, commodity, setCommodity, status, setStatus,
  searchQuery, setSearchQuery, totalCount, nearExpiryCount, lowStockCount, onOpenRestock,
  onOpenNationalRegistry,
}) => {
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shrink-0 space-y-2.5 shadow-2xs">
      {/* Tiêu đề hành chính & Nút liên kết Quốc Gia */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-teal-800 rounded-xs" />
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
            Quản Trị Kho Dược Bệnh Viện • Đồng Bộ CSDL Cục Quản Lý Dược (BYT)
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenNationalRegistry && (
            <button
              onClick={onOpenNationalRegistry}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-md bg-teal-50 hover:bg-teal-100/80 border border-teal-200 text-teal-900 font-semibold text-xs transition cursor-pointer"
              title="Tra cứu CSDL 54.885 Số Đăng Ký Cục Quản lý Dược"
            >
              <Database className="w-3.5 h-3.5 text-teal-700" />
              <span>Cổng Dược Quốc Gia</span>
              <span className="font-mono text-2xs font-bold px-1 py-0.2 bg-teal-800 text-white rounded">55k SĐK</span>
            </button>
          )}
          {lowStockCount > 0 && (
            <button
              onClick={onOpenRestock}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Dự trù thiếu ({lowStockCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Bộ tìm kiếm và bộ lọc hàng ngang chuẩn hành chính */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Ô tìm kiếm thông tin thuốc */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tra cứu Số đăng ký (SĐK), Tên thuốc, Hoạt chất, Nhà sản xuất, Số lô..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:border-teal-700 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Cụm bộ lọc: Phân hệ kho, Loại mặt hàng, Trạng thái */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {/* Phân hệ kho */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/60 font-medium">
            <button onClick={() => setWarehouse('all')} className={`px-2.5 py-1 rounded cursor-pointer ${warehouse === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Tất cả kho</button>
            <button onClick={() => setWarehouse('inpatient')} className={`px-2.5 py-1 rounded cursor-pointer ${warehouse === 'inpatient' ? 'bg-teal-800 text-white font-bold shadow-2xs' : 'text-slate-600'}`}>Nội trú</button>
            <button onClick={() => setWarehouse('outpatient')} className={`px-2.5 py-1 rounded cursor-pointer ${warehouse === 'outpatient' ? 'bg-teal-800 text-white font-bold shadow-2xs' : 'text-slate-600'}`}>Ngoại trú</button>
          </div>

          {/* Loại mặt hàng */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/60 font-medium">
            <button onClick={() => setCommodity('all')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Tất cả loại</button>
            <button onClick={() => setCommodity('medication')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'medication' ? 'bg-white text-teal-800 font-bold shadow-2xs' : 'text-slate-600'}`}>Thuốc</button>
            <button onClick={() => setCommodity('medical_supply')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'medical_supply' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Vật tư</button>
          </div>

          {/* Trạng thái FEFO */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/60 font-medium">
            <button onClick={() => setStatus('all')} className={`px-2 py-1 rounded cursor-pointer ${status === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Tất cả ({totalCount})</button>
            <button onClick={() => setStatus('near_expiry')} className={`px-2 py-1 rounded cursor-pointer ${status === 'near_expiry' ? 'bg-rose-700 text-white font-bold shadow-2xs' : 'text-slate-600'}`}>Cận hạn ({nearExpiryCount})</button>
            <button onClick={() => setStatus('low_stock')} className={`px-2 py-1 rounded cursor-pointer ${status === 'low_stock' ? 'bg-amber-700 text-white font-bold shadow-2xs' : 'text-slate-600'}`}>Dưới min ({lowStockCount})</button>
          </div>
        </div>
      </div>
    </div>
  );
};
