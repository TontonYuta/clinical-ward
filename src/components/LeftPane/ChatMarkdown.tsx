/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bộ Định Dạng Markdown Lâm Sàng Tinh Chỉnh Cho Chatbot (<=180 LOC)
 */

import React from 'react';
import { AlertTriangle, AlertCircle, ShieldCheck, Lightbulb, BookOpen, ExternalLink, Globe } from 'lucide-react';
import { RagCitationItem } from '../../types/chat';
import { normalizeInlineCitations } from '../../utils/citationLabel';
import { InlineCitationPill } from './InlineCitationPill';

export interface MarkdownRenderOptions {
  isDark?: boolean;
  hideInlineSources?: boolean;
  citations?: RagCitationItem[];
  onCitationClick?: (citation: {
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
  }) => void;
  compact?: boolean;
}

export const sanitizeClinicalText = (text: string): string => {
  if (!text) return '';
  let sanitized = text
    .replace(/\$([0-9.]+)\s*\^\{?\\circ\}?\\text\{C\}\s*[-–]\s*([0-9.]+)\s*\^\{?\\circ\}?\\text\{C\}\$/g, '$1°C – $2°C')
    .replace(/\(([0-9.]+)\s*\^\{?\\circ\}?\\text\{C\}\s*[-–]\s*([0-9.]+)\s*\^\{?\\circ\}?\\text\{C\}\)/g, '($1°C – $2°C)')
    .replace(/\^\{?\\circ\}?\s*(?:\\text\{C\}|C)/g, '°C')
    .replace(/\\circ\\text\{C\}/g, '°C')
    .replace(/\\circ\s*C/g, '°C')
    .replace(/\^\{?\\circ\}?/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\le\b/g, '≤')
    .replace(/\\pm\b/g, '±')
    .replace(/\\times\b/g, '×')
    .replace(/\\mu\s*g\b/g, 'µg')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1');

  // Auto-heal unclosed markdown tags caused by truncation or streaming
  const triple = sanitized.match(/\*\*\*/g);
  if (triple && triple.length % 2 !== 0) {
    if (sanitized.endsWith('…')) sanitized = sanitized.slice(0, -1) + '***…';
    else if (sanitized.endsWith('...')) sanitized = sanitized.slice(0, -3) + '***...';
    else sanitized += '***';
  }

  const strippedOfTriple = sanitized.replace(/\*\*\*/g, '');
  const double = strippedOfTriple.match(/\*\*/g);
  if (double && double.length % 2 !== 0) {
    if (sanitized.endsWith('…')) sanitized = sanitized.slice(0, -1) + '**…';
    else if (sanitized.endsWith('...')) sanitized = sanitized.slice(0, -3) + '**...';
    else sanitized += '**';
  }

  const backtick = sanitized.match(/`/g);
  if (backtick && backtick.length % 2 !== 0) {
    if (sanitized.endsWith('…')) sanitized = sanitized.slice(0, -1) + '`…';
    else if (sanitized.endsWith('...')) sanitized = sanitized.slice(0, -3) + '`...';
    else sanitized += '`';
  }

  return sanitized;
};

export const formatInlineMarkdown = (
  rawText: string,
  isDarkOrOptions: boolean | MarkdownRenderOptions = false
): React.ReactNode => {
  if (!rawText) return null;
  const options: MarkdownRenderOptions =
    typeof isDarkOrOptions === 'boolean' ? { isDark: isDarkOrOptions } : isDarkOrOptions;
  const { isDark = false, onCitationClick } = options;

  const text = normalizeInlineCitations(sanitizeClinicalText(rawText));
  const tokens = text.split(
    /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|`[^`\n]+`|\[[^\]]+\]\([^\)]+\)|(?:\[\d+\])+|\[(?:DTQG|DĐVN|Dược thư|QĐ|TT|NĐ|Luật|Nguồn|Bộ Y tế)[^\]\n]+\]|\(?https?:\/\/[^\s\)]+\)?|\*[^*\n]+?\*|_[^_\n]+?_)/g
  );

  return tokens.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={i} className={`font-semibold italic ${isDark ? 'text-white' : 'text-slate-950'}`}>
          {part.slice(3, -3)}
        </strong>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className={`font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className={`px-1.5 py-0.5 rounded font-mono text-2xs font-medium border ${
            isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-teal-900 border-slate-200'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // A. Link Markdown [Tên](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];

      if (linkUrl.startsWith('/pdf/') || /^https?:\/\/[^\s]+\.pdf(?:[#?].*)?$/i.test(linkUrl)) {
        const pageMatch = linkUrl.match(/#page=(\d+)/);
        const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onCitationClick?.({
                title: linkText,
                url: linkUrl,
                page: pageNum,
              });
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-200/90 transition cursor-pointer active:scale-95 align-baseline shadow-3xs"
            title={`Mở chuyên luận y văn Dược thư: ${linkText}`}
          >
            <BookOpen className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="underline decoration-emerald-400/70 underline-offset-2">{linkText}</span>
          </button>
        );
      }

      if (!/^https?:\/\//i.test(linkUrl)) {
        return <span key={i}>{linkText}</span>;
      }

      return (
        <a
          key={i}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-md font-semibold text-xs sm:text-sm border transition cursor-pointer group/link align-baseline shadow-3xs ${
            isDark
              ? 'bg-teal-950/80 text-teal-300 border-teal-800 hover:bg-teal-900 hover:text-teal-100'
              : 'bg-teal-50/90 text-teal-800 border-teal-200 hover:bg-teal-100 hover:text-teal-950 hover:border-teal-300'
          }`}
          title={`Mở nguồn tài liệu y khoa ngoài: ${linkUrl}`}
        >
          <ExternalLink className="w-3 h-3 text-teal-600 shrink-0 group-hover/link:translate-x-0.5 transition-transform" />
          <span className="underline decoration-teal-400/80 underline-offset-2">{linkText}</span>
        </a>
      );
    }

    // B. Footnote Citation Cluster [1], [2], [3][4]... -> ChatGPT-style Domain/Source Pill + Hover Card
    if (/^(?:\[\d+\])+$/.test(part)) {
      const nums = Array.from(part.matchAll(/\[(\d+)\]/g), (m) => parseInt(m[1], 10));
      return (
        <InlineCitationPill
          key={i}
          indices={nums}
          citations={options.citations}
          isDark={isDark}
          onCitationClick={onCitationClick}
        />
      );
    }

    // C. Raw URLs (e.g. https://... or (https://...))
    const rawUrlMatch = part.match(/^\(?((?:https?:\/\/)[^\s\)]+)\)?$/i);
    if (rawUrlMatch) {
      const cleanUrl = rawUrlMatch[1];
      let domain = '';
      try {
        domain = new URL(cleanUrl).hostname.replace('www.', '');
      } catch {
        domain = cleanUrl;
      }

      return (
        <a
          key={i}
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-md font-semibold text-xs border transition cursor-pointer group/link align-baseline shadow-3xs ${
            isDark
              ? 'bg-teal-950/80 text-teal-300 border-teal-800 hover:bg-teal-900 hover:text-teal-100'
              : 'bg-teal-50/90 text-teal-800 border-teal-200 hover:bg-teal-100 hover:text-teal-950'
          }`}
          title={`Mở liên kết web: ${cleanUrl}`}
        >
          <ExternalLink className="w-3 h-3 text-teal-600 shrink-0 group-hover/link:translate-x-0.5 transition-transform" />
          <span className="underline decoration-teal-400/80 underline-offset-2 truncate max-w-[220px] sm:max-w-[280px]">
            {domain || cleanUrl}
          </span>
        </a>
      );
    }

    // B. Token Trích Dẫn Y Khoa Tự Nhiên [DTQG tr.1118], [Dược thư tr.1118], [DĐVN tr.50], [QĐ 5948], v.v.
    const citationTokenMatch = part.match(
      /^\[((?:DTQG|DĐVN|Dược thư|QĐ|TT|NĐ|Luật|Nguồn|Bộ Y tế)[^\]\n]+)\]$/i
    );
    if (citationTokenMatch) {
      return options.hideInlineSources ? null : <span key={i}>{part}</span>;
    }

    if (((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) && part.length >= 2 && !part.startsWith('**')) {
      const inner = part.slice(1, -1);
      if (/\[(?:DTQG|DĐVN|Dược thư|QĐ|TT|NĐ|Luật|Nguồn|Bộ Y tế)[^\]\n]+\]/i.test(inner)) {
        return (
          <em key={i} className={`italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {formatInlineMarkdown(inner, options)}
          </em>
        );
      }
      return (
        <em key={i} className={`italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {inner}
        </em>
      );
    }
    return part;
  });
};

export const renderFormattedText = (
  rawText: string,
  isDarkOrOptions: boolean | MarkdownRenderOptions = false
): React.ReactNode => {
  if (!rawText) return null;
  const options: MarkdownRenderOptions =
    typeof isDarkOrOptions === 'boolean' ? { isDark: isDarkOrOptions } : isDarkOrOptions;
  const { isDark = false } = options;

  const text = sanitizeClinicalText(rawText).replace(
    /\[(\d+(?:\s*,\s*\d+)+)\](?!\()/g,
    (_, nums: string) => nums.split(',').map((n) => `[${n.trim()}]`).join('')
  );
  const rawLines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const rawLine = rawLines[i];
    const line = rawLine.trim();

    // 1. Khung cảnh báo (> [!WARNING], > [!IMPORTANT], > [!NOTE], > [!TIP], > [!CAUTION])
    if (line.startsWith('> [!')) {
      const isDanger = line.includes('[!WARNING]') || line.includes('[!CAUTION]');
      const isImportant = line.includes('[!IMPORTANT]');
      const isTip = line.includes('[!TIP]');

      let alertTitle = 'LƯU Ý CHUYÊN MÔN';
      let icon = <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />;
      let styleClass = 'bg-teal-50/80 border-teal-300 text-teal-950';

      if (isDanger) {
        alertTitle = line.includes('[!CAUTION]') ? 'CẢNH BÁO NGUY CƠ CAO' : 'CẢNH BÁO AN TOÀN';
        icon = <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />;
        styleClass = 'bg-rose-50/80 border-rose-300 text-rose-950';
      } else if (isImportant) {
        alertTitle = 'LƯU Ý QUAN TRỌNG';
        icon = <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />;
        styleClass = 'bg-amber-50/80 border-amber-300 text-amber-950';
      } else if (isTip) {
        alertTitle = 'KHUYẾN CÁO LÂM SÀNG';
        icon = <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0" />;
        styleClass = 'bg-emerald-50/80 border-emerald-300 text-emerald-950';
      }

      // Đọc tiêu đề tùy chỉnh nếu có phía sau [!TYPE]
      const customTitleMatch = line.match(/>\s*\[!(?:WARNING|CAUTION|IMPORTANT|NOTE|TIP)\]\s*(.*)$/i);
      if (customTitleMatch && customTitleMatch[1].trim()) {
        alertTitle = customTitleMatch[1].trim();
      }

      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < rawLines.length && rawLines[j].trim().startsWith('>')) {
        bodyLines.push(rawLines[j].trim().replace(/^>\s*/, ''));
        j++;
      }
      i = j;
      elements.push(
        <div
          key={`alert-${i}`}
          className={`my-2.5 p-3.5 rounded-xl border text-xs sm:text-sm space-y-1.5 shadow-3xs ${styleClass}`}
        >
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs">
            {icon}
            <span>{alertTitle}</span>
          </div>
          <div className="space-y-1 mt-1">
            {bodyLines.map((bLine, bIdx) => {
              const bBullet = bLine.match(/^[\*\-\+•●▪⁃–]\s*(.+)$/);
              if (bBullet) {
                return (
                  <div key={bIdx} className="flex items-start gap-2 leading-relaxed text-xs sm:text-sm pl-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isDanger ? 'bg-rose-500' : isImportant ? 'bg-amber-500' : isTip ? 'bg-emerald-500' : 'bg-teal-600'} mt-1.5 shrink-0`} />
                    <div className="flex-1">{formatInlineMarkdown(bBullet[1], options)}</div>
                  </div>
                );
              }
              return (
                <div key={bIdx} className="leading-relaxed pl-1 text-xs sm:text-sm">
                  {formatInlineMarkdown(bLine, options)}
                </div>
              );
            })}
          </div>
        </div>
      );
      continue;
    }

    // 2. Thẻ Thông Số Định Danh Thuốc (Pill Badges Grid)
    if (
      line.includes('|') &&
      (line.includes('**Hoạt chất') ||
        line.includes('**Số đăng ký') ||
        line.includes('**SĐK') ||
        line.includes('**Dạng bào chế') ||
        line.includes('**Hàm lượng') ||
        line.includes('**Phân loại'))
    ) {
      const rawPills = line.replace(/^[•\-\*]\s*/, '').split('|');
      const pillItems = rawPills.map((p) => p.trim()).filter(Boolean);
      elements.push(
        <div
          key={`meta-pills-${i}`}
          className="my-2.5 p-2 rounded-xl bg-teal-50/60 border border-teal-200/70 flex flex-wrap gap-2 text-xs sm:text-sm"
        >
          {pillItems.map((item, pIdx) => (
            <div
              key={pIdx}
              className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-teal-200/80 shadow-3xs text-slate-800 text-xs sm:text-sm font-medium"
            >
              <span>{formatInlineMarkdown(item, options)}</span>
            </div>
          ))}
        </div>
      );
      i++;
      continue;
    }

    // 3. Khung Bảng Markdown (| Tiêu đề 1 | Tiêu đề 2 |)
    if (
      line.startsWith('|') &&
      line.endsWith('|') &&
      i + 1 < rawLines.length &&
      rawLines[i + 1].trim().startsWith('|') &&
      rawLines[i + 1].includes('---')
    ) {
      const headerCells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      const bodyRows: string[][] = [];
      let j = i + 2;
      while (
        j < rawLines.length &&
        rawLines[j].trim().startsWith('|') &&
        rawLines[j].trim().endsWith('|')
      ) {
        const cells = rawLines[j]
          .trim()
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        bodyRows.push(cells);
        j++;
      }
      i = j;
      elements.push(
        <div
          key={`table-${i}`}
          className="my-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white"
        >
          <table className="w-full text-left text-[13.5px] sm:text-[14px] border-collapse">
            <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200/80">
              <tr>
                {headerCells.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold"
                  >
                    {formatInlineMarkdown(h, options)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {bodyRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={rIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/60 transition-colors' : 'bg-slate-50/35 hover:bg-slate-50/80 transition-colors'}
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-4 py-2.5 leading-[1.6] text-[13.5px] sm:text-[14px] align-top ${
                        cIdx === 0 ? 'font-medium text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {formatInlineMarkdown(cell, options)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Trích dẫn Blockquote & Đường phân cách
    if (line.startsWith('>')) {
      const quoteLines: string[] = [line.replace(/^>\s*/, '')];
      let j = i + 1;
      while (
        j < rawLines.length &&
        rawLines[j].trim().startsWith('>') &&
        !rawLines[j].trim().startsWith('> [!')
      ) {
        quoteLines.push(rawLines[j].trim().replace(/^>\s*/, ''));
        j++;
      }
      i = j;
      const firstQuoteLine = quoteLines[0] || '';
      if (quoteLines.length === 1 && /^\*\*[^*]+:\*\*$/.test(firstQuoteLine.trim())) {
        continue;
      }
      const isDangerQuote = /^\*\*(?:Cảnh báo|Chống chỉ định|Ngộ độc|Quá liều)/i.test(firstQuoteLine);
      const isSummaryQuote = /^\*\*(?:Tóm tắt|Kết luận|Lưu ý)/i.test(firstQuoteLine);
      const quoteStyle = isDangerQuote
        ? 'my-4 px-4 py-3.5 rounded-r-xl border-l-[3px] border-rose-500 bg-rose-50/55 text-slate-800 not-italic'
        : isSummaryQuote
          ? 'my-3 px-4 py-3 rounded-r-xl border-l-[3px] border-teal-600 bg-teal-50/45 text-slate-800 not-italic'
          : 'my-3 pl-4 py-2.5 border-l-[3px] border-slate-300 bg-slate-50/70 rounded-r-lg text-slate-700 italic';
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className={`text-[14.5px] sm:text-[15px] leading-[1.7] space-y-1.5 ${quoteStyle}`}
        >
          {quoteLines.map((qLine, qIdx) => {
            const qBullet = qLine.match(/^[\*\-\+•]\s+(.+)$/);
            if (qBullet) {
              return (
                <div key={qIdx} className="flex items-start gap-2.5 pl-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full mt-[10px] shrink-0 ${isDangerQuote ? 'bg-rose-400' : 'bg-teal-500'}`} />
                  <div className="flex-1">{formatInlineMarkdown(qBullet[1], options)}</div>
                </div>
              );
            }
            return <div key={qIdx}>{formatInlineMarkdown(qLine, options)}</div>;
          })}
        </blockquote>
      );
      continue;
    }
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      elements.push(<hr key={`hr-${i}`} className="my-4 border-slate-200/70" />);
      i++; continue;
    }

    // 5. Tiêu đề Markdown (#, ##, ###, ####) — Phân cấp 3 tầng chuẩn rõ ràng (Cấp 1 > Cấp 2 > Cấp 3)
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      elements.push(
        <h2 key={`h1-${i}`} className="font-bold text-lg sm:text-[21px] text-slate-950 mt-6 mb-3 border-b border-slate-200/80 pb-2">
          {formatInlineMarkdown(h1[1], options)}
        </h2>
      );
      i++; continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      elements.push(
        <h3 key={`h2-${i}`} className="font-bold text-[17px] sm:text-[19px] text-slate-950 mt-6 mb-2.5 pb-1.5 border-b border-slate-100">
          {formatInlineMarkdown(h2[1], options)}
        </h3>
      );
      i++; continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      const isRefHeader = /nguồn tham khảo|tài liệu tham khảo/i.test(h3[1]);
      const isDangerHeader = /chống chỉ định|cảnh báo|quá liều|ngộ độc|lưu ý an toàn/i.test(h3[1]);
      const hasPriorContent = elements.length > 0;
      elements.push(
        <h4
          key={`h3-${i}`}
          className={`font-bold text-[16.5px] sm:text-[18px] leading-snug mb-2.5 flex items-center gap-2 ${
            isRefHeader
              ? 'mt-7 pt-5 border-t border-slate-200/80 text-slate-900'
              : hasPriorContent
                ? `mt-7 pt-5 border-t border-slate-100 ${isDangerHeader ? 'text-rose-800' : 'text-slate-950'}`
                : `mt-1 ${isDangerHeader ? 'text-rose-800' : 'text-slate-950'}`
          }`}
        >
          {isRefHeader && <Globe className="w-4 h-4 text-slate-500 shrink-0" />}
          <span>{formatInlineMarkdown(h3[1], options)}</span>
        </h4>
      );
      i++; continue;
    }
    const h4 = line.match(/^####\s+(.+)$/);
    if (h4) {
      elements.push(
        <h5 key={`h4-${i}`} className="font-semibold text-[14.5px] sm:text-[15.5px] text-slate-900 mt-4 mb-1.5">
          {formatInlineMarkdown(h4[1], options)}
        </h5>
      );
      i++; continue;
    }
    // Xử lý dòng trống: gom các dòng trống liên tiếp thành khoảng đệm nhẹ (tránh làm loãng luật gần nhau)
    if (line === '') {
      while (i + 1 < rawLines.length && rawLines[i + 1].trim() === '') {
        i++;
      }
      elements.push(<div key={`spacer-${i}`} className="h-1" />);
      i++;
      continue;
    }

    // 6. Nhãn phân mục lâm sàng dạng ngoặc vuông [Liều dùng...]
    const bracketMatch = line.match(/^\[([^\]]+)\]:?$/);
    if (bracketMatch) {
      elements.push(
        <div key={`bracket-hdr-${i}`} className="mt-2.5 mb-1 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/80 w-fit shadow-3xs">
          <span className="w-1.5 h-1.5 rounded-xs bg-teal-700 shrink-0" />
          <span>{formatInlineMarkdown(bracketMatch[1], options)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Tiêu đề khối in đậm độc lập (**Tiêu đề lâm sàng:**)
    const boldHdrMatch = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldHdrMatch) {
      elements.push(
        <div key={`bold-hdr-${i}`} className="mt-2.5 mb-1 font-bold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
          <span>{formatInlineMarkdown(boldHdrMatch[1], options)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Source metadata is rendered from structured citations below the answer.
    const sourceMatch = line.match(/^[\*\(_\-]*\s*Nguồn(?:\s*tham\s*chiếu)?:?\s*(.+)$/i);
    if (sourceMatch) {
      if (options.hideInlineSources) {
        i++;
        continue;
      }
      const rest = sourceMatch[1].replace(/[\*\)]+$/, '').trim();
      const isNested = rawLine.startsWith('  ') || rawLine.startsWith('\t');
      elements.push(
        <div
          key={`source-line-${i}`}
          className={`mt-1.5 flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 font-medium ${isNested ? 'pl-4 sm:pl-5' : 'pl-0.5'}`}
        >
          <span className="text-slate-400 font-normal">Nguồn:</span>
          {formatInlineMarkdown(rest, options)}
        </div>
      );
      i++;
      continue;
    }

    // 8. Câu hỏi gợi ý kết thúc câu trả lời
    if (/^(?:Đồng nghiệp|Bác sĩ|Dược sĩ|Điều dưỡng)\s+cần\s+tra\s+cứu\s+thêm/i.test(line)) {
      elements.push(
        <div key={`prompt-closing-${i}`} className="mt-3 pt-2 border-t border-slate-100 text-xs sm:text-sm text-slate-600 italic flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span>{formatInlineMarkdown(line, options)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 9. Danh sách có số (1. , 2. )
    const numMatch = line.match(/^(\d+)[\.\)]\s*(.+)$/);
    if (numMatch) {
      const isNested = rawLine.startsWith('  ') || rawLine.startsWith('\t');
      const itemNum = numMatch[1];
      elements.push(
        <div
          id={`citation-ref-${itemNum}`}
          key={`num-${i}`}
          className={`flex items-start gap-2.5 ${options.compact ? 'my-0.5' : 'my-1.5'} ${
            isNested ? 'pl-4 sm:pl-5' : 'pl-0.5'
          } leading-[1.7] ${options.compact ? 'text-xs' : 'text-[15px] sm:text-[15.5px]'} text-slate-800 group/numitem`}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold shrink-0 mt-0.5">
            {itemNum}
          </span>
          <div className="flex-1 min-w-0">{formatInlineMarkdown(numMatch[2], options)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 10. Danh sách gạch đầu dòng (* , - , + , • , ● , ▪ , ⁃ , – )
    const bulletMatch = line.match(/^(?:[•●▪⁃–]\s*|[\*\-\+]\s+)(.+)$/);
    if (bulletMatch) {
      const indentSpaces = (rawLine.match(/^\s*/)?.[0] || '').length;
      const isDoubleNested = indentSpaces >= 4 || rawLine.startsWith('\t\t');
      const isNested = indentSpaces >= 2 || rawLine.startsWith('\t');

      let bulletIcon = <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-[10px] shrink-0" />;
      if (isDoubleNested) {
        bulletIcon = <span className="w-1 h-1 rounded-full bg-slate-300 mt-[11px] shrink-0" />;
      } else if (isNested) {
        bulletIcon = <span className="w-1.5 h-1.5 rounded-full border border-slate-400 mt-[10px] shrink-0" />;
      }

      elements.push(
        <div
          key={`bullet-${i}`}
          className={`flex items-start gap-2.5 ${options.compact ? 'my-0.5' : 'my-1.5'} leading-[1.7] ${
            options.compact ? 'text-xs' : 'text-[15px] sm:text-[15.5px]'
          } text-slate-800 ${
            isDoubleNested ? 'pl-7 sm:pl-8' : isNested ? 'pl-3.5 sm:pl-4' : 'pl-0.5'
          }`}
        >
          {bulletIcon}
          <div className="flex-1 min-w-0">{formatInlineMarkdown(bulletMatch[1], options)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 11. Hộp cảnh báo an toàn y khoa cuối bài (⚠️ Lưu ý: ...)
    if (line.startsWith('⚠️')) {
      elements.push(
        <div
          key={`disclaimer-${i}`}
          className="mt-4 mb-1 px-4 py-2.5 rounded-r-xl border-l-[3px] border-amber-400 bg-amber-50/55 text-[13px] sm:text-[13.5px] text-amber-950/90 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-[1.6]">
            {formatInlineMarkdown(line.replace(/^⚠️\s*/, ''), options)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 12. Dòng văn bản bình thường (Gom các dòng liên tiếp thành đoạn văn tự nhiên)
    const paraLines: string[] = [line];
    let j = i + 1;
    while (
      j < rawLines.length &&
      rawLines[j].trim() !== '' &&
      !rawLines[j].trim().startsWith('#') &&
      !rawLines[j].trim().startsWith('>') &&
      !rawLines[j].trim().startsWith('|') &&
      !rawLines[j].trim().startsWith('⚠️') &&
      !rawLines[j].trim().match(/^[\*\-\+•●▪⁃–]\s*/) &&
      !rawLines[j].trim().match(/^(\d+)[\.\)]\s*/) &&
      !rawLines[j].trim().match(/^\[([^\]]+)\]:?$/) &&
      !rawLines[j].trim().match(/^\*\*([^*]+)\*\*:?$/) &&
      !/^(?:Đồng nghiệp|Bác sĩ|Dược sĩ|Điều dưỡng)\s+cần\s+tra\s+cứu\s+thêm/i.test(rawLines[j].trim()) &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(rawLines[j].trim())
    ) {
      paraLines.push(rawLines[j].trim());
      j++;
    }
    i = j;

    elements.push(
      <p
        key={`p-${i}`}
        className={`${options.compact ? 'my-0.5 text-xs' : 'my-1.5 text-[15px] sm:text-[15.5px]'} leading-[1.7] text-slate-800 break-words`}
      >
        {paraLines.map((pLine, pIdx) => (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && ' '}
            {formatInlineMarkdown(pLine, options)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return elements;
};

export const renderClinicalMarkdown = renderFormattedText;
