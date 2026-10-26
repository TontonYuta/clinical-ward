/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Nút Xem Tài Liệu PDF (HDSD & Mẫu Nhãn) Cục Quản Lý Dược (<=200 LOC)
 * Tích hợp luồng trực tiếp từ dichvucong.dav.gov.vn/File/GoToViewTaiLieu
 */

import React from 'react';
import { FileText, Tag, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { getDavPdfUrl } from '../../../config/clinicalVerification';

interface DavDocumentActionButtonsProps {
  hdsdPath?: string;
  labelPath?: string;
  nationalCode?: string;
  brandName?: string;
}

export const DavDocumentActionButtons: React.FC<DavDocumentActionButtonsProps> = ({
  hdsdPath,
  labelPath,
  nationalCode,
  brandName,
}) => {
  const hdsdUrl = getDavPdfUrl(hdsdPath);
  const labelUrl = getDavPdfUrl(labelPath);
  const davSearchUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(nationalCode || brandName || '')}`;

  const hasAnyDoc = Boolean(hdsdUrl || labelUrl);

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-2xs uppercase font-bold text-slate-700">
          <FileText className="w-3.5 h-3.5 text-teal-700" />
          <span>Tài Liệu Số Hóa Cục Quản Lý Dược (Bộ Y Tế)</span>
        </div>
        <span className="text-[10px] text-teal-800 font-medium bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
          Chữ ký số & Pháp lý SmPC
        </span>
      </div>

      {hasAnyDoc ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {hdsdUrl ? (
            <a
              href={hdsdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs transition shadow-xs group"
              title="Mở toàn văn Tờ Hướng Dẫn Sử Dụng (SmPC) PDF chính thức có chữ ký số của Cục QLD"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-teal-200 shrink-0" />
                <span className="truncate">Xem Tờ HDSD (PDF Gốc)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-teal-300 group-hover:text-white shrink-0" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs border border-slate-200">
              <FileText className="w-4 h-4 shrink-0 text-slate-300" />
              <span>Chưa có file scan HDSD</span>
            </div>
          )}

          {labelUrl ? (
            <a
              href={labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 hover:text-teal-900 border border-slate-300 font-semibold text-xs transition shadow-2xs group"
              title="Mở bản vẽ kỹ thuật Mẫu Nhãn Bao Bì lưu hành được Bộ Y Tế phê duyệt"
            >
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="truncate">Xem Mẫu Nhãn (PDF)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-800 shrink-0" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs border border-slate-200">
              <Tag className="w-4 h-4 shrink-0 text-slate-300" />
              <span>Chưa có file scan Mẫu nhãn</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2 bg-amber-50/70 border border-amber-200/80 rounded-lg text-2xs text-amber-900">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Hồ sơ giấy truyền thống chưa số hóa PDF trực tuyến tại Cổng Dịch vụ công.</span>
          </div>
          <a
            href={davSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-amber-950 underline hover:text-amber-800 shrink-0 inline-flex items-center gap-1"
          >
            <span>Tra cứu SĐK</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
