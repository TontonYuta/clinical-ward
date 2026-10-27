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
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 font-semibold text-2xs">
          <tr>
            <th className="py-2 px-3">Tên thuốc & hàm lượng</th>
            <th className="py-2 px-2 text-center w-24">Sáng (07:00)</th>
            <th className="py-2 px-2 text-center w-24">Trưa (11:30)</th>
            <th className="py-2 px-2 text-center w-24">Chiều (18:00)</th>
            <th className="py-2 px-2 text-center w-24">Tối (20:00)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-2xs">
          {meds.map((m, i) => {
            const renderCell = (k: string) => {
              const s = m.timeSlots.find(sl => sl.id === k || sl.label.toLowerCase().includes(k));
              if (!s) return <span className="text-slate-300">—</span>;
              return (
                <div className="font-mono">
                  <span className="font-bold text-slate-900 block">{s.dosageText}</span>
                  {s.mealRelation && <span className="text-[10px] text-slate-500 block">{s.mealRelation}</span>}
                </div>
              );
            };
            return (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="py-2 px-3 font-semibold text-slate-900">
                  {m.medicationName}
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
