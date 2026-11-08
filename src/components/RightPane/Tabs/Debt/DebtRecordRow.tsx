/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị phiếu mượn/nợ vỏ trên bảng Desktop chuẩn hành chính Kho Dược (<=200 LOC)
 */

import React from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import { DebtRecord } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../../services/patientService';

interface DebtRecordRowProps {
  index: number;
  item: DebtRecord;
  onOpenPrintForm?: (formType: PrintableFormType, record?: DebtRecord) => void;
  onAmpouleReturn: (id: string) => void;
  onSettle: (id: string) => void;
  onSelectPatient?: (patientName: string) => void;
}

export const DebtRecordRow: React.FC<DebtRecordRowProps> = ({
  index,
  item,
  onAmpouleReturn,
  onSettle,
  onSelectPatient,
}) => {
  const isDebt = item.status === 'debt';
  const isNarcotic = item.itemType === 'Thuốc gây nghiện';

  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-200 text-slate-800 text-sm">
      {/* 1. STT */}
      <td className="py-3 px-3 text-center font-mono text-slate-600 font-medium whitespace-nowrap text-sm border-r border-slate-100">
        {index + 1}
      </td>

      {/* 2. Mã phiếu */}
      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 font-medium border-r border-slate-100">
        {item.code}
      </td>

      {/* 3. Thuốc / Vật tư & Phân loại */}
      <td className="py-3 px-3.5 border-r border-slate-100">
        <div className="font-semibold text-slate-900 leading-snug">
          {item.itemName}
        </div>
        <div className={`text-xs mt-0.5 font-medium ${isNarcotic ? 'text-rose-700' : 'text-slate-500'}`}>
          {item.itemType}
        </div>
      </td>

      {/* 4. Số lượng mượn */}
      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-900 text-sm whitespace-nowrap border-r border-slate-100 tabular-nums">
        {item.quantity}
      </td>

      {/* 5. Người bệnh & Buồng bệnh */}
      <td className="py-3 px-3.5 border-r border-slate-100">
        <div>
          <button
            type="button"
            data-testid="patient-name-btn"
            onClick={() => onSelectPatient?.(item.patientName)}
            className="font-medium text-slate-900 leading-snug hover:text-teal-700 hover:underline text-left cursor-pointer"
            title="Nhấp để xem hồ sơ bệnh nhân"
          >
            {item.patientName}
          </button>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>Buồng: <span className="font-medium text-slate-700">{item.patientRoom}</span></span>
          {findPatientByNameOrQuery(item.patientName, INITIAL_PATIENTS)?.phone && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-700">SĐT: {findPatientByNameOrQuery(item.patientName, INITIAL_PATIENTS)?.phone}</span>
            </>
          )}
        </div>
      </td>

      {/* 6. Thời gian mượn */}
      <td className="py-3 px-3.5 text-center text-slate-600 font-mono text-xs sm:text-sm whitespace-nowrap border-r border-slate-100">
        {item.borrowTime}
      </td>

      {/* 7. Trạng thái vỏ ống TT 20/2017 */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap border-r border-slate-100">
        {isNarcotic ? (
          item.ampouleDestroyed ? (
            <span className="text-xs font-medium text-slate-500">
              Đã tiêu hủy
            </span>
          ) : item.ampouleReturned ? (
            <span className="text-xs font-semibold text-slate-700">
              Đã nộp khay
            </span>
          ) : (
            <span className="text-xs font-bold text-rose-700">
              Chưa nộp vỏ
            </span>
          )
        ) : (
          <span className="text-slate-300 font-mono select-none">—</span>
        )}
      </td>

      {/* 8. Trạng thái hoàn bù */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap border-r border-slate-100">
        <span
          className={`text-xs font-semibold ${
            isDebt ? 'text-amber-800' : 'text-slate-600'
          }`}
        >
          {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
        </span>
      </td>

      {/* 9. Nút thao tác nhanh */}
      <td className="py-3 px-3 text-center whitespace-nowrap">
        {isDebt ? (
          isNarcotic && !item.ampouleReturned ? (
            <button
              type="button"
              onClick={() => onAmpouleReturn(item.id)}
              className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer active:scale-98 transition shadow-xs whitespace-nowrap"
              title="Thu hồi vỏ ống thuốc gây nghiện nộp vào khay đối soát (TT 18/2026/TT-BYT)"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Nộp vỏ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSettle(item.id)}
              className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 whitespace-nowrap"
              title="Xác nhận hoàn trả cơ số bù tủ trực (VBHN 07)"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Hoàn bù</span>
            </button>
          )
        ) : (
          <span className="text-xs text-slate-400 font-medium select-none">Đã hoàn tất</span>
        )}
      </td>
    </tr>
  );
};
