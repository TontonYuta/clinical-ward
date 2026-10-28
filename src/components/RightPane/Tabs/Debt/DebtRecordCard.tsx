/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị phiếu mượn/nợ vỏ trên giao diện Mobile
 */

import React from 'react';
import { Clock, Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DebtRecord } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface DebtRecordCardProps {
  item: DebtRecord;
  onOpenPrintForm?: (formType: PrintableFormType, record?: DebtRecord) => void;
  onAmpouleReturn: (id: string) => void;
  onSettle: (id: string) => void;
}

export const DebtRecordCard: React.FC<DebtRecordCardProps> = ({
  item,
  onAmpouleReturn,
  onSettle,
}) => {
  const isDebt = item.status === 'debt';
  const isNarcotic = item.itemType === 'Thuốc gây nghiện';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3.5 hover:border-slate-300 transition shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
            {item.code}
          </span>
          <span className="text-xs sm:text-sm text-slate-500 font-mono font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {item.borrowTime}
          </span>
        </div>
        <div>
          {isDebt ? (
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Đang nợ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-md">
              Đã hoàn bù
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-snug">{item.itemName}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-md ${
                isNarcotic
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {item.itemType}
            </span>
            <span className="text-xs sm:text-sm text-slate-600 font-medium">
              Người bệnh: <strong className="text-slate-900 font-bold">{item.patientName}</strong>
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-lg sm:text-xl font-black text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md inline-block">
            {item.quantity}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm pt-2.5 border-t border-slate-100">
        <div className="text-slate-600 font-medium">
          <span className="text-slate-500">Vị trí:</span>{' '}
          <span className="font-bold text-slate-900">{item.patientRoom}</span>
        </div>
        <div>
          {isNarcotic ? (
            item.ampouleDestroyed ? (
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                Đã tiêu hủy vỏ
              </span>
            ) : item.ampouleReturned ? (
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Đã nộp vỏ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                Nợ vỏ Morphin
              </span>
            )
          ) : (
            <span className="text-slate-500 text-xs sm:text-sm font-medium">Cơ số thường</span>
          )}
        </div>
      </div>

      {isDebt && (
        <div className="pt-2.5 border-t border-slate-100">
          {isNarcotic && !item.ampouleReturned ? (
            <button
              onClick={() => onAmpouleReturn(item.id)}
              className="w-full py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Thu hồi vỏ nộp khay</span>
            </button>
          ) : (
            <button
              onClick={() => onSettle(item.id)}
              className="w-full py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận hoàn bù</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
