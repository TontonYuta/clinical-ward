/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trình xem bản Scan PDF Văn bản Gốc & Dược thư Bộ Y Tế (Full-bleed PDF Viewer)
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  FileText,
  Download,
} from 'lucide-react';

export interface PdfViewerTarget {
  title: string;
  url: string;
  page?: number | null;
  excerpt?: string;
  legal_basis?: string;
  section?: string;
  inn?: string;
}

interface PdfViewerDrawerProps {
  isOpen: boolean;
  target: PdfViewerTarget | null;
  onClose: () => void;
}

export const PdfViewerDrawer: React.FC<PdfViewerDrawerProps> = ({ isOpen, target, onClose }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (target?.page) {
      setCurrentPage(target.page);
    } else if (target?.url) {
      const match = target.url.match(/#page=(\d+)/);
      setCurrentPage(match ? parseInt(match[1], 10) : 1);
    } else {
      setCurrentPage(1);
    }
  }, [target]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !target) return null;

  const baseUrl = target.url.split('#')[0];
  const activeUrl = `${baseUrl}#page=${currentPage}`;

  const handleCopyExcerpt = (text?: string) => {
    const copyText = text || target.excerpt;
    if (!copyText) return;
    navigator.clipboard.writeText(copyText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePageChange = (delta: number) => {
    setCurrentPage((prev) => Math.max(1, prev + delta));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/30 backdrop-blur-[1px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide Drawer */}
      <div
        data-testid="in-app-pdf-drawer"
        className={`relative z-10 h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-full' : 'w-full sm:w-[600px] md:w-[720px] lg:w-[840px]'
        }`}
      >
        {/* Header Bar */}
        <div className="h-14 px-4 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between gap-3 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-teal-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {target.title || 'Bản Scan PDF Văn Bản Gốc'}
              </h3>
              <p className="text-xs text-slate-500 truncate font-sans">
                {target.legal_basis ? `${target.legal_basis} · ` : ''}Trang {currentPage}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Page navigation */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
              <button
                type="button"
                onClick={() => handlePageChange(-1)}
                className="p-1 rounded hover:bg-slate-200 transition cursor-pointer text-slate-600 hover:text-slate-900"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-sans tabular-nums px-1 font-semibold text-teal-700">Tr. {currentPage}</span>
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                className="p-1 rounded hover:bg-slate-200 transition cursor-pointer text-slate-600 hover:text-slate-900"
                title="Trang tiếp"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <a
              href={baseUrl}
              download
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Tải tệp PDF về máy"
            >
              <Download className="w-4 h-4" />
            </a>

            <a
              href={activeUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Mở toàn trang tab mới"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer hidden md:inline-flex"
              title={isExpanded ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
              title="Đóng (Esc)"
              aria-label="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Excerpt Alert Banner (nếu có đoạn trích dẫn cụ thể) */}
        {target.excerpt && (
          <div className="px-4 py-2 bg-teal-50/90 border-b border-teal-200/90 flex items-center justify-between gap-2 shrink-0 text-xs text-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="font-semibold text-teal-950 text-2xs shrink-0">
                Đoạn trích đối chứng (Trang {currentPage}):
              </span>
              <span className="text-slate-700 text-2xs truncate font-mono">
                "{target.excerpt.slice(0, 100)}..."
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyExcerpt()}
              className="p-1 rounded text-teal-800 hover:bg-teal-200/80 transition cursor-pointer shrink-0"
              title="Sao chép đoạn trích"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Full-Height Scan PDF Viewer Iframe */}
        <div className="flex-1 w-full h-full bg-slate-100 relative overflow-hidden">
          <iframe
            key={activeUrl}
            src={activeUrl}
            data-testid="in-app-pdf-iframe"
            className="w-full h-full border-0 bg-white"
            title={target.title || 'Bản Scan PDF Gốc'}
          />
        </div>
      </div>
    </div>
  );
};
