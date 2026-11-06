import type { InventoryBatch } from '../../../../types/pharmacy';
import { expiryState } from '../../../ui/workspaceStatus';

export function dispatchHoldReason(batch: InventoryBatch): string | null {
  const expiry = expiryState(batch.expiryDate);
  if (expiry === 'expired') return 'Lô đã hết hạn.';
  if (expiry === 'unknown') return 'Chưa xác định hạn dùng của lô.';
  if (batch.isQuarantined) return batch.dispatchHoldReason || 'Lô đang biệt trữ.';
  if (batch.isDispatchable === false) return batch.dispatchHoldReason || 'Máy chủ đang giữ lô, chưa cho phép xuất.';
  if (batch.coldStorageRequired && (!batch.coldStorageLinkVerified || batch.coldChainStateId == null || batch.isDispatchable !== true)) return batch.coldStorageUnknownReason || 'Chưa xác nhận liên kết tủ hoặc điều kiện xuất lô bảo quản lạnh.';
  if (!Number.isFinite(batch.currentStock) || batch.currentStock <= 0) return 'Không có số lượng tồn khả dụng.';
  return null;
}

export function dispatchQuantityError(batch: InventoryBatch, input: string): string | null {
  const hold = dispatchHoldReason(batch);
  if (hold) return hold;
  const quantity = Number(input);
  if (!input.trim() || !Number.isSafeInteger(quantity) || quantity <= 0) return 'Nhập số lượng là số nguyên dương.';
  if (quantity > batch.currentStock) return 'Số lượng xuất vượt quá tồn kho ghi nhận.';
  return null;
}
