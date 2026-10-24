/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hợp nhất Danh mục Thuốc Cấp cứu, Hồi sinh tim phổi & Phản vệ (TT 51/2017 & TT 22/2011)
 */

import { MasterMedication } from '../../types/medication';
import { CARDIAC_EMERGENCY_MEDICATIONS } from './cardiacEmergencyMeds';
import { SEDATIVE_RESP_MEDICATIONS } from './sedativeRespMeds';

export const EMERGENCY_MASTER_MEDICATIONS: MasterMedication[] = [
  ...CARDIAC_EMERGENCY_MEDICATIONS,
  ...SEDATIVE_RESP_MEDICATIONS,
];
