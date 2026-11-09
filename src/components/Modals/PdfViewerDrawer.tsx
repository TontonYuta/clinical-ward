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
  Search,
  Sparkles,
  Layers,
  Zap,
} from 'lucide-react';

export interface PdfViewerTarget {
  title: string;
  url: string;
  page?: number | null;
  excerpt?: string;
  legal_basis?: string;
  section?: string;
  inn?: string;
  searchTerm?: string;
  keywords?: string[];
  textFragmentUrl?: string;
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

  // Chế độ engine: 'native' (trình duyệt gốc, siêu tốc <0.1s) vs 'pdfjs' (tìm kiếm bôi vàng)
  const [engineMode, setEngineMode] = useState<'native' | 'pdfjs'>('native');

  // Trạng thái tìm kiếm đa từ khóa & cụm từ
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPhraseMatch, setIsPhraseMatch] = useState<boolean>(true);
  const [appliedQuery, setAppliedQuery] = useState<string>('');
  const [appliedIsPhrase, setAppliedIsPhrase] = useState<boolean>(true);
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);

  // Đồng bộ trang & từ khóa mặc định khi target thay đổi
  useEffect(() => {
    if (!target) return;

    if (target.page) {
      setCurrentPage(target.page);
    } else if (target.url) {
      const match = target.url.match(/#page=(\d+)/);
      setCurrentPage(match ? parseInt(match[1], 10) : 1);
    } else {
      setCurrentPage(1);
    }

    // Chọn từ khóa mặc định khởi đầu (ưu tiên searchTerm, rồi đến cụm thuốc + mục, hoặc tên thuốc)
    const initialQuery = (
      target.searchTerm ||
      (target.inn && target.section ? `${target.inn} ${target.section}` : '') ||
      target.section ||
      target.inn ||
      ''
    ).trim();

    // Làm sạch từ khóa (không lấy các nhãn văn bản tài liệu)
    const isDocLabel = /^(?:Dược thư|DTQG|DĐVN|QĐ|TT|NĐ|Luật|Nguồn|Bộ Y tế)/i.test(initialQuery);
    const cleanInitial = isDocLabel ? (target.inn || '') : initialQuery;

    setSearchQuery(cleanInitial);
    setAppliedQuery(cleanInitial);
    // MẶC ĐỊNH KHÔNG tự động kích hoạt tìm kiếm PDF.js để tránh quét 1600 trang gây đơ/chậm
    setIsSearchActive(false);
    setIsPhraseMatch(true);
    setAppliedIsPhrase(true);
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

  // Chỉ gắn &search khi người dùng chủ động bấm "Tìm", tránh PDF.js tự động quét toàn bộ 1600 trang
  const cleanSearch = isSearchActive ? appliedQuery.trim().replace(/["']/g, '') : '';
  const searchFragment = cleanSearch
    ? `&search=${encodeURIComponent(cleanSearch)}&phrase=${appliedIsPhrase ? 'true' : 'false'}`
    : '';

  const activeUrl = engineMode === 'native'
    ? `${baseUrl}#page=${currentPage}`
    : `/pdfjs/web/viewer.html?file=${encodeURIComponent(baseUrl)}#page=${currentPage}${searchFragment}`;

  const handleApplySearch = (queryToApply?: string, phraseMode?: boolean) => {
    const q = (queryToApply !== undefined ? queryToApply : searchQuery).trim();
    const p = phraseMode !== undefined ? phraseMode : isPhraseMatch;
    setSearchQuery(q);
    setAppliedQuery(q);
    setAppliedIsPhrase(p);
    if (q) {
      setIsSearchActive(true);
      setEngineMode('pdfjs'); // Tự động kích hoạt PDF.js để bôi vàng
    } else {
      setIsSearchActive(false);
    }
  };

  // Hàm bôi vàng đa từ khóa & cụm từ trong trích đoạn Excerpt
  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    if (!text) return '';
    const cleanKw = (query || '').trim();
    if (!cleanKw || cleanKw.length < 2) return text;

    try {
      // Phân tách query thành mảng các từ khóa độc lập (nếu dài hơn 1 từ) + cả cụm từ
      const terms = Array.from(new Set([cleanKw, ...cleanKw.split(/\s+/).filter((w) => w.length >= 2)]));
      const escapedTerms = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const regex = new RegExp(`(${escapedTerms})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, idx) =>
        regex.test(part) ? (
          <mark key={idx} className="bg-amber-300 text-amber-950 font-bold px-1 rounded shadow-2xs">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

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
            {/* Engine Switcher */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEngineMode('native');
                  setIsSearchActive(false);
                }}
                className={`px-2 py-0.5 rounded text-2xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  engineMode === 'native'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Chế độ Siêu tốc (Trình duyệt gốc): Tải tức thì <0.1s, mượt mà và tiết kiệm băng thông"
              >
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>Siêu tốc</span>
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('pdfjs')}
                className={`px-2 py-0.5 rounded text-2xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  engineMode === 'pdfjs'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Chế độ PDF.js: Hỗ trợ tìm kiếm từ khóa và công cụ PDF"
              >
                <Search className="w-3 h-3 text-teal-600" />
                <span>PDF.js</span>
              </button>
            </div>

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
              title={engineMode === 'native' ? 'Mở toàn trang tab mới' : 'Mở toàn trang tab mới (PDF.js)'}
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

        {/* Multi-Keyword & Interactive Search Bar */}
        <div className="px-4 py-2 bg-slate-50/90 border-b border-slate-200 flex flex-col gap-1.5 shrink-0 select-none">
          {/* Search Input Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleApplySearch();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm cụm từ hoặc nhiều từ khóa trong PDF (hỗ trợ tiếng Việt)..."
                className="w-full bg-white border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 font-sans shadow-2xs transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    handleApplySearch('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Xóa ô tìm kiếm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Match Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextMode = !isPhraseMatch;
                setIsPhraseMatch(nextMode);
                handleApplySearch(searchQuery, nextMode);
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-semibold border transition cursor-pointer shrink-0 ${
                isPhraseMatch
                  ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                  : 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100'
              }`}
              title={
                isPhraseMatch
                  ? 'Chế độ Cụm từ chính xác: Bôi vàng đúng cả cụm từ'
                  : 'Chế độ Đa từ khóa: Bôi vàng đồng thời TẤT CẢ các từ riêng lẻ'
              }
            >
              {isPhraseMatch ? (
                <>
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Cụm từ</span>
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>Tất cả từ</span>
                </>
              )}
            </button>

            {/* Apply Button */}
            <button
              type="submit"
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium text-xs rounded shadow-2xs transition cursor-pointer shrink-0"
              title="Tìm kiếm và bôi vàng trên PDF"
            >
              Tìm
            </button>
          </form>
        </div>

        {/* Excerpt Alert Banner (Highlight từ khóa bằng thẻ mark vàng rực) */}
        {target.excerpt && (
          <div className="px-4 py-2.5 bg-teal-50/95 border-b border-teal-200 flex items-start justify-between gap-3 shrink-0 text-xs text-slate-800">
            <div className="flex items-start gap-2 min-w-0">
              <FileText className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-bold text-teal-950 text-2xs block">
                  Đoạn trích đối chứng y văn (Trang {currentPage}):
                </span>
                <p className="text-slate-800 text-xs line-clamp-2 mt-0.5 leading-relaxed font-sans">
                  "{renderHighlightedText(target.excerpt, appliedQuery || target.inn || '')}"
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopyExcerpt()}
              className="p-1.5 rounded-md text-teal-800 hover:bg-teal-200/80 transition cursor-pointer shrink-0 border border-teal-200/80 bg-white/80"
              title="Sao chép đoạn trích"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-teal-700" />}
            </button>
          </div>
        )}

        {/* Full-Height Scan PDF Viewer Iframe */}
        <div className="flex-1 w-full h-full bg-slate-100 relative overflow-hidden">
          <iframe
            key={`${activeUrl}-${engineMode}`}
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
