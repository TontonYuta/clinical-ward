import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ExternalLink, Globe } from 'lucide-react';
import { RagCitationItem } from '../../types/chat';
import { buildTextFragmentUrl } from '../../utils/webTextFragment';
import { extractShortSourceLabel, isWebCitationItem } from '../../utils/citationLabel';

export interface InlineCitationClickPayload {
  title: string;
  url?: string;
  page?: number | null;
  excerpt?: string;
  legal_basis?: string;
  section?: string;
  inn?: string;
  searchTerm?: string;
  keywords?: string[];
  text_fragment_url?: string;
  index?: number;
}

interface InlineCitationPillProps {
  indices: number[];
  citations?: RagCitationItem[];
  isDark?: boolean;
  onCitationClick?: (citation: InlineCitationClickPayload) => void;
}

interface ResolvedEntry {
  num: number;
  citation?: RagCitationItem;
  shortLabel: string;
  isWeb: boolean;
}

export const InlineCitationPill: React.FC<InlineCitationPillProps> = ({
  indices,
  citations,
  isDark = false,
  onCitationClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [openBelow, setOpenBelow] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const uniqueNums = Array.from(new Set(indices.filter((n) => Number.isFinite(n) && n > 0)));
  if (uniqueNums.length === 0) return null;

  const entries: ResolvedEntry[] = uniqueNums.map((num) => {
    const matched =
      citations?.find((c) => c.index === num) ||
      (citations && citations.length >= num ? citations[num - 1] : undefined);
    return {
      num,
      citation: matched,
      shortLabel: extractShortSourceLabel(matched, num),
      isWeb: isWebCitationItem(matched),
    };
  });

  // Deduplicate entries that point to the exact same citation URL/source
  const dedupedEntries = Array.from(
    new Map(
      entries.map((entry) => {
        const key = entry.citation
          ? `${entry.citation.url || entry.citation.document_id || entry.citation.source || ''}|${entry.citation.page ?? ''}`
          : `idx-${entry.num}`;
        return [key, entry];
      })
    ).values()
  );

  const primary = dedupedEntries[0];
  const extraCount = dedupedEntries.length - 1;

  const openPopover = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (triggerRef.current && typeof window !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      setAlignRight(rect.left > window.innerWidth - 340);
      setOpenBelow(rect.top < 220);
    }
    setIsOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 140);
  };

  const activateEntry = (entry: ResolvedEntry) => {
    setIsOpen(false);
    const matched = entry.citation;
    if (matched) {
      if (onCitationClick) {
        onCitationClick({
          title: matched.title || matched.source || `Nguồn [${entry.num}]`,
          url: matched.url ?? undefined,
          page: matched.page,
          excerpt: matched.excerpt || matched.snippet,
          legal_basis: matched.legal_basis,
          section: matched.section,
          index: entry.num,
        });
        return;
      }
      if (
        matched.url &&
        (matched.url.startsWith('http://') || matched.url.startsWith('https://')) &&
        !matched.url.toLowerCase().endsWith('.pdf')
      ) {
        window.open(
          buildTextFragmentUrl(matched.url, matched.excerpt || matched.snippet),
          '_blank',
          'noopener,noreferrer'
        );
        return;
      }
    }
    const targetEl = document.getElementById(`citation-ref-${entry.num}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-block align-baseline"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        data-testid="inline-citation-pill"
        onClick={(e) => {
          e.preventDefault();
          activateEntry(primary);
        }}
        onFocus={openPopover}
        onBlur={scheduleClose}
        className={`inline-flex items-center gap-1 px-2 py-[1px] ml-0.5 rounded-full text-[11px] font-medium leading-[1.35] align-baseline transition-colors duration-150 cursor-pointer select-none max-w-[180px] ${
          isDark
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            : 'bg-slate-100/95 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900'
        }`}
        aria-label={`Nguồn tham khảo: ${primary.shortLabel}${extraCount > 0 ? ` và ${extraCount} nguồn khác` : ''}`}
      >
        <span className="truncate">{primary.shortLabel}</span>
        {extraCount > 0 && (
          <span className={`shrink-0 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
            +{extraCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          data-testid="inline-citation-popover"
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
          className={`absolute z-50 w-72 sm:w-80 rounded-xl border border-slate-200/90 bg-white p-2 shadow-lg text-left animate-in fade-in duration-150 ${
            openBelow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          } ${alignRight ? 'right-0' : 'left-0'}`}
        >
          <div className="space-y-1">
            {dedupedEntries.map((entry) => {
              const cit = entry.citation;
              const title = cit?.title || cit?.source || cit?.legal_basis || `Nguồn tham chiếu #${entry.num}`;
              const snippet = (cit?.excerpt || cit?.snippet || '').trim();
              const tierLabel =
                entry.isWeb && cit?.credibility_tier && cit.credibility_tier <= 2
                  ? cit.credibility_tier === 1
                    ? 'Chính thống'
                    : 'Uy tín'
                  : '';

              return (
                <button
                  key={`pop-${entry.num}-${entry.shortLabel}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    activateEntry(entry);
                  }}
                  className="w-full text-left rounded-lg p-2 hover:bg-slate-50 transition-colors cursor-pointer group block"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 min-w-0 truncate">
                      {entry.isWeb ? (
                        <Globe className="w-3 h-3 text-slate-400 group-hover:text-teal-600 shrink-0" />
                      ) : (
                        <BookOpen className="w-3 h-3 text-slate-400 group-hover:text-teal-600 shrink-0" />
                      )}
                      <span className="truncate">{entry.shortLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      {tierLabel && (
                        <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                          {tierLabel}
                        </span>
                      )}
                      <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-teal-600 transition-colors" />
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-teal-900 line-clamp-2 leading-snug">
                    {title}
                  </div>
                  {snippet && (
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-snug">
                      {snippet}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
};
