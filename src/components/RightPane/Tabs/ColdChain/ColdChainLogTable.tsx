/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng nhật ký nhiệt độ tự động 24h qua Datalogger GSP (<=200 LOC)
 */

import React from 'react';
import { Clock, Thermometer, Droplets, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ColdChainLog } from '../../../../types/clinical';

interface ColdChainLogTableProps {
  logs: ColdChainLog[];
}

export const ColdChainLogTable: React.FC<ColdChainLogTableProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Table Sub-header */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-700" />
          <span className="font-bold text-slate-900 text-xs sm:text-sm">
            Nhật ký nhiệt độ Datalogger tự động 24 giờ qua (Đo đạc mỗi 15 phút)
          </span>
        </div>
        <div className="flex items-center gap-2 text-2xs sm:text-xs text-slate-500 font-mono">
          <span>Datalogger: <strong className="text-slate-800">VAX-LOG-04</strong></span>
          <span>·</span>
          <span>Cảm biến: <strong className="text-slate-800">Sensirion SHT35</strong></span>
        </div>
      </div>

      {/* Desktop Table View (hidden sm:block) */}
      <div className="overflow-x-auto thin-scrollbar flex-1 min-h-0 hidden sm:block">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/70 border-b border-slate-200 sticky top-0 z-10 text-2xs font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="py-2 px-3 text-center w-12 border-r border-slate-100">STT</th>
              <th className="py-2 px-3.5 border-r border-slate-100">Thời Điểm Ghi Nhận</th>
              <th className="py-2 px-3.5 border-r border-slate-100">Nhiệt Độ (°C)</th>
              <th className="py-2 px-3.5 border-r border-slate-100">Độ Ẩm (% RH)</th>
              <th className="py-2 px-3.5 border-r border-slate-100">Dải Cho Phép (GSP)</th>
              <th className="py-2 px-3.5">Trạng Thái Đánh Giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {logs.map((log, index) => {
              const isWarning = log.temperature > 8.0 || log.temperature < 2.0 || log.status === 'critical';

              return (
                <tr
                  key={index}
                  className={`hover:bg-slate-50 transition-colors ${
                    isWarning ? 'bg-rose-50/40' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-2xs border-r border-slate-100">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono font-medium text-slate-800 border-r border-slate-100">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3.5 border-r border-slate-100">
                    <span
                      className={`font-mono font-bold text-sm tabular-nums ${
                        isWarning ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {log.temperature.toFixed(1)}°C
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-600 border-r border-slate-100">
                    {log.humidity}% RH
                  </td>
                  <td className="py-2.5 px-3.5 text-2xs font-mono text-slate-500 border-r border-slate-100">
                    2.0°C – 8.0°C
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold border ${
                        isWarning
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isWarning ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Vượt ngưỡng an toàn</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Đạt chuẩn GSP</span>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (sm:hidden) */}
      <div className="sm:hidden p-2 space-y-2 overflow-y-auto flex-1 min-h-0">
        {logs.map((log, index) => {
          const isWarning = log.temperature > 8.0 || log.temperature < 2.0 || log.status === 'critical';

          return (
            <div
              key={index}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                isWarning
                  ? 'bg-rose-50/60 border-rose-300 text-rose-900'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs text-slate-400">#{index + 1}</span>
                <span className="font-mono font-medium text-slate-800">{log.timestamp}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xs text-slate-500">{log.humidity}% RH</span>
                <span
                  className={`font-mono font-bold text-sm tabular-nums ${
                    isWarning ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {log.temperature.toFixed(1)}°C
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWarning ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
