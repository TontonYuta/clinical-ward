import React from 'react';
import { BookOpen, ExternalLink, Globe } from 'lucide-react';
import { RagCitationItem } from '../../types/chat';

type CitationSourceListProps = {
  citations?: RagCitationItem[];
  onCitationClick?: (citation: {
    title: string;
    url?: string | null;
    page?: number | null;
    excerpt?: string;
    legal_basis?: string;
    section?: string;
    text_fragment_url?: string;
  }) => void;
};

export function CitationSourceList({ citations = [], onCitationClick }: CitationSourceListProps) {
  const uniqueCitations = Array.from(
    new Map(
      citations.map((citation) => [
        [citation.document_id, citation.url, citation.page, citation.section].join('|'),
        citation,
      ]),
    ).values(),
  );

  if (uniqueCitations.length === 0) return null;

  return (
    <section aria-label="Nguồn tài liệu" className="mt-3 border-t border-slate-100 pt-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-2xs uppercase tracking-wider font-bold text-slate-400">
        <Globe className="h-3 w-3 text-teal-600" aria-hidden="true" />
        <span>Nguồn tài liệu & Căn cứ y văn</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueCitations.map((citation, index) => {
          const sourceName = citation.source || citation.title || citation.legal_basis || 'Tài liệu';
          const location = citation.page
            ? `trang ${citation.page}`
            : citation.section || '';
          const label = location ? `${sourceName} · ${location}` : sourceName;
          
          const isWeb = Boolean(
            citation.url &&
            (citation.url.startsWith('http://') || citation.url.startsWith('https://')) &&
            !citation.url.toLowerCase().endsWith('.pdf')
          );

          const icon = isWeb ? (
            <ExternalLink className="h-3 w-3 shrink-0 text-teal-600" aria-hidden="true" />
          ) : (
            <BookOpen className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
          );

          const content = (
            <>
              {icon}
              <span className="truncate max-w-[260px] sm:max-w-[340px]">{label}</span>
            </>
          );

          if (!citation.url) {
            return (
              <span
                key={`${citation.document_id || sourceName}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
              >
                {content}
              </span>
            );
          }

          return (
            <button
              key={`${citation.document_id || sourceName}-${index}`}
              type="button"
              onClick={() => onCitationClick?.({
                title: citation.title || sourceName,
                url: citation.url,
                page: citation.page,
                excerpt: citation.excerpt,
                legal_basis: citation.legal_basis,
                section: citation.section,
                text_fragment_url: (citation as RagCitationItem & { text_fragment_url?: string }).text_fragment_url,
              })}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-left text-xs font-semibold transition shadow-3xs cursor-pointer active:scale-95 focus-visible:outline-2 ${
                isWeb
                  ? 'border-teal-200/90 bg-teal-50/80 text-teal-900 hover:bg-teal-100 hover:border-teal-300 focus-visible:outline-teal-700'
                  : 'border-emerald-200/90 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:outline-emerald-700'
              }`}
              title={citation.legal_basis || citation.title || sourceName}
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
