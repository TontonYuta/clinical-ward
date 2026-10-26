/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược Thư Quốc Gia Việt Nam (<=200 LOC)
 */

import React, { useState } from 'react';
import { BookOpen, AlertOctagon, ShieldAlert, Sparkles, ChevronDown, ChevronUp, Stethoscope, Droplet } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const hasClinicalData = Boolean(data.contraindications || data.adultDosage || data.indications || data.atcCode);

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
    <div className="border border-teal-200/90 bg-teal-50/30 rounded-lg p-3.5 space-y-3">
      {/* Header Chuyên Luận */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-teal-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-teal-700 text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-teal-950 text-xs sm:text-sm flex items-center gap-1.5">
              Dược Thư Quốc Gia Việt Nam
              <span className="text-2xs font-normal text-teal-700 bg-teal-100/80 border border-teal-200 px-1.5 py-0.2 rounded">
                Chuẩn Bộ Y Tế
              </span>
            </span>
            {data.drugClass && (
              <p className="text-2xs text-teal-800 line-clamp-1 mt-0.5">{data.drugClass}</p>
            )}
          </div>
        </div>

        {data.atcCode && (
          <span className="font-mono text-2xs font-bold text-teal-900 bg-white border border-teal-200 px-2 py-0.5 rounded shadow-2xs">
            Mã ATC: {data.atcCode}
          </span>
        )}
      </div>

      {/* Chống Chỉ Định (Bắt buộc cảnh báo đỏ nếu có) */}
      {data.contraindications && (
        <div className="bg-rose-50/90 border border-rose-200 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-rose-900 font-bold text-2xs sm:text-xs uppercase tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Chống chỉ định tuyệt đối</span>
          </div>
          <p className="text-2xs sm:text-xs text-rose-950 leading-relaxed whitespace-pre-line font-medium pl-5">
            {data.contraindications}
          </p>
        </div>
      )}

      {/* Thuốc Giải Độc (Antidote) nếu có */}
      {data.antidote && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="text-2xs font-bold uppercase text-emerald-900">Thuốc giải độc đặc hiệu (Antidote):</span>
            <p className="text-2xs sm:text-xs text-emerald-950 font-semibold mt-0.5">{data.antidote}</p>
          </div>
        </div>
      )}

      {/* Liều Lượng & Trần Liều 24h */}
      {(data.adultDosage || data.pediatricDosage) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-2xs sm:text-xs">
          {data.adultDosage && (
            <div className="bg-white border border-slate-200 rounded p-2.5">
              <span className="font-bold text-slate-800 block text-2xs uppercase mb-1">Liều người lớn & Trần liều:</span>
              <p className="text-slate-700 line-clamp-3 leading-relaxed whitespace-pre-line">{data.adultDosage}</p>
            </div>
          )}
          {data.pediatricDosage && (
            <div className="bg-white border border-slate-200 rounded p-2.5">
              <span className="font-bold text-slate-800 block text-2xs uppercase mb-1">Liều trẻ em (mg/kg):</span>
              <p className="text-slate-700 line-clamp-3 leading-relaxed whitespace-pre-line">{data.pediatricDosage}</p>
            </div>
          )}
        </div>
      )}

      {/* Xem thêm chi tiết lâm sàng (Thận trọng, Suy thận, Tương tác, ADR) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-2xs font-semibold text-teal-800 hover:text-teal-950 flex items-center gap-1 cursor-pointer"
        >
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isExpanded ? 'Thu gọn chi tiết lâm sàng' : 'Xem chỉnh liều suy thận, suy gan & tương tác thuốc'}</span>
        </button>

        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-teal-100 space-y-2 text-2xs sm:text-xs animate-in fade-in duration-150">
            {data.renalAdjustment && (
              <div className="bg-white border border-slate-200 rounded p-2">
                <span className="font-bold text-indigo-900 block mb-0.5">Hiệu chỉnh liều suy thận (ClCr):</span>
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">{data.renalAdjustment}</p>
              </div>
            )}
            {data.hepaticAdjustment && (
              <div className="bg-white border border-slate-200 rounded p-2">
                <span className="font-bold text-amber-900 block mb-0.5">Hiệu chỉnh liều suy gan:</span>
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">{data.hepaticAdjustment}</p>
              </div>
            )}
            {data.drugInteractions && (
              <div className="bg-white border border-slate-200 rounded p-2">
                <span className="font-bold text-purple-900 block mb-0.5">Tương tác thuốc đáng chú ý:</span>
                <p className="text-slate-700 line-clamp-4 whitespace-pre-line leading-relaxed">{data.drugInteractions}</p>
              </div>
            )}
            {data.overdoseTreatment && !data.antidote && (
              <div className="bg-white border border-slate-200 rounded p-2">
                <span className="font-bold text-rose-900 block mb-0.5">Xử trí quá liều:</span>
                <p className="text-slate-700 line-clamp-3 whitespace-pre-line leading-relaxed">{data.overdoseTreatment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
