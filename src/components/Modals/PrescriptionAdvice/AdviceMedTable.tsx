/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng cữ uống thuốc trong Modal dặn dò bác sĩ (<=200 LOC)
 */

import React from 'react';
import { ScheduledMedication } from '../../../types/medicationSchedule';

interface AdviceMedTableProps {
  meds: ScheduledMedication[];
}

export const AdviceMedTable: React.FC<AdviceMedTableProps> = ({ meds }) => {
  return (
    <div className="border border-slate-200 rounded-md overflow-x-auto bg-white">
      <table className="w-full text-left text-xs min-w-[700px]">
        <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 font-semibold text-xs">
          <tr>
            <th className="py-2.5 px-3">Tên thuốc & hàm lượng</th>
            <th className="py-2.5 px-2 text-center w-32">Sáng</th>
            <th className="py-2.5 px-2 text-center w-32">Trưa</th>
            <th className="py-2.5 px-2 text-center w-32">Chiều</th>
            <th className="py-2.5 px-2 text-center w-32">Tối</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {meds.map((m, i) => {
            const renderCell = (k: string) => {
              const s = m.timeSlots.find(sl => sl.id === k || sl.label.toLowerCase().includes(k));
              if (!s) return <span className="text-slate-300">—</span>;
              return (
                <div className="font-mono">
                  <span className="font-bold text-slate-900 block">{s.dosageText}</span>
                  {s.time && <span>{s.time}</span>}
                  {s.mealRelation && <span className="text-[10px] text-slate-500 block">{s.mealRelation}</span>}
                  {s.note && <span className="text-xs text-slate-700 block">{s.note}</span>}
                </div>
              );
            };
            return (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="py-2 px-3 font-semibold text-slate-900">
                  {m.medicationName}
                  <div className="font-normal text-slate-700 mt-1">Liều: {m.dosage || 'Chưa ghi'} · Đường dùng: {m.route || 'Chưa ghi'}</div>
                  <div className="font-normal text-slate-700">Tần suất: {m.frequency || 'Chưa ghi'} · Thời hạn: {m.durationDays > 0 ? `${m.durationDays} ngày` : 'Chưa ghi'}</div>
                  {m.specialInstructions && <div className="font-normal text-slate-700">{m.specialInstructions}</div>}
                  {!m.timeSlots.length && <div className="font-normal text-amber-800">Chưa cấu hình giờ dùng; xem chỉ định đã kê.</div>}
                </td>
                <td className="py-2 px-2 text-center">{renderCell('morning')}</td>
                <td className="py-2 px-2 text-center">{renderCell('noon')}</td>
                <td className="py-2 px-2 text-center">{renderCell('afternoon')}</td>
                <td className="py-2 px-2 text-center">{renderCell('evening')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
