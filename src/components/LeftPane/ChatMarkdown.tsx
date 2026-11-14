/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bộ Định Dạng Markdown Lâm Sàng Tinh Chỉnh Cho Chatbot (<=180 LOC)
 */

import React from 'react';
import { AlertTriangle, AlertCircle, ShieldCheck, Lightbulb, BookOpen } from 'lucide-react';
import { RagCitationItem } from '../../types/chat';

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

  const text = sanitizeClinicalText(rawText);
  const tokens = text.split(
    /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|`[^`\n]+`|\[[^\]]+\]\([^\)]+\)|\[(?:DTQG|DĐVN|Dược thư|QĐ|TT|NĐ|Luật|Nguồn|Bộ Y tế)[^\]\n]+\]|\*[^*\n]+?\*|_[^_\n]+?_)/g
  );

  return tokens.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={i} className={`font-bold italic ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {part.slice(3, -3)}
        </strong>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className={`px-1.5 py-0.5 rounded font-mono text-2xs font-medium border ${
            isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-200'
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

      if (linkUrl.startsWith('/pdf/') || linkUrl.includes('.pdf')) {
        if (options.hideInlineSources) return null;
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
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-2xs sm:text-xs font-semibold bg-teal-50 text-teal-800 hover:bg-teal-100 hover:text-teal-950 border border-teal-200/80 transition cursor-pointer active:scale-95 align-baseline"
            title={`Tra cứu y văn: ${linkText}`}
          >
            <BookOpen className="w-2.5 h-2.5 text-teal-600" />
            <span>{linkText}</span>
          </button>
        );
      }

      return (
        <a
          key={i}
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className={`underline font-semibold transition ${isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-900'}`}
        >
          {linkText}
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

  const text = sanitizeClinicalText(rawText);
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
          className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 shadow-3xs"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-slate-100/90 text-slate-900 font-bold border-b border-slate-200">
              <tr>
                {headerCells.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-3 py-2 text-xs uppercase tracking-wider text-slate-700 font-bold"
                  >
                    {formatInlineMarkdown(h, options)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {bodyRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 leading-relaxed text-xs sm:text-sm">
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
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 pl-3.5 py-1.5 border-l-3 border-teal-700 bg-slate-50/80 rounded-r-lg text-xs sm:text-sm text-slate-800 italic leading-relaxed space-y-1 border-y border-r border-slate-200/50"
        >
          {quoteLines.map((qLine, qIdx) => (
            <div key={qIdx}>{formatInlineMarkdown(qLine, options)}</div>
          ))}
        </blockquote>
      );
      continue;
    }
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      elements.push(<hr key={`hr-${i}`} className="my-2.5 border-slate-200/80" />);
      i++; continue;
    }

    // 5. Tiêu đề Markdown (#, ##, ###, ####)
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      elements.push(
        <h2 key={`h1-${i}`} className="font-bold text-base sm:text-lg text-teal-950 mt-3.5 mb-2 border-b border-slate-200/90 pb-1.5 flex items-center gap-1.5">
          {formatInlineMarkdown(h1[1], options)}
        </h2>
      );
      i++; continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      elements.push(
        <h3 key={`h2-${i}`} className="font-bold text-sm sm:text-base text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
          {formatInlineMarkdown(h2[1], options)}
        </h3>
      );
      i++; continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      elements.push(
        <h4 key={`h3-${i}`} className="font-bold text-sm sm:text-base text-teal-900 mt-2.5 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
          {formatInlineMarkdown(h3[1], options)}
        </h4>
      );
      i++; continue;
    }
    const h4 = line.match(/^####\s+(.+)$/);
    if (h4) {
      elements.push(
        <h5 key={`h4-${i}`} className="font-semibold text-xs sm:text-sm text-slate-800 mt-2 mb-0.5">
          {formatInlineMarkdown(h4[1], options)}
        </h5>
      );
      i++; continue;
    }
    // Xử lý dòng trống: gom các dòng trống liên tiếp thành một khoảng cách thống nhất
    if (line === '') {
      while (i + 1 < rawLines.length && rawLines[i + 1].trim() === '') {
        i++;
      }
      elements.push(<div key={`spacer-${i}`} className={options.compact ? 'h-1' : 'h-1.5'} />);
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
      elements.push(
        <div key={`num-${i}`} className={`flex items-start gap-1.5 ${options.compact ? 'my-0.5' : 'my-1'} ${isNested ? 'pl-4 sm:pl-5' : 'pl-0.5'} leading-relaxed ${options.compact ? 'text-xs' : 'text-sm sm:text-base'} text-slate-800`}>
          <span className="font-semibold text-slate-600 text-xs sm:text-sm shrink-0 mt-0.5 min-w-[16px]">{numMatch[1]}.</span>
          <div className="flex-1">{formatInlineMarkdown(numMatch[2], options)}</div>
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

      let bulletIcon = <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />;
      if (isDoubleNested) {
        bulletIcon = <span className="w-1 h-1 rounded-full bg-slate-400 mt-2 shrink-0" />;
      } else if (isNested) {
        bulletIcon = <span className="w-1.5 h-1.5 rounded-xs bg-teal-700/80 mt-2 shrink-0" />;
      }

      elements.push(
        <div
          key={`bullet-${i}`}
          className={`flex items-start gap-2 ${options.compact ? 'my-0.5' : 'my-1'} leading-relaxed ${options.compact ? 'text-xs' : 'text-sm sm:text-base'} text-slate-800 ${
            isDoubleNested ? 'pl-7 sm:pl-8' : isNested ? 'pl-3.5 sm:pl-4' : 'pl-0.5'
          }`}
        >
          {bulletIcon}
          <div className="flex-1">{formatInlineMarkdown(bulletMatch[1], options)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 11. Dòng văn bản bình thường (Gom các dòng liên tiếp thành đoạn văn tự nhiên)
    const paraLines: string[] = [line];
    let j = i + 1;
    while (
      j < rawLines.length &&
      rawLines[j].trim() !== '' &&
      !rawLines[j].trim().startsWith('#') &&
      !rawLines[j].trim().startsWith('>') &&
      !rawLines[j].trim().startsWith('|') &&
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
        className={`${options.compact ? 'my-0.5 text-xs' : 'my-1 text-sm sm:text-base'} leading-relaxed text-slate-800 break-words`}
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
