import React, { useState } from 'react';
import { SlidersHorizontal, Printer, ZapOff, Check, FileCheck2 } from 'lucide-react';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';
import { PageHeaderAction, SearchField } from '../../../ui/Workspace';
export type ColdChainFilterStatus = 'all' | 'safe' | 'quarantined' | 'freeze_sensitive';
export type ColdChainSubTab = 'inventory' | 'datalogger';
interface ColdChainHeaderRibbonProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: ColdChainFilterStatus;
  setFilterStatus: (f: ColdChainFilterStatus) => void;
  activeSubTab: ColdChainSubTab;
  setActiveSubTab: (t: ColdChainSubTab) => void;
  totalVaccineCount: number;
  totalLogsCount: number;
  isAlarm: boolean;
  isQuarantined: boolean;
  onRestore: () => void;
  onReleaseQuarantine?: () => void;
  onSimulateOutage: () => void;
  onOpenPrintForm?: (f: PrintableFormType) => void;
}
export const ColdChainHeaderRibbon: React.FC<ColdChainHeaderRibbonProps> = (p) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <PageHeaderAction>
        {
          <button
            type="button"
            className="button-secondary"
            onClick={() => p.onOpenPrintForm?.('COLD_CHAIN_INCIDENT_REPORT')}
          >
            <Printer size={17} />
            <span>Biên bản</span>
          </button>
        }
      </PageHeaderAction>
      <div className="workspace-toolbar">
        <div className="segment-control" aria-label="Nội dung chuỗi lạnh">
          <button
            type="button"
            data-testid="subtab-inventory"
            aria-pressed={p.activeSubTab === 'inventory'}
            onClick={() => p.setActiveSubTab('inventory')}
          >
            Danh mục<span>{p.totalVaccineCount}</span>
          </button>
          <button
            type="button"
            data-testid="subtab-datalogger"
            aria-pressed={p.activeSubTab === 'datalogger'}
            onClick={() => p.setActiveSubTab('datalogger')}
          >
            Nhật ký nhiệt độ<span>{p.totalLogsCount}</span>
          </button>
        </div>
        {p.activeSubTab === 'inventory' && (
          <SearchField
            value={p.searchQuery}
            onChange={p.setSearchQuery}
            label="Tìm trong kho lạnh"
            placeholder="Tên sinh phẩm, số lô…"
          />
        )}
        <button
          type="button"
          className="button-secondary"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          aria-controls="coldchain-options"
        >
          <SlidersHorizontal size={16} />
          Tùy chọn{p.filterStatus !== 'all' ? ' •' : ''}
        </button>
        {expanded && (
          <div className="workspace-filters" id="coldchain-options">
            {p.activeSubTab === 'inventory' && (
              <label>
                Lọc danh mục
                <select
                  aria-label="Bộ lọc bảo quản"
                  className="workspace-select"
                  value={p.filterStatus}
                  onChange={(e) => p.setFilterStatus(e.target.value as ColdChainFilterStatus)}
                >
                  <option value="all">Tất cả sinh phẩm</option>
                  <option value="safe">Không bị giữ xuất theo hồ sơ, còn hạn</option>
                  <option value="quarantined">Đang biệt trữ</option>
                  <option value="freeze_sensitive" disabled>Nhạy cảm nhiệt đông — chưa có dữ liệu</option>
                </select>
              </label>
            )}
            <div className="flex flex-wrap items-end gap-2">
              {p.isAlarm && (
                <button type="button" className="button-primary" onClick={p.onRestore}>
                  <Check size={15} />
                  Khôi phục điện
                </button>
              )}
              {p.isQuarantined && p.onReleaseQuarantine && (
                <button type="button" className="button-secondary" onClick={p.onReleaseQuarantine}>
                  <FileCheck2 size={15} />
                  Xét giải phóng biệt trữ
                </button>
              )}
              <button type="button" className="button-secondary" onClick={p.onSimulateOutage}>
                <ZapOff size={15} />
                Mô phỏng mất điện
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
