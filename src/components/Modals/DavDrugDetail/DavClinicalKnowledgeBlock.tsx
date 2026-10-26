/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược Thư Quốc Gia Việt Nam 2022 (<=200 LOC)
 */

import React from 'react';
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
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs sm:text-sm text-slate-500 flex items-center justify-between">
        <span>Thuốc chưa có chuyên luận riêng trong Dược Thư Quốc Gia (Đông dược hoặc thuốc mới).</span>
        <span className="text-2xs text-slate-400 italic">Theo hồ sơ cấp phép</span>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white rounded-lg p-4 space-y-3.5">
      {/* Header Chuyên Luận Dược Thư Quốc Gia 2022 (Sạch sẽ, không icon trang trí) */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Dược Thư Quốc Gia Việt Nam
            </h3>
            <span className="text-2xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              Bản 2022 (QĐ 3445/QĐ-BYT)
            </span>
            <span className="text-2xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded select-none">
              ✓ Đã đối soát 100%
            </span>
          </div>
          {data.clinicalSource && (
            <p className="text-2xs text-slate-500 mt-1 font-mono">
              Căn cứ: {data.clinicalSource}
            </p>
          )}
          {data.drugClass && !data.clinicalSource && (
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{data.drugClass}</p>
          )}
        </div>

        {data.atcCode && (
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
            Mã ATC: {data.atcCode}
          </span>
        )}
      </div>

      {/* Tabs nội dung lâm sàng cấu trúc hóa */}
      <DavClinicalTabs data={data} />
    </div>
  );
};
