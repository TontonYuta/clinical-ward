/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị đơn thuốc bác sĩ CPOE trên Mobile (<=200 LOC)
 */

import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { PrescriptionOrder } from '../../../../types/cpoe';

interface CpoeOrderCardProps {
  order: PrescriptionOrder;
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
}

export const CpoeOrderCard: React.FC<CpoeOrderCardProps> = ({ order, onSelectOrder, onOpenSafetyGuide, onOpenAdvice }) => {
  return (
    <div
      onClick={() => onSelectOrder?.(order)}
      className="p-3 hover:bg-slate-50 transition cursor-pointer space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            {order.id}
          </span>
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {order.prescribedAt}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              order.prescriptionType === 'outpatient'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {order.prescriptionType === 'outpatient' ? 'Ngoại trú' : 'Nội trú'}
          </span>
          {order.isChronicDisease && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
              Mạn {order.daysPrescribed}d
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="font-bold text-sm text-slate-900">{order.patientName}</div>
        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <span>{order.patientId}</span>
          <span>•</span>
          <span>CCCD: <span className="font-mono">{order.patientCccd}</span></span>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-xs bg-slate-50 p-2 rounded-md border border-slate-100">
        <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[11px] shrink-0">
          {order.diagnosisIcd10}
        </span>
        <span className="text-slate-700 line-clamp-1">{order.diagnosisText}</span>
      </div>

      <div className="text-xs space-y-1 border-t border-slate-100 pt-1.5">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between items-center text-slate-700">
            <span className="font-medium flex items-center gap-1.5">
              • {it.medicationName}
              {onOpenSafetyGuide && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenSafetyGuide(it.medicationName); }}
                  className="text-teal-700 text-[10px] font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 cursor-pointer"
                  title="Tra cứu thông tin thuốc & Dược thư"
                >
                  Thông tin thuốc
                </button>
              )}
            </span>
            <span className="font-mono text-slate-900 font-semibold">{it.quantity} {it.unit}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
        <div className="flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{order.doctorName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenAdvice && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenAdvice(order); }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-2xs font-bold cursor-pointer"
            >
              <Clock className="w-3 h-3 text-teal-700" />
              <span>Dặn dò nhắc thuốc</span>
            </button>
          )}
          <span className="text-teal-700 font-semibold text-[11px]">Chi tiết →</span>
        </div>
      </div>
    </div>
  );
};
