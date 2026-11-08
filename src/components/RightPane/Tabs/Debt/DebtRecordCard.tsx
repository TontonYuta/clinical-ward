/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị phiếu mượn/nợ vỏ trên Mobile chuẩn Kho Dược (<=200 LOC)
 */

import React from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import { DebtRecord } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';

interface DebtRecordCardProps {
  index: number;
  item: DebtRecord;
  onOpenPrintForm?: (formType: PrintableFormType, record?: DebtRecord) => void;
  onAmpouleReturn: (id: string) => void;
  onSettle: (id: string) => void;
  onSelectPatient?: (patientName: string) => void;
}

export const DebtRecordCard: React.FC<DebtRecordCardProps> = ({
  index,
  item,
  onAmpouleReturn,
  onSettle,
  onSelectPatient,
}) => {
  const isDebt = item.status === 'debt';
  const isNarcotic = item.itemType === 'Thuốc gây nghiện';

  return (
    <article className="bg-white border-b border-slate-200 px-1 py-3 space-y-2 text-sm">
      {/* Hàng 1: STT, Mã phiếu & Thời gian */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs text-slate-500 font-bold w-6">#{index + 1}</span>
          <span className="font-mono text-sm font-semibold text-slate-700">
            {item.code}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {item.borrowTime}
          </span>
          {isNarcotic && (
            <span className="text-xs font-semibold text-rose-700">
              Gây nghiện
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold ${isDebt ? 'text-amber-800' : 'text-slate-600'}`}>
          {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
        </span>
      </div>

      {/* Hàng 2: Tên thuốc, Người bệnh & Buồng */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 leading-snug">{item.itemName}</h3>
          <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Bệnh nhân:</span>
            <button
              type="button"
              onClick={() => onSelectPatient?.(item.patientName)}
              className="text-slate-900 font-medium hover:text-teal-700 hover:underline cursor-pointer"
              title="Nhấp để xem hồ sơ bệnh nhân"
            >
              {item.patientName}
            </button>
            <span className="text-slate-500">({item.patientRoom})</span>
            {findPatientByNameOrQuery(item.patientName, INITIAL_PATIENTS)?.phone && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-700 font-medium">
                  SĐT: {findPatientByNameOrQuery(item.patientName, INITIAL_PATIENTS)?.phone}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
            {item.quantity}
          </span>
        </div>
      </div>

      {/* Hàng 3: Trạng thái vỏ & Thao tác */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <div>
          {isNarcotic ? (
            item.ampouleDestroyed ? (
              <span className="text-slate-500">Vỏ: Đã tiêu hủy</span>
            ) : item.ampouleReturned ? (
              <span className="font-medium text-slate-700">Vỏ: Đã nộp khay</span>
            ) : (
              <span className="font-bold text-rose-700">Vỏ: Chưa nộp</span>
            )
          ) : (
            <span className="text-slate-400">Vỏ thường</span>
          )}
        </div>

        <div>
          {isDebt && (
            isNarcotic && !item.ampouleReturned ? (
              <button
                type="button"
                onClick={() => onAmpouleReturn(item.id)}
                className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition active:scale-98 shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Nộp vỏ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSettle(item.id)}
                className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold transition active:scale-98 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Hoàn bù</span>
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
};
