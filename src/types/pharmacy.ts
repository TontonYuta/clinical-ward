/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Dược Bệnh Viện: Kho Nội Trú, Kho Ngoại Trú & Nợ Vỏ Morphin
 */

export type WarehouseType = 'inpatient_central' | 'ward_emergency' | 'outpatient_pharmacy';
export type DebtStatus = 'debt' | 'settled';

export interface DebtRecord {
  id: string;
  code: string; // PN-2026-xxx
  itemName: string;
  itemType: 'Thuốc gây nghiện' | 'Thuốc hướng thần' | 'Thuốc cấp cứu' | 'Vật tư tiêu hao' | 'Vật tư phẫu thuật';
  isNarcotic?: boolean;
  quantity: string;
  patientName: string;
  patientRoom: string;
  borrowTime: string;
  borrowDate: string;
  borrowerName: string;
  status: DebtStatus;
  note: string;
  legalBasis: string; // Theo TT 18/2026/TT-BYT & VBHN 07/VBHN-BYT
  settledAt?: string;
  ampouleReturned?: boolean;
  ampouleReturnTime?: string;
  ampouleDestroyed?: boolean;
}

export interface InventoryBatch {
  id: string;
  itemCode: string;
  itemName: string;
  category:
    | 'Thuốc gây nghiện'
    | 'Kháng sinh'
    | 'Dịch truyền & Cấp cứu'
    | 'Chỉ phẫu thuật & Khâu'
    | 'Vật tư tiêu hao'
    | 'Thuốc cấp cứu'
    | 'Vắc xin & Chuỗi lạnh';
  warehouseType?: WarehouseType;
  batchNumber: string; // Số lô
  expiryDate: string; // YYYY-MM-DD
  daysLeft: number;
  daysRemaining?: number;
  isNearExpiry: boolean; // Dưới 60 ngày -> FEFO ưu tiên đỏ
  currentStock: number;
  unit: string;
  warehouseLocation: string;
  storageCondition: string;
  priorityOrder: number;
  minThreshold: number; // Định mức an toàn tối thiểu (VBHN 07/VBHN-BYT)
  maxThreshold: number;
  isLowStock: boolean;
}
