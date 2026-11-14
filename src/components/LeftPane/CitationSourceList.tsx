import React from 'react';
import { BookOpen } from 'lucide-react';
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
    <section aria-label="Nguồn tài liệu" className="mt-2 border-t border-slate-100 pt-2">
      <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
        <BookOpen className="h-3 w-3" aria-hidden="true" />
        <span>Nguồn</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueCitations.map((citation, index) => {
          const sourceName = citation.source || citation.title || citation.legal_basis || 'Tài liệu';
          const location = citation.page
            ? `trang ${citation.page}`
            : citation.section || '';
          const label = location ? `${sourceName} · ${location}` : sourceName;
          const content = (
            <>
              <BookOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </>
          );

          if (!citation.url) {
            return (
              <span
                key={`${citation.document_id || sourceName}-${index}`}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
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
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-left text-xs font-medium text-teal-800 transition hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-teal-700"
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
