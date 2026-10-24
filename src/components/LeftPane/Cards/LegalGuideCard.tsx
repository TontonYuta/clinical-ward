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
    <div className="p-3.5 sm:p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 text-xs sm:text-sm text-slate-700 space-y-2 shadow-2xs">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-200/70 text-purple-900 flex items-center justify-center shrink-0">
          <Scale className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-purple-950 text-xs sm:text-sm truncate">
            {data.doc_title || 'Căn Cứ Pháp Lý'}
          </div>
          <span className="text-xs text-purple-700 font-medium block">
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
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs transition cursor-pointer shadow-2xs active:scale-98"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Mở Căn Cứ Pháp Lý &amp; Toàn Văn Văn Bản</span>
        </button>
      )}
    </div>
  );
};
