import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe, LoaderCircle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../../services/api';
import { buildTextFragmentUrl } from '../../utils/webTextFragment';

type ReaderBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

interface WebReaderPayload {
  url: string;
  status: 'ok' | 'blocked' | 'error' | 'pdf' | 'empty';
  reason?: string;
  title?: string;
  blocks?: ReaderBlock[];
  paragraphs: string[];
}

interface WebHighlightReaderProps {
  url?: string | null;
  title: string;
  domain?: string;
  excerpt?: string;
  hideTopBar?: boolean;
}

// Session-scoped cache so switching between sidebar tabs [1] <-> [2] <-> [3] is instant (0ms)
const readerCache = new Map<string, WebReaderPayload>();

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function blockSearchableText(block: ReaderBlock): string {
  if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'heading') {
    return block.text;
  }
  if (block.type === 'list') {
    return block.items.join(' ');
  }
  if (block.type === 'table') {
    return [...block.headers, ...block.rows.flat()].join(' ');
  }
  return '';
}

export function findBestMatchingBlockIndex(blocks: ReaderBlock[], excerpt?: string): number {
  if (!blocks.length || !excerpt) return -1;
  const normExcerpt = normalizeForMatch(excerpt);
  if (!normExcerpt) return -1;

  const excerptTokens = new Set(normExcerpt.split(' ').filter((w) => w.length >= 3));
  if (excerptTokens.size === 0) return -1;

  const segments = excerpt
    .split(/\.{2,}|…|\n/)
    .map((s) => normalizeForMatch(s))
    .filter((s) => s.length >= 16);
  const anchor = (segments[0] || normExcerpt).split(' ').slice(0, 6).join(' ');

  let bestIdx = -1;
  let bestScore = 0;

  blocks.forEach((b, idx) => {
    if (b.type === 'image') return;
    const normB = normalizeForMatch(blockSearchableText(b));
    if (!normB) return;
    if (anchor.length >= 15 && normB.includes(anchor)) {
      bestIdx = idx;
      bestScore = 1.0;
      return;
    }
    const bTokens = new Set(normB.split(' ').filter((w) => w.length >= 3));
    let overlap = 0;
    excerptTokens.forEach((tok) => {
      if (bTokens.has(tok)) overlap += 1;
    });
    const score = overlap / excerptTokens.size;
    if (score > bestScore && score >= 0.35) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return bestIdx;
}

/**
 * Tier-2 highlight: bold + amber-mark only the matching sentences/clauses inside a matched block.
 */
function renderTwoTierText(text: string, excerpt?: string): React.ReactNode {
  if (!excerpt) return text;

  const cleanSegments = excerpt
    .split(/\.{2,}|…|\n/)
    .map((s) => normalizeForMatch(s))
    .filter((s) => s.length >= 12);

  const excerptTokens = new Set(
    normalizeForMatch(excerpt)
      .split(' ')
      .filter((w) => w.length >= 3)
  );
  if (excerptTokens.size === 0) return text;

  const sentences = text.match(/[^.!?;\n]+[.!?;\n]*\s*/g) || [text];
  let anyHighlighted = false;

  const nodes = sentences.map((sentence, idx) => {
    const normSent = normalizeForMatch(sentence);
    if (!normSent) return <React.Fragment key={idx}>{sentence}</React.Fragment>;

    const directHit = cleanSegments.some((seg) => {
      const shortProbe = seg.split(' ').slice(0, 5).join(' ');
      return (
        (shortProbe.length >= 12 && normSent.includes(shortProbe)) ||
        (normSent.length >= 16 && seg.includes(normSent))
      );
    });

    const sentTokens = normSent.split(' ').filter((w) => w.length >= 3);
    let overlap = 0;
    sentTokens.forEach((t) => {
      if (excerptTokens.has(t)) overlap += 1;
    });
    const ratioSent = sentTokens.length > 0 ? overlap / sentTokens.length : 0;
    const ratioExcerpt = overlap / excerptTokens.size;

    const isFocus = directHit || (overlap >= 3 && (ratioSent >= 0.42 || ratioExcerpt >= 0.32));
    if (isFocus) {
      anyHighlighted = true;
      return (
        <mark
          key={idx}
          data-testid="web-reader-bold-mark"
          className="bg-amber-200/85 text-slate-950 font-semibold px-0.5 rounded-xs"
        >
          {sentence}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{sentence}</React.Fragment>;
  });

  if (!anyHighlighted) {
    return (
      <mark
        data-testid="web-reader-bold-mark"
        className="bg-amber-200/80 text-slate-950 font-semibold px-0.5 rounded-xs"
      >
        {text}
      </mark>
    );
  }
  return nodes;
}

const ArticleImageBlock: React.FC<{ src: string; alt?: string; caption?: string }> = ({
  src,
  alt,
  caption,
}) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className="my-3 rounded-lg border border-slate-200/80 bg-slate-50/60 overflow-hidden" data-testid="web-reader-image">
      <img
        src={src}
        alt={alt || caption || 'Hình minh họa y khoa'}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full max-h-[360px] object-contain bg-white"
      />
      {(caption || alt) && (
        <figcaption className="px-3 py-1.5 text-[11px] text-slate-600 border-t border-slate-100 leading-snug">
          {caption || alt}
        </figcaption>
      )}
    </figure>
  );
};

export const WebHighlightReader: React.FC<WebHighlightReaderProps> = ({
  url,
  title,
  domain,
  excerpt,
  hideTopBar = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [readerData, setReaderData] = useState<WebReaderPayload | null>(null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  const fragmentUrl = useMemo(() => buildTextFragmentUrl(url, excerpt), [url, excerpt]);

  useEffect(() => {
    if (!url) {
      setReaderData(null);
      setLoading(false);
      return;
    }

    const cached = readerCache.get(url);
    if (cached) {
      setReaderData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReaderData(null);

    apiFetch(`${API_BASE_URL}/copilot/web-reader?url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        if (!res.ok) {
          return { url, status: 'error' as const, reason: `HTTP ${res.status}`, blocks: [], paragraphs: [] };
        }
        return (await res.json()) as WebReaderPayload;
      })
      .catch(() => ({
        url,
        status: 'error' as const,
        reason: 'Không thể kết nối máy chủ.',
        blocks: [],
        paragraphs: [],
      }))
      .then((data) => {
        if (cancelled) return;
        readerCache.set(url, data);
        setReaderData(data);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const blocks = useMemo<ReaderBlock[]>(() => {
    if (!readerData || readerData.status !== 'ok') return [];
    if (readerData.blocks && readerData.blocks.length > 0) return readerData.blocks;
    return (readerData.paragraphs || []).map((text) => ({ type: 'paragraph', text }));
  }, [readerData]);

  const matchedIndex = useMemo(() => {
    if (!blocks.length) return -1;
    return findBestMatchingBlockIndex(blocks, excerpt);
  }, [blocks, excerpt]);

  const mediaStats = useMemo(() => {
    let images = 0;
    let tables = 0;
    blocks.forEach((b) => {
      if (b.type === 'image') images += 1;
      if (b.type === 'table') tables += 1;
    });
    return { images, tables };
  }, [blocks]);

  useEffect(() => {
    if (!loading && matchedIndex >= 0 && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [loading, matchedIndex, url]);

  const hasSubstantialArticle =
    readerData?.status === 'ok' && blocks.length > 0 && (matchedIndex >= 0 || blocks.length >= 3);

  const metaStatsText = [
    mediaStats.images > 0 ? `${mediaStats.images} ảnh` : '',
    mediaStats.tables > 0 ? `${mediaStats.tables} bảng` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white" data-testid="web-highlight-reader">
      {/* Compact single-line toolbar (ẩn khi đã gộp nút Mở bài gốc lên Header của NotebookSourceInspector) */}
      {!hideTopBar && (
        <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-600">
            <Globe className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="font-medium truncate">{domain || 'Nguồn Internet'}</span>
            {!loading && hasSubstantialArticle && matchedIndex >= 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold shrink-0">
                Đã đánh dấu
              </span>
            )}
            {!loading && hasSubstantialArticle && metaStatsText && (
              <span className="hidden sm:inline text-[10px] text-slate-500 shrink-0">
                {metaStatsText}
              </span>
            )}
          </div>
          {url && (
            <a
              data-testid="web-open-fragment-link"
              href={fragmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-teal-800 hover:bg-teal-50 border border-teal-200/80 transition shrink-0"
              title="Mở trang gốc & tự cuộn tới đoạn trích"
            >
              <span>Mở bài gốc</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Main rich article area */}
      <div className="clinical-prose flex-1 min-h-0 overflow-y-auto px-5 py-4 thin-scrollbar" data-testid="web-reader-panel">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[13.5px] text-slate-500">
            <LoaderCircle className="w-4 h-4 animate-spin text-teal-700" />
            <span>Đang tải bài viết, hình ảnh &amp; đối chiếu đoạn trích...</span>
          </div>
        ) : hasSubstantialArticle ? (
          <article className="space-y-3">
            {hideTopBar && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-600 truncate">{domain || 'Nguồn Internet'}</span>
                {matchedIndex >= 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100/90 text-amber-900 text-[11px] font-semibold">
                    Đã đánh dấu
                  </span>
                )}
                {metaStatsText && (
                  <span className="text-slate-400">· {metaStatsText}</span>
                )}
              </div>
            )}
            <h5 className="text-[17px] font-bold text-slate-950 leading-snug pb-2.5 border-b border-slate-100">
              {readerData?.title || title}
            </h5>
            {blocks.map((block, idx) => {
              const isMatch = idx === matchedIndex;
              const matchWrapperClass = isMatch
                ? 'bg-amber-50/85 border-l-3 border-amber-400 px-3.5 py-2.5 rounded-r-lg'
                : '';

              if (block.type === 'heading') {
                const sizeClass =
                  block.level <= 2
                    ? 'text-[16px] font-bold text-slate-950 pt-3'
                    : 'text-[15px] font-semibold text-slate-900 pt-2';
                return (
                  <div
                    key={`blk-${idx}`}
                    ref={isMatch ? highlightedRef : undefined}
                    data-testid={isMatch ? 'web-reader-highlighted-para' : undefined}
                    className={`${sizeClass} ${matchWrapperClass}`}
                  >
                    {isMatch ? renderTwoTierText(block.text, excerpt) : block.text}
                  </div>
                );
              }

              if (block.type === 'image') {
                return (
                  <ArticleImageBlock
                    key={`blk-${idx}`}
                    src={block.src}
                    alt={block.alt}
                    caption={block.caption}
                  />
                );
              }

              if (block.type === 'table') {
                return (
                  <div
                    key={`blk-${idx}`}
                    ref={isMatch ? highlightedRef : undefined}
                    data-testid={isMatch ? 'web-reader-highlighted-para' : 'web-reader-table'}
                    className={`my-3 overflow-x-auto rounded-lg border border-slate-200 ${isMatch ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      {block.headers.length > 0 && (
                        <thead className="bg-slate-100/90 text-slate-800">
                          <tr>
                            {block.headers.map((h, hIdx) => (
                              <th key={hIdx} className="px-2.5 py-2 font-semibold border-b border-slate-200">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody className="divide-y divide-slate-100">
                        {block.rows.map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-2.5 py-1.5 text-slate-700 align-top">
                                {isMatch ? renderTwoTierText(cell, excerpt) : cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              if (block.type === 'list') {
                const ListTag = block.ordered ? 'ol' : 'ul';
                return (
                  <div
                    key={`blk-${idx}`}
                    ref={isMatch ? highlightedRef : undefined}
                    data-testid={isMatch ? 'web-reader-highlighted-para' : undefined}
                    className={matchWrapperClass}
                  >
                    <ListTag
                      className={`text-[14.5px] leading-[1.7] text-slate-800 space-y-1.5 pl-5 ${
                        block.ordered ? 'list-decimal' : 'list-disc'
                      }`}
                    >
                      {block.items.map((item, iIdx) => (
                        <li key={iIdx}>{isMatch ? renderTwoTierText(item, excerpt) : item}</li>
                      ))}
                    </ListTag>
                  </div>
                );
              }

              if (block.type === 'quote') {
                return (
                  <div
                    key={`blk-${idx}`}
                    ref={isMatch ? highlightedRef : undefined}
                    data-testid={isMatch ? 'web-reader-highlighted-para' : undefined}
                    className={
                      isMatch
                        ? matchWrapperClass
                        : 'border-l-2 border-slate-300 bg-slate-50/70 px-3.5 py-2.5 rounded-r-lg text-[14.5px] italic text-slate-700 leading-[1.7]'
                    }
                  >
                    {isMatch ? renderTwoTierText(block.text, excerpt) : block.text}
                  </div>
                );
              }

              return (
                <div
                  key={`blk-${idx}`}
                  ref={isMatch ? highlightedRef : undefined}
                  data-testid={isMatch ? 'web-reader-highlighted-para' : undefined}
                  className={`text-[14.5px] leading-[1.72] transition ${
                    isMatch ? `${matchWrapperClass} text-slate-900` : 'text-slate-800 px-0.5'
                  }`}
                >
                  {isMatch ? renderTwoTierText(block.text, excerpt) : block.text}
                </div>
              );
            })}
          </article>
        ) : (
          /* Minimal fallback when external site blocks automated reading */
          <div className="space-y-3">
            <h5 className="text-[16px] font-bold text-slate-950 leading-snug">{title}</h5>
            {excerpt && (
              <blockquote
                data-testid="web-excerpt-highlight"
                className="text-[14.5px] text-slate-950 font-medium leading-[1.7] whitespace-pre-line bg-amber-100/75 border-l-3 border-amber-500 px-3.5 py-2.5 rounded-r-lg"
              >
                {excerpt}
              </blockquote>
            )}
            <p className="text-[12.5px] text-slate-500 leading-relaxed">
              Trang gốc hạn chế đọc trực tiếp trong khung ({readerData?.reason || 'bảo vệ truy cập'}). Bấm{' '}
              <strong>Mở bài gốc</strong> ở góc trên để xem toàn văn kèm tô vàng tự động.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
