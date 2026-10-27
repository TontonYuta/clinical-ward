/**
 * Định nghĩa Types cho Kịch bản Lâm Sàng Phía Client (Frontend)
 */

import { PatientProfile } from '../../patientService';
import { ProcessedQueryResult } from '../../../utils/nlp/types';

export interface FrontendScenarioContext {
  rawInput: string;
  lower: string;
  nowStr: string;
  patient?: PatientProfile;
  aiAnswer: string | null;
}

export interface FrontendScenarioHandler {
  id: string;
  canHandle: (lower: string) => boolean;
  handle: (ctx: FrontendScenarioContext) => ProcessedQueryResult | null;
}
