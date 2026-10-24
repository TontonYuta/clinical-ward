/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị sự cố thiết bị y tế trên bảng Desktop (Modern Data Grid)
 */

import React from 'react';
import { Check, ShieldCheck, Printer } from 'lucide-react';
import { EquipmentTicket, UserRole } from '../../../../types/clinical';

interface EquipmentTicketRowProps {
  ticket: EquipmentTicket;
  onOpenHandover: (ticket: EquipmentTicket) => void;
  onOpenPrintForm?: (formType: 'EQUIPMENT_HANDOVER_INSPECT', ticket?: EquipmentTicket) => void;
  currentUserRole?: UserRole;
}

export const EquipmentTicketRow: React.FC<EquipmentTicketRowProps> = ({
  ticket,
  onOpenHandover,
  onOpenPrintForm,
  currentUserRole,
}) => {
  const isUrgent = ticket.urgency === 'urgent';
  const isResolved = ticket.status === 'resolved';

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-800">
      <td className="py-3 px-3 whitespace-nowrap">
        <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 block w-fit">
          {ticket.code}
        </span>
        <span
          className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[11px] font-bold border ${
            ticket.riskClass === 'D'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          Loại {ticket.riskClass}
        </span>
      </td>

      <td className="py-3 px-3">
        <span className="font-bold text-slate-900 block text-sm leading-snug">{ticket.deviceName}</span>
        <span className="text-xs text-slate-500 font-medium block mt-0.5">
          SN: {ticket.serialNumber} · {ticket.deviceModel}
        </span>
      </td>

      <td className="py-3 px-3">
        <span className="text-xs font-semibold text-slate-900 line-clamp-2" title={ticket.accessoryIssue}>
          {ticket.accessoryIssue}
        </span>
        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">KS: {ticket.assignedEngineer}</span>
      </td>

      <td className="py-3 px-3 whitespace-nowrap">
        <span className="font-medium text-slate-800 text-xs block">{ticket.location}</span>
      </td>

      <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-slate-700">
        <span className="font-bold text-slate-900 block">{ticket.nextInspectionDue}</span>
        <span className="text-[11px] text-slate-500 font-sans mt-0.5 block">NĐ 04/2025/NĐ-CP</span>
      </td>

      <td className="py-3 px-3 text-center whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
            isUrgent && !isResolved
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : isResolved
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {isUrgent && !isResolved ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              Khẩn cấp
            </>
          ) : isResolved ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Đã bàn giao
            </>
          ) : (
            'Đang xử lý'
          )}
        </span>
      </td>

      <td className="py-3 px-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT', ticket)}
            className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            title="In biên bản kỹ thuật NĐ 04/2025 & NĐ 98"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In</span>
          </button>

          {!isResolved && (
            <button
              onClick={() => onOpenHandover(ticket)}
              className={`h-8 px-3 rounded-md text-xs font-semibold transition cursor-pointer active:scale-98 flex items-center gap-1 ${
                currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                  ? 'bg-teal-800 hover:bg-teal-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Bàn giao</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
