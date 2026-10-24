/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị phiếu mượn/nợ vỏ trên bảng Desktop
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
    <tr className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors border-b border-slate-200/80">
      <td className="py-3 px-3.5 font-mono text-slate-800 font-bold text-xs whitespace-nowrap border-r border-slate-200/70">
        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300/70 inline-block">
          {item.code}
        </span>
      </td>

      <td className="py-3 px-3.5 pr-2 border-r border-slate-200/70">
        <span className="font-bold text-slate-950 block text-[15px] leading-snug truncate" title={item.itemName}>
          {item.itemName}
        </span>
        <span className="text-xs text-slate-600 font-medium block truncate mt-0.5">{item.itemType}</span>
      </td>

      <td className="py-3 px-2 text-center font-mono font-extrabold text-slate-950 text-base whitespace-nowrap border-r border-slate-200/70">
        {item.quantity}
      </td>

      <td className="py-3 px-3.5 pr-2 border-r border-slate-200/70">
        <span className="text-slate-950 font-bold block text-[15px] leading-snug truncate" title={item.patientName}>
          {item.patientName}
        </span>
        <span className="text-xs text-slate-700 font-medium block truncate mt-0.5" title={item.patientRoom}>
          📍 {item.patientRoom}
        </span>
      </td>

      <td className="py-3 px-2 text-center text-slate-700 text-xs font-mono font-semibold whitespace-nowrap border-r border-slate-200/70">
        {item.borrowTime}
      </td>

      <td className="py-3 px-2 text-center whitespace-nowrap border-r border-slate-200/70">
        {isNarcotic ? (
          item.ampouleDestroyed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Đã tiêu hủy
            </span>
          ) : item.ampouleReturned ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Đã nộp khay
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              Chưa nộp vỏ
            </span>
          )
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      <td className="py-3 px-2 text-center whitespace-nowrap border-r border-slate-200/70">
        <span
          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
            isDebt ? 'bg-amber-50 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
        </span>
      </td>

      <td className="py-3 px-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-2 justify-end">
          <button
            onClick={() =>
              onOpenPrintForm?.(
                isNarcotic ? 'TT20_AMPOULE_DESTRUCTION' : 'EMERGENCY_BORROW_TICKET',
                item
              )
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-teal-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="In phiếu kẹp bệnh án"
          >
            <Printer className="w-4 h-4" />
          </button>
          {isDebt && (
            isNarcotic && !item.ampouleReturned ? (
              <button
                onClick={() => onAmpouleReturn(item.id)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 text-xs font-bold cursor-pointer active:scale-98 transition shadow-2xs whitespace-nowrap"
                title="Thu hồi vỏ ống thuốc gây nghiện nộp vào khay (TT 18/2026/TT-BYT)"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Nộp vỏ</span>
              </button>
            ) : (
              <button
                onClick={() => onSettle(item.id)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                title="Duyệt hoàn bù cơ số tủ trực (VBHN 07)"
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
