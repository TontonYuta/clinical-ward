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
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-800">
      <td className="py-3.5 px-4 font-mono font-medium text-xs sm:text-sm whitespace-nowrap text-slate-600">
        <span>
          {item.code}
        </span>
      </td>

      <td className="py-3.5 px-4">
        <span className="font-medium text-slate-900 block text-sm leading-snug">
          {item.itemName}
        </span>
        <span className="text-xs text-slate-500 block mt-1">{item.itemType}</span>
      </td>

      <td className="py-3.5 px-3.5 text-center font-mono font-semibold text-slate-900 text-sm whitespace-nowrap">
        {item.quantity}
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
            <span className="text-xs sm:text-sm font-medium text-slate-600">
              Đã tiêu hủy
            </span>
          ) : item.ampouleReturned ? (
            <span className="text-xs sm:text-sm font-medium text-slate-700">
              Đã nộp khay
            </span>
          ) : (
            <span className="text-xs sm:text-sm font-semibold text-rose-700">
              Chưa nộp vỏ
            </span>
          )
        ) : (
          <span className="text-slate-300 text-sm font-bold">—</span>
        )}
      </td>

      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
        <span
          className={`text-xs sm:text-sm font-medium ${
            isDebt ? 'text-amber-800' : 'text-slate-600'
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
