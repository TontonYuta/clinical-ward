/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ngăn Đối Chiếu Nguồn Y Văn & Tài Liệu Gốc Kiểu NotebookLM (Chế độ Fullscreen Desktop)
 */

import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Maximize2,
  PanelRightClose,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import { RagCitationItem } from '../../types/chat';
import { resolvePdfDocumentTarget } from '../../utils/pdfDocumentResolver';
import { PdfHighlightViewer } from './PdfHighlightViewer';

export interface ActiveSourceDocument {
  title: string;
  url?: string | null;
  page?: number | null;
  excerpt?: string;
  legal_basis?: string;
  section?: string;
  document_id?: string | null;
  domain?: string;
  credibility_tier?: number;
  imageUrl?: string;
  drug_anchor?: string;
}

interface NotebookSourceInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  citations: RagCitationItem[];
  activeDocument: ActiveSourceDocument | null;
  onSelectDocument: (doc: ActiveSourceDocument | null) => void;
  onOpenFullModal?: (doc: ActiveSourceDocument) => void;
  onOpenImageModal?: (url: string, title: string) => void;
  messageQuery?: string;
}

export const NotebookSourceInspector: React.FC<NotebookSourceInspectorProps> = ({
  isOpen,
  onClose,
  citations,
  activeDocument,
  onSelectDocument,
  onOpenFullModal,
  onOpenImageModal,
  messageQuery,
}) => {
  const uniqueCitations = Array.from(
    new Map(
      (citations || []).map((c) => [
        [c.document_id, c.url, c.page, c.section, c.title].join('|'),
        c,
      ])
    ).values()
  );

  const isExternalWebUrl = Boolean(
    activeDocument?.url &&
    (activeDocument.url.startsWith('http://') || activeDocument.url.startsWith('https://'))
  );

  const resolvedPdf =
    activeDocument && !activeDocument.imageUrl && !isExternalWebUrl
      ? resolvePdfDocumentTarget(
          {
            url: activeDocument.url || undefined,
            title: activeDocument.title,
            legal_basis: activeDocument.legal_basis,
            page: activeDocument.page || undefined,
          },
          activeDocument.page || undefined
        )
      : null;

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Ngăn đối chiếu y văn"
      className="w-[48%] min-w-[420px] max-w-[760px] h-full bg-white border-l border-slate-200 flex flex-col shrink-0 transition-all duration-200"
    >
      {/* Header Ngăn Phải (1 thanh gọn duy nhất) */}
      <div className="h-11 px-3 border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          {activeDocument && uniqueCitations.length > 1 ? (
            <button
              type="button"
              onClick={() => onSelectDocument(null)}
              className="p-1 -ml-1 rounded-lg text-slate-500 hover:text-teal-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
              title="Danh sách căn cứ"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-6 h-6 rounded-md bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700 shrink-0">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          )}
          <h4 className="text-xs font-bold text-slate-900 truncate">
            {activeDocument ? activeDocument.title : 'Căn cứ & Nguồn đối chiếu'}
          </h4>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {resolvedPdf && (
            <a
              href={resolvedPdf.pdfUrl}
              download={resolvedPdf.pdfUrl.split('/').pop() || 'tai_lieu_y_van.pdf'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition"
              title="Tải tệp PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
          {resolvedPdf && onOpenFullModal && activeDocument && (
            <button
              type="button"
              onClick={() => onOpenFullModal(activeDocument)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
              title="Phóng to toàn màn hình"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          {resolvedPdf && (
            <a
              href={resolvedPdf.exactHashUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition"
              title="Mở tab mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Đóng ngăn đối chiếu"
            aria-label="Đóng ngăn đối chiếu"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thanh chuyển nhanh giữa các nguồn khi có >= 2 trích dẫn */}
      {activeDocument && uniqueCitations.length > 1 && (
        <div className="px-2.5 py-1.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {uniqueCitations.map((c, idx) => {
            const title = c.source || c.title || c.legal_basis || `Nguồn ${idx + 1}`;
            const isSelected =
              activeDocument.title === title &&
              (activeDocument.page ?? null) === (c.page ?? null);
            return (
              <button
                key={`tab-cit-${idx}`}
                type="button"
                onClick={() =>
                  onSelectDocument({
                    title,
                    url: c.url,
                    page: c.page,
                    excerpt: c.excerpt,
                    legal_basis: c.legal_basis,
                    section: c.section,
                    document_id: c.document_id,
                    domain: c.domain,
                    credibility_tier: c.credibility_tier,
                  })
                }
                className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 shrink-0 max-w-[180px] transition cursor-pointer ${
                  isSelected
                    ? 'bg-teal-800 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300 hover:text-teal-800'
                }`}
              >
                <span className="shrink-0">[{c.index ?? idx + 1}]</span>
                <span className="truncate">{title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Body Ngăn Phải */}
      {activeDocument ? (
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50/40">
          {/* 1. Xem ảnh đơn thuốc */}
          {activeDocument.imageUrl ? (
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-3">
              <img
                src={activeDocument.imageUrl}
                alt={activeDocument.title}
                className="max-w-full rounded-lg border border-slate-200 shadow-xs object-contain bg-white"
              />
              {onOpenImageModal && (
                <button
                  type="button"
                  onClick={() => onOpenImageModal(activeDocument.imageUrl!, activeDocument.title)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-teal-800 hover:border-teal-300 transition cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Phóng to kiểm tra chữ viết tay</span>
                </button>
              )}
            </div>
          ) : isExternalWebUrl ? (
            /* 2. Xem chi tiết nguồn Web ngoài */
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-teal-700">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{activeDocument.domain || 'Nguồn tham khảo Internet'}</span>
                </div>
                <h5 className="text-sm font-bold text-slate-900 leading-snug">{activeDocument.title}</h5>
                {activeDocument.excerpt && (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {activeDocument.excerpt}
                  </p>
                )}
              </div>
              {activeDocument.url && (
                <a
                  href={activeDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở bài viết gốc trên tab mới</span>
                </a>
              )}
            </div>
          ) : resolvedPdf ? (
            /* 3. Inline PDF Viewer đúng số trang kèm Highlight */
            <PdfHighlightViewer
              pdfUrl={resolvedPdf.pdfUrl}
              initialPage={resolvedPdf.pageNumber}
              highlightText={activeDocument.excerpt}
              citationTitle={activeDocument.title}
              citationSection={activeDocument.section}
              messageQuery={messageQuery}
              drugAnchor={activeDocument.drug_anchor}
            />
          ) : null}
        </div>
      ) : (
        /* Danh sách Excerpts kiểu NotebookLM */
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 thin-scrollbar">
          {messageQuery && uniqueCitations.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-teal-50/60 border border-teal-100 text-[11px] text-teal-900 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                Đối chiếu cho: <strong className="font-semibold">{messageQuery}</strong>
              </span>
            </div>
          )}

          {uniqueCitations.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Chưa có đoạn trích được chọn</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Khi trợ lý AI trả lời kèm căn cứ y văn, các đoạn trích gốc và trang PDF tương ứng sẽ xuất hiện tại đây để bạn kiểm chứng trực tiếp.
              </p>
            </div>
          ) : (
            uniqueCitations.map((c, idx) => {
              const title = c.source || c.title || c.legal_basis || 'Tài liệu y văn';
              const isWeb = Boolean(
                c.url && (c.url.startsWith('http://') || c.url.startsWith('https://')) && !c.document_id
              );
              const badgeNum = c.index ?? idx + 1;
              const loc = c.page ? `Trang ${c.page}` : c.section || '';

              return (
                <button
                  key={`${title}-${loc}-${idx}`}
                  type="button"
                  onClick={() =>
                    onSelectDocument({
                      title,
                      url: c.url,
                      page: c.page,
                      excerpt: c.excerpt,
                      legal_basis: c.legal_basis,
                      section: c.section,
                      document_id: c.document_id,
                      domain: c.domain,
                      credibility_tier: c.credibility_tier,
                    })
                  }
                  className="w-full text-left p-3 rounded-xl bg-slate-50/70 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-300 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {badgeNum}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-teal-900">
                        {title}
                      </span>
                    </div>
                    {isWeb ? (
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 shrink-0 mt-0.5" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 shrink-0 mt-0.5" />
                    )}
                  </div>

                  {loc && (
                    <div className="text-[11px] font-semibold text-teal-700 pl-7">{loc}</div>
                  )}

                  {c.excerpt && (
                    <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-4 pl-7">
                      "{c.excerpt}"
                    </p>
                  )}

                  <div className="pl-7 pt-0.5 text-[11px] font-semibold text-teal-800 opacity-80 group-hover:opacity-100">
                    {isWeb ? 'Xem tóm tắt & link gốc →' : 'Mở trang tài liệu gốc →'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
};
