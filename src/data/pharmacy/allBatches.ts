/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hợp nhất Danh mục Kho Dược & Vật tư y tế Bệnh viện
 */

import { InventoryBatch } from '../../types/pharmacy';
import { INPATIENT_INVENTORY_BATCHES } from './inpatientBatches';
import { OUTPATIENT_INVENTORY_BATCHES } from './outpatientBatches';
import { SUPPLIES_INVENTORY_BATCHES } from './suppliesBatches';

export const INITIAL_INVENTORY_BATCHES: InventoryBatch[] = [
  ...SUPPLIES_INVENTORY_BATCHES.slice(0, 2), // batch-1, batch-2
  ...INPATIENT_INVENTORY_BATCHES.slice(0, 5), // batch-3..7
  ...SUPPLIES_INVENTORY_BATCHES.slice(2, 4), // batch-8, batch-9
  ...INPATIENT_INVENTORY_BATCHES.slice(5), // batch-10..18
  ...SUPPLIES_INVENTORY_BATCHES.slice(4), // batch-19, batch-20
  ...OUTPATIENT_INVENTORY_BATCHES, // batch-op-1..6
];

export {
  INPATIENT_INVENTORY_BATCHES,
  OUTPATIENT_INVENTORY_BATCHES,
  SUPPLIES_INVENTORY_BATCHES,
};
