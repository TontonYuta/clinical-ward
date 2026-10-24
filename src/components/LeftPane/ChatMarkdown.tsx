/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const formatInlineMarkdown = (text: string, isDark: boolean = false): React.ReactNode => {
  if (!text) return null;
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
          className={`px-1.5 py-0.5 rounded font-mono text-xs font-semibold border ${
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

export const renderFormattedText = (text: string, isDark: boolean = false): React.ReactNode => {
  if (!text) return null;
  const rawLines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    if (line.trim().startsWith('> [!')) {
      const isWarning = line.includes('[!WARNING]') || line.includes('[!CAUTION]');
      const isImportant = line.includes('[!IMPORTANT]');
      const alertTitle = isWarning
        ? 'CẢNH BÁO PHÁP LÝ (TT 20/2017 & TT 22/2011)'
        : isImportant
        ? 'QUY ĐỊNH BẮT BUỘC'
        : 'KHUYẾN CÁO THỰC HÀNH';

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
          className={`my-2 p-3 rounded-lg border text-xs space-y-1.5 ${
            isWarning ? 'bg-amber-50/90 border-amber-300/80 text-amber-950' : 'bg-teal-50/90 border-teal-300/80 text-teal-950'
          }`}
        >
          <div className={`flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider ${isWarning ? 'text-amber-800' : 'text-teal-800'}`}>
            {isWarning ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />}
            <span>{alertTitle}</span>
          </div>
          {bodyLines.length > 0 && (
            <div className={`leading-relaxed text-xs space-y-1 ${isWarning ? 'text-amber-900' : 'text-teal-900'}`}>
              {bodyLines.map((bLine, bIdx) => (
                <div key={bIdx}>{formatInlineMarkdown(bLine, false)}</div>
              ))}
            </div>
          )}
        </div>
      );
      continue;
    }

    if (line.trim().startsWith('>')) {
      const quoteContent = line.trim().replace(/^>\s*/, '');
      elements.push(
        <div key={`quote-${i}`} className="my-2 pl-3 py-1.5 border-l-2 border-teal-600 bg-teal-50/40 rounded-r text-xs text-slate-700 italic leading-relaxed">
          {formatInlineMarkdown(quoteContent, isDark)}
        </div>
      );
      i++;
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={`spacer-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\.\s/.test(line.trim());
    elements.push(
      <div key={`line-${i}`} className={isBullet ? 'pl-2 my-0.5 leading-relaxed' : 'my-0.5 leading-relaxed'}>
        {formatInlineMarkdown(line, isDark)}
      </div>
    );
    i++;
  }

  return elements;
};
