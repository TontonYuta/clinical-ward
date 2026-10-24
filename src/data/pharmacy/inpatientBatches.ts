/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tổng hợp Kho Dược Nội Trú & Tủ Trực Cấp Cứu
 */

import { InventoryBatch } from '../../types/pharmacy';
import { INPATIENT_CENTRAL_BATCHES } from './inpatientCentralBatches';
import { WARD_EMERGENCY_BATCHES } from './wardEmergencyBatches';

export const INPATIENT_INVENTORY_BATCHES: InventoryBatch[] = [
  ...INPATIENT_CENTRAL_BATCHES,
  ...WARD_EMERGENCY_BATCHES,
];
