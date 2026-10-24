/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { CdssAlert } from '../../../types/clinical';
import { formatInlineMarkdown } from '../ChatMarkdown';

interface CdssAlertBannerProps {
  alert: CdssAlert;
}

export const CdssAlertBanner: React.FC<CdssAlertBannerProps> = ({ alert }) => {
  const isCritical = alert.level === 'critical';
  const isWarning = alert.level === 'warning';

  return (
    <div
      className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 shadow-2xs ${
        isCritical
          ? 'bg-rose-50 border-rose-300 text-rose-900'
          : isWarning
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-blue-50 border-blue-300 text-blue-900'
      }`}
    >
      <AlertOctagon
        className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${
          isCritical ? 'text-rose-600' : 'text-amber-600'
        }`}
      />
      <div className="space-y-1.5 w-full">
        <div className="font-bold uppercase tracking-tight flex items-center justify-between">
          <span>{alert.title}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${
              isCritical
                ? 'bg-rose-200 text-rose-800'
                : 'bg-amber-200 text-amber-800'
            }`}
          >
            CDSS Alert
          </span>
        </div>
        <div className="text-xs font-medium leading-relaxed">
          {formatInlineMarkdown(alert.message)}
        </div>
        {alert.antidoteRecommendation && (
          <div className="text-xs bg-white/90 p-2 rounded-md border border-rose-200 font-semibold text-rose-800 mt-1">
            <b>Khuyến cáo an toàn:</b> {formatInlineMarkdown(alert.antidoteRecommendation)}
          </div>
        )}
        {alert.regulatoryReference && (
          <div className="text-xs opacity-75 font-mono">
            Căn cứ: {alert.regulatoryReference}
          </div>
        )}
      </div>
    </div>
  );
};
