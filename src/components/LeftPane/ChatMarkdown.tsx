/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bộ Định Dạng Markdown Lâm Sàng Tinh Chỉnh Cho Chatbot (<=180 LOC)
 */

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

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
          className={`px-1.5 py-0.5 rounded font-mono text-2xs font-semibold border ${
            isDark ? 'bg-slate-800 text-teal-300 border-slate-700' : 'bg-slate-100 text-teal-800 border-slate-200'
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

    // 1. Khung cảnh báo (> [!WARNING], > [!IMPORTANT])
    if (line.startsWith('> [!')) {
      const isWarning = line.includes('[!WARNING]') || line.includes('[!CAUTION]');
      const alertTitle = isWarning ? 'CẢNH BÁO NGUY HIỂM' : 'LƯU Ý CHUYÊN MÔN';
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
          className={`my-2 p-3 rounded-xl border text-xs space-y-1 ${
            isWarning ? 'bg-rose-50/80 border-rose-300 text-rose-950' : 'bg-teal-50/80 border-teal-300 text-teal-950'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs">
            {isWarning ? <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />}
            <span>{alertTitle}</span>
          </div>
          {bodyLines.map((bLine, bIdx) => (
            <div key={bIdx} className="leading-relaxed">{formatInlineMarkdown(bLine, false)}</div>
          ))}
        </div>
      );
      continue;
    }

    // 2. Trích dẫn Blockquote & Đường phân cách
    if (line.startsWith('>')) {
      elements.push(<div key={`quote-${i}`} className="my-1.5 pl-3 py-1 border-l-2 border-teal-600 bg-slate-50/80 rounded-r text-xs text-slate-700 italic leading-relaxed">{formatInlineMarkdown(line.replace(/^>\s*/, ''), isDark)}</div>);
      i++; continue;
    }
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      elements.push(<hr key={`hr-${i}`} className="my-2 border-slate-200/80" />);
      i++; continue;
    }

    // 4. Tiêu đề Markdown (#, ##, ###, ####)
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) { elements.push(<h2 key={`h1-${i}`} className="font-bold text-base text-slate-900 mt-3 mb-1.5 border-b border-slate-200/60 pb-1">{formatInlineMarkdown(h1[1], isDark)}</h2>); i++; continue; }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { elements.push(<h3 key={`h2-${i}`} className="font-bold text-sm text-slate-900 mt-2.5 mb-1">{formatInlineMarkdown(h2[1], isDark)}</h3>); i++; continue; }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) { elements.push(<h4 key={`h3-${i}`} className="font-bold text-xs sm:text-sm text-teal-800 mt-2 mb-1 flex items-center gap-1.5">{formatInlineMarkdown(h3[1], isDark)}</h4>); i++; continue; }
    const h4 = line.match(/^####\s+(.+)$/);
    if (h4) { elements.push(<h5 key={`h4-${i}`} className="font-semibold text-xs text-slate-800 mt-1.5 mb-0.5">{formatInlineMarkdown(h4[1], isDark)}</h5>); i++; continue; }
    if (line === '') { elements.push(<div key={`spacer-${i}`} className="h-1" />); i++; continue; }

    // 6. Danh sách có số (1. , 2. )
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-1.5 my-0.5 pl-1 leading-relaxed text-xs sm:text-sm">
          <span className="font-bold text-teal-700 text-xs shrink-0 mt-0.5 min-w-[14px]">{numMatch[1]}.</span>
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
        <div key={`bullet-${i}`} className={`flex items-start gap-2 my-0.5 leading-relaxed text-xs sm:text-sm ${isNested ? 'pl-4' : 'pl-1'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
          <div className="flex-1">{formatInlineMarkdown(bulletMatch[1], isDark)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 8. Dòng văn bản bình thường
    elements.push(
      <div key={`p-${i}`} className="my-0.5 leading-relaxed text-xs sm:text-sm">
        {formatInlineMarkdown(line, isDark)}
      </div>
    );
    i++;
  }

  return elements;
};
