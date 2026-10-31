/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Lâm Sàng Dược thư Quốc gia lần xuất bản II (2015) (<=200 LOC)
 * Font chữ tăng gấp đôi, hỗ trợ scroll ngang và dọc mượt mà với thanh scroll siêu nhỏ
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { DavClinicalTabs, TabType } from './DavClinicalTabs';

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

export const DavClinicalKnowledgeBlock: React.FC<{ data: ClinicalDataProps; isLoading?: boolean; activeTab?: TabType; showNavigation?: boolean }> = ({ data, isLoading, activeTab, showNavigation }) => {
  if (isLoading) {
    return (
      <div className="border border-slate-200 bg-white rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-7 h-7 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-slate-600">Đang tải thông tin chuyên luận Dược Thư…</span>
      </div>
    );
  }

  const hasClinicalData = Boolean(
    data.contraindications ||
    data.adultDosage ||
    data.indications ||
    data.drugInteractions
  );

  if (!hasClinicalData) {
    return (
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 text-base sm:text-lg text-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-bold">
          <span>⚠️ Thuốc chưa có chuyên luận riêng trong Dược Thư Quốc Gia 2015 (QĐ 2033/QĐ-BYT).</span>
        </div>
        <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
          Dược Thư chỉ gồm ~700 hoạt chất gốc (Generic). Căn cứ theo quy định của Bộ Y Tế, nhân viên y tế tra cứu và tuân thủ trực tiếp theo <strong>Tờ Hướng Dẫn Sử Dụng (HDSD)</strong> và <strong>Nhãn thuốc chính thức</strong> do Cục Quản lý Dược phê duyệt cấp phép lưu hành.
        </p>
      </div>
    );
  }

  const srcInfo = parseSource(data.clinicalSource);

  return (
    <div className="space-y-3">
      {/* Header Chuyên Luận Dược Thư Quốc Gia */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-lg sm:text-xl tracking-tight">
              Dược Thư Quốc Gia Việt Nam
            </h3>
          </div>
          {srcInfo ? (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-slate-900 text-sm">{srcInfo.legalBasis}</span>
                {srcInfo.pageStr && (
                  <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-md">
                    {srcInfo.pageStr}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end flex-wrap gap-2 pt-2 border-t border-slate-200">
                {srcInfo.pdfUrl && (
                  <a
                    href={srcInfo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm shadow-xs transition cursor-pointer"
                    title={`Mở trực tiếp tệp ${srcInfo.pdfFile}${srcInfo.pageNum ? ` tại Trang ${srcInfo.pageNum}` : ''}`}
                  >
                    <span>Mở PDF Dược Thư {srcInfo.pageNum ? `(Trang ${srcInfo.pageNum})` : ''}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </a>
                )}
              </div>
            </div>
          ) : null}
          {data.drugClass && !srcInfo && (
            <p className="text-base text-slate-600 mt-1 font-semibold">{data.drugClass}</p>
          )}
        </div>

        {data.atcCode && (
          <span className="font-mono text-sm sm:text-base font-semibold text-slate-700">
            Mã ATC: {data.atcCode}
          </span>
        )}
      </div>

      {/* Tabs nội dung lâm sàng cấu trúc hóa */}
      <DavClinicalTabs data={data} activeTab={activeTab} showNavigation={showNavigation} />
    </div>
  );
};
