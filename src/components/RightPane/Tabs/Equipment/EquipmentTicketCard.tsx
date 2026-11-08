/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị sự cố thiết bị y tế trên Mobile chuẩn Kho Dược (<=200 LOC)
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EquipmentTicket, UserRole } from '../../../../types/clinical';

interface EquipmentTicketCardProps {
  index: number;
  ticket: EquipmentTicket;
  onOpenHandover: (ticket: EquipmentTicket) => void;
  onOpenPrintForm?: (formType: 'EQUIPMENT_HANDOVER_INSPECT', ticket?: EquipmentTicket) => void;
  currentUserRole?: UserRole;
}

export const EquipmentTicketCard: React.FC<EquipmentTicketCardProps> = ({
  index,
  ticket,
  onOpenHandover,
  currentUserRole,
}) => {
  const isUrgent = ticket.urgency === 'urgent';
  const isResolved = ticket.status === 'resolved';

  return (
    <article className="bg-white border-b border-slate-200 px-1 py-3 space-y-2 text-sm">
      {/* Hàng 1: STT, Mã sự cố & Phân loại rủi ro */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-sans tabular-nums text-xs text-slate-500 font-bold w-6">#{index + 1}</span>
          <span className="font-sans tabular-nums text-sm font-semibold text-slate-800">
            {ticket.code}
          </span>
          <span className="text-xs font-medium text-slate-500 font-sans">
            Loại <strong className={ticket.riskClass === 'D' ? 'text-rose-700' : 'text-slate-800'}>{ticket.riskClass}</strong>
          </span>
          <span className="text-xs text-slate-400">· {ticket.location}</span>
        </div>
        <span
          className={`text-xs font-semibold ${
            isUrgent && !isResolved
              ? 'text-rose-700'
              : isResolved
              ? 'text-slate-500'
              : 'text-amber-800'
          }`}
        >
          {isUrgent && !isResolved ? 'Khẩn cấp P1' : isResolved ? 'Đã bàn giao' : 'Đang sửa'}
        </span>
      </div>

      {/* Hàng 2: Tên thiết bị, Serial & Hư hỏng */}
      <div>
        <h3 className="font-semibold text-slate-900 leading-snug">{ticket.deviceName}</h3>
        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
          {ticket.accessoryIssue}
        </p>
      </div>

      {/* Hàng 3: Hạn kiểm định & Thao tác */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <div className="text-slate-500 font-sans tabular-nums">
          Hạn KĐ: <span className="text-slate-800 font-medium">{ticket.nextInspectionDue}</span>
        </div>

        <div>
          {!isResolved ? (
            <button
              type="button"
              onClick={() => onOpenHandover(ticket)}
              className={`inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg text-xs font-semibold transition active:scale-98 shadow-xs ${
                currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                  ? 'bg-teal-700 hover:bg-teal-800 text-white font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Nghiệm thu</span>
            </button>
          ) : (
            <span className="text-slate-400 select-none">Đã nghiệm thu</span>
          )}
        </div>
      </div>
    </article>
  );
};
