/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Hospital Pharmacy & FEFO Batches (TT 36/2018/TT-BYT) (<=200 LOC)
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
  cold_chain_state_id?: number | null;
  cold_storage_link_verified?: boolean;
  cold_storage_required?: boolean;
  cold_storage_unknown_reason?: string | null;
  is_dispatchable?: boolean;
  dispatch_hold_reason?: string | null;
  national_code?: string;
  registration_number?: string;
  active_ingredient?: string;
  concentration?: string;
  dosage_form?: string;
  manufacturer?: string;
  country?: string;
  packaging_spec?: string;
  standard_pharmacopeia?: string;
  shelf_life?: string;
  manufacturer_address?: string;
  applicant_name?: string;
  applicant_address?: string;
  applicant_country?: string;
  approval_decision?: string;
  route?: string;
}

function mapBackendToBatch(b: BackendBatch): InventoryBatch {
  return {
    id: b.id,
    itemCode: b.batch_number,
    itemName: b.item_name,
    nationalCode: b.national_code,
    registrationNumber: b.registration_number,
    activeIngredient: b.active_ingredient,
    concentration: b.concentration,
    dosageForm: b.dosage_form,
    manufacturer: b.manufacturer,
    country: b.country,
    packagingSpec: b.packaging_spec,
    standardPharmacopeia: b.standard_pharmacopeia,
    shelfLife: b.shelf_life,
    manufacturerAddress: b.manufacturer_address,
    applicantName: b.applicant_name,
    applicantAddress: b.applicant_address,
    applicantCountry: b.applicant_country,
    approvalDecision: b.approval_decision,
    route: b.route,
    isControlledSubstance: b.category.includes('nghiện'),
    category: b.category as InventoryBatch['category'],
    commodityType: (b.category.includes('Vật tư') ? 'medical_supply' : 'medication'),
    warehouseType:
      (b.warehouse_location.includes('Ngoại Trú')
        ? 'outpatient_pharmacy'
        : b.warehouse_location.includes('Cấp Cứu') || b.warehouse_location.includes('Kho Lạnh') || b.warehouse_location.includes('Tủ')
        ? 'ward_emergency'
        : 'inpatient_central'),
    batchNumber: b.batch_number,
    expiryDate: b.expiry_date,
    daysLeft: b.days_left,
    isNearExpiry: b.is_near_expiry,
    currentStock: b.current_stock,
    minThreshold: b.min_threshold,
    maxThreshold: b.max_threshold,
    isLowStock: b.is_low_stock,
    isQuarantined: b.is_quarantined ?? false,
    coldChainStateId: b.cold_chain_state_id,
    coldStorageLinkVerified: b.cold_storage_link_verified,
    coldStorageRequired: b.cold_storage_required,
    coldStorageUnknownReason: b.cold_storage_unknown_reason,
    isDispatchable: b.is_dispatchable,
    dispatchHoldReason: b.dispatch_hold_reason,
    unit: b.unit,
    warehouseLocation: b.warehouse_location,
    storageCondition: 'Chưa có dữ liệu điều kiện bảo quản',
    priorityOrder: b.is_near_expiry ? 1 : 2,
  };
}

export const inventoryApi = {
  async createRestockProposal(batchIds: string[], pharmacistName: string): Promise<{ message: string; proposed_count: number }> {
    return apiRequest('/inventory/restock-proposal', {
      method: 'POST',
      body: JSON.stringify({ batch_ids: batchIds, pharmacist_name: pharmacistName }),
    });
  },
  async fetchInventoryBatches(): Promise<InventoryBatch[]> {
    const raw = await apiRequest<BackendBatch[]>('/inventory/batches');
    return raw.map(mapBackendToBatch);
  },

  async dispatchBatch(batchId: string, quantity: number, targetWard: string): Promise<InventoryBatch> {
    const res = await apiRequest<BackendBatch>(`/inventory/batches/${batchId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({
        quantity,
      }),
    });
    return mapBackendToBatch(res);
  },
};
