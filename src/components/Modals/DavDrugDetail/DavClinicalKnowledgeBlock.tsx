/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược Thư Quốc Gia Việt Nam 2022 (<=200 LOC)
 * Font chữ tăng gấp đôi, hỗ trợ scroll ngang và dọc mượt mà với thanh scroll siêu nhỏ
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
      <div className="border border-slate-200 bg-white rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-base font-bold">Đang nạp chuyên luận Dược Thư Quốc Gia &amp; CSDL Dược...</span>
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
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-base sm:text-lg text-slate-600 flex items-center justify-between">
        <span>Thuốc chưa có chuyên luận riêng trong Dược Thư Quốc Gia (Đông dược hoặc thuốc mới).</span>
        <span className="text-sm text-slate-500 italic">Theo hồ sơ cấp phép Cục QLD</span>
      </div>
    );
  }

  const srcInfo = parseSource(data.clinicalSource);

  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
      {/* Header Chuyên Luận Dược Thư Quốc Gia */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-200">
        <div className="flex-1 min-w-[300px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-black text-slate-900 text-xl sm:text-2xl tracking-tight">
              Dược Thư Quốc Gia Việt Nam
            </h3>
            <span className="text-sm font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-md">
              Lần xuất bản II - 2015 (QĐ 2033/QĐ-BYT)
            </span>
          </div>
          {srcInfo ? (
            <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm sm:text-base">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-900 text-base sm:text-lg">{srcInfo.legalBasis}</span>
                {srcInfo.pageStr && (
                  <span className="font-mono font-black text-base sm:text-lg bg-blue-50 text-blue-900 border border-blue-300 px-3 py-0.5 rounded-md">
                    {srcInfo.pageStr}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200">
                {srcInfo.pdfFile && (
                  <span className="font-mono text-sm text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-red-600" />
                    {srcInfo.pdfFile}
                  </span>
                )}
                {srcInfo.pdfUrl && (
                  <a
                    href={srcInfo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-xs transition cursor-pointer"
                    title={`Mở trực tiếp tệp ${srcInfo.pdfFile}${srcInfo.pageNum ? ` tại Trang ${srcInfo.pageNum}` : ''}`}
                  >
                    <span>Mở PDF Dược Thư {srcInfo.pageNum ? `(Trang ${srcInfo.pageNum})` : ''}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-800 mt-1 italic">
              Đang đối soát chuyên luận đối chiếu từ CSDL Dược Quốc Gia
            </p>
          )}
          {data.drugClass && !srcInfo && (
            <p className="text-base text-slate-600 mt-1 font-semibold">{data.drugClass}</p>
          )}
        </div>

        {data.atcCode && (
          <span className="font-mono text-sm sm:text-base font-black text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
            Mã ATC: {data.atcCode}
          </span>
        )}
      </div>

      {/* Tabs nội dung lâm sàng cấu trúc hóa */}
      <DavClinicalTabs data={data} />
    </div>
  );
};
