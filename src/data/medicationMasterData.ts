/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kho Dữ Liệu Dược Lâm Sàng Bệnh Viện & Thuật Toán Tìm Kiếm Dược
 */

import { MasterMedication } from '../types/medication';
import { EMERGENCY_MASTER_MEDICATIONS } from './medications/emergencyMeds';
import { CONTROLLED_HIGH_ALERT_MASTER_MEDICATIONS } from './medications/controlledHighAlertMeds';
import { ANTIBIOTICS_INFUSIONS_MASTER_MEDICATIONS } from './medications/antibioticsInfusionsMeds';
import { SUPPLIES_MASTER_MEDICATIONS } from './medications/suppliesMeds';

export const ALL_MASTER_MEDICATIONS: MasterMedication[] = [
  ...EMERGENCY_MASTER_MEDICATIONS,
  ...CONTROLLED_HIGH_ALERT_MASTER_MEDICATIONS,
  ...ANTIBIOTICS_INFUSIONS_MASTER_MEDICATIONS,
  ...SUPPLIES_MASTER_MEDICATIONS,
];

/**
 * Loại bỏ dấu tiếng Việt để tìm kiếm mờ nhanh chóng
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export interface MedicationSearchOptions {
  onlyCrashCart?: boolean; // Chỉ tìm trong cơ số tủ trực cấp cứu
  groupFilter?: string; // Lọc theo nhóm
  limit?: number; // Số lượng kết quả tối đa
}

/**
 * Thuật toán tìm kiếm Dược đa chiều (Tên, Hoạt chất, Mã BHYT, Alias, Không dấu)
 */
export function searchMasterMedications(
  query: string,
  options: MedicationSearchOptions = {}
): MasterMedication[] {
  const { onlyCrashCart = false, groupFilter, limit = 8 } = options;
  const cleanQuery = removeVietnameseTones(query);

  let pool = ALL_MASTER_MEDICATIONS;
  if (onlyCrashCart) {
    pool = pool.filter((m) => m.isCrashCart);
  }
  if (groupFilter) {
    pool = pool.filter((m) => m.group === groupFilter);
  }

  if (!cleanQuery) {
    return pool.slice(0, limit);
  }

  return pool
    .filter((med) => {
      const matchBrand = removeVietnameseTones(med.brandName).includes(cleanQuery);
      const matchActive = removeVietnameseTones(med.activeIngredient).includes(cleanQuery);
      const matchCode = med.nationalCode.toLowerCase().includes(cleanQuery);
      const matchTallMan = med.tallManName ? removeVietnameseTones(med.tallManName).includes(cleanQuery) : false;
      const matchAliases = med.searchAliases.some((alias) =>
        removeVietnameseTones(alias).includes(cleanQuery)
      );

      return matchBrand || matchActive || matchCode || matchTallMan || matchAliases;
    })
    .slice(0, limit);
}
