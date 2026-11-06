import React from 'react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { expiryState } from '../../../ui/workspaceStatus';
import { dispatchHoldReason } from './dispatchModel';
interface PharmacyBatchRowProps {
  index: number;
  batch: InventoryBatch;
  onQuickDispatch?: (batch: InventoryBatch) => void;
  onOpenRestock?: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onSelectBatch?: (batch: InventoryBatch) => void;
}
export const PharmacyBatchRow: React.FC<PharmacyBatchRowProps> = ({ batch, onSelectBatch, onQuickDispatch }) => {
  const expiry = expiryState(batch.expiryDate);
  const low = batch.isLowStock || batch.currentStock <= batch.minThreshold;
  const hold = dispatchHoldReason(batch);
  return (
    <tr data-workspace-record>
      <td>
        <button
          type="button"
          className="record-link"
          data-testid={`btn-medname-${batch.id}`}
          onClick={() => onSelectBatch?.(batch)}
        >
          {batch.itemName}
        </button>
        <span className="record-sub">
          {batch.activeIngredient}
          {batch.concentration ? ` · ${batch.concentration}` : ''}
        </span>
        <span className="record-sub">
          {batch.dosageForm || 'Chưa có dạng bào chế'}
          {batch.isControlledSubstance && ' · Kiểm soát đặc biệt'}
        </span>
      </td>
      <td>
        <span className="record-mono">{batch.batchNumber}</span>
        <span className={`record-sub ${expiry === 'expired' ? '!text-red-700' : ''}`}>
          HD: {batch.expiryDate || 'Chưa có'}
        </span>
      </td>
      <td>
        <span className="font-semibold">
          {batch.currentStock.toLocaleString('vi-VN')}{' '}
          <span className="font-normal">{batch.unit}</span>
        </span>
        <span className="record-sub">Tối thiểu: {batch.minThreshold}</span>
      </td>
      <td>
        <span className="text-[.75rem]">{batch.warehouseLocation || 'Chưa có vị trí'}</span>
      </td>
      <td>
        <div className="flex flex-col items-start gap-1">
          {expiry === 'expired' ? (
            <span className="status-pill danger">Hết hạn</span>
          ) : expiry === 'near' ? (
            <span className="status-pill warning">Cận hạn</span>
          ) : expiry === 'unknown' ? (
            <span className="status-pill warning">Kiểm tra hạn</span>
          ) : null}
          {low && <span className="status-pill warning">Tồn thấp</span>}
          {hold && <><span className="status-pill danger">Chặn xuất</span><span className="record-sub">{hold}</span></>}
          {expiry === 'valid' && !low && !hold && <span className="status-pill neutral">—</span>}
          {onQuickDispatch && <button type="button" className="button-secondary mt-1" aria-label={`Xuất lô ${batch.batchNumber}`} disabled={Boolean(hold)} onClick={() => onQuickDispatch(batch)}>Xuất kho</button>}
        </div>
      </td>
    </tr>
  );
};
