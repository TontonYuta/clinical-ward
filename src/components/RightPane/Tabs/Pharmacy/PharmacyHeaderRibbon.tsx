/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tra cứu kho dược chuẩn Thông tư 22/2011/TT-BYT (<=200 LOC)
 */

import React from 'react';
import { Search, Database } from 'lucide-react';
import { PHARMACOLOGICAL_GROUPS, PharmacologicalGroupKey } from '../../../../utils/clinical/pharmacologicalClassification';

export type WarehouseFilter = 'all' | 'inpatient' | 'outpatient';
export type StatusFilter = 'all' | 'near_expiry' | 'low_stock';

interface PharmacyHeaderRibbonProps {
  warehouse: WarehouseFilter;
  setWarehouse: (w: WarehouseFilter) => void;
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  pharmacologicalGroup: PharmacologicalGroupKey;
  setPharmacologicalGroup: (g: PharmacologicalGroupKey) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  nearExpiryCount: number;
  locations: string[];
  location: string;
  setLocation: (location: string) => void;
  onOpenNationalRegistry?: () => void;
}

export const PharmacyHeaderRibbon: React.FC<PharmacyHeaderRibbonProps> = ({
  warehouse, setWarehouse, status, setStatus,
  pharmacologicalGroup, setPharmacologicalGroup,
  searchQuery, setSearchQuery, nearExpiryCount, locations, location, setLocation,
  onOpenNationalRegistry,
}) => {
  return (
    <div className="shrink-0 overflow-x-auto thin-scrollbar">
      <div className="flex min-w-max items-center gap-2 rounded-lg bg-white p-1">
        {/* Ô tìm kiếm thông tin thuốc */}
        <select aria-label="Kho" value={warehouse} onChange={(e) => setWarehouse(e.target.value as WarehouseFilter)} className="min-h-11 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700">
          <option value="all">Tất cả kho</option><option value="inpatient">Nội trú &amp; tủ trực</option><option value="outpatient">Ngoại trú</option>
        </select>
        <div className="relative w-[min(24rem,32vw)] min-w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên thuốc, hoạt chất, SĐK hoặc số lô..."
            aria-label="Tìm thuốc theo tên, hoạt chất, số đăng ký hoặc số lô"
            className="w-full min-h-11 pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-500 focus:bg-white text-slate-900 placeholder-slate-500"
          />
        </div>
        <select aria-label="Vị trí kho" value={location} onChange={(e) => setLocation(e.target.value)} className="min-h-11 max-w-[220px] bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700">
          <option value="all">Tất cả vị trí</option>{locations.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Trạng thái tồn" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="min-h-11 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700">
          <option value="all">Tất cả tồn</option><option value="near_expiry">Cận hạn ({nearExpiryCount})</option><option value="low_stock">Dưới tồn tối thiểu</option>
        </select>
        <select aria-label="Nhóm dược lý" value={pharmacologicalGroup} onChange={(e) => setPharmacologicalGroup(e.target.value as PharmacologicalGroupKey)} data-testid="pharmacological-class-select" className="min-h-11 max-w-[190px] bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700">
          <option value="all">Tất cả nhóm</option>{PHARMACOLOGICAL_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <button type="button" onClick={onOpenNationalRegistry} data-testid="btn-open-national-registry" className="min-h-11 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer transition whitespace-nowrap" title="Tra cứu Kho Dược Quốc Gia"><Database className="w-4 h-4 inline mr-1.5" />Kho Dược Quốc Gia</button>
      </div>
    </div>
  );
};
