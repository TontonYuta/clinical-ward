/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược Thư Quốc Gia Việt Nam 2022 (<=200 LOC)
 */

import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
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

function parseSource(src?: string) {
  if (!src) return null;
  const pageMatch = src.match(/Trang\s*([\d\s–-]+)/i);
  const pageStr = pageMatch ? pageMatch[0].trim() : null;
  const pageNum = pageMatch ? parseInt(pageMatch[1].trim().split(/[-–\s]+/)[0], 10) : null;
  const pdfMatch = src.match(/([A-Za-z0-9_.-]+\.pdf)/i);
  const pdfFile = pdfMatch ? pdfMatch[1] : (src.includes('Dược thư') ? 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf' : null);
  const pdfUrl = pdfFile ? `/pdf/${pdfFile}${pageNum ? `#page=${pageNum}` : ''}` : null;
  const legalBasis = src.split('•')[0].replace(/,\s*Trang\s*[\d\s–-]+/i, '').trim();
  return { legalBasis, pdfFile, pageStr, pageNum, pdfUrl };
}

export const DavClinicalKnowledgeBlock: React.FC<{ data: ClinicalDataProps; isLoading?: boolean }> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="border border-slate-200 bg-white rounded-lg p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Đang nạp chuyên luận Dược Thư Quốc Gia &amp; CSDL Dược...</span>
      </div>
    );
  }

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

  const srcInfo = parseSource(data.clinicalSource);

  return (
    <div className="border border-slate-200 bg-white rounded-lg p-4 space-y-3.5">
      {/* Header Chuyên Luận Dược Thư Quốc Gia */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Dược Thư Quốc Gia Việt Nam
            </h3>
            <span className="text-2xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              Lần xuất bản II - 2015 (QĐ 2033/QĐ-BYT)
            </span>
          </div>
          {srcInfo ? (
            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-slate-800">{srcInfo.legalBasis}</span>
                {srcInfo.pageStr && (
                  <span className="font-mono font-bold text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                    {srcInfo.pageStr}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/60">
                {srcInfo.pdfFile && (
                  <span className="font-mono text-2xs text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <FileText className="w-3 h-3 text-red-600" />
                    {srcInfo.pdfFile}
                  </span>
                )}
                {srcInfo.pdfUrl && (
                  <a
                    href={srcInfo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-2xs shadow-2xs transition cursor-pointer"
                    title={`Mở trực tiếp tệp ${srcInfo.pdfFile}${srcInfo.pageNum ? ` tại Trang ${srcInfo.pageNum}` : ''}`}
                  >
                    <span>Mở PDF đối chứng {srcInfo.pageNum ? `(Trang ${srcInfo.pageNum})` : ''}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-2xs text-amber-700 mt-1 italic">
              Chưa có tài liệu chuyên luận đối chiếu trong kho tài liệu nội bộ
            </p>
          )}
          {data.drugClass && !srcInfo && (
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
