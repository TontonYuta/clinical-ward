/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Centralized Storage Keys Registry for Clinical Ward
 */

export const STORAGE_KEYS = {
  // CPOE & Prescriptions
  CLINICAL_CACHED_CPOE: 'clinical_cached_cpoe',
  LEGACY_CPOE_PRESCRIPTIONS_V2: 'cpoe_prescriptions_cache_v2',

  // Patients
  CLINICAL_PATIENTS_CACHE: 'clinical_patients_cache_v1',

  // Clinical Copilot & Multi-session Chat
  CLINICAL_CHAT_MESSAGES: 'clinical_chat_messages',
  CLINICAL_WARD_CHAT_MESSAGES: 'clinical_ward_chat_messages',
  CLINICAL_VOICE_AUTO_SEND: 'clinical_voice_auto_send',
  CLINICAL_CHAT_SIDEBAR_OPEN: 'clinical_chat_sidebar_open',
  CLINICAL_GEMINI_MODEL: 'clinical_gemini_model',

  // Operational State & Verification
  CLINICAL_SHOW_VERIFICATION_LINKS: 'CLINICAL_SHOW_VERIFICATION_LINKS',
  CLINICAL_USER_ROLE: 'clinical_user_role',
  CLINICAL_FONT_SCALE: 'clinical_font_scale',

  // Session Storage
  CPOE_FILTER_TYPE: 'cpoe_filter_type',
  CPOE_SEARCH_QUERY: 'cpoe_search_query',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
