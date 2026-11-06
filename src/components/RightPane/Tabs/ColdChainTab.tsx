import React, { useState, useMemo, useEffect } from 'react';
import type { ColdChainMonitorState, InventoryBatch } from '../../../types/clinical';
import { expiryState, temperatureAlarm } from '../../ui/workspaceStatus';
import type { PrintableFormType } from '../../Modals/PrintableFormModal';
import { ColdChainHeaderRibbon, ColdChainFilterStatus, ColdChainSubTab } from './ColdChain/ColdChainHeaderRibbon';
import { ColdChainTelemetryCards } from './ColdChain/ColdChainTelemetryCards';
import { ColdChainQuarantineBanner } from './ColdChain/ColdChainQuarantineBanner';
import { ColdChainLogTable } from './ColdChain/ColdChainLogTable';
import { DavDrugDetailModal } from '../../Modals/DavDrugDetailModal';
import { EmptyState } from '../../ui/Workspace';

function ColdBatchStatus({batch}: {batch: InventoryBatch}) {
  const expired = expiryState(batch.expiryDate) === 'expired';
  return <><span className={`status-pill ${expired ? 'danger' : batch.isDispatchable === true ? 'neutral' : 'warning'}`}>{expired ? 'Hết hạn' : batch.isDispatchable === true ? 'Không có lệnh giữ theo hồ sơ' : 'Giữ để kiểm tra'}</span><span className="record-sub">{batch.dispatchHoldReason || (batch.isDispatchable === true ? '' : 'Chưa xác nhận điều kiện xuất')}</span></>;
}

interface ColdChainTabProps {
  coldChainState: ColdChainMonitorState;
  batches?: InventoryBatch[];
  onTriggerOutage: () => void;
  onRestorePower: () => void;
  onReleaseQuarantine?: () => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const ColdChainTab: React.FC<ColdChainTabProps> = ({ coldChainState, batches = [], onTriggerOutage, onRestorePower, onReleaseQuarantine, onOpenPrintForm }) => {
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('coldchain_search') || '');
  const [filterStatus, setFilterStatus] = useState<ColdChainFilterStatus>(() => {
    const saved = sessionStorage.getItem('coldchain_filter');
    return saved === 'safe' || saved === 'quarantined' ? saved : 'all';
  });
  const [activeSubTab, setActiveSubTab] = useState<ColdChainSubTab>(() => sessionStorage.getItem('coldchain_subtab') === 'datalogger' ? 'datalogger' : 'inventory');
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem('coldchain_search', searchQuery);
      sessionStorage.setItem('coldchain_filter', filterStatus);
      sessionStorage.setItem('coldchain_subtab', activeSubTab);
    } catch {}
  }, [searchQuery, filterStatus, activeSubTab]);
  const isAlarm = temperatureAlarm(coldChainState);
  const isQuarantined = coldChainState.quarantineStatus === 'quarantined';
  const coldBatches = useMemo(() => batches.filter(batch =>
    (batch.coldStorageRequired || batch.coldChainStateId != null) &&
    (!batch.coldStorageLinkVerified || coldChainState.storageId == null || batch.coldChainStateId === coldChainState.storageId)
  ), [batches, coldChainState.storageId]);
  const filteredBatches = useMemo(() => coldBatches.filter(batch => {
    if (filterStatus === 'safe' && (batch.isDispatchable !== true || batch.isQuarantined || !['valid', 'near'].includes(expiryState(batch.expiryDate)))) return false;
    if (filterStatus === 'quarantined' && !batch.isQuarantined && !(batch.coldStorageLinkVerified && batch.coldChainStateId === coldChainState.storageId && isQuarantined)) return false;
    const query = searchQuery.trim().toLocaleLowerCase('vi');
    return !query || [batch.itemName, batch.batchNumber, batch.registrationNumber, batch.warehouseLocation].some(value => value?.toLocaleLowerCase('vi').includes(query));
  }), [coldBatches, filterStatus, searchQuery, isQuarantined, coldChainState.storageId]);
  return <div className="workspace-page">
    <ColdChainHeaderRibbon searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterStatus={filterStatus} setFilterStatus={setFilterStatus} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} totalVaccineCount={coldBatches.length} totalLogsCount={coldChainState.logs.length} isAlarm={isAlarm} isQuarantined={isQuarantined} onRestore={onRestorePower} onReleaseQuarantine={onReleaseQuarantine} onSimulateOutage={onTriggerOutage} onOpenPrintForm={onOpenPrintForm} />
    <ColdChainTelemetryCards coldChainState={coldChainState} isAlarm={isAlarm} isQuarantined={isQuarantined} />
    {isQuarantined && <ColdChainQuarantineBanner coldChainState={coldChainState} onReleaseQuarantine={onReleaseQuarantine} />}
    {activeSubTab === 'inventory' ? <>
      <p role="note" className="px-3 py-2 border border-slate-300 text-xs text-slate-700">Danh sách từ tồn kho máy chủ. Chưa có dữ liệu VVM, mức nhạy cảm đông hoặc ánh sáng của từng lô. Lô chưa có liên kết tủ được xác nhận cần tiếp tục giữ để kiểm tra.</p>
      <div className="workspace-list desktop-records">
        <div className="list-caption"><strong>{filteredBatches.length} lô bảo quản lạnh</strong><span>Liên kết tủ được kiểm tra riêng cho từng lô</span></div>
        <div className="workspace-table-scroll"><table className="workspace-table"><thead><tr><th>Thuốc / sinh phẩm</th><th>Lô / hạn dùng</th><th>Tồn ghi nhận</th><th>Liên kết bảo quản</th><th>Trạng thái xuất</th></tr></thead><tbody>
          {filteredBatches.map(batch => <tr key={batch.id} data-workspace-record>
            <td><button type="button" className="record-link" onClick={() => setSelectedBatch(batch)}>{batch.itemName}</button><span className="record-sub">{batch.registrationNumber || 'Chưa có số đăng ký'}</span></td>
            <td>{batch.batchNumber}<span className="record-sub">{batch.expiryDate || 'Chưa có hạn dùng'}</span></td>
            <td>{batch.currentStock} {batch.unit}</td>
            <td>{batch.coldStorageLinkVerified ? `Đã liên kết tủ ${batch.coldChainStateId}` : 'Chưa xác nhận liên kết tủ'}<span className="record-sub">{batch.warehouseLocation || 'Chưa ghi vị trí'}{batch.coldStorageUnknownReason && batch.coldStorageUnknownReason !== batch.dispatchHoldReason ? ` · ${batch.coldStorageUnknownReason}` : ''}</span></td>
            <td><ColdBatchStatus batch={batch} /></td>
          </tr>)}
        </tbody></table>{!filteredBatches.length && <EmptyState title="Chưa có lô bảo quản lạnh phù hợp" description="Chỉ hiển thị lô thực có yêu cầu bảo quản lạnh hoặc liên kết tủ trong hồ sơ máy chủ." />}</div>
      </div>
      <div className="mobile-records" aria-label="Lô bảo quản lạnh">
        {filteredBatches.map(batch => <article key={batch.id} className="mobile-record" data-workspace-record>
          <div className="mobile-record-heading"><button type="button" className="record-link" onClick={() => setSelectedBatch(batch)}>{batch.itemName}</button><strong className="shrink-0">{batch.currentStock} {batch.unit}</strong></div>
          <span className="record-sub">{batch.batchNumber} · HD: {batch.expiryDate || 'Chưa có'}</span>
          <ColdBatchStatus batch={batch} />
          <span className="record-sub">{batch.coldStorageLinkVerified ? `Đã liên kết tủ ${batch.coldChainStateId}` : 'Chưa xác nhận liên kết tủ'} · {batch.registrationNumber || 'Chưa có số đăng ký'}</span>
          <span className="record-sub">{batch.warehouseLocation || 'Chưa ghi vị trí'}{batch.coldStorageUnknownReason && batch.coldStorageUnknownReason !== batch.dispatchHoldReason ? ` · ${batch.coldStorageUnknownReason}` : ''}</span>
        </article>)}
        {!filteredBatches.length && <EmptyState title="Chưa có lô bảo quản lạnh phù hợp" description="Đối chiếu hồ sơ máy chủ và bộ lọc đang chọn." />}
      </div>
    </> : <ColdChainLogTable logs={coldChainState.logs} />}
    {selectedBatch && <DavDrugDetailModal isOpen onClose={() => setSelectedBatch(null)} batch={selectedBatch} />}
  </div>;
};
