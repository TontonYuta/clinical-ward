/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trình xem PDF nội bộ dùng pdfjs-dist (Canvas + TextLayer) hỗ trợ tô vàng tự động đoạn trích dẫn.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  ScanText,
} from 'lucide-react';
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import {
  extractHighlightTargets,
  extractPageHeadingCandidates,
} from '../../utils/pdfSectionExtractor';
import {
  computeNormalizedHighlightBoxes,
  findSectionMatches,
  type NormalizedHighlightBox,
} from '../../utils/pdfTextHighlighter';
import { selectPdfHighlightHeadingsWithGemini } from '../../services/pdfHighlightGemini';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfHighlightViewerProps {
  pdfUrl: string;
  initialPage?: number;
  highlightText?: string;
  citationTitle?: string;
  citationSection?: string;
  messageQuery?: string;
  drugAnchor?: string;
}

type MatchStatus = 'idle' | 'matched' | 'not_found' | 'scanned';

export const PdfHighlightViewer: React.FC<PdfHighlightViewerProps> = ({
  pdfUrl,
  initialPage = 1,
  highlightText,
  citationTitle,
  citationSection,
  messageQuery,
  drugAnchor,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage));
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(520);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('idle');
  const [matchedGroupCount, setMatchedGroupCount] = useState<number>(0);
  const [activeGroupIdx, setActiveGroupIdx] = useState<number>(0);
  const [highlightBoxes, setHighlightBoxes] = useState<NormalizedHighlightBox[]>([]);
  const autoScannedTargetRef = useRef<string>('');

  const highlightTargets = React.useMemo(
    () =>
      extractHighlightTargets({
        title: citationTitle,
        section: citationSection,
        excerpt: highlightText,
        query: messageQuery,
        drugAnchor,
      }),
    [citationTitle, citationSection, highlightText, messageQuery, drugAnchor]
  );

  // Sync current page when citation target changes
  useEffect(() => {
    autoScannedTargetRef.current = '';
    setCurrentPage(Math.max(1, initialPage || 1));
  }, [pdfUrl, initialPage, highlightText]);

  // Re-fit PDF width smoothly when the right pane resizes (e.g., 50/50 split)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Math.abs(w - containerWidth) > 24) {
        setContainerWidth(Math.max(320, Math.floor(w - 28)));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [containerWidth]);

  // Load PDF document via HTTP Range Requests
  useEffect(() => {
    let cancelled = false;
    setIsLoadingDoc(true);
    setDocError(null);
    setPdfDoc(null);

    const loadingTask = getDocument({
      url: pdfUrl,
      rangeChunkSize: 65536,
      disableRange: false,
      disableStream: false,
    });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          void doc.cleanup();
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage((prev) => Math.min(Math.max(1, prev), doc.numPages));
        setIsLoadingDoc(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDocError(err?.message || 'Không thể tải tài liệu PDF.');
        setIsLoadingDoc(false);
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [pdfUrl]);

  // Render active page Canvas + TextLayer + Highlight
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

    let cancelled = false;
    let activeRenderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let activeTextLayer: TextLayer | null = null;

    const renderCurrentPage = async () => {
      setIsRenderingPage(true);
      setMatchStatus('idle');
      setMatchedGroupCount(0);
      setActiveGroupIdx(0);
      setHighlightBoxes([]);

      try {
        const safePage = Math.min(Math.max(1, currentPage), pdfDoc.numPages);
        const page = await pdfDoc.getPage(safePage);
        if (cancelled) return;

        const measuredWidth = scrollContainerRef.current?.clientWidth
          ? Math.max(320, scrollContainerRef.current.clientWidth - 28)
          : containerWidth;
        const baseViewport = page.getViewport({ scale: 1.0 });
        const fitScale = measuredWidth / baseViewport.width;
        const finalScale = Math.max(0.5, Math.min(2.4, fitScale * zoomFactor));
        const viewport = page.getViewport({ scale: finalScale });

        const canvas = canvasRef.current!;
        const textLayerEl = textLayerRef.current!;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderContext = {
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        };
        activeRenderTask = page.render(renderContext as any);
        await activeRenderTask.promise;
        if (cancelled) return;

        // Render TextLayer & apply excerpt highlighting
        textLayerEl.innerHTML = '';
        textLayerEl.style.width = `${Math.floor(viewport.width)}px`;
        textLayerEl.style.height = `${Math.floor(viewport.height)}px`;
        textLayerEl.style.setProperty('--scale-factor', String(finalScale));

        const textContent = await page.getTextContent();
        if (cancelled) return;

        const itemStrings = (textContent.items || []).map((item: any) =>
          typeof item?.str === 'string' ? item.str : ''
        );

        activeTextLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerEl,
          viewport,
        });
        await activeTextLayer.render();
        if (cancelled) return;

        const hasTargets =
          highlightTargets.sectionHeadings.length > 0 ||
          highlightTargets.fallbackSnippets.length > 0;

        if (itemStrings.every((s) => s.trim().length === 0)) {
          setMatchStatus('scanned');
        } else {
          let activeBoxes: NormalizedHighlightBox[] = [];
          let activeCount = 0;

          if (hasTargets) {
            const localRes = computeNormalizedHighlightBoxes(
              textLayerEl,
              itemStrings,
              highlightTargets
            );
            activeBoxes = localRes.boxes;
            activeCount = localRes.matchCount;
          }

          if (activeCount > 0 && activeBoxes.length > 0) {
            setHighlightBoxes(activeBoxes);
            setMatchedGroupCount(activeCount);
            setActiveGroupIdx(0);
            setMatchStatus('matched');
            // Cuộn mượt tới hộp highlight đầu tiên sau khi overlay render
            window.requestAnimationFrame(() => {
              const firstMark = overlayRef.current?.querySelector('[data-pdf-highlight="true"]');
              firstMark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          } else {
            // 1. Nếu trang mở đầu chưa chứa mục cần tìm, quét nhanh các trang lân cận (+1..+4, -1) trước
            const scanKey = `${pdfUrl}|${initialPage}|${highlightText || ''}|${citationSection || ''}`;
            if (safePage === Math.max(1, initialPage || 1) && autoScannedTargetRef.current !== scanKey && hasTargets) {
              autoScannedTargetRef.current = scanKey;
              for (const offset of [1, 2, 3, 4, -1]) {
                const candidatePage = safePage + offset;
                if (candidatePage < 1 || candidatePage > pdfDoc.numPages) continue;
                const adjPage = await pdfDoc.getPage(candidatePage);
                if (cancelled) return;
                const adjContent = await adjPage.getTextContent();
                if (cancelled) return;
                const adjStrings = (adjContent.items || []).map((it: any) =>
                  typeof it?.str === 'string' ? it.str : ''
                );
                if (findSectionMatches(adjStrings, highlightTargets).length > 0) {
                  setCurrentPage(candidatePage);
                  return;
                }
              }
            }

            // 2. Nếu vẫn chưa khớp (câu hỏi ngữ nghĩa), gọi Gemini chọn trực tiếp từ danh sách tiêu đề trên trang
            if (messageQuery) {
              const candidates = extractPageHeadingCandidates(itemStrings);
              if (candidates.length > 0) {
                const geminiRes = await selectPdfHighlightHeadingsWithGemini(
                  messageQuery,
                  candidates,
                  highlightTargets.drugAnchor
                );
                if (cancelled) return;
                if (geminiRes.selected_headings.length > 0) {
                  const gemComputed = computeNormalizedHighlightBoxes(textLayerEl, itemStrings, {
                    drugAnchor: geminiRes.drug_anchor || highlightTargets.drugAnchor,
                    sectionHeadings: geminiRes.selected_headings,
                    fallbackSnippets: [],
                  });
                  if (gemComputed.matchCount > 0 && gemComputed.boxes.length > 0) {
                    setHighlightBoxes(gemComputed.boxes);
                    setMatchedGroupCount(gemComputed.matchCount);
                    setActiveGroupIdx(0);
                    setMatchStatus('matched');
                    window.requestAnimationFrame(() => {
                      const firstMark = overlayRef.current?.querySelector('[data-pdf-highlight="true"]');
                      firstMark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                    return;
                  }
                }
              }
            }

            setMatchedGroupCount(0);
            setMatchStatus('not_found');
          }
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setDocError(err?.message || 'Lỗi hiển thị trang PDF.');
        }
      } finally {
        if (!cancelled) setIsRenderingPage(false);
      }
    };

    void renderCurrentPage();

    return () => {
      cancelled = true;
      try {
        activeRenderTask?.cancel();
      } catch {}
      try {
        activeTextLayer?.cancel();
      } catch {}
    };
  }, [pdfDoc, currentPage, zoomFactor, highlightTargets, containerWidth]);

  const jumpToHighlightGroup = (nextIdx: number) => {
    if (matchedGroupCount <= 0) return;
    const wrapped = (nextIdx + matchedGroupCount) % matchedGroupCount;
    setActiveGroupIdx(wrapped);
    const el = overlayRef.current?.querySelector(`[data-highlight-group="${wrapped}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const targetPage = Math.max(1, initialPage || 1);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-100/80">
      {/* Toolbar duy nhất tích hợp lật trang + zoom + trạng thái đối chiếu */}
      <div className="h-9 px-3 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoadingDoc}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-slate-700"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 font-semibold text-slate-700 tabular-nums text-[11px]">
            {currentPage} / {numPages || '…'}
          </span>
          <button
            type="button"
            disabled={numPages === 0 || currentPage >= numPages || isLoadingDoc}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-slate-700"
            title="Trang sau"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {currentPage !== targetPage && (
            <button
              type="button"
              onClick={() => setCurrentPage(targetPage)}
              className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:text-teal-800 text-[10px] font-medium transition cursor-pointer"
              title={`Quay lại trang đầu mục (${targetPage})`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Tr.{targetPage}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {matchStatus === 'matched' && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-semibold">
              <Highlighter className="w-3 h-3 text-emerald-700" />
              <span>
                {matchedGroupCount > 1
                  ? `Mục ${activeGroupIdx + 1}/${matchedGroupCount}`
                  : 'Đã đánh dấu'}
              </span>
              {matchedGroupCount > 1 && (
                <button
                  type="button"
                  onClick={() => jumpToHighlightGroup(activeGroupIdx + 1)}
                  className="ml-0.5 px-1 rounded hover:bg-emerald-200/60 text-emerald-900 cursor-pointer"
                  title="Chuyển tới mục đánh dấu tiếp theo"
                >
                  ›
                </button>
              )}
            </div>
          )}
          {matchStatus === 'scanned' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold">
              <ScanText className="w-3 h-3 text-amber-700" />
              <span>Ảnh scan</span>
            </span>
          )}
          {matchStatus === 'not_found' && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
              <AlertCircle className="w-3 h-3" />
              <span>Trang tham chiếu</span>
            </span>
          )}

          <div className="flex items-center gap-0.5 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={() => setZoomFactor((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
              className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-medium text-slate-600 w-9 text-center tabular-nums">
              {Math.round(zoomFactor * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomFactor((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
              className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chỉ hiện đoạn trích đối chiếu nếu là PDF dạng ảnh scan không thể tô vàng trực tiếp */}
      {matchStatus === 'scanned' && highlightText && (
        <div className="px-3 py-2 bg-amber-50/90 border-b border-amber-200/70 text-[11px] text-amber-950 leading-relaxed max-h-20 overflow-y-auto shrink-0">
          <span className="font-bold">Đoạn trích: </span>
          {highlightText}
        </div>
      )}

      {/* Vùng hiển thị Canvas + TextLayer */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto p-3 flex justify-center relative">
        {docError ? (
          <div className="my-auto p-4 rounded-xl bg-white border border-rose-200 text-xs text-rose-700 max-w-xs text-center space-y-1">
            <p className="font-bold">Không thể mở trực tiếp tệp PDF</p>
            <p className="text-slate-500">{docError}</p>
          </div>
        ) : (
          <div className="relative bg-white shadow-sm border border-slate-200/80 h-fit">
            {(isLoadingDoc || isRenderingPage) && (
              <div className="absolute inset-0 bg-white/75 z-20 flex items-center justify-center text-xs text-slate-600 font-medium">
                {isLoadingDoc ? 'Đang kết nối tài liệu PDF...' : `Đang hiển thị trang ${currentPage}...`}
              </div>
            )}
            <canvas ref={canvasRef} className="block" />
            {/* Lớp overlay tô vàng mượt theo tỷ lệ % [0..100] dùng mix-blend-multiply để giữ chữ đen sắc nét */}
            <div ref={overlayRef} className="absolute inset-0 pointer-events-none z-10 mix-blend-multiply">
              {highlightBoxes.map((box, idx) => (
                <div
                  key={`hl-box-${idx}`}
                  data-pdf-highlight="true"
                  data-highlight-group={box.groupIndex}
                  title={box.label}
                  style={{
                    left: `${box.xPct}%`,
                    top: `${box.yPct}%`,
                    width: `${box.wPct}%`,
                    height: `${box.hPct}%`,
                  }}
                  className={`absolute rounded-[2px] transition-colors ${
                    box.groupIndex === activeGroupIdx
                      ? 'bg-yellow-300/85 ring-1 ring-amber-400/80'
                      : 'bg-yellow-200/65'
                  }`}
                />
              ))}
            </div>
            <div ref={textLayerRef} className="textLayer z-[15]" />
          </div>
        )}
      </div>
    </div>
  );
};
