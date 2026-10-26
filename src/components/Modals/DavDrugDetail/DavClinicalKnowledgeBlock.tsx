/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược Thư Quốc Gia Việt Nam 2022 (<=200 LOC)
 */

import React from 'react';
import { BookOpen, ShieldAlert, Sparkles, CheckCircle } from 'lucide-react';
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
      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-2xs sm:text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Thuốc chưa có chuyên luận riêng trong Dược Thư Quốc Gia (Đông dược hoặc thuốc mới).</span>
        </div>
        <span className="text-slate-400 italic">Để trống theo hồ sơ gốc</span>
      </div>
    );
  }

  return (
    <div className="border border-teal-200/90 bg-teal-50/20 rounded-lg p-3.5 space-y-3 shadow-2xs">
      {/* Header Chuyên Luận Dược Thư Quốc Gia 2022 */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-teal-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-teal-950 text-xs sm:text-sm">
                Dược Thư Quốc Gia Việt Nam
              </span>
              <span className="text-3xs font-semibold text-teal-800 bg-teal-100/90 border border-teal-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <CheckCircle className="w-2.5 h-2.5 text-teal-700" /> Bản 2022 (QĐ 3445/QĐ-BYT)
              </span>
            </div>
            {data.drugClass && (
              <p className="text-2xs text-teal-800 line-clamp-1 mt-0.5 font-medium">{data.drugClass}</p>
            )}
          </div>
        </div>

        {data.atcCode && (
          <span className="font-mono text-2xs font-bold text-teal-900 bg-white border border-teal-300 px-2 py-0.5 rounded shadow-2xs">
            Mã ATC: {data.atcCode}
          </span>
        )}
      </div>

      {/* Cảnh Báo An Toàn: Chống Chỉ Định Tuyệt Đối */}
      {data.contraindications && (
        <div className="bg-rose-50/95 border border-rose-200 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-rose-900 font-bold text-2xs sm:text-xs uppercase tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Chống chỉ định tuyệt đối</span>
          </div>
          <p className="text-2xs sm:text-xs text-rose-950 leading-relaxed whitespace-pre-line font-medium pl-5">
            {data.contraindications}
          </p>
        </div>
      )}

      {/* Thuốc Giải Độc Đặc Hiệu (Antidote) */}
      {data.antidote && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-start gap-2 shadow-2xs">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="text-2xs font-bold uppercase text-emerald-900">Thuốc giải độc đặc hiệu (Antidote):</span>
            <p className="text-2xs sm:text-xs text-emerald-950 font-semibold mt-0.5">{data.antidote}</p>
          </div>
        </div>
      )}

      {/* Tabs nội dung lâm sàng đầy đủ (Liều lượng, Chỉ định, ADR, Tương tác) */}
      <DavClinicalTabs data={data} />
    </div>
  );
};
