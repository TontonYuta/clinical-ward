/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh tác vụ điều hành & sự cố chuỗi lạnh GSP (<=200 LOC)
 */

import React from 'react';
import { Check, ZapOff, FileCheck2 } from 'lucide-react';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface ColdChainHeaderProps {
  isAlarm: boolean;
  isQuarantined: boolean;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  onRestore: () => void;
  onReleaseQuarantine?: () => void;
  onSimulateOutage: () => void;
}

export const ColdChainHeader: React.FC<ColdChainHeaderProps> = ({
  isAlarm,
  isQuarantined,
  onRestore,
  onReleaseQuarantine,
  onSimulateOutage,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-lg border border-slate-200 shrink-0 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm border ${
            isAlarm
              ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
              : isQuarantined
              ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isAlarm ? 'bg-rose-600' : isQuarantined ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
          />
          {isAlarm
            ? 'Mất điện lưới (11.0°C)'
            : isQuarantined
            ? 'Đang biệt trữ cách ly'
            : 'Chuỗi lạnh GSP: 2.0°C – 8.0°C (ổn định)'}
        </span>
        <span className="text-xs sm:text-sm text-slate-500 hidden sm:inline font-medium">
          Tủ Dometic HC-302 · Cảm biến VAX-LOG-04
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        {isAlarm ? (
          <button
            onClick={onRestore}
            className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition cursor-pointer active:scale-98 shadow-xs"
            title="Khôi phục nguồn điện máy phát dự phòng, đưa nhiệt độ về dải an toàn 4.5°C"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Khôi phục điện (4.5°C)</span>
          </button>
        ) : isQuarantined ? (
          onReleaseQuarantine && (
            <button
              onClick={onReleaseQuarantine}
              className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs sm:text-sm transition cursor-pointer active:scale-98 shadow-xs"
              title="Hội đồng Dược: Ký lệnh giải phóng lô vắc xin sau sự cố nhiệt độ"
            >
              <FileCheck2 className="w-4 h-4 text-white" />
              <span>Giải phóng lô biệt trữ</span>
            </button>
          )
        ) : (
          <button
            onClick={onSimulateOutage}
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-98"
            title="Mô phỏng sự cố mất lưới điện 220V khiến nhiệt độ tăng vọt lên 11°C"
          >
            <ZapOff className="w-3.5 h-3.5 text-rose-600" />
            <span>Mô phỏng mất điện</span>
          </button>
        )}
      </div>
    </div>
  );
};
