/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Lưới nhật ký nhiệt độ tự động 24h qua Datalogger GSP (<=200 LOC)
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { ColdChainMonitorState } from '../../../../types/clinical';

interface ColdChainLogGridProps {
  logs: ColdChainMonitorState['logs'];
}

export const ColdChainLogGrid: React.FC<ColdChainLogGridProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Nhật ký nhiệt độ tự động 24 giờ qua (Đo đạc mỗi 15 phút)
        </span>
        <span className="text-xs text-slate-500 font-mono">Datalogger ID: VAX-LOG-04</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs sm:text-sm">
        {logs.map((log, index) => {
          const isWarn = log.temperature > 8.0;
          return (
            <div
              key={index}
              className={`py-2 px-1.5 rounded-md border transition ${
                isWarn
                  ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-[11px] text-slate-500 block mb-0.5">{log.timestamp}</span>
              <span className="font-mono font-bold text-xs sm:text-sm block">
                {log.temperature.toFixed(1)}°C
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
