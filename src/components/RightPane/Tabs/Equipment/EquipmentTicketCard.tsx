/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị sự cố thiết bị y tế trên giao diện Mobile
 */

import React from 'react';
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react';
import { EquipmentTicket, UserRole } from '../../../../types/clinical';

interface EquipmentTicketCardProps {
  ticket: EquipmentTicket;
  onOpenHandover: (ticket: EquipmentTicket) => void;
  onOpenPrintForm?: (formType: 'EQUIPMENT_HANDOVER_INSPECT', ticket?: EquipmentTicket) => void;
  currentUserRole?: UserRole;
}

export const EquipmentTicketCard: React.FC<EquipmentTicketCardProps> = ({
  ticket,
  onOpenHandover,
  currentUserRole,
}) => {
  const isUrgent = ticket.urgency === 'urgent';
  const isResolved = ticket.status === 'resolved';

  return (
    <div
      className={`bg-white rounded-lg border p-3.5 hover:border-slate-300 transition shadow-2xs space-y-3 ${
        isUrgent && !isResolved ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
            {ticket.code}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs sm:text-sm font-bold border ${
              ticket.riskClass === 'D'
                ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                : 'bg-amber-50 text-amber-700 border-amber-200/80'
            }`}
          >
            Loại {ticket.riskClass}
          </span>
        </div>
        <div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full border ${
              isUrgent && !isResolved
                ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                : isResolved
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {isUrgent && !isResolved ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Khẩn cấp P1
              </>
            ) : isResolved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Đã nghiệm thu
              </>
            ) : (
              'Đang xử lý'
            )}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold text-slate-900 leading-snug">{ticket.deviceName}</h3>
        <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200/70 text-xs sm:text-sm text-slate-800 font-medium flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{ticket.accessoryIssue}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600 pt-2 border-t border-slate-100 font-medium">
        <div>
          <span className="text-slate-500">Vị trí:</span>{' '}
          <strong className="text-slate-900 font-bold">{ticket.location}</strong>
        </div>
        <div>
          <span className="text-slate-500">Hạn KĐ:</span>{' '}
          <strong className="text-slate-900 font-mono font-bold">{ticket.nextInspectionDue}</strong>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        {!isResolved ? (
          <button
            onClick={() => onOpenHandover(ticket)}
            className={`w-full py-2 px-3.5 rounded-md text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 ${
              currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Nghiệm thu bàn giao</span>
          </button>
        ) : (
          <div className="w-full py-2 px-3.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs sm:text-sm font-bold text-center">
            Đã nghiệm thu bàn giao
          </div>
        )}
      </div>
    </div>
  );
};
