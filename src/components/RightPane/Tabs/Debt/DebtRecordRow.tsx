/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị phiếu mượn/nợ vỏ trên bảng Desktop (Modern Data Grid)
 */

import React from 'react';
import { Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DebtRecord } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface DebtRecordRowProps {
  item: DebtRecord;
  onOpenPrintForm?: (formType: PrintableFormType, record?: DebtRecord) => void;
  onAmpouleReturn: (id: string) => void;
  onSettle: (id: string) => void;
}

export const DebtRecordRow: React.FC<DebtRecordRowProps> = ({
  item,
  onAmpouleReturn,
  onSettle,
}) => {
  const isDebt = item.status === 'debt';
  const isNarcotic = item.itemType === 'Thuốc gây nghiện';

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-800">
      <td className="py-3.5 px-3.5 font-mono font-bold text-xs sm:text-sm whitespace-nowrap">
        <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
          {item.code}
        </span>
      </td>

      <td className="py-3.5 px-3.5">
        <span className="font-bold text-slate-900 block text-sm sm:text-base leading-snug">
          {item.itemName}
        </span>
        <span className="text-xs sm:text-sm text-slate-500 font-semibold block mt-1">{item.itemType}</span>
      </td>

      <td className="py-3.5 px-3.5 text-center font-mono font-black text-slate-900 text-base sm:text-lg whitespace-nowrap">
        <span className="bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
          {item.quantity}
        </span>
      </td>

      <td className="py-3.5 px-3.5">
        <span className="text-slate-900 font-bold block text-sm sm:text-base leading-snug">
          {item.patientName}
        </span>
        <span className="text-xs sm:text-sm text-slate-600 font-semibold block mt-1">
          <span className="text-slate-400 font-normal">Buồng:</span> {item.patientRoom}
        </span>
      </td>

      <td className="py-3.5 px-3.5 text-center text-slate-700 text-xs sm:text-sm font-mono font-semibold whitespace-nowrap">
        {item.borrowTime}
      </td>

      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
        {isNarcotic ? (
          item.ampouleDestroyed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700">
              Đã tiêu hủy
            </span>
          ) : item.ampouleReturned ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Đã nộp khay
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Chưa nộp vỏ
            </span>
          )
        ) : (
          <span className="text-slate-300 text-sm font-bold">—</span>
        )}
      </td>

      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
        <span
          className={`inline-block px-3 py-1 rounded-md text-xs sm:text-sm font-bold ${
            isDebt ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
        </span>
      </td>

      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5 justify-end">
          {isDebt && (
            isNarcotic && !item.ampouleReturned ? (
              <button
                onClick={() => onAmpouleReturn(item.id)}
                className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold cursor-pointer active:scale-98 transition shadow-xs whitespace-nowrap"
                title="Thu hồi vỏ ống thuốc gây nghiện nộp vào khay (TT 18/2026/TT-BYT)"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Nộp vỏ</span>
              </button>
            ) : (
              <button
                onClick={() => onSettle(item.id)}
                className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-98 whitespace-nowrap"
                title="Xác nhận hoàn trả cơ số tủ trực (VBHN 07)"
              >
                <Check className="w-4 h-4" />
                <span>Hoàn bù</span>
              </button>
            )
          )}
        </div>
      </td>
    </tr>
  );
};
