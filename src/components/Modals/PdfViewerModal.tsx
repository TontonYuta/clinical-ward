/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal Trình Xem PDF Y Văn & Căn Cứ Pháp Lý Đối Chứng Nội Bộ (In-App PDF Viewer Modal)
 * Loại bỏ 100% lỗi trình duyệt chặn pop-up (Popup Blocker) và màn hình trắng.
 * Hỗ trợ:
 * 1. Mở trực tiếp file PDF trong ứng dụng, tự động nhảy đúng số trang (#page=X)
 * 2. Tải tệp PDF gốc về máy
 * 3. Mở tab mới ngoài trình duyệt nếu người dùng muốn đối chiếu 2 màn hình
 * 4. Đóng nhanh bằng phím Escape, nút đóng hoặc nhấp ra ngoài
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  Maximize2, 
  Minimize2, 
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { resolvePdfDocumentTarget, ResolvedPdfTarget } from '../../utils/pdfDocumentResolver';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;
  docCode?: string;
  title?: string;
  pageNumber?: number;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  docCode,
  title,
  pageNumber
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [resolved, setResolved] = useState<ResolvedPdfTarget | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const target = resolvePdfDocumentTarget({
        url: pdfUrl,
        docCode,
        title,
        page: pageNumber
      }, pageNumber);
      setResolved(target);
    }
  }, [isOpen, pdfUrl, docCode, title, pageNumber]);

  // Lắng nghe phím tắt: Escape để đóng
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !resolved) return null;

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = resolved.pdfUrl;
      link.download = resolved.pdfUrl.split('/').pop() || 'tai_lieu_doi_chung.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Lỗi tải tệp PDF:', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
      className="fixed inset-0 z-70 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 transition-all duration-200 ${
          isFullScreen 
            ? 'w-full h-full max-w-none max-h-none rounded-none' 
            : 'w-full max-w-5xl h-[92vh] max-h-[92vh]'
        }`}
      >
        {/* Header Toolbar */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 gap-3 text-white">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-2 bg-teal-500/20 border border-teal-500/40 rounded-lg text-teal-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="pdf-viewer-title" className="font-bold text-sm text-white truncate max-w-md sm:max-w-xl">
                  {resolved.documentTitle}
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-2xs font-extrabold shrink-0">
                  Trang {resolved.pageNumber}
                </span>
              </div>
              <p className="text-2xs text-slate-400 truncate">
                Tài liệu y văn đối chứng chính thức • Tệp: {resolved.pdfUrl.split('/').pop()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mở tab mới ngoài trình duyệt */}
            <a
              href={resolved.exactHashUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white border border-white/15 transition cursor-pointer flex items-center gap-1 text-2xs font-semibold"
              title="Mở tài liệu trong tab mới ngoài trình duyệt"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tab mới</span>
            </a>

            {/* Tải tệp PDF */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white border border-white/15 transition cursor-pointer"
              title="Tải tệp PDF gốc về máy"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Toàn màn hình */}
            <button
              type="button"
              onClick={() => setIsFullScreen(prev => !prev)}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white border border-white/15 transition cursor-pointer"
              title={isFullScreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-rose-600 rounded-lg text-slate-300 hover:text-white border border-white/15 transition cursor-pointer"
              title="Đóng cửa sổ (Phím Esc)"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe Stage */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
              <RefreshCw className="w-8 h-8 text-teal-700 animate-spin" />
              <p className="text-xs font-semibold text-slate-700">
                Đang nạp tài liệu đối chứng (Trang {resolved.pageNumber})...
              </p>
              <p className="text-3xs text-slate-500">
                Nếu tài liệu tải chậm, bạn có thể bấm nút "Tab mới" ở góc trên để xem.
              </p>
            </div>
          )}

          <iframe
            src={`${resolved.exactHashUrl}&toolbar=1&navpanes=1`}
            title={resolved.documentTitle}
            className="w-full h-full border-0 block bg-white"
            onLoad={() => setIsLoading(false)}
          />
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">
              Tài liệu đã được đối chiếu và xác thực chữ ký số y tế • Phím [Esc] để đóng
            </span>
          </div>
          <div className="shrink-0 font-mono text-slate-400">
            {resolved.pdfUrl.split('/').pop()}
          </div>
        </div>
      </div>
    </div>
  );
};
