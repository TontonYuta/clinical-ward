/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CDSS High-Alert Banner & 1-Click Substitution Engine
 */

import React from 'react';
import { AlertOctagon, Zap } from 'lucide-react';
import { CdssAlert } from '../../../types/chat';
import { formatInlineMarkdown } from '../ChatMarkdown';

interface CdssAlertBannerProps {
  alert: CdssAlert;
  onSubstitute?: (drug: string) => void;
}

export const CdssAlertBanner: React.FC<CdssAlertBannerProps> = ({ alert, onSubstitute }) => {
  const isCritical = alert.level === 'critical';
  const isWarning = alert.level === 'warning';

  return (
    <div
      data-testid="cdss-alert-banner"
      className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-3 shadow-xs transition-all ${
        isCritical
          ? 'bg-rose-50/95 border-rose-300 text-rose-950 ring-1 ring-rose-200'
          : isWarning
          ? 'bg-amber-50/95 border-amber-300 text-amber-950 ring-1 ring-amber-200'
          : 'bg-blue-50/95 border-blue-300 text-blue-950'
      }`}
    >
      <AlertOctagon
        className={`w-5 h-5 shrink-0 mt-0.5 animate-pulse ${
          isCritical ? 'text-rose-600' : 'text-amber-600'
        }`}
      />
      <div className="space-y-1.5 w-full">
        <div className="font-bold tracking-tight flex items-center justify-between gap-2">
          <span className="text-xs uppercase font-extrabold flex items-center gap-1.5">
            {isCritical ? '🛑' : '⚠️'} {alert.title}
          </span>
          <span
            className={`text-2xs px-2 py-0.5 rounded-md font-extrabold uppercase shrink-0 ${
              isCritical
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-amber-500 text-white shadow-2xs'
            }`}
          >
            {isCritical ? 'QĐ 5948 Chống Chỉ Định' : 'Cảnh Báo Lâm Sàng'}
          </span>
        </div>

        <div className="text-xs font-semibold leading-relaxed text-slate-800">
          {formatInlineMarkdown(alert.message)}
        </div>

        {alert.antidoteRecommendation && (
          <div className="text-xs bg-white p-2.5 rounded-lg border border-rose-200/80 font-medium text-slate-800 shadow-2xs mt-1">
            <span className="font-bold text-rose-800">Khuyến cáo xử trí: </span>
            {formatInlineMarkdown(alert.antidoteRecommendation)}
          </div>
        )}

        {/* Actionable 1-Click Substitution Button */}
        {alert.substituteDrug && (
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="cdss-substitute-btn"
              onClick={() => onSubstitute?.(alert.substituteDrug!)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-2xs hover:shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ Đổi sang {alert.substituteDrug} (1-Click)</span>
            </button>
            <span className="text-3xs text-slate-500 font-medium italic">
              (Bấm để tự động điều chỉnh đơn và tái thẩm định)
            </span>
          </div>
        )}

        {alert.regulatoryReference && (
          <div className="text-3xs text-slate-500 font-mono pt-0.5">
            Căn cứ pháp lý: {alert.regulatoryReference}
          </div>
        )}
      </div>
    </div>
  );
};
