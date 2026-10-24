/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  CLINICAL_SYSTEM_INSTRUCTION,
  getGeminiApiKey,
  saveGeminiApiKey,
  isCloudAIAvailable
} from './gemini/config';

export {
  askGeminiClinicalCopilot,
  type ClinicalContextOptions
} from './gemini/copilot';

export {
  analyzeMedicalInvoiceWithGemini,
  type ParsedInvoiceItem,
  type ParsedInvoiceResult
} from './gemini/visionOcr';

export {
  diagnoseBiomedicalDeviceWithGemini
} from './gemini/biomedical';
