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
    <section className="bg-white py-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-4.5 h-4.5 text-slate-600" />
          Nhật ký nhiệt độ tự động 24 giờ qua (Đo đạc mỗi 15 phút)
        </span>
        <span className="text-sm text-slate-600 font-mono">
          Datalogger ID: VAX-LOG-04
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-2 text-center">
        {logs.map((log, index) => {
          const isWarn = log.temperature > 8.0;
          return (
            <div
              key={index}
              className={`py-2.5 px-2 border-b transition ${
                isWarn
                  ? 'border-rose-400 text-rose-800 font-bold'
                  : 'border-slate-100 text-slate-700'
              }`}
            >
              <span className="text-sm font-medium text-slate-500 block mb-1">{log.timestamp}</span>
              <span className="font-mono font-semibold text-base block">
                {log.temperature.toFixed(1)}°C
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
