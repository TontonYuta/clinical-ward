/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dữ liệu Kho Dược Ngoại Trú & Cấp phát BHYT Mạn Tính - CSDL 54.885 Thuốc Cục QLD (<=200 LOC)
 */

import { InventoryBatch } from '../../types/pharmacy';

export const OUTPATIENT_INVENTORY_BATCHES: InventoryBatch[] = [
  {
    id: 'b-18', itemCode: 'DP-SF-01', itemName: 'Safeesem 5',
    nationalCode: '890110197826', registrationNumber: '890110197826', activeIngredient: 'S-amlodipine (dưới dạng S-amlodipine besylate)',
    concentration: '5mg', dosageForm: 'Viên nén', manufacturer: 'MSN Laboratories Private Limited',
    country: 'Ấn Độ', packagingSpec: 'Hộp 3 vỉ x 10 viên', standardPharmacopeia: 'NSX', route: 'Đường uống',
    shelfLife: '36 tháng', applicantName: 'MSN Laboratories Private Limited', approvalDecision: 'QĐ 798/QĐ-QLD',
    category: 'Thuốc điều trị chuyên khoa', commodityType: 'medication', warehouseType: 'outpatient_pharmacy',
    batchNumber: 'LOT-SF26-A1', expiryDate: '2028-01-15', daysLeft: 446, isNearExpiry: false,
    currentStock: 800, minThreshold: 300, maxThreshold: 2500, isLowStock: false, unit: 'Viên',
    warehouseLocation: 'Kho Dược Ngoại Trú (Khu phát thuốc BHYT Mạn tính)',
    storageCondition: 'Bảo quản < 30°C, khô ráo GSP', priorityOrder: 18,
  },
  {
    id: 'b-19', itemCode: 'DP-PF-01', itemName: 'Panfor PR-750',
    nationalCode: '890110197726', registrationNumber: '890110197726', activeIngredient: 'Metformin Hydrochloride',
    concentration: '750mg', dosageForm: 'Viên nén phóng thích kéo dài', manufacturer: 'Inventia Healthcare Limited',
    country: 'Ấn Độ', packagingSpec: 'Hộp 10 vỉ x 10 viên', standardPharmacopeia: 'USP', route: 'Đường uống',
    shelfLife: '36 tháng', applicantName: 'Inventia Healthcare Limited', approvalDecision: 'QĐ 798/QĐ-QLD',
    category: 'Thuốc điều trị chuyên khoa', commodityType: 'medication', warehouseType: 'outpatient_pharmacy',
    batchNumber: 'LOT-PF26-M7', expiryDate: '2028-03-20', daysLeft: 510, isNearExpiry: false,
    currentStock: 950, minThreshold: 300, maxThreshold: 3000, isLowStock: false, unit: 'Viên',
    warehouseLocation: 'Kho Dược Ngoại Trú (Khu phát thuốc BHYT Mạn tính)',
    storageCondition: 'Bảo quản < 30°C, nơi khô mát GSP', priorityOrder: 19,
  },
  {
    id: 'b-20', itemCode: 'DP-AT-01', itemName: 'Atorvastatin Sandoz 20mg',
    nationalCode: '590110192126', registrationNumber: '590110192126', activeIngredient: 'Atorvastatin (dưới dạng Atorvastatin calci trihydrat)',
    concentration: '20mg', dosageForm: 'Viên nén bao phim', manufacturer: 'Lek S.A. (Ba Lan / Sandoz)',
    country: 'Ba Lan', packagingSpec: 'Hộp 3 vỉ x 10 viên', standardPharmacopeia: 'NSX / EP', route: 'Đường uống',
    shelfLife: '36 tháng', applicantName: 'Sandoz Pharmaceuticals d.d.', approvalDecision: 'QĐ 798/QĐ-QLD',
    category: 'Thuốc điều trị chuyên khoa', commodityType: 'medication', warehouseType: 'outpatient_pharmacy',
    batchNumber: 'LOT-AT26-S2', expiryDate: '2028-06-30', daysLeft: 612, isNearExpiry: false,
    currentStock: 600, minThreshold: 200, maxThreshold: 2000, isLowStock: false, unit: 'Viên',
    warehouseLocation: 'Kho Dược Ngoại Trú (Khu phát thuốc BHYT Mạn tính)',
    storageCondition: 'Bảo quản < 30°C, tránh ẩm GSP', priorityOrder: 20,
  },
];
