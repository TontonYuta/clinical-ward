/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị phiếu mượn/nợ vỏ trên bảng Desktop (Modern Data Grid)
 */

import React from 'react';
import { Check, ShieldAlert, ShieldCheck, Printer } from 'lucide-react';
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
  onOpenPrintForm,
  onAmpouleReturn,
  onSettle,
}) => {
  const isDebt = item.status === 'debt';
  const isNarcotic = item.itemType === 'Thuốc gây nghiện';

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-800">
      <td className="py-3 px-3 font-mono font-bold text-xs whitespace-nowrap">
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
          {item.code}
        </span>
      </td>

      <td className="py-3 px-3">
        <span className="font-bold text-slate-900 block text-sm leading-snug">
          {item.itemName}
        </span>
        <span className="text-xs text-slate-500 font-medium block mt-0.5">{item.itemType}</span>
      </td>

      <td className="py-3 px-3 text-center font-mono font-extrabold text-slate-900 text-sm whitespace-nowrap">
        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 inline-block">
          {item.quantity}
        </span>
      </td>

      <td className="py-3 px-3">
        <span className="text-slate-900 font-bold block text-sm leading-snug">
          {item.patientName}
        </span>
        <span className="text-xs text-slate-600 font-medium block mt-0.5">
          <span className="text-slate-400 font-normal">Buồng:</span> {item.patientRoom}
        </span>
      </td>

      <td className="py-3 px-3 text-center text-slate-600 text-xs font-mono whitespace-nowrap">
        {item.borrowTime}
      </td>

      <td className="py-3 px-3 text-center whitespace-nowrap">
        {isNarcotic ? (
          item.ampouleDestroyed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
              Đã tiêu hủy
            </span>
          ) : item.ampouleReturned ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Đã nộp khay
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              Chưa nộp vỏ
            </span>
          )
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      <td className="py-3 px-3 text-center whitespace-nowrap">
        <span
          className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${
            isDebt ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
        </span>
      </td>

      <td className="py-3 px-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5 justify-end">
          <button
            onClick={() =>
              onOpenPrintForm?.(
                isNarcotic ? 'TT20_AMPOULE_DESTRUCTION' : 'EMERGENCY_BORROW_TICKET',
                item
              )
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="In phiếu kẹp bệnh án"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          {isDebt && (
            isNarcotic && !item.ampouleReturned ? (
              <button
                onClick={() => onAmpouleReturn(item.id)}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer active:scale-98 transition shadow-xs whitespace-nowrap"
                title="Thu hồi vỏ ống thuốc gây nghiện nộp vào khay (TT 18/2026/TT-BYT)"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Nộp vỏ</span>
              </button>
            ) : (
              <button
                onClick={() => onSettle(item.id)}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer active:scale-98 whitespace-nowrap"
                title="Xác nhận hoàn trả cơ số tủ trực (VBHN 07)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Hoàn bù</span>
              </button>
            )
          )}
        </div>
      </td>
    </tr>
  );
};
