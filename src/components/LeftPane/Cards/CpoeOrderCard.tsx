/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị Đơn thuốc điện tử CPOE trong Chatbot (<=100 LOC)
 */

import React from 'react';
import { Pill, User, Stethoscope, Clock } from 'lucide-react';
import { PrescriptionOrder } from '../../../types/cpoe';

interface CpoeOrderCardProps {
  order: PrescriptionOrder;
}

export const CpoeOrderCard: React.FC<CpoeOrderCardProps> = ({ order }) => {
  return (
    <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-300 text-xs">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-bold text-slate-900 text-sm">{order.patientName}</span>
          <span className="text-[10px] text-slate-500">({order.patientAge}T - {order.patientGender})</span>
        </div>
        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
          {order.id}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
        <Stethoscope className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <div>
          <strong>Chẩn đoán:</strong> <span className="font-mono text-slate-900 font-semibold">{order.diagnosisIcd10}</span> - {order.diagnosisText}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold text-slate-800 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1">
            <Pill className="w-3 h-3 text-slate-600" />
            <span>Danh mục thuốc chỉ định ({order.items.length} mục):</span>
          </span>
          <span className="text-slate-500 text-[10px] flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> {order.daysPrescribed} ngày
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden">
          {order.items.map((it, idx) => (
            <div key={idx} className="p-2 bg-white flex items-center justify-between text-2xs">
              <div>
                <strong className="text-slate-900 block">{it.medicationName}</strong>
                <span className="text-slate-500">{it.frequency}</span>
              </div>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                {it.quantity} {it.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
