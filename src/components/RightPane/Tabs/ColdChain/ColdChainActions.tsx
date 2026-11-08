/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Nhóm nút tác vụ điều hành chuỗi lạnh GSP (<=200 LOC)
 */

import React from 'react';
import { Check, ZapOff, FileCheck2, Printer } from 'lucide-react';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface ColdChainActionsProps {
  isAlarm: boolean;
  isQuarantined: boolean;
  onRestore: () => void;
  onReleaseQuarantine?: () => void;
  onSimulateOutage: () => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  size?: 'sm' | 'md';
}

export const ColdChainActions: React.FC<ColdChainActionsProps> = ({
  isAlarm,
  isQuarantined,
  onRestore,
  onReleaseQuarantine,
  onSimulateOutage,
  onOpenPrintForm,
  size = 'md',
}) => {
  const isSm = size === 'sm';

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {isAlarm ? (
        <button
          onClick={onRestore}
          className={`inline-flex items-center gap-1 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-bold transition active:scale-98 shadow-xs cursor-pointer ${
            isSm ? 'h-7 px-2 text-2xs' : 'h-8.5 px-3 text-xs sm:text-sm'
          }`}
          title="Khôi phục nguồn điện máy phát"
        >
          <Check className={`text-emerald-400 ${isSm ? 'w-3 h-3' : 'w-4 h-4'}`} />
          <span>Khôi phục điện</span>
        </button>
      ) : isQuarantined ? (
        onReleaseQuarantine && (
          <button
            onClick={onReleaseQuarantine}
            className={`inline-flex items-center gap-1 rounded-md bg-amber-700 hover:bg-amber-800 text-white font-bold transition active:scale-98 shadow-xs cursor-pointer ${
              isSm ? 'h-7 px-2 text-2xs' : 'h-8.5 px-3 text-xs sm:text-sm'
            }`}
            title="Ký lệnh giải phóng lô vắc xin sau sự cố nhiệt độ"
          >
            <FileCheck2 className={`text-white ${isSm ? 'w-3 h-3' : 'w-4 h-4'}`} />
            <span>Giải phóng biệt trữ</span>
          </button>
        )
      ) : (
        <button
          onClick={onSimulateOutage}
          className={`inline-flex items-center gap-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold transition active:scale-98 cursor-pointer ${
            isSm ? 'h-7 px-2 text-2xs' : 'h-8.5 px-3 text-xs sm:text-sm'
          }`}
          title="Mô phỏng sự cố mất lưới điện 220V khiến nhiệt độ tăng vọt lên 11°C"
        >
          <ZapOff className={`text-rose-600 ${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          <span>Mô phỏng mất điện</span>
        </button>
      )}

      <button
        onClick={() => onOpenPrintForm?.('COLD_CHAIN_INCIDENT_REPORT')}
        className={`inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition active:scale-98 cursor-pointer ${
          isSm ? 'h-7 w-7 justify-center p-0' : 'h-8.5 px-3 text-xs sm:text-sm'
        }`}
        title="In biểu mẫu biên bản sự cố chuỗi lạnh GSP"
      >
        <Printer className={`text-slate-500 ${isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
        {!isSm && <span>Biên bản GSP</span>}
      </button>
    </div>
  );
};
