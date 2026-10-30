/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng đồng hồ đo nhiệt độ & thông số cảm biến thời gian thực (<=200 LOC)
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { ColdChainMonitorState } from '../../../../types/clinical';

interface ColdChainGaugeBannerProps {
  coldChainState: ColdChainMonitorState;
  isAlarm: boolean;
}

export const ColdChainGaugeBanner: React.FC<ColdChainGaugeBannerProps> = ({
  coldChainState,
  isAlarm,
}) => {
  return (
    <div
      className={`bg-white border-b px-4 py-3.5 transition shrink-0 ${
        isAlarm ? 'border-rose-300' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
        {/* Temperature Gauge Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-4xl sm:text-5xl font-semibold font-mono tabular-nums ${
                isAlarm ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {coldChainState.currentTemp.toFixed(1)}
            </span>
            <span className={`text-base font-bold ${isAlarm ? 'text-rose-600' : 'text-slate-500'}`}>
              °C
            </span>
          </div>

          {/* Visual Safe Zone Meter */}
          <div className="w-40 hidden sm:block">
            <div className="relative w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-emerald-400 border-x border-emerald-600"
                style={{ left: '13.3%', width: '40%' }}
                title="Dải an toàn GSP: 2.0°C - 8.0°C"
              />
              <div
                className={`absolute top-0 bottom-0 w-3 rounded-full -ml-1.5 transition-all duration-300 ${
                  isAlarm ? 'bg-rose-600' : 'bg-slate-800'
                }`}
                style={{ left: `${Math.min(100, Math.max(0, (coldChainState.currentTemp / 15) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono mt-1 font-semibold">
              <span>0°C</span>
              <span className="text-emerald-700 font-bold">2-8°C GSP</span>
              <span>15°C</span>
            </div>
          </div>
        </div>

        {/* Mobile Quick Metrics (sm:hidden) */}
        <div className="grid grid-cols-3 gap-2 w-full pt-2.5 border-t border-slate-100 sm:hidden text-center text-xs">
          <div className="px-2 py-1">
            <div className="text-xs text-slate-500 font-semibold">Nguồn</div>
            <div className="font-bold text-slate-900 truncate text-xs mt-0.5">
              {isAlarm ? 'UPS dự phòng' : 'Điện lưới'}
            </div>
          </div>
          <div className="px-2 py-1">
            <div className="text-xs text-slate-500 font-semibold">Độ ẩm</div>
            <div className="font-bold text-slate-900 font-mono text-xs mt-0.5">
              {coldChainState.currentHumidity}% RH
            </div>
          </div>
          <div className="px-2 py-1">
            <div className="text-xs text-slate-500 font-semibold">Cơ số vắc xin</div>
            <div className="font-bold text-slate-900 font-mono text-xs mt-0.5">
              {coldChainState.totalVaccineDoses.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Desktop Quick Metrics (hidden sm:flex) */}
        <div className="hidden sm:flex flex-wrap items-center gap-4 text-slate-700 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-1.5">
            <span>
              Nguồn:{' '}
              <strong className="text-slate-900 font-bold">
                {isAlarm ? 'Mất điện (UPS dự phòng)' : 'Điện lưới'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
            <span>
              Độ ẩm: <strong className="text-slate-900 font-mono font-bold">{coldChainState.currentHumidity}% RH</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
            <span>
              Vắc xin:{' '}
              <strong className="text-slate-900 font-mono font-bold">
                {coldChainState.totalVaccineDoses.toLocaleString()} liều
              </strong>
            </span>
          </div>
        </div>

        {/* SOP-GSP-09 badge */}
        <div className="text-sm text-slate-600 hidden xl:flex items-center gap-1.5 border-l border-slate-200 pl-4">
          <span>SOP-09: Chuyển hòm đá tích lạnh khi mất điện</span>
        </div>
      </div>
    </div>
  );
};
