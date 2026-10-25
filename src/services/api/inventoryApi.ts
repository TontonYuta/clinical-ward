/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Hospital Pharmacy & FEFO Batches (TT 36/2018/TT-BYT) (<=200 LOC)
 */

import { apiRequest } from './client';
import { InventoryBatch } from '../../types/clinical';
import { INITIAL_INVENTORY_BATCHES } from '../../data/pharmacy/allBatches';

interface BackendBatch {
  id: string;
  item_name: string;
  batch_number: string;
  category: string;
  expiry_date: string;
  days_left: number;
  current_stock: number;
  min_threshold: number;
  max_threshold: number;
  unit: string;
  warehouse_location: string;
  is_near_expiry: boolean;
  is_low_stock: boolean;
  is_quarantined?: boolean;
  national_code?: string;
  registration_number?: string;
  active_ingredient?: string;
}

function mapBackendToBatch(b: BackendBatch): InventoryBatch {
  const master = INITIAL_INVENTORY_BATCHES.find(
    (m) =>
      m.batchNumber === b.batch_number ||
      m.id === b.id ||
      m.itemName.toLowerCase().includes(b.item_name.toLowerCase().slice(0, 15))
  );

  return {
    id: b.id,
    itemCode: master?.itemCode || b.batch_number,
    itemName: b.item_name,
    nationalCode: b.national_code || master?.nationalCode,
    registrationNumber: b.registration_number || master?.registrationNumber,
    activeIngredient: b.active_ingredient || master?.activeIngredient,
    isControlledSubstance: master?.isControlledSubstance ?? b.category.includes('nghiện'),
    category: b.category as InventoryBatch['category'],
    commodityType: master?.commodityType || (b.category.includes('Vật tư') ? 'medical_supply' : 'medication'),
    warehouseType: master?.warehouseType || (b.warehouse_location.includes('Kho Lạnh') ? 'ward_emergency' : 'inpatient_central'),
    batchNumber: b.batch_number,
    expiryDate: b.expiry_date,
    daysLeft: b.days_left,
    isNearExpiry: b.is_near_expiry,
    currentStock: b.current_stock,
    minThreshold: b.min_threshold,
    maxThreshold: b.max_threshold,
    isLowStock: b.is_low_stock,
    unit: b.unit,
    warehouseLocation: b.warehouse_location,
    storageCondition: master?.storageCondition || 'Tiêu chuẩn bảo quản GSP',
    priorityOrder: b.is_near_expiry ? 1 : 2,
  };
}

export const inventoryApi = {
  async fetchInventoryBatches(): Promise<InventoryBatch[]> {
    const raw = await apiRequest<BackendBatch[]>('/inventory/batches');
    const mapped = raw.map(mapBackendToBatch);
    const mappedBatchNums = new Set(mapped.map((b) => b.batchNumber));
    const extra = INITIAL_INVENTORY_BATCHES.filter((b) => !mappedBatchNums.has(b.batchNumber));
    return [...mapped, ...extra];
  },

  async dispatchBatch(batchId: string, quantity: number, targetWard: string): Promise<InventoryBatch> {
    const res = await apiRequest<BackendBatch>(`/inventory/batches/${batchId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({
        quantity,
        target_ward: targetWard,
        dispatcher_name: 'DS. Nguyễn Hoàng Anh',
        auth_method: 'PASSWORD',
      }),
    });
    return mapBackendToBatch(res);
  },
};
