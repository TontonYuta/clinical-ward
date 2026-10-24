/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hệ thống Danh mục Quy phạm Pháp luật Y tế Việt Nam Cập Nhật 2026
 */

import React from 'react';

export type LegalDocId =
  | 'tt26_2025'
  | 'tt18_2026'
  | 'nd98_2021'
  | 'vbhn07_2018'
  | 'tt51_2017'
  | 'nd151_2017'
  | 'tt36_2018';

export interface LegalDocMeta {
  id: LegalDocId;
  code: string;
  shortCode: string;
  category: string;
  title: string;
  authority: string;
  effectiveDate?: string;
  replacesOrAmends?: string;
  link: string;
  icon?: React.ComponentType<{ className?: string }>;
  keyArticles: {
    article: string;
    summary: string;
    systemFeature: string;
  }[];
}

export interface LegalReferenceClause {
  lawCode: string;
  title: string;
  clause: string;
  mandatoryRule?: string;
}
