/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ chỉ số cảm biến IoT & Đo lường chuỗi lạnh GSP (<=200 LOC)
 */

import React from 'react';
import { Thermometer, Droplets, Zap, ShieldAlert, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { ColdChainMonitorState } from '../../../../types/clinical';

interface ColdChainTelemetryCardsProps {
  coldChainState: ColdChainMonitorState;
  isAlarm: boolean;
  isQuarantined: boolean;
}

export const ColdChainTelemetryCards: React.FC<ColdChainTelemetryCardsProps> = ({
  coldChainState,
  isAlarm,
  isQuarantined,
}) => {
  const currentTemp = coldChainState.currentTemp;
  const isOutOfRange = currentTemp < 2.0 || currentTemp > 8.0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
      {/* 1. Real-time Temperature Card */}
      <div
        className={`p-3 sm:p-3.5 rounded-lg border transition bg-white shadow-2xs ${
          isAlarm
            ? 'border-rose-300 ring-1 ring-rose-200'
            : isQuarantined
            ? 'border-amber-300'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Thermometer className={`w-3.5 h-3.5 ${isAlarm ? 'text-rose-600' : 'text-teal-600'}`} />
            Nhiệt độ tức thời
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-2xs font-bold border shrink-0 ${
              isAlarm
                ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
                : isQuarantined
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}
          >
            {isAlarm ? 'Quá nhiệt' : isQuarantined ? 'Đang biệt trữ' : 'Chuẩn GSP'}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-2xl sm:text-3xl font-bold font-sans tabular-nums leading-none ${
              isAlarm ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {currentTemp.toFixed(1)}
          </span>
          <span className={`text-xs font-bold ${isAlarm ? 'text-rose-600' : 'text-slate-500'}`}>°C</span>
          <span className="text-xs text-slate-500 font-sans ml-auto">Ngưỡng: 2°C – 8°C</span>
        </div>

        {/* Visual Mini Safe-Zone Gauge */}
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-emerald-400 border-x border-emerald-600"
              style={{ left: '13.3%', width: '40%' }}
              title="Dải an toàn GSP: 2.0°C - 8.0°C"
            />
            <div
              className={`absolute top-0 bottom-0 w-2.5 rounded-full -ml-1 transition-all duration-300 ${
                isAlarm ? 'bg-rose-600' : 'bg-slate-800'
              }`}
              style={{ left: `${Math.min(100, Math.max(0, (currentTemp / 15) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-sans tabular-nums mt-1">
            <span>0°C</span>
            <span className="text-emerald-700 font-semibold">2°C – 8°C GSP</span>
            <span>15°C</span>
          </div>
        </div>
      </div>

      {/* 2. Humidity & Datalogger Sensor */}
      <div className="p-3 sm:p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-blue-600" />
            Độ ẩm & Cảm biến
          </span>
          <span className="text-xs font-sans tabular-nums font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            VAX-LOG-04
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-bold font-sans tabular-nums leading-none text-slate-900">
            {coldChainState.currentHumidity}
          </span>
          <span className="text-xs font-bold text-slate-500">% RH</span>
          <span className="text-xs text-emerald-700 font-medium ml-auto">Chuẩn: 35–70%</span>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
          <span>Tần suất: 15 phút/lần</span>
          <span className="text-slate-700 font-medium">Sensirion SHT35</span>
        </div>
      </div>

      {/* 3. Power Grid & Compressor Status */}
      <div className="p-3 sm:p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Zap className={`w-3.5 h-3.5 ${isAlarm ? 'text-rose-600' : 'text-amber-500'}`} />
            Nguồn điện & Tủ
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-2xs font-bold border shrink-0 ${
              isAlarm
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}
          >
            {isAlarm ? 'Mất điện' : 'Điện lưới 220V'}
          </span>
        </div>

        <div className="text-sm font-bold text-slate-900 truncate">
          {isAlarm ? 'UPS dự phòng APC 3kVA' : 'Lưới điện Bệnh viện (Ổn định)'}
        </div>

        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
          <span>Máy nén Inverter:</span>
          <span className={`font-semibold ${isAlarm ? 'text-rose-700' : 'text-emerald-700'}`}>
            {isAlarm ? 'Dừng sự cố (fault)' : 'Đang chạy (running)'}
          </span>
        </div>
      </div>

      {/* 4. Biological Inventory & MKT Metric */}
      <div className="p-3 sm:p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Cơ số & Kháng nguyên
          </span>
          <span className="text-2xs font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
            MKT: 5.6°C
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-bold font-sans tabular-nums leading-none text-slate-900">
            {coldChainState.totalVaccineDoses.toLocaleString()}
          </span>
          <span className="text-xs font-bold text-slate-500">liều sinh phẩm</span>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
          <span>Chỉ thị VVM:</span>
          <span className="font-semibold text-emerald-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block border border-emerald-600" />
            Cấp độ 1 (An toàn)
          </span>
        </div>
      </div>
    </div>
  );
};
