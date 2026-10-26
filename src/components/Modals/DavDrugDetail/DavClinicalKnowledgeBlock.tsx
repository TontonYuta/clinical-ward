/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược Thư Quốc Gia Việt Nam 2022 (<=200 LOC)
 */

import React from 'react';
import { BookOpen, CheckCircle } from 'lucide-react';
import { DavClinicalTabs } from './DavClinicalTabs';

export interface ClinicalDataProps {
  atcCode?: string;
  drugClass?: string;
  indications?: string;
  contraindications?: string;
  precautions?: string;
  pregnancyWarning?: string;
  adultDosage?: string;
  pediatricDosage?: string;
  renalAdjustment?: string;
  hepaticAdjustment?: string;
  adverseEffects?: string;
  drugInteractions?: string;
  overdoseTreatment?: string;
  antidote?: string;
  clinicalSource?: string;
}

export const DavClinicalKnowledgeBlock: React.FC<{ data: ClinicalDataProps }> = ({ data }) => {
  const hasClinicalData = Boolean(
    data.contraindications ||
    data.adultDosage ||
    data.indications ||
    data.atcCode ||
    data.pediatricDosage ||
    data.drugInteractions
  );

  if (!hasClinicalData) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-slate-400 shrink-0" />
          <span>Thuốc chưa có chuyên luận riêng trong Dược Thư Quốc Gia (Đông dược hoặc thuốc mới).</span>
        </div>
        <span className="text-xs text-slate-400 italic">Để trống theo hồ sơ gốc</span>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white rounded-lg p-4 space-y-3.5 shadow-xs">
      {/* Header Chuyên Luận Dược Thư Quốc Gia 2022 */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                Dược Thư Quốc Gia Việt Nam
              </span>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-blue-600" /> Bản 2022 (QĐ 3445/QĐ-BYT)
              </span>
            </div>
            {data.drugClass && (
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">{data.drugClass}</p>
            )}
          </div>
        </div>

        {data.atcCode && (
          <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
            Mã ATC: {data.atcCode}
          </span>
        )}
      </div>

      {/* Tabs nội dung lâm sàng đầy đủ (Liều lượng, Chỉ định, ADR, Tương tác) */}
      <DavClinicalTabs data={data} />
    </div>
  );
};
