/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị sự cố thiết bị y tế trên bảng Desktop (Modern Data Grid)
 */

import React from 'react';
import { Check, ShieldCheck } from 'lucide-react';
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
  currentUserRole,
}) => {
  const isUrgent = ticket.urgency === 'urgent';
  const isResolved = ticket.status === 'resolved';

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-800">
      <td className="py-3.5 px-3.5 whitespace-nowrap">
        <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 block w-fit">
          {ticket.code}
        </span>
        <span
          className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-bold border ${
            ticket.riskClass === 'D'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          Loại {ticket.riskClass}
        </span>
      </td>

      <td className="py-3.5 px-3.5">
        <span className="font-bold text-slate-900 block text-sm sm:text-base leading-snug">{ticket.deviceName}</span>
        <span className="text-xs sm:text-sm text-slate-500 font-semibold block mt-1">
          SN: {ticket.serialNumber} · {ticket.deviceModel}
        </span>
      </td>

      <td className="py-3.5 px-3.5">
        <span className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2" title={ticket.accessoryIssue}>
          {ticket.accessoryIssue}
        </span>
        <span className="text-xs sm:text-sm text-slate-600 font-medium block mt-1">KS: <strong className="text-slate-800 font-semibold">{ticket.assignedEngineer}</strong></span>
      </td>

      <td className="py-3.5 px-3.5 whitespace-nowrap">
        <span className="font-bold text-slate-800 text-xs sm:text-sm block">{ticket.location}</span>
      </td>

      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono text-xs sm:text-sm text-slate-700">
        <span className="font-bold text-slate-900 block">{ticket.nextInspectionDue}</span>
        <span className="text-xs text-slate-500 font-sans mt-1 block font-medium">NĐ 04/2025/NĐ-CP</span>
      </td>

      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-sm font-bold border ${
            isUrgent && !isResolved
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : isResolved
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {isUrgent && !isResolved ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              Khẩn cấp
            </>
          ) : isResolved ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              Đã bàn giao
            </>
          ) : (
            'Đang xử lý'
          )}
        </span>
      </td>

      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {!isResolved && (
            <button
              onClick={() => onOpenHandover(ticket)}
              className={`h-8.5 px-3.5 rounded-md text-xs sm:text-sm font-bold transition cursor-pointer active:scale-98 flex items-center gap-1.5 ${
                currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                  ? 'bg-teal-800 hover:bg-teal-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Bàn giao</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
