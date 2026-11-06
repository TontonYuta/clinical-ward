import React from 'react';
import { Plus } from 'lucide-react';
import { PageHeaderAction, SearchField } from '../../../ui/Workspace';
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
  onOpenNewPrescription,
}) => (
  <>
    <PageHeaderAction>
      {canPrescribe && (
        <button type="button" className="button-primary" onClick={onOpenNewPrescription}>
          <Plus size={17} />
          Kê đơn mới
        </button>
      )}
    </PageHeaderAction>
    <div className="workspace-toolbar">
      <SearchField
        value={searchQuery}
        onChange={setSearchQuery}
        label="Tìm đơn thuốc điện tử"
        placeholder="Tìm tên người bệnh, mã đơn, thuốc…"
      />
      <div className="segment-control" aria-label="Phân loại đơn thuốc">
        {(
          [
            ['all', 'Tất cả', totalCount],
            ['inpatient_daily', 'Nội trú', inpatientCount],
            ['outpatient', 'Ngoại trú', outpatientCount],
          ] as const
        ).map(([value, label, count]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filterType === value}
            onClick={() => setFilterType(value)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>
    </div>
  </>
);
