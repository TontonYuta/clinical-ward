/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị sự cố thiết bị y tế trên bảng Desktop
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
    <tr className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors border-b border-slate-200/80">
      <td className="py-3 px-4 whitespace-nowrap border-r border-slate-200/70">
        <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300/70 block w-fit">
          {ticket.code}
        </span>
        <span
          className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-bold border ${
            ticket.riskClass === 'D'
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}
        >
          Loại {ticket.riskClass}
        </span>
      </td>

      <td className="py-3 px-3.5 border-r border-slate-200/70">
        <span className="font-bold text-slate-950 block text-[15px] leading-snug">{ticket.deviceName}</span>
        <span className="text-xs text-slate-600 font-medium block mt-0.5">
          SN: {ticket.serialNumber} · {ticket.deviceModel}
        </span>
      </td>

      <td className="py-3 px-3.5 max-w-xs border-r border-slate-200/70">
        <span className="text-sm text-slate-950 font-semibold line-clamp-1" title={ticket.accessoryIssue}>
          {ticket.accessoryIssue}
        </span>
        <span className="text-xs text-slate-600 font-medium block mt-0.5">KS: {ticket.assignedEngineer}</span>
      </td>

      <td className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200/70">
        <span className="font-semibold text-slate-800 text-sm block">📍 {ticket.location}</span>
      </td>

      <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-slate-800 border-r border-slate-200/70">
        <span className="font-bold text-slate-900 block">{ticket.nextInspectionDue}</span>
        <span className="text-xs text-slate-600 font-sans mt-0.5 block">NĐ 04/2025/NĐ-CP</span>
      </td>

      <td className="py-3 px-3 text-center whitespace-nowrap border-r border-slate-200/70">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
            isUrgent && !isResolved
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : isResolved
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          {isUrgent && !isResolved ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-600" />
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

      <td className="py-3 px-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT', ticket)}
            className="h-8.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="In Biên bản kỹ thuật NĐ 04/2025 & NĐ 98"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden xl:inline">In NĐ 98</span>
          </button>

          {!isResolved && (
            <button
              onClick={() => onOpenHandover(ticket)}
              className={`h-8.5 px-3.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-98 flex items-center gap-1.5 ${
                currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                  ? 'bg-teal-700 hover:bg-teal-800 text-white'
                  : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-300'
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
