/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock } from 'lucide-react';

interface ShiftHandoverCardProps {
  data: {
    total_debts: number;
    pending_ampoules_count: number;
    pending_list?: Array<{ patient: string; room: string; quantity: string }>;
    replenishment?: Array<{ name: string; needed: number }>;
  };
}

export const ShiftHandoverCard: React.FC<ShiftHandoverCardProps> = ({ data }) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
          <span className="text-slate-500 block">Số lượt mượn đêm qua:</span>
          <span className="text-sm font-bold text-slate-900 font-mono">
            {data.total_debts} lượt
          </span>
        </div>
        <div
          className={`p-2.5 rounded-lg border ${
            data.pending_ampoules_count > 0
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span className="block text-xs opacity-80">Nợ vỏ Morphin chưa nộp:</span>
          <span className="text-sm font-bold font-mono">
            {data.pending_ampoules_count} vỏ
          </span>
        </div>
      </div>

      {data.pending_list && data.pending_list.length > 0 && (
        <div className="p-2.5 rounded-lg bg-rose-50/90 border border-rose-200 text-xs space-y-1.5">
          <span className="font-bold text-rose-800 block flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            Vi phạm thu hồi vỏ ống (Điều 15 TT 20/2017):
          </span>
          {data.pending_list.slice(0, 3).map((it, idx) => (
            <div key={idx} className="flex justify-between text-rose-700 text-xs">
              <span className="truncate max-w-[190px]">
                • {it.patient} ({it.room})
              </span>
              <span className="font-bold font-mono">{it.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {data.replenishment && data.replenishment.length > 0 && (
        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5">
          <span className="font-bold text-slate-700 block">Cần Kho Dược cấp bù sáng nay:</span>
          <div className="flex flex-wrap gap-1.5">
            {data.replenishment.map((r, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs"
              >
                {r.name}: <b>{r.needed}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
