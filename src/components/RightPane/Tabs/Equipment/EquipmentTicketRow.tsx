/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị sự cố thiết bị y tế trên bảng Desktop chuẩn hành chính Kho Dược (<=200 LOC)
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EquipmentTicket, UserRole } from '../../../../types/clinical';

interface EquipmentTicketRowProps {
  index: number;
  ticket: EquipmentTicket;
  onOpenHandover: (ticket: EquipmentTicket) => void;
  onOpenPrintForm?: (formType: 'EQUIPMENT_HANDOVER_INSPECT', ticket?: EquipmentTicket) => void;
  currentUserRole?: UserRole;
}

export const EquipmentTicketRow: React.FC<EquipmentTicketRowProps> = ({
  index,
  ticket,
  onOpenHandover,
  currentUserRole,
}) => {
  const isUrgent = ticket.urgency === 'urgent';
  const isResolved = ticket.status === 'resolved';

  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-200 text-slate-800 text-sm">
      {/* 1. STT */}
      <td className="py-3 px-3 text-center font-mono text-slate-600 font-medium whitespace-nowrap text-sm border-r border-slate-100">
        {index + 1}
      </td>

      {/* 2. Mã sự cố & Phân loại rủi ro thiết bị */}
      <td className="py-3 px-3.5 whitespace-nowrap font-mono border-r border-slate-100">
        <div className="font-semibold text-slate-800">{ticket.code}</div>
        <div className="text-xs text-slate-500 font-sans mt-0.5">
          Rủi ro Loại <span className={`font-bold ${ticket.riskClass === 'D' ? 'text-rose-700' : 'text-slate-800'}`}>{ticket.riskClass}</span>
        </div>
      </td>

      {/* 3. Tên Thiết Bị & Serial / Model */}
      <td className="py-3 px-3.5 border-r border-slate-100">
        <div className="font-semibold text-slate-900 leading-snug">{ticket.deviceName}</div>
        <div className="text-xs text-slate-500 font-mono mt-0.5">
          SN: <span className="text-slate-700 font-medium">{ticket.serialNumber}</span> · {ticket.deviceModel}
        </div>
      </td>

      {/* 4. Mô tả hư hỏng & Kỹ sư phụ trách */}
      <td className="py-3 px-3.5 border-r border-slate-100">
        <div className="text-sm font-medium text-slate-900 leading-snug" title={ticket.accessoryIssue}>
          {ticket.accessoryIssue}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          KS phụ trách: <span className="font-medium text-slate-800">{ticket.assignedEngineer}</span>
        </div>
      </td>

      {/* 5. Vị trí đặt máy */}
      <td className="py-3 px-3.5 border-r border-slate-100">
        <span className="font-medium text-slate-800 text-sm leading-snug">{ticket.location}</span>
      </td>

      {/* 6. Hạn kiểm định (NĐ 04/2025/NĐ-CP) */}
      <td className="py-3 px-3.5 text-center font-mono text-xs sm:text-sm border-r border-slate-100">
        {ticket.nextInspectionDue.includes('(') ? (
          <div>
            <div className="font-semibold text-slate-900">{ticket.nextInspectionDue.split('(')[0].trim()}</div>
            <div className={`text-xs font-sans mt-0.5 font-medium ${ticket.nextInspectionDue.includes('quá hạn') ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
              ({ticket.nextInspectionDue.split('(')[1]}
            </div>
          </div>
        ) : (
          <div className="font-semibold text-slate-900">{ticket.nextInspectionDue}</div>
        )}
        <div className="text-2xs text-slate-400 font-sans mt-0.5 select-none">NĐ 04/2025</div>
      </td>

      {/* 7. Trạng thái sự cố */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap border-r border-slate-100">
        <span
          className={`text-xs font-semibold ${
            isUrgent && !isResolved
              ? 'text-rose-700'
              : isResolved
              ? 'text-slate-500'
              : 'text-amber-800'
          }`}
        >
          {isUrgent && !isResolved ? 'Khẩn cấp P1' : isResolved ? 'Đã bàn giao' : 'Đang xử lý'}
        </span>
      </td>

      {/* 8. Thao tác nghiệm thu */}
      <td className="py-3 px-3 text-center whitespace-nowrap">
        {!isResolved ? (
          <button
            type="button"
            onClick={() => onOpenHandover(ticket)}
            className={`inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-98 shadow-xs ${
              currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                ? 'bg-teal-700 hover:bg-teal-800 text-white font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
            }`}
            title="Biên bản nghiệm thu kỹ thuật và bàn giao khoa lâm sàng"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Nghiệm thu</span>
          </button>
        ) : (
          <span className="text-xs text-slate-400 font-medium select-none">Đã hoàn tất</span>
        )}
      </td>
    </tr>
  );
};
