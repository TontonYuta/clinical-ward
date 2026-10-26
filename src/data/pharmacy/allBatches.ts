/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hợp nhất Danh mục Kho Dược Bệnh Viện từ CSDL 54.885 Thuốc Cục QLD (<=200 LOC)
 */

import { InventoryBatch } from '../../types/pharmacy';
import { INPATIENT_CENTRAL_BATCHES } from './inpatientCentralBatches';
import { WARD_EMERGENCY_BATCHES } from './wardEmergencyBatches';
import { OUTPATIENT_INVENTORY_BATCHES } from './outpatientBatches';
import { SUPPLIES_INVENTORY_BATCHES } from './suppliesBatches';

import { INPATIENT_INVENTORY_BATCHES } from './inpatientBatches';

export const INITIAL_INVENTORY_BATCHES: InventoryBatch[] = [
  ...INPATIENT_CENTRAL_BATCHES,
  ...WARD_EMERGENCY_BATCHES,
  ...OUTPATIENT_INVENTORY_BATCHES,
].sort((a, b) => a.priorityOrder - b.priorityOrder);

export {
  INPATIENT_CENTRAL_BATCHES,
  WARD_EMERGENCY_BATCHES,
  INPATIENT_INVENTORY_BATCHES,
  OUTPATIENT_INVENTORY_BATCHES,
  SUPPLIES_INVENTORY_BATCHES,
};
