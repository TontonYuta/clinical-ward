/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Hospital Pharmacy & FEFO Batches (TT 36/2018/TT-BYT)
 */

import { apiRequest } from './client';
import { InventoryBatch } from '../../types/clinical';

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
}

function mapBackendToBatch(b: BackendBatch): InventoryBatch {
  return {
    id: b.id,
    itemCode: b.batch_number,
    itemName: b.item_name,
    category: b.category as InventoryBatch['category'],
    commodityType: b.category.includes('Vật tư') ? 'medical_supply' : 'medication',
    warehouseType: b.warehouse_location.includes('Kho Lạnh')
      ? 'ward_emergency'
      : b.warehouse_location.includes('Vật tư')
      ? 'inpatient_central'
      : 'inpatient_central',
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
    storageCondition: 'Tiêu chuẩn bảo quản GSP',
    priorityOrder: b.is_near_expiry ? 1 : 2,
  };
}

export const inventoryApi = {
  async fetchInventoryBatches(): Promise<InventoryBatch[]> {
    const raw = await apiRequest<BackendBatch[]>('/inventory/batches');
    return raw.map(mapBackendToBatch);
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
