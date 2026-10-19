/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Thermometer,
  Zap,
  ZapOff,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Package,
  FileCheck2,
  Shield,
  FlaskConical,
  CheckCheck,
  Printer
} from 'lucide-react';
import { ColdChainMonitorState } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { PrintableFormType } from '../../Modals/PrintableFormModal';

interface ColdChainTabProps {
  coldChainState: ColdChainMonitorState;
  onTriggerOutage: () => void;
  onRestorePower: () => void;
  onReleaseQuarantine?: () => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const ColdChainTab: React.FC<ColdChainTabProps> = ({
  coldChainState,
  onTriggerOutage,
  onRestorePower,
  onReleaseQuarantine,
  onOpenPrintForm,
  isAudioMuted
}) => {
  const isAlarm = coldChainState.alarmActive || coldChainState.currentTemp > 8.0;
  const isQuarantined = coldChainState.quarantineStatus === 'quarantined';

  const handleSimulateOutage = () => {
    onTriggerOutage();
  };

  const handleRestore = () => {
    if (!isAudioMuted) {
      clinicalAudio.stopAlarm();
      clinicalAudio.playSuccessChime();
    }
    onRestorePower();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2 w-full">
      {/* 1. Slim Integrated Executive Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">
            Giám Sát Chuỗi Lạnh Vắc Xin
          </h2>
          <span className="text-[11px] font-mono text-slate-400 border-l border-slate-200 pl-2 hidden md:inline">
            Chuẩn 2.0°C - 8.0°C (GSP - TT 36/2018)
          </span>
          {/* Subtle inline summary */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-2.5">
            <span className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded text-[10px] sm:text-[11px] border ${
              isAlarm
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : isQuarantined
                ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isAlarm ? 'bg-rose-500 animate-pulse' : isQuarantined ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}></span>
              {isAlarm
                ? 'MẤT ĐIỆN (11.0°C)'
                : isQuarantined
                ? 'BIỆT TRỮ (QUARANTINE)'
                : 'Chuỗi lạnh GSP ổn định'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => onOpenPrintForm?.('COLD_CHAIN_INCIDENT_REPORT')}
            className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-[11px] sm:text-xs transition shadow-2xs cursor-pointer active:scale-98"
            title="In Biên bản xử lý sự cố quá nhiệt chuỗi lạnh & thẩm định vắc xin GSP (Thông tư 36/2018/TT-BYT)"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-700" />
            <span className="hidden sm:inline">In Biên Bản GSP (A4)</span>
            <span className="sm:hidden">In GSP</span>
          </button>

          {isAlarm ? (
            <button
              onClick={handleRestore}
              className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] sm:text-xs transition shadow-2xs cursor-pointer active:scale-98"
              title="Khôi phục nguồn điện máy phát dự phòng, đưa nhiệt độ về dải an toàn 4.5°C"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Khôi phục điện (4.5°C)</span>
              <span className="sm:hidden">Phục hồi điện</span>
            </button>
          ) : isQuarantined ? (
            onReleaseQuarantine && (
              <button
                onClick={onReleaseQuarantine}
                className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] sm:text-xs transition shadow-2xs cursor-pointer active:scale-98"
                title="Hội đồng Dược & ĐT: Ký lệnh giải phóng lô vắc xin sau sự cố nhiệt độ theo GSP"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-slate-950" />
                <span className="hidden sm:inline">Giải phóng lô biệt trữ</span>
                <span className="sm:hidden">Giải phóng</span>
              </button>
            )
          ) : (
            <button
              onClick={handleSimulateOutage}
              className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 rounded-md bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 hover:border-rose-300 font-semibold text-[11px] sm:text-xs transition shadow-2xs cursor-pointer active:scale-98"
              title="Mô phỏng sự cố mất lưới điện 220V khiến nhiệt độ tăng vọt lên 11°C"
            >
              <ZapOff className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Mô phỏng mất điện (11°C)</span>
              <span className="sm:hidden">Mất điện</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sleek Compact Instrument Banner */}
      <div
        className={`bg-white rounded-lg border px-3 py-2 shadow-2xs transition shrink-0 ${
          isAlarm ? 'border-rose-300 bg-rose-50/20 ring-1 ring-rose-200' : 'border-slate-200/90'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Temperature Gauge Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <Thermometer className={`w-4 h-4 ${isAlarm ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
              <span
                className={`text-2xl font-black font-mono tabular-nums ${
                  isAlarm ? 'text-rose-600 animate-pulse' : 'text-slate-900'
                }`}
              >
                {coldChainState.currentTemp.toFixed(1)}
              </span>
              <span className={`text-xs font-semibold ${isAlarm ? 'text-rose-600' : 'text-slate-400'}`}>
                °C
              </span>
            </div>

            {/* Visual Safe Zone Meter */}
            <div className="w-36 hidden sm:block">
              <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-emerald-400 border-x border-emerald-600"
                  style={{ left: '13.3%', width: '40%' }}
                  title="Dải an toàn GSP: 2.0°C - 8.0°C"
                />
                <div
                  className={`absolute top-0 bottom-0 w-2 rounded-full -ml-1 transition-all duration-300 ${
                    isAlarm ? 'bg-rose-600' : 'bg-slate-800'
                  }`}
                  style={{ left: `${Math.min(100, Math.max(0, (coldChainState.currentTemp / 15) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
                <span>0°C</span>
                <span className="text-emerald-700 font-medium">2-8°C GSP</span>
                <span>15°C</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4 text-slate-600 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className={`w-3.5 h-3.5 ${isAlarm ? 'text-rose-600' : 'text-emerald-600'}`} />
              <span>Nguồn: <strong className="text-slate-900">{isAlarm ? 'MẤT ĐIỆN (UPS ON)' : 'Điện lưới 220V'}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span>Độ ẩm: <strong className="text-slate-900">{coldChainState.currentHumidity}% RH</strong></span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span>Cơ số vắc xin: <strong className="text-slate-900">{coldChainState.totalVaccineDoses.toLocaleString()} liều</strong></span>
            </div>
          </div>

          {/* SOP-GSP-09 badge */}
          <div className="text-[11px] text-slate-500 hidden xl:flex items-center gap-1 border-l border-slate-200 pl-3">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <span>SOP-09: Quá 15p mất điện ➔ Chuyển hòm đá tích lạnh</span>
          </div>
        </div>
      </div>


      {/* 2. Isolated Scrollable Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
        {/* Quarantine Assessment Banner (GSP TT 36/2018 & WHO PQS) */}
        {isQuarantined && (
          <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3.5 shadow-2xs text-xs ring-1 ring-amber-200">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold text-amber-950 uppercase text-xs tracking-wide">
                  Khu Vực Biệt Trữ Cách Ly Lô Vắc Xin (Quarantine - Chuẩn GSP &amp; WHO)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                Trạng thái: Đang Biệt Trữ (Chờ Phóng Thích)
              </span>
            </div>

            <p className="text-slate-700 text-xs mb-3 leading-relaxed">
              Do sự cố ngắt điện lưới khiến nhiệt độ buồng tăng vọt lên <strong>11.0°C</strong> (vượt ngưỡng 2.0°C - 8.0°C), toàn bộ <strong>{coldChainState.totalVaccineDoses.toLocaleString()} liều sinh phẩm &amp; vắc xin</strong> đã được tự động niêm phong biệt trữ theo Điều 12 Thông tư 36/2018/TT-BYT nhằm thẩm định tính toàn vẹn hoạt tính sinh học trước khi đưa trở lại tiêm chủng.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              <div className="bg-white p-2.5 rounded-md border border-amber-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">1. Chỉ thị nhiệt VVM</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block border border-emerald-600"></span>
                  <span className="font-bold text-slate-900 text-xs">Cấp độ 1 (Đạt chuẩn)</span>
                </div>
                <span className="text-[10px] text-emerald-700 block mt-0.5">Hình vuông trong sáng màu hơn vòng ngoài (An toàn)</span>
              </div>

              <div className="bg-white p-2.5 rounded-md border border-amber-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">2. Nhiệt độ MKT (Mean Kinetic Temp)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
                  <span className="font-bold text-slate-900 font-mono text-xs">5.6°C (Đạt chuẩn)</span>
                </div>
                <span className="text-[10px] text-teal-700 block mt-0.5">Nằm trong giới hạn bảo toàn kháng nguyên &lt; 8.0°C</span>
              </div>

              <div className="bg-white p-2.5 rounded-md border border-amber-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">3. Thời gian phơi nhiễm sự cố</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                  <span className="font-bold text-slate-900 font-mono text-xs">12 phút</span>
                </div>
                <span className="text-[10px] text-slate-600 block mt-0.5">Nằm trong ngưỡng cho phép (&lt; 30 phút theo WHO PQS)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200">
              <span className="text-[11px] text-slate-600 italic">
                * Thẩm quyền ký duyệt: Dược sĩ phụ trách QA hoặc Ban Giám Đốc bệnh viện (yêu cầu chữ ký kép theo GSP).
              </span>
              {onReleaseQuarantine && (
                <button
                  onClick={onReleaseQuarantine}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-2xs cursor-pointer active:scale-98"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ký Lệnh Giải Phóng Lô Vắc Xin</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 24h Temperature Log Grid */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Nhật ký nhiệt độ tự động 24 giờ qua (Đo đạc mỗi 15 phút)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Datalogger ID: VAX-LOG-04</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            {coldChainState.logs.map((log, index) => {
              const isWarn = log.temperature > 8.0;
              return (
                <div
                  key={index}
                  className={`py-2 px-1 rounded border transition ${
                    isWarn
                      ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold ring-1 ring-rose-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block mb-0.5">{log.timestamp}</span>
                  <span className="font-mono font-bold text-xs block">{log.temperature.toFixed(1)}°C</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vaccine Inventory Breakdown Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-teal-600" />
              Danh mục sinh phẩm &amp; vắc xin đang bảo quản trong buồng lạnh (Tổng: 1.250 liều)
            </span>
            <span className="text-[11px] text-teal-700 font-medium">Kho Lạnh Dược Lâm Sàng GSP</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Vắc xin Dại tinh chế (Verorab)</span>
                {isQuarantined && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Biệt trữ
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Số lượng: <strong className="text-slate-800">450 liều</strong> · Lô: VR-2409</div>
              <div className={`text-[10px] font-medium mt-1 ${isQuarantined ? 'text-amber-700 font-bold' : 'text-emerald-700'}`}>
                {isQuarantined ? 'Đang biệt trữ chờ thẩm định VVM' : 'Dải bảo quản: 2°C - 8°C (Không để đông băng)'}
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Kháng độc tố Uốn ván (SAT 1500 UI)</span>
                {isQuarantined && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Biệt trữ
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Số lượng: <strong className="text-slate-800">500 ống</strong> · Lô: ST-9921</div>
              <div className={`text-[10px] font-medium mt-1 ${isQuarantined ? 'text-amber-700 font-bold' : 'text-emerald-700'}`}>
                {isQuarantined ? 'Đang biệt trữ chờ thẩm định VVM' : 'Dải bảo quản: 2°C - 8°C (Tránh ánh sáng)'}
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Vắc xin Viêm gan B tái tổ hợp</span>
                {isQuarantined && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Biệt trữ
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Số lượng: <strong className="text-slate-800">300 liều</strong> · Lô: HB-8812</div>
              <div className={`text-[10px] font-medium mt-1 ${isQuarantined ? 'text-amber-700 font-bold' : 'text-emerald-700'}`}>
                {isQuarantined ? 'Đang biệt trữ chờ thẩm định VVM' : 'Dải bảo quản: 2°C - 8°C (Nhạy cảm nhiệt đông)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

