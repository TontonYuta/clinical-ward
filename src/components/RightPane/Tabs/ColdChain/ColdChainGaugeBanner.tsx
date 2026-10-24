/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng đồng hồ đo nhiệt độ & thông số cảm biến thời gian thực (<=200 LOC)
 */

import React from 'react';
import { Thermometer, Zap, ShieldAlert } from 'lucide-react';
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
      className={`bg-white rounded-lg border px-4 py-3 shadow-2xs transition shrink-0 ${
        isAlarm ? 'border-rose-300 bg-rose-50/20 ring-1 ring-rose-200' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
        {/* Temperature Gauge Indicator */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-baseline gap-1.5">
            <Thermometer className={`w-5 h-5 ${isAlarm ? 'text-rose-600' : 'text-slate-600'}`} />
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                isAlarm ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {coldChainState.currentTemp.toFixed(1)}
            </span>
            <span className={`text-sm font-bold ${isAlarm ? 'text-rose-600' : 'text-slate-500'}`}>
              °C
            </span>
          </div>

          {/* Visual Safe Zone Meter */}
          <div className="w-36 hidden sm:block">
            <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-emerald-400 border-x border-emerald-600"
                style={{ left: '13.3%', width: '40%' }}
                title="Dải an toàn GSP: 2.0°C - 8.0°C"
              />
              <div
                className={`absolute top-0 bottom-0 w-2.5 rounded-full -ml-1 transition-all duration-300 ${
                  isAlarm ? 'bg-rose-600' : 'bg-slate-800'
                }`}
                style={{ left: `${Math.min(100, Math.max(0, (coldChainState.currentTemp / 15) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
              <span>0°C</span>
              <span className="text-emerald-700 font-semibold">2-8°C GSP</span>
              <span>15°C</span>
            </div>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="flex flex-wrap items-center gap-4 text-slate-600 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <Zap className={`w-4 h-4 ${isAlarm ? 'text-rose-600' : 'text-emerald-600'}`} />
            <span>
              Nguồn:{' '}
              <strong className="text-slate-900">
                {isAlarm ? 'MẤT ĐIỆN (UPS ON)' : 'Điện lưới 220V'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3.5">
            <span>
              Độ ẩm: <strong className="text-slate-900 font-mono">{coldChainState.currentHumidity}% RH</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3.5">
            <span>
              Cơ số vắc xin:{' '}
              <strong className="text-slate-900 font-mono">
                {coldChainState.totalVaccineDoses.toLocaleString()} liều
              </strong>
            </span>
          </div>
        </div>

        {/* SOP-GSP-09 badge */}
        <div className="text-xs text-slate-500 font-medium hidden xl:flex items-center gap-1.5 border-l border-slate-200 pl-3.5">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <span>SOP-09: Quá 15p mất điện ➔ Chuyển hòm đá tích lạnh</span>
        </div>
      </div>
    </div>
  );
};
