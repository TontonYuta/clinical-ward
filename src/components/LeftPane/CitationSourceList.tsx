import React from 'react';
import { BookOpen, ExternalLink, Globe } from 'lucide-react';
import { RagCitationItem } from '../../types/chat';
import { buildTextFragmentUrl } from '../../utils/webTextFragment';
import { extractShortSourceLabel } from '../../utils/citationLabel';

type CitationSourceListProps = {
  citations?: RagCitationItem[];
  isWebSearch?: boolean;
  openWebInSidebar?: boolean;
  onCitationClick?: (citation: {
    title: string;
    url?: string | null;
    page?: number | null;
    excerpt?: string;
    legal_basis?: string;
    section?: string;
    text_fragment_url?: string;
    index?: number;
  }) => void;
};

export function CitationSourceList({
  citations = [],
  isWebSearch = false,
  openWebInSidebar = false,
  onCitationClick,
}: CitationSourceListProps) {
  const uniqueCitations = Array.from(
    new Map(
      citations.map((citation) => {
        const isWebItem = Boolean(
          citation.url &&
          (citation.url.startsWith('http://') || citation.url.startsWith('https://')) &&
          !citation.document_id
        );
        const dedupKey = isWebItem
          ? `web|${citation.url}`
          : `doc|${citation.document_id || citation.source}|${citation.page ?? ''}`;
        return [dedupKey, citation];
      }),
    ).values(),
  );

  if (uniqueCitations.length === 0) return null;

  const isAllWeb =
    isWebSearch ||
    uniqueCitations.every((citation) =>
      Boolean(
        citation.url &&
        (citation.url.startsWith('http://') || citation.url.startsWith('https://')) &&
        !citation.document_id
      )
    );

  return (
    <section aria-label={isAllWeb ? 'Nguồn tham khảo Internet' : 'Nguồn tài liệu'} className="mt-3 border-t border-slate-100 pt-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-2xs uppercase tracking-wider font-bold text-slate-400">
        <Globe className="h-3 w-3 text-teal-600" aria-hidden="true" />
        <span>{isAllWeb ? 'Nguồn tham khảo Internet' : 'Nguồn tài liệu & Căn cứ y văn'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueCitations.map((citation, index) => {
          const sourceName = citation.source || citation.title || citation.legal_basis || 'Tài liệu';
          const location = citation.page
            ? `trang ${citation.page}`
            : citation.section || '';
          const label = location ? `${sourceName} · ${location}` : sourceName;
          
          const isWeb =
            isWebSearch ||
            Boolean(
              citation.url &&
              (citation.url.startsWith('http://') || citation.url.startsWith('https://')) &&
              !citation.url.toLowerCase().endsWith('.pdf') &&
              !citation.document_id
            );

          const displayIndex = citation.index ?? index + 1;
          const shortLabel = extractShortSourceLabel(citation, displayIndex);
          const tierBadge =
            isWeb && citation.credibility_tier && citation.credibility_tier <= 2
              ? citation.credibility_tier === 1
                ? 'Chính thống'
                : 'Uy tín'
              : '';

          const icon = isWeb ? (
            <Globe className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
          ) : (
            <BookOpen className="h-3 w-3 shrink-0 text-teal-600" aria-hidden="true" />
          );

          const content = (
            <>
              {icon}
              <span className="truncate max-w-[190px] sm:max-w-[230px]">
                {isWeb ? shortLabel : label}
              </span>
              {tierBadge && (
                <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 shrink-0">
                  {tierBadge}
                </span>
              )}
              {isWeb && (
                <ExternalLink className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden="true" />
              )}
            </>
          );

          if (!citation.url) {
            return (
              <span
                key={`${citation.document_id || sourceName}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
              >
                {content}
              </span>
            );
          }

          if (isWeb && citation.url && !openWebInSidebar) {
            const highlightUrl = buildTextFragmentUrl(citation.url, citation.excerpt || citation.snippet);
            return (
              <a
                key={`${citation.document_id || sourceName}-${index}`}
                href={highlightUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="web-citation-link"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 px-2.5 py-1 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-teal-700"
                title={`Mở & tự tô vàng đoạn trích: ${citation.title || sourceName}`}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={`${citation.document_id || sourceName}-${index}`}
              type="button"
              data-testid={isWeb ? 'web-citation-tab-btn' : 'pdf-citation-btn'}
              onClick={() => onCitationClick?.({
                title: citation.title || sourceName,
                url: citation.url,
                page: citation.page,
                excerpt: citation.excerpt || citation.snippet,
                legal_basis: citation.legal_basis,
                section: citation.section,
                text_fragment_url: (citation as RagCitationItem & { text_fragment_url?: string }).text_fragment_url,
                index: displayIndex,
              })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 px-2.5 py-1 text-left text-xs font-medium text-slate-700 transition cursor-pointer hover:bg-slate-100 hover:text-slate-950 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-teal-700"
              title={isWeb ? `Mở tab đối chiếu & in đậm đoạn trích: ${citation.title || sourceName}` : (citation.legal_basis || citation.title || sourceName)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
