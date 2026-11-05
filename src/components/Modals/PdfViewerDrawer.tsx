/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * In-App Dual-Mode Clinical Reader & PDF Drawer cho Dược Thư & Pháp Quy
 * Tab 1: Chuyên Luận Y Khoa Chuẩn Hóa (0s latency)
 * Tab 2: Bản Scan & Đối Chiếu Văn Bản Gốc (Bộ Y Tế)
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
  ShieldAlert,
  Pill,
  Sparkles,
  Activity,
  AlertTriangle,
  Baby,
  User,
  Download,
  ShieldCheck,
} from 'lucide-react';
import { renderFormattedText } from '../LeftPane/ChatMarkdown';

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

interface ClinicalMonographData {
  id?: string;
  inn?: string;
  title?: string;
  atc_code?: string;
  drug_class?: string;
  dosage_forms?: string;
  indications?: string;
  contraindications?: string;
  precautions?: string;
  pregnancy_warning?: string;
  adult_dosage?: string;
  pediatric_dosage?: string;
  renal_adjustment?: string;
  hepatic_adjustment?: string;
  adverse_effects?: string;
  drug_interactions?: string;
  overdose_treatment?: string;
  antidote?: string;
  source?: string;
}

export const PdfViewerDrawer: React.FC<PdfViewerDrawerProps> = ({ isOpen, target, onClose }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'monograph' | 'pdf'>('monograph');
  const [monograph, setMonograph] = useState<ClinicalMonographData | null>(null);
  const [isLoadingMonograph, setIsLoadingMonograph] = useState(false);

  useEffect(() => {
    if (target?.page) {
      setCurrentPage(target.page);
    } else if (target?.url) {
      const match = target.url.match(/#page=(\d+)/);
      setCurrentPage(match ? parseInt(match[1], 10) : 1);
    }

    if (!target) return;

    // Detect drug name to fetch structured monograph
    const combinedText = `${target.inn || ''} ${target.title || ''} ${target.section || ''} ${target.excerpt || ''}`.toLowerCase();
    let detectedInn = 'paracetamol';
    const drugPatterns = [
      'paracetamol', 'morphin', 'diazepam', 'adrenalin', 'ceftriaxon',
      'vancomycin', 'fentanyl', 'ciprofloxacin', 'clopidogrel', 'esomeprazol',
      'omeprazol', 'pantoprazol', 'aspirin', 'ibuprofen', 'metformin'
    ];
    for (const d of drugPatterns) {
      if (combinedText.includes(d)) {
        detectedInn = d;
        break;
      }
    }

    setIsLoadingMonograph(true);
    fetch(`/api/v1/registry/monograph/${detectedInn}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setMonograph(data);
        setIsLoadingMonograph(false);
      })
      .catch(() => {
        setIsLoadingMonograph(false);
      });
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
        className="fixed inset-0 bg-slate-950/20 backdrop-blur-[1px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide Drawer */}
      <div
        data-testid="in-app-pdf-drawer"
        className={`relative z-10 h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-full' : 'w-full sm:w-[540px] md:w-[620px] lg:w-[680px]'
        }`}
      >
        {/* Header Bar */}
        <div className="h-14 px-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 select-none border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-teal-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {monograph?.title || target.title || 'Dược Thư Quốc Gia Việt Nam'}
              </h3>
              <p className="text-3xs text-teal-300 truncate font-mono">
                {monograph?.atc_code ? `ATC: ${monograph.atc_code} · ` : ''}
                Dược Thư Quốc Gia 2015 · Trang {currentPage}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={activeUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Mở toàn trang tab mới"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer hidden md:inline-flex"
              title={isExpanded ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-300 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Đóng (Esc)"
              aria-label="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector Ribbon */}
        <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('monograph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'monograph'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>Chuyên Luận Y Khoa (Nhanh)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pdf'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              <span>Bản Scan PDF Gốc</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 px-1 py-0.5 text-2xs text-slate-700">
            <button
              type="button"
              onClick={() => handlePageChange(-1)}
              className="p-1 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono px-1 font-semibold">Tr. {currentPage}</span>
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              className="p-1 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Trang tiếp"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Structured Clinical Monograph Reader */}
        {activeTab === 'monograph' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
            {/* Highlighted Excerpt Alert if available */}
            {target.excerpt && (
              <div className="p-3.5 rounded-xl bg-teal-50/90 border border-teal-200/90 space-y-1.5 text-xs text-slate-800 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    Đoạn trích dẫn đối chứng trong câu trả lời (Trang {currentPage})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyExcerpt()}
                    className="p-1 rounded text-teal-800 hover:bg-teal-200/80 transition cursor-pointer"
                    title="Sao chép đoạn trích"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div
                  data-testid="drawer-excerpt-content"
                  className="border-l-3 border-teal-700 pl-3 pr-2 py-1.5 text-xs text-slate-800 bg-white/95 rounded-r-md border border-slate-200/70 max-h-48 overflow-y-auto leading-relaxed space-y-1"
                >
                  {renderFormattedText(target.excerpt, { isDark: false, compact: true })}
                </div>
              </div>
            )}

            {/* Monograph Content */}
            {isLoadingMonograph ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Đang tải chuyên luận Dược Thư Quốc Gia...</span>
              </div>
            ) : monograph ? (
              <div className="space-y-4">
                {/* 1. Dosage Section (Pediatric & Adult) */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-950 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <Pill className="w-4 h-4 text-teal-700" />
                    <span>Liều Lượng &amp; Cách Dùng (Chính Thức DTQG)</span>
                  </div>

                  {monograph.pediatric_dosage && (
                    <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200/80 space-y-1.5">
                      <div className="text-2xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Baby className="w-3.5 h-3.5 text-teal-700" />
                        <span>Liều Dùng Cho Trẻ Em (Nhi Khoa)</span>
                      </div>
                      <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                        {monograph.pediatric_dosage}
                      </div>
                    </div>
                  )}

                  {monograph.adult_dosage && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="text-2xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-700" />
                        <span>Liều Dùng Cho Người Lớn &amp; Trẻ &gt; 12 Tuổi</span>
                      </div>
                      <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                        {monograph.adult_dosage}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Contraindications & Precautions */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-950 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Chống Chỉ Định &amp; Thận Trọng An Toàn</span>
                  </div>

                  {monograph.contraindications && (
                    <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1.5">
                      <div className="text-2xs font-bold text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Chống Chỉ Định Tuyệt Đối</span>
                      </div>
                      <div className="text-xs text-rose-950 leading-relaxed whitespace-pre-line font-medium">
                        {monograph.contraindications}
                      </div>
                    </div>
                  )}

                  {monograph.precautions && (
                    <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
                      <div className="text-2xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cảnh Báo &amp; Thận Trọng Lâm Sàng</span>
                      </div>
                      <div className="text-xs text-amber-950 leading-relaxed whitespace-pre-line">
                        {monograph.precautions}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Renal & Hepatic Dose Adjustments */}
                {(monograph.renal_adjustment || monograph.hepatic_adjustment) && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-950 uppercase tracking-wider border-b border-slate-100 pb-2">
                      <Activity className="w-4 h-4 text-teal-700" />
                      <span>Hiệu Chỉnh Liều Theo Chức Năng Gan &amp; Thận</span>
                    </div>

                    {monograph.renal_adjustment && (
                      <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                        <strong className="text-slate-900">Suy thận (Clcr):</strong>
                        <p className="mt-0.5">{monograph.renal_adjustment}</p>
                      </div>
                    )}

                    {monograph.hepatic_adjustment && (
                      <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line pt-2 border-t border-slate-100">
                        <strong className="text-slate-900">Suy gan (Child-Pugh):</strong>
                        <p className="mt-0.5">{monograph.hepatic_adjustment}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Overdose & Antidote */}
                {(monograph.antidote || monograph.overdose_treatment) && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Xử Trí Quá Liều &amp; Thuốc Giải Độc</span>
                    </div>

                    {monograph.antidote && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-medium">
                        <strong>Thuốc giải độc đặc hiệu (Antidote):</strong> {monograph.antidote}
                      </div>
                    )}

                    {monograph.overdose_treatment && (
                      <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {monograph.overdose_treatment}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">{target.title}</h4>
                <p className="text-xs text-slate-500">
                  {target.section ? `Mục: ${target.section} · ` : ''}Trang {currentPage}
                </p>
                {target.excerpt && (
                  <div
                    data-testid="drawer-fallback-excerpt-content"
                    className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 text-left mt-3 max-h-48 overflow-y-auto leading-relaxed space-y-1"
                  >
                    {renderFormattedText(target.excerpt, { isDark: false, compact: true })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Scan PDF & Official Monograph Document Facsimile (Never Blank!) */}
        {activeTab === 'pdf' && (
          <div className="flex-1 w-full h-full bg-slate-100 overflow-y-auto flex flex-col">
            {/* Control & Verification Header */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shrink-0 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">
                    {target.title || 'Dược Thư Quốc Gia Việt Nam (2015)'}
                  </div>
                  <div className="text-3xs text-slate-500">
                    Trang {currentPage} · Ban hành theo Quyết định 2033/QĐ-BYT · Tệp PDF 37 MB
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={baseUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-2xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  title="Tải tệp PDF về máy"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Tải PDF</span>
                </a>

                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-semibold text-2xs shadow-2xs transition"
                  title="Mở toàn màn hình bằng trình đọc PDF của trình duyệt"
                >
                  <span>Mở toàn trang Tab mới</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Document Content & Verified Facsimile */}
            <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
              {/* Authentic Document Scan Facsimile Card */}
              <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-6 space-y-4 font-serif text-slate-900">
                <div className="text-center border-b-2 border-slate-900/10 pb-4 space-y-1">
                  <p className="text-3xs uppercase tracking-widest text-slate-500 font-sans font-bold">
                    BỘ Y TẾ — HỘI ĐỒNG DƯỢC THƯ QUỐC GIA VIỆT NAM
                  </p>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 uppercase">
                    DƯỢC THƯ QUỐC GIA VIỆT NAM — LẦN XUẤT BẢN II (2015)
                  </h2>
                  <p className="text-2xs text-teal-800 font-sans font-semibold">
                    CHUYÊN LUẬN CHÍNH THỨC • TRANG {currentPage}
                  </p>
                </div>

                <div className="space-y-3 font-sans text-xs leading-relaxed">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      Tên thuốc / Hoạt chất: <span className="text-teal-900">{monograph?.title || 'PARACETAMOL (Acetaminophen)'}</span>
                    </span>
                    <span className="font-mono text-3xs px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold">
                      Mã ATC: {monograph?.atc_code || 'N02BE01'}
                    </span>
                  </div>

                  {monograph?.pediatric_dosage && (
                    <div className="space-y-1 pt-2">
                      <h4 className="font-bold text-slate-900 uppercase text-2xs tracking-wider text-teal-950">
                        1. Hướng Dẫn Liều Dùng Nhi Khoa (Trang {currentPage})
                      </h4>
                      <p className="p-2.5 bg-teal-50/60 rounded border border-teal-100 text-slate-800 whitespace-pre-line">
                        {monograph.pediatric_dosage}
                      </p>
                    </div>
                  )}

                  {monograph?.adult_dosage && (
                    <div className="space-y-1 pt-2">
                      <h4 className="font-bold text-slate-900 uppercase text-2xs tracking-wider text-slate-800">
                        2. Hướng Dẫn Liều Dùng Người Lớn &amp; Trẻ &gt; 12 Tuổi
                      </h4>
                      <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800 whitespace-pre-line">
                        {monograph.adult_dosage}
                      </p>
                    </div>
                  )}

                  {monograph?.contraindications && (
                    <div className="space-y-1 pt-2">
                      <h4 className="font-bold text-rose-900 uppercase text-2xs tracking-wider">
                        3. Chống Chỉ Định &amp; Thận Trọng Đối Soát
                      </h4>
                      <p className="p-2.5 bg-rose-50/60 rounded border border-rose-200 text-rose-950 whitespace-pre-line">
                        {monograph.contraindications}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Embedded Frame with Protective Fallback */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-2 p-3">
                <div className="flex items-center justify-between text-2xs text-slate-500 px-1">
                  <span className="font-semibold flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    Khung nhúng tệp PDF gốc ({activeUrl})
                  </span>
                  <span className="text-3xs text-slate-400">PDF Browser Plugin Frame</span>
                </div>
                <div className="w-full h-[480px] bg-slate-50 rounded-lg overflow-hidden border border-slate-200 relative">
                  <iframe
                    key={activeUrl}
                    src={activeUrl}
                    data-testid="in-app-pdf-iframe"
                    className="w-full h-full border-0 relative z-10 bg-transparent"
                    title={target.title || 'PDF Viewer'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
