/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Nút Xem Tài Liệu PDF (HDSD & Mẫu Nhãn) Cục Quản Lý Dược (<=200 LOC)
 */

import React, { useState, useEffect } from 'react';
import { FileText, Tag, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { getDavPdfUrl } from '../../../config/clinicalVerification';

interface DavDocumentActionButtonsProps {
  hdsdPath?: string;
  labelPath?: string;
  nationalCode?: string;
  brandName?: string;
}

export const DavDocumentActionButtons: React.FC<DavDocumentActionButtonsProps> = ({
  hdsdPath, labelPath, nationalCode, brandName,
}) => {
  const [resolvedHdsd, setResolvedHdsd] = useState<string | undefined>(hdsdPath);
  const [resolvedLabel, setResolvedLabel] = useState<string | undefined>(labelPath);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [attempted, setAttempted] = useState<boolean>(false);

  useEffect(() => {
    setResolvedHdsd(hdsdPath);
    setResolvedLabel(labelPath);
    setAttempted(false);
  }, [hdsdPath, labelPath, nationalCode]);

  useEffect(() => {
    if (resolvedHdsd || resolvedLabel || attempted || !nationalCode) return;
    let active = true;
    setIsResolving(true);

    fetch(`/api/v1/registry/${encodeURIComponent(nationalCode)}/documents`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.hdsd_path || data?.label_path) {
          setResolvedHdsd(data.hdsd_path || undefined);
          setResolvedLabel(data.label_path || undefined);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setIsResolving(false);
          setAttempted(true);
        }
      });

    return () => { active = false; };
  }, [resolvedHdsd, resolvedLabel, attempted, nationalCode]);

  const activeHdsd = resolvedHdsd || hdsdPath;
  const activeLabel = resolvedLabel || labelPath;
  const hdsdUrl = getDavPdfUrl(activeHdsd);
  const labelUrl = getDavPdfUrl(activeLabel);
  const davSearchUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(nationalCode || brandName || '')}`;

  const hasAnyDoc = Boolean(hdsdUrl || labelUrl);
  const isLegacyPaper = nationalCode ? !/^\d{12}$/.test(nationalCode) : false;

  return (
    <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/70 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase font-bold text-slate-500">
          Hồ Sơ Điện Tử Cục Quản Lý Dược
        </span>
        <span className="text-2xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          Pháp lý SmPC
        </span>
      </div>

      {isResolving ? (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <span>Đang đối soát hồ sơ điện tử TT89 từ Cổng Cục Quản Lý Dược...</span>
        </div>
      ) : hasAnyDoc ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {hdsdUrl ? (
            <a
              href={hdsdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition shadow-xs group cursor-pointer"
              title="Mở toàn văn Tờ Hướng Dẫn Sử Dụng (SmPC) PDF chính thức của Cục QLD"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-blue-100 shrink-0" />
                <span className="truncate">Xem Tờ HDSD (PDF Gốc)</span>
              </div>
              <ExternalLink className="w-4 h-4 text-blue-200 group-hover:text-white shrink-0" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded bg-slate-100 text-slate-400 text-xs border border-slate-200">
              <FileText className="w-4 h-4 shrink-0 text-slate-300" />
              <span>Chưa có file scan HDSD</span>
            </div>
          )}

          {labelUrl ? (
            <a
              href={labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded bg-white hover:bg-slate-50 text-slate-900 hover:text-blue-700 border border-slate-300 font-semibold text-xs sm:text-sm transition shadow-2xs group cursor-pointer"
              title="Mở bản vẽ kỹ thuật Mẫu Nhãn Bao Bì lưu hành được Bộ Y Tế phê duyệt"
            >
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">Xem Mẫu Nhãn (PDF)</span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded bg-slate-100 text-slate-400 text-xs border border-slate-200">
              <Tag className="w-4 h-4 shrink-0 text-slate-300" />
              <span>Chưa có file scan Mẫu nhãn</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {isLegacyPaper
                ? 'Hồ sơ giấy cấp phép trước TT89/2020 - Chưa có tệp scan PDF trên Cổng DVC.'
                : 'Hồ sơ điện tử chưa đính kèm tệp PDF công khai trên Cổng DVC.'}
            </span>
          </div>
          <a
            href={davSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-amber-950 underline hover:text-amber-800 shrink-0 inline-flex items-center gap-1"
          >
            <span>Tra cứu SĐK</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
};
