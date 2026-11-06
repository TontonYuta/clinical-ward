import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { expiryState } from '../../../ui/workspaceStatus';
import { dispatchHoldReason } from './dispatchModel';
interface PharmacyBatchCardProps {
  index: number;
  batch: InventoryBatch;
  onQuickDispatch?: (b: InventoryBatch) => void;
  onOpenRestock?: () => void;
  onOpenSafetyGuide?: (name: string) => void;
  onSelectBatch?: (b: InventoryBatch) => void;
}
export const PharmacyBatchCard: React.FC<PharmacyBatchCardProps> = ({ batch, onSelectBatch, onQuickDispatch }) => {
  const expiry = expiryState(batch.expiryDate),
    low = batch.isLowStock || batch.currentStock <= batch.minThreshold;
  const hold = dispatchHoldReason(batch);
  return (
    <article className="mobile-record" data-workspace-record>
      <div className="mobile-record-heading">
        <div>
          <button
            type="button"
            data-testid={`btn-medname-${batch.id}`}
            className="record-link"
            onClick={() => onSelectBatch?.(batch)}
          >
            {batch.itemName}
          </button>
          <span className="record-sub">
            {batch.activeIngredient} {batch.concentration} · {batch.dosageForm}
          </span>
          {batch.isControlledSubstance && (
            <span className="status-pill warning mt-2">Kiểm soát đặc biệt</span>
          )}
        </div>
        <button
          type="button"
          className="icon-action shrink-0"
          aria-label={`Xem ${batch.itemName}`}
          onClick={() => onSelectBatch?.(batch)}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="mobile-record-meta">
        <div>
          <span className="record-mono">{batch.batchNumber}</span>
          <span className="record-sub">
            HD: {batch.expiryDate} · {batch.warehouseLocation}
          </span>
        </div>
        <div className="text-right shrink-0">
          <strong className="text-sm">
            {batch.currentStock} {batch.unit}
          </strong>
          <div className="mt-1">
            {expiry === 'expired' ? (
              <span className="status-pill danger">Hết hạn</span>
            ) : expiry === 'near' ? (
              <span className="status-pill warning">Cận hạn</span>
            ) : expiry === 'unknown' ? (
              <span className="status-pill warning">Kiểm tra hạn</span>
            ) : null}
            {low && <span className="status-pill warning ml-1">Tồn thấp</span>}
          </div>
        </div>
      </div>
      {hold && <p className="record-sub mt-3"><span className="status-pill danger mr-2">Chặn xuất</span>{hold}</p>}
      {onQuickDispatch && <button type="button" className="button-secondary mt-3" aria-label={`Xuất lô ${batch.batchNumber}`} disabled={Boolean(hold)} onClick={() => onQuickDispatch(batch)}>Xuất kho</button>}
    </article>
  );
};
