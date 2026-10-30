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
    <div className="space-y-2">
      {isResolving ? (
        <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-lg text-xs text-slate-700">
          <Loader2 className="w-4 h-4 text-slate-600 animate-spin shrink-0" />
          <span>Đang truy xuất hồ sơ điện tử từ Cổng Cục QLD…</span>
        </div>
      ) : hasAnyDoc ? (
        <div className="space-y-2">
          {hdsdUrl ? (
            <a
              href={hdsdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-medium text-xs transition cursor-pointer"
              title="Mở tờ hướng dẫn sử dụng PDF"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">Tờ Hướng Dẫn Sử Dụng (HDSD PDF Gốc)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </a>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 text-slate-400 text-xs border border-slate-200">
              <FileText className="w-4 h-4 shrink-0 text-slate-300" />
              <span>Chưa có file scan HDSD</span>
            </div>
          )}

          {labelUrl ? (
            <a
              href={labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-medium text-xs transition cursor-pointer"
              title="Mở bản vẽ kỹ thuật Mẫu Nhãn Bao Bì lưu hành được Bộ Y Tế phê duyệt"
            >
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">Mẫu Nhãn Bao Bì (PDF Gốc)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </a>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 text-slate-400 text-xs border border-slate-200">
              <Tag className="w-4 h-4 shrink-0 text-slate-300" />
              <span>Chưa có file scan Mẫu nhãn</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              {isLegacyPaper
                ? 'Hồ sơ giấy chưa có tệp scan PDF trên Cổng DVC.'
                : 'Chưa đính kèm tệp PDF công khai.'}
            </span>
          </div>
          <a
            href={davSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline hover:text-slate-700 shrink-0 inline-flex items-center gap-1"
          >
            <span>Tra Cổng QLD</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
