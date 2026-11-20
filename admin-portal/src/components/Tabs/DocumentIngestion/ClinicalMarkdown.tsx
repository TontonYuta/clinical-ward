import React from 'react';

interface ClinicalMarkdownProps {
  content: string;
}

export const ClinicalMarkdown: React.FC<ClinicalMarkdownProps> = ({ content }) => {
  if (!content) return null;

  // Chuẩn hóa ký hiệu lâm sàng
  const sanitized = content
    .replace(/\^\{?\\circ\}?\s*(?:\\text\{C\}|C)/g, '°C')
    .replace(/\\circ\\text\{C\}/g, '°C')
    .replace(/\\circ\s*C/g, '°C')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\le\b/g, '≤')
    .replace(/\\pm\b/g, '±')
    .replace(/\\times\b/g, '×')
    .replace(/\\mu\s*g\b/g, 'µg');

  const lines = sanitized.split('\n');
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-5 my-1.5 space-y-1 text-slate-800">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const renderInline = (text: string) => {
    // Tách bold **...**, italic *...*, code `...`
    const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={idx} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={idx} className="italic text-slate-800 font-serif">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={idx} className="px-1 py-0.5 rounded bg-slate-100 text-teal-800 font-mono text-2xs border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h3-${lineIdx}`} className="text-xs sm:text-sm font-bold text-slate-900 mt-2.5 mb-1 tracking-tight flex items-center gap-1.5">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h2-${lineIdx}`} className="text-sm sm:text-base font-bold text-slate-950 mt-3 mb-1.5 pb-1 border-b border-slate-100">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`h1-${lineIdx}`} className="text-base sm:text-lg font-bold text-slate-950 mt-3.5 mb-1.5">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    // Divider
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(<hr key={`hr-${lineIdx}`} className="my-2 border-slate-200" />);
      return;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`quote-${lineIdx}`} className="pl-3 py-1 my-1.5 border-l-2 border-teal-600 bg-teal-50/40 text-slate-700 italic text-2xs rounded-r">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Bullet list
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      inList = true;
      listItems.push(
        <li key={`li-${lineIdx}`} className="text-xs leading-relaxed">
          {renderInline(trimmed.slice(2))}
        </li>
      );
      return;
    }

    // Numbered list
    const matchNumber = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (matchNumber) {
      flushList();
      elements.push(
        <div key={`num-${lineIdx}`} className="flex items-start gap-1.5 my-1 text-xs leading-relaxed">
          <span className="font-bold text-slate-900 min-w-[18px] shrink-0">{matchNumber[1]}.</span>
          <div className="flex-1 text-slate-800">{renderInline(matchNumber[2])}</div>
        </div>
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${lineIdx}`} className="h-1.5" />);
      return;
    }

    // Normal paragraph
    flushList();
    elements.push(
      <p key={`p-${lineIdx}`} className="text-xs leading-relaxed text-slate-800 my-0.5">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1 font-sans">{elements}</div>;
};
