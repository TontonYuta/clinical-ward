/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bộ Định Dạng Markdown Lâm Sàng Tinh Chỉnh Cho Chatbot (<=180 LOC)
 */

import React from 'react';
import { AlertTriangle, AlertCircle, ShieldCheck, Lightbulb, Pill } from 'lucide-react';

export const sanitizeClinicalText = (text: string): string => {
  if (!text) return '';
  return text
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
};

export const formatInlineMarkdown = (rawText: string, isDark: boolean = false): React.ReactNode => {
  if (!rawText) return null;
  const text = sanitizeClinicalText(rawText);
  const tokens = text.split(/(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|`[^`\n]+`|\[[^\]]+\]\([^\)]+\)|\*[^*\n]+?\*|_[^_\n]+?_)/g);

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
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className={`underline font-semibold transition ${isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-900'}`}
        >
          {linkMatch[1]}
        </a>
      );
    }
    if (((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) && part.length >= 2 && !part.startsWith('**')) {
      return (
        <em key={i} className={`italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
};

export const renderFormattedText = (rawText: string, isDark: boolean = false): React.ReactNode => {
  if (!rawText) return null;
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
          className={`my-2.5 p-3 rounded-xl border text-xs space-y-1.5 shadow-3xs ${styleClass}`}
        >
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-2xs">
            {icon}
            <span>{alertTitle}</span>
          </div>
          {bodyLines.map((bLine, bIdx) => (
            <div key={bIdx} className="leading-relaxed pl-5.5">{formatInlineMarkdown(bLine, false)}</div>
          ))}
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
          className="my-2.5 p-2 rounded-xl bg-teal-50/60 border border-teal-200/70 flex flex-wrap gap-2 text-xs"
        >
          {pillItems.map((item, pIdx) => (
            <div
              key={pIdx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-teal-100 shadow-3xs text-slate-800 text-xs"
            >
              <Pill className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span>{formatInlineMarkdown(item, isDark)}</span>
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
          className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 shadow-3xs"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-900 font-bold border-b border-slate-200">
              <tr>
                {headerCells.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-3 py-2 text-2xs uppercase tracking-wider text-slate-700 font-bold"
                  >
                    {formatInlineMarkdown(h, isDark)}
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
                    <td key={cIdx} className="px-3 py-2 leading-relaxed text-xs">
                      {formatInlineMarkdown(cell, isDark)}
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
      elements.push(<div key={`quote-${i}`} className="my-1.5 pl-3 py-1 border-l-2 border-teal-600 bg-slate-50/80 rounded-r text-xs text-slate-700 italic leading-relaxed">{formatInlineMarkdown(line.replace(/^>\s*/, ''), isDark)}</div>);
      i++; continue;
    }
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      elements.push(<hr key={`hr-${i}`} className="my-2.5 border-slate-200/80" />);
      i++; continue;
    }

    // 5. Tiêu đề Markdown (#, ##, ###, ####)
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      elements.push(
        <h2 key={`h1-${i}`} className="font-bold text-sm sm:text-base text-teal-950 mt-3.5 mb-2 border-b border-slate-200/90 pb-1.5 flex items-center gap-1.5">
          {formatInlineMarkdown(h1[1], isDark)}
        </h2>
      );
      i++; continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      elements.push(
        <h3 key={`h2-${i}`} className="font-bold text-xs sm:text-sm text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
          {formatInlineMarkdown(h2[1], isDark)}
        </h3>
      );
      i++; continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      elements.push(
        <h4 key={`h3-${i}`} className="font-bold text-xs text-teal-900 mt-2.5 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
          {formatInlineMarkdown(h3[1], isDark)}
        </h4>
      );
      i++; continue;
    }
    const h4 = line.match(/^####\s+(.+)$/);
    if (h4) {
      elements.push(
        <h5 key={`h4-${i}`} className="font-semibold text-xs text-slate-800 mt-2 mb-0.5">
          {formatInlineMarkdown(h4[1], isDark)}
        </h5>
      );
      i++; continue;
    }
    if (line === '') { elements.push(<div key={`spacer-${i}`} className="h-1.5" />); i++; continue; }

    // 6. Danh sách có số (1. , 2. )
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-1.5 my-1 pl-0.5 leading-relaxed text-xs sm:text-sm text-slate-800">
          <span className="font-semibold text-slate-600 text-xs shrink-0 mt-0.5 min-w-[16px]">{numMatch[1]}.</span>
          <div className="flex-1">{formatInlineMarkdown(numMatch[2], isDark)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 7. Danh sách gạch đầu dòng (* , - , + , • )
    const bulletMatch = line.match(/^[\*\-\+•]\s+(.+)$/);
    if (bulletMatch) {
      const isNested = rawLine.startsWith('   ') || rawLine.startsWith('\t');
      elements.push(
        <div key={`bullet-${i}`} className={`flex items-start gap-2 my-1 leading-relaxed text-xs sm:text-sm text-slate-800 ${isNested ? 'pl-4' : 'pl-0.5'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
          <div className="flex-1">{formatInlineMarkdown(bulletMatch[1], isDark)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 8. Dòng văn bản bình thường
    elements.push(
      <div key={`p-${i}`} className="my-1 leading-relaxed text-xs sm:text-sm text-slate-800">
        {formatInlineMarkdown(line, isDark)}
      </div>
    );
    i++;
  }

  return elements;
};
