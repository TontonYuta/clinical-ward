/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatInlineMarkdown } from '../ChatMarkdown';

interface FefoReportCardProps {
  batches: Array<{
    name: string;
    batch: string;
    expiry: string;
    days_left: number;
  }>;
}

export const FefoReportCard: React.FC<FefoReportCardProps> = ({ batches }) => {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Danh sách lô cận hạn &lt; 60 ngày:
      </p>
      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
        {batches.slice(0, 5).map((b, idx) => (
          <div
            key={idx}
            className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
          >
            <div className="truncate max-w-[200px]">
              <div className="font-bold text-slate-900 truncate">
                {formatInlineMarkdown(b.name)}
              </div>
              <div className="text-slate-500 font-mono text-xs">
                Lô: {b.batch} • Hạn: {b.expiry}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-xs">
                Còn {b.days_left} ngày
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface LowStockReportCardProps {
  items: Array<{
    name: string;
    needed: number;
    unit: string;
  }>;
}

export const LowStockReportCard: React.FC<LowStockReportCardProps> = ({ items }) => {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Mặt hàng chạm ngưỡng Min cần bù:
      </p>
      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
        {items.slice(0, 4).map((it, idx) => (
          <div
            key={idx}
            className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
          >
            <span className="font-semibold text-slate-800 truncate max-w-[190px]">
              {formatInlineMarkdown(it.name)}
            </span>
            <span className="font-mono text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-xs">
              +{it.needed} {it.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
