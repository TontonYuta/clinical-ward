import React, { useState } from 'react';
import { SlidersHorizontal, BookOpen, RotateCcw } from 'lucide-react';
import {
  PHARMACOLOGICAL_GROUPS,
  PharmacologicalGroupKey,
} from '../../../../utils/clinical/pharmacologicalClassification';
import { PageHeaderAction, SearchField } from '../../../ui/Workspace';
export type WarehouseFilter = 'all' | 'inpatient' | 'outpatient';
export type StatusFilter = 'all' | 'near_expiry' | 'low_stock' | 'expired';
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
  setLocation: (v: string) => void;
  onOpenNationalRegistry?: () => void;
  onOpenRestock?: () => void;
}
export const PharmacyHeaderRibbon: React.FC<PharmacyHeaderRibbonProps> = (p) => {
  const [expanded, setExpanded] = useState(false);
  const active = Number(p.location !== 'all') + Number(p.pharmacologicalGroup !== 'all');
  return (
    <>
      <PageHeaderAction>
        {p.onOpenRestock && <button type="button" className="button-primary" onClick={p.onOpenRestock}>Dự trù bổ sung</button>}
        {
          <button
            type="button"
            className="button-secondary"
            data-testid="btn-open-national-registry"
            onClick={p.onOpenNationalRegistry}
          >
            <BookOpen size={17} />
            Tra cứu thuốc
          </button>
        }
      </PageHeaderAction>
      <div className="workspace-toolbar">
        <SearchField
          value={p.searchQuery}
          onChange={p.setSearchQuery}
          label="Tìm thuốc theo tên, hoạt chất, số đăng ký hoặc số lô"
          placeholder="Tên thuốc, hoạt chất, số lô…"
        />
        <select
          aria-label="Kho"
          value={p.warehouse}
          onChange={(e) => p.setWarehouse(e.target.value as WarehouseFilter)}
          className="workspace-select"
        >
          <option value="all">Tất cả kho</option>
          <option value="inpatient">Nội trú & tủ trực</option>
          <option value="outpatient">Ngoại trú</option>
        </select>
        <select
          aria-label="Trạng thái tồn"
          value={p.status}
          onChange={(e) => p.setStatus(e.target.value as StatusFilter)}
          className="workspace-select"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="near_expiry">Cận hạn ({p.nearExpiryCount})</option>
          <option value="expired">Hết hạn</option>
          <option value="low_stock">Dưới tồn tối thiểu</option>
        </select>
        <button
          type="button"
          className="button-secondary"
          aria-expanded={expanded}
          aria-controls="pharmacy-extra-filters"
          onClick={() => setExpanded((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          Bộ lọc{active > 0 ? ` (${active})` : ''}
        </button>
        {expanded && (
          <div className="workspace-filters" id="pharmacy-extra-filters">
            <label>
              Vị trí
              <select
                aria-label="Vị trí kho"
                value={p.location}
                onChange={(e) => p.setLocation(e.target.value)}
                className="workspace-select"
              >
                <option value="all">Tất cả vị trí</option>
                {p.locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhóm dược lý
              <select
                aria-label="Nhóm dược lý"
                value={p.pharmacologicalGroup}
                onChange={(e) =>
                  p.setPharmacologicalGroup(e.target.value as PharmacologicalGroupKey)
                }
                data-testid="pharmacological-class-select"
                className="workspace-select"
              >
                <option value="all">Tất cả nhóm</option>
                {PHARMACOLOGICAL_GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-action self-end"
              onClick={() => {
                p.setWarehouse('all');
                p.setStatus('all');
                p.setLocation('all');
                p.setPharmacologicalGroup('all');
                p.setSearchQuery('');
              }}
            >
              <RotateCcw size={14} />
              Đặt lại
            </button>
          </div>
        )}
      </div>
    </>
  );
};
