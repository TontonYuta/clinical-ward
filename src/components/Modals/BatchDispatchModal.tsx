import React, { useState } from 'react';
import type { InventoryBatch } from '../../types/pharmacy';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { dispatchHoldReason, dispatchQuantityError } from '../RightPane/Tabs/Pharmacy/dispatchModel';

interface Props {
  batch: InventoryBatch;
  onClose: () => void;
  onContinue: (batchId: string, quantity: number) => void | Promise<void>;
}
export function BatchDispatchModal({ batch, onClose, onContinue }: Props) {
  useModalDismiss(true, onClose);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [continuing, setContinuing] = useState(false);
  const hold = dispatchHoldReason(batch);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = dispatchQuantityError(batch, quantity);
    if (invalid) { setError(invalid); return; }
    setContinuing(true);
    setError('');
    try { await onContinue(batch.id, Number(quantity)); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa mở được bước xác nhận.'); }
    finally { setContinuing(false); }
  }
  return <div className="clinical-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="batch-dispatch-title" className="w-full max-w-md rounded-xl border border-slate-300 bg-white p-5 shadow-xl">
      <h2 id="batch-dispatch-title" className="text-lg font-semibold">Số lượng xuất kho</h2>
      <p className="mt-3 font-medium">{batch.itemName}</p>
      <p className="record-sub">Lô: {batch.batchNumber} · Hạn dùng: {batch.expiryDate}</p>
      <p className="mt-2 text-sm">Tồn ghi nhận: {batch.currentStock} {batch.unit}</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="batch-dispatch-quantity" className="mt-4 block text-sm font-medium">Số lượng xuất</label>
        <input id="batch-dispatch-quantity" autoFocus type="number" inputMode="numeric" min="1" step="1" max={batch.currentStock} value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }} className="mt-1 w-full rounded border border-slate-300 p-2" />
        {(hold || error) && <p role="alert" className="mt-3 text-sm text-red-800">{hold || error}</p>}
        <p className="mt-3 text-sm text-slate-600">Tiếp tục để xác nhận thao tác. Tồn kho chỉ cập nhật khi máy chủ chấp nhận lệnh xuất.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="button-secondary">Hủy</button><button type="submit" disabled={Boolean(hold) || continuing} className="button-primary">Tiếp tục xác nhận</button></div>
      </form>
    </section>
  </div>;
}
