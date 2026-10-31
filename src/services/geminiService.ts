/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  CLINICAL_SYSTEM_INSTRUCTION,
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  callGeminiWithFallback,
  getGeminiApiKey,
  saveGeminiApiKey,
  isCloudAIAvailable
} from './gemini/config';

export {
  askGeminiClinicalCopilot,
  type ClinicalContextOptions
} from './gemini/copilot';
