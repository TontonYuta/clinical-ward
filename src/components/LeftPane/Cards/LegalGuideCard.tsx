/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Scale, BookOpen } from 'lucide-react';
import { formatInlineMarkdown } from '../ChatMarkdown';

interface LegalGuideCardProps {
  data: {
    doc_title?: string;
    content: string;
  };
  onOpenLegalDocs?: () => void;
}

export const LegalGuideCard: React.FC<LegalGuideCardProps> = ({ data, onOpenLegalDocs }) => {
  return (
    <div className="p-3 sm:p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 space-y-2 shadow-2xs">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
          <Scale className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
            {data.doc_title || 'Căn Cứ Pháp Lý'}
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            Quy chuẩn y tế &amp; Căn cứ pháp luật hiện hành
          </span>
        </div>
      </div>
      <div className="text-slate-700 leading-relaxed text-xs sm:text-sm whitespace-pre-wrap">
        {formatInlineMarkdown(data.content)}
      </div>
      {onOpenLegalDocs && (
        <button
          type="button"
          onClick={onOpenLegalDocs}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-2xs active:scale-98"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Mở Căn Cứ Pháp Lý &amp; Toàn Văn Văn Bản</span>
        </button>
      )}
    </div>
  );
};
