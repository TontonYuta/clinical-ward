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
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-left text-2xs">
        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
          <tr>
            <th className="p-2">Tên thuốc</th>
            <th className="p-2 text-center bg-teal-50 text-teal-900">🌅 Sáng (07:30)</th>
            <th className="p-2 text-center bg-amber-50 text-amber-900">☀️ Trưa (11:30)</th>
            <th className="p-2 text-center bg-orange-50 text-orange-900">🌤️ Chiều (18:00)</th>
            <th className="p-2 text-center bg-indigo-50 text-indigo-900">🌙 Tối (20:00)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {meds.map((m, i) => {
            const hasSlot = (k: string) => m.timeSlots.find(s => s.id === k || s.label.toLowerCase().includes(k));
            return (
              <tr key={i} className="hover:bg-slate-50/70">
                <td className="p-2 font-medium text-slate-900">
                  {m.medicationName} <span className="text-slate-400">({m.dosage})</span>
                </td>
                <td className="p-2 text-center font-mono">{hasSlot('morning') ? <span className="font-bold text-teal-800">1 viên</span> : '—'}</td>
                <td className="p-2 text-center font-mono">{hasSlot('noon') ? <span className="font-bold text-amber-800">1 viên</span> : '—'}</td>
                <td className="p-2 text-center font-mono">{hasSlot('afternoon') ? <span className="font-bold text-orange-800">1 viên</span> : '—'}</td>
                <td className="p-2 text-center font-mono">{hasSlot('evening') ? <span className="font-bold text-indigo-800">1 viên</span> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
