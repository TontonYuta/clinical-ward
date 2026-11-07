/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * DualZoneMessageBubble: Hiển thị 2 phân vùng tri thức y khoa lâm sàng trực quan (<= 150 LOC)
 * Zone 1: 🏛️ Căn Cứ Dược Thư & CSDL Quốc Gia (100% Đối Chứng)
 * Zone 2: 💡 Suy Luận Lâm Sàng Tham Khảo (AI Reference - FDA CDSS)
 */

import React, { useMemo } from 'react';
import { ShieldCheck, Lightbulb, BookOpen } from 'lucide-react';
import { renderClinicalMarkdown } from '../LeftPane/ChatMarkdown';
import { RagCitationItem } from '../../types/chat';

export interface DualZoneMessageBubbleProps {
  content: string;
  isDark?: boolean;
  citations?: RagCitationItem[];
  onCitationClick?: (citation: {
    title: string;
    url?: string;
    page?: number | null;
    excerpt?: string;
    legal_basis?: string;
    section?: string;
  }) => void;
}

export const DualZoneMessageBubble: React.FC<DualZoneMessageBubbleProps> = ({
  content,
  isDark = false,
  citations = [],
  onCitationClick,
}) => {
  const { zone1, zone2 } = useMemo(() => {
    const divider = '### 💡 VÙNG 2: SUY LUẬN LÂM SÀNG THAM KHẢO';
    if (!content.includes(divider)) {
      return { zone1: content, zone2: null };
    }
    const [part1, part2] = content.split(divider);
    // Xóa header Vùng 1 nếu có để thay bằng thẻ component chuẩn đẹp
    const cleanPart1 = part1.replace('### 🏛️ VÙNG 1: CĂN CỨ DƯỢC THƯ & CSDL QUỐC GIA (100% ĐỐI CHỨNG)', '').trim();
    return {
      zone1: cleanPart1,
      zone2: part2?.trim() || null,
    };
  }, [content]);

  if (!zone2) {
    return (
      <div className="dual-zone-single text-sm leading-relaxed">
        {renderClinicalMarkdown(zone1, { isDark, citations, onCitationClick })}
      </div>
    );
  }

  return (
    <div className="dual-zone-container space-y-4 text-sm leading-relaxed">
      {/* VÙNG 1: 100% CSDL XÁC THỰC */}
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          isDark
            ? 'bg-slate-900/60 border-blue-500/30 text-slate-200'
            : 'bg-blue-50/50 border-blue-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-200/50 dark:border-blue-800/40">
          <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
            <BookOpen className="w-4 h-4" />
            <span>CĂN CỨ DƯỢC THƯ & CSDL QUỐC GIA</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            100% Đối chứng
          </span>
        </div>
        <div className="zone-1-body">
          {renderClinicalMarkdown(zone1, { isDark, citations, onCitationClick })}
        </div>
      </div>

      {/* VÙNG 2: AI SUY LUẬN LÂM SÀNG THAM KHẢO */}
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          isDark
            ? 'bg-slate-900/60 border-amber-500/30 text-slate-200'
            : 'bg-amber-50/50 border-amber-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/50 dark:border-amber-800/40">
          <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
            <Lightbulb className="w-4 h-4" />
            <span>SUY LUẬN LÂM SÀNG THAM KHẢO</span>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
            AI Reference
          </span>
        </div>
        <div className="zone-2-body">
          {renderClinicalMarkdown(zone2, { isDark, citations, onCitationClick })}
        </div>
      </div>
    </div>
  );
};
