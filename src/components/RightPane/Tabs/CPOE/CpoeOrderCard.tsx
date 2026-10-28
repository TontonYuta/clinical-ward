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
      className="p-3.5 hover:bg-slate-50 transition cursor-pointer space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
          <span className="font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            {order.id}
          </span>
          <span className="text-slate-500 text-xs flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5" />
            {order.prescribedAt}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
              order.prescriptionType === 'outpatient'
                ? 'bg-blue-100 text-blue-900'
                : 'bg-emerald-100 text-emerald-900'
            }`}
          >
            {order.prescriptionType === 'outpatient' ? 'Ngoại trú' : 'Nội trú'}
          </span>
          {order.isChronicDisease && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900">
              Mạn {order.daysPrescribed}d
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="font-bold text-base text-slate-900">{order.patientName}</div>
        <div className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 mt-0.5 font-medium">
          <span>{order.patientId}</span>
          <span>•</span>
          <span>CCCD: <span className="font-mono font-bold text-slate-700">{order.patientCccd}</span></span>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-xs sm:text-sm bg-slate-50 p-2.5 rounded-md border border-slate-100">
        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-900 font-mono font-bold text-xs shrink-0">
          {order.diagnosisIcd10}
        </span>
        <span className="text-slate-800 font-medium line-clamp-1">{order.diagnosisText}</span>
      </div>

      <div className="text-xs sm:text-sm space-y-1.5 border-t border-slate-100 pt-2">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between items-center text-slate-800">
            <span className="font-medium flex items-center gap-1.5">
              • <strong className="font-bold text-slate-900">{it.medicationName}</strong>
              {onOpenSafetyGuide && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenSafetyGuide(it.medicationName); }}
                  className="text-teal-700 text-xs font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 cursor-pointer"
                  title="Tra cứu thông tin thuốc & Dược thư"
                >
                  Thông tin thuốc
                </button>
              )}
            </span>
            <span className="font-mono text-slate-900 font-bold">{it.quantity} {it.unit}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-100 text-slate-600">
        <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{order.doctorName}</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenAdvice && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenAdvice(order); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold cursor-pointer transition shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-teal-700" />
              <span>Dặn dò nhắc thuốc</span>
            </button>
          )}
          <span className="text-teal-700 font-bold text-xs sm:text-sm">Chi tiết →</span>
        </div>
      </div>
    </div>
  );
};
