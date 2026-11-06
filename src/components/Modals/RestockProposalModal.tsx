import React, { useState } from 'react';
import type { InventoryBatch } from '../../types/clinical';
import type { PrintableFormType } from './PrintableFormModal';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface RestockProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockBatches: InventoryBatch[];
  onConfirmRestock: (batchIds: string[]) => void | Promise<void>;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
  operatorName?: string;
}
export const RestockProposalModal: React.FC<RestockProposalModalProps> = props => props.isOpen ? <RestockProposalContent {...props} /> : null;

function RestockProposalContent({ onClose, lowStockBatches, onConfirmRestock, onOpenPrintForm, operatorName }: RestockProposalModalProps) {
  useModalDismiss(true, onClose);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState('');
  async function continueConfirmation() {
    if (!lowStockBatches.length || continuing) return;
    setContinuing(true);
    setError('');
    try { await onConfirmRestock(lowStockBatches.map(batch => batch.id)); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa mở được bước xác nhận.'); }
    finally { setContinuing(false); }
  }
  return <div className="clinical-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-0 sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="restock-proposal-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 id="restock-proposal-title" className="text-lg font-semibold">Dự trù bổ sung</h2><button type="button" onClick={onClose} aria-label="Đóng dự trù" className="button-secondary">Đóng</button></header>
      <div className="space-y-4 overflow-y-auto p-5 text-sm">
        <p>Đề nghị bổ sung từ các ngưỡng tồn ghi nhận. Số lượng gợi ý chưa được duyệt và chưa phải hàng đã tiếp nhận; tồn kho giữ nguyên khi lập đề nghị.</p>
        <p>Tài khoản hiện tại: {operatorName || 'Chưa xác nhận danh tính'}</p>
        <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Thuốc / vật tư và lô</th><th>Tồn ghi nhận</th><th>Ngưỡng min / max</th><th>Gợi ý bổ sung</th></tr></thead><tbody>
          {lowStockBatches.map(batch => <tr key={batch.id}><td>{batch.itemName}<span className="record-sub">{batch.batchNumber}</span></td><td>{batch.currentStock} {batch.unit}</td><td>{batch.minThreshold} / {batch.maxThreshold}</td><td>{Number.isFinite(batch.maxThreshold) && Number.isFinite(batch.currentStock) ? Math.max(0, batch.maxThreshold - batch.currentStock) : 'Chưa có dữ liệu'} {batch.unit}</td></tr>)}
          {!lowStockBatches.length && <tr><td colSpan={4}>Chưa có lô tồn thấp trong danh sách nguồn.</td></tr>}
        </tbody></table></div>
        {error && <p role="alert" className="text-red-800">{error}</p>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">
        {onOpenPrintForm && <button type="button" className="button-secondary" onClick={() => { onOpenPrintForm('TT22_RESTOCK_PROPOSAL'); onClose(); }}>In dự thảo</button>}
        <button type="button" onClick={onClose} className="button-secondary">Hủy</button>
        <button type="button" onClick={() => void continueConfirmation()} disabled={!lowStockBatches.length || continuing} className="button-primary">Tiếp tục xác nhận</button>
      </footer>
    </section>
  </div>;
}
