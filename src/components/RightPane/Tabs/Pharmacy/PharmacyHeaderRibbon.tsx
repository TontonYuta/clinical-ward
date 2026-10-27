/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tra cứu kho dược chuẩn Thông tư 22/2011/TT-BYT (<=200 LOC)
 */

import React from 'react';
import { Search, Building2, Store } from 'lucide-react';
import { PHARMACOLOGICAL_GROUPS, PharmacologicalGroupKey } from '../../../../utils/clinical/pharmacologicalClassification';

export type WarehouseFilter = 'all' | 'inpatient' | 'outpatient';
export type CommodityFilter = 'all' | 'medication' | 'medical_supply';
export type StatusFilter = 'all' | 'near_expiry' | 'low_stock';
export type DavRegulatoryFilter = 'all' | 'controlled' | 'emergency' | 'cold_chain' | 'high_alert' | 'iv_fluid';

interface PharmacyHeaderRibbonProps {
  warehouse: WarehouseFilter;
  setWarehouse: (w: WarehouseFilter) => void;
  commodity: CommodityFilter;
  setCommodity: (c: CommodityFilter) => void;
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  pharmacologicalGroup: PharmacologicalGroupKey;
  setPharmacologicalGroup: (g: PharmacologicalGroupKey) => void;
  davFilter: DavRegulatoryFilter;
  setDavFilter: (f: DavRegulatoryFilter) => void;
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
  pharmacologicalGroup, setPharmacologicalGroup, davFilter, setDavFilter,
  searchQuery, setSearchQuery, totalCount, nearExpiryCount, lowStockCount, onOpenRestock,
}) => {
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shrink-0 space-y-2.5 shadow-2xs">
      {/* Tiêu đề & Nút thao tác kho */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-blue-600 rounded-xs" />
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
              Kho Dược Bệnh Viện
            </h2>
            <p className="text-[11px] text-slate-500 font-normal">
              Quản lý danh mục thuốc &amp; cấp phát nội trú, ngoại trú (Thông tư 22/2011/TT-BYT)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={onOpenRestock}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-2xs transition active:scale-98"
            >
              <span>Lập dự trù bổ sung ({lowStockCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Phân hệ kho Nội trú vs Ngoại trú trực quan */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            type="button"
            onClick={() => setWarehouse('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              warehouse === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả danh mục ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setWarehouse('inpatient')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              warehouse === 'inpatient'
                ? 'bg-blue-700 text-white font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Kho thuốc Nội trú &amp; Tủ trực</span>
          </button>
          <button
            type="button"
            onClick={() => setWarehouse('outpatient')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              warehouse === 'outpatient'
                ? 'bg-emerald-700 text-white font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Kho thuốc Ngoại trú</span>
          </button>
        </div>

        {/* Loại mặt hàng: Thuốc vs Vật tư y tế */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/60 font-medium text-xs">
          <button type="button" onClick={() => setCommodity('all')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Tất cả loại</button>
          <button type="button" onClick={() => setCommodity('medication')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'medication' ? 'bg-white text-blue-800 font-bold shadow-2xs' : 'text-slate-600'}`}>Thuốc</button>
          <button type="button" onClick={() => setCommodity('medical_supply')} className={`px-2.5 py-1 rounded cursor-pointer ${commodity === 'medical_supply' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Vật tư y tế</button>
        </div>
      </div>

      {/* Thanh tìm kiếm và bộ lọc chuyên môn */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1">
        {/* Ô tìm kiếm thông tin thuốc */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên thuốc, hoạt chất, số đăng ký (SĐK), số lô, nhà sản xuất..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:border-blue-600 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Cụm bộ lọc: Tồn kho/Hạn dùng, Dược lý, Quy chế */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {/* Tình trạng hạn dùng & tồn kho */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/60 font-medium">
            <button type="button" onClick={() => setStatus('all')} className={`px-2 py-1 rounded cursor-pointer ${status === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'}`}>Tất cả hạn</button>
            <button type="button" onClick={() => setStatus('near_expiry')} className={`px-2 py-1 rounded cursor-pointer ${status === 'near_expiry' ? 'bg-rose-700 text-white font-bold shadow-2xs' : 'text-slate-600'}`}>Cận hạn ({nearExpiryCount})</button>
            <button type="button" onClick={() => setStatus('low_stock')} className={`px-2 py-1 rounded cursor-pointer ${status === 'low_stock' ? 'bg-amber-700 text-white font-bold shadow-2xs' : 'text-slate-600'}`}>Dưới định mức ({lowStockCount})</button>
          </div>

          {/* Phân loại Tác dụng Trị liệu / Dược lý */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60 font-medium">
            <span className="text-slate-500 font-semibold text-[11px] whitespace-nowrap">Dược lý:</span>
            <select
              value={pharmacologicalGroup}
              onChange={(e) => setPharmacologicalGroup(e.target.value as PharmacologicalGroupKey)}
              data-testid="pharmacological-class-select"
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer max-w-[155px] truncate"
            >
              <option value="all">Tất cả nhóm</option>
              {PHARMACOLOGICAL_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Phân loại Quy chế quản lý */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60 font-medium">
            <span className="text-slate-500 font-semibold text-[11px] whitespace-nowrap">Quy chế:</span>
            <select
              value={davFilter}
              onChange={(e) => setDavFilter(e.target.value as DavRegulatoryFilter)}
              data-testid="dav-regulatory-select"
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer max-w-[155px] truncate"
            >
              <option value="all">Tất cả quy chế</option>
              <option value="controlled">Thuốc kiểm soát đặc biệt (vỏ ống)</option>
              <option value="emergency">Thuốc cấp cứu tủ trực</option>
              <option value="cold_chain">Bảo quản lạnh 2-8°C</option>
              <option value="high_alert">Thuốc nguy cơ cao (High-Alert)</option>
              <option value="iv_fluid">Dịch truyền tĩnh mạch</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
