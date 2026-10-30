/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị Đơn thuốc điện tử CPOE trong Chatbot (<=100 LOC)
 */

import React from 'react';
import { Pill, User, Stethoscope, Clock } from 'lucide-react';
import { PrescriptionOrder } from '../../../types/cpoe';
import { openPatientDetailModal } from '../../../services/patientService';

interface CpoeOrderCardProps {
  order: PrescriptionOrder | any;
}

export const CpoeOrderCard: React.FC<CpoeOrderCardProps> = ({ order }) => {
  if (!order) return null;

  const patientName = order.patientName || order.patient || 'Bệnh nhân';
  const patientAge = order.patientAge || 45;
  const patientGender = order.patientGender || 'Nam';
  const orderId = order.id || order.prescriptionId || 'RX-2026';
  const icd10 = order.diagnosisIcd10 || order.icd10 || 'ICD-10';
  const diagnosis = order.diagnosisText || order.diagnosis || 'Chẩn đoán điều trị nội trú';
  const days = order.daysPrescribed || 3;
  
  const items: Array<{ medicationName: string; quantity: number | string; unit: string; frequency?: string }> = Array.isArray(order.items)
    ? order.items
    : order.medication
    ? [{ medicationName: order.medication, quantity: 1, unit: 'Lọ/Ống', frequency: 'Y lệnh bác sĩ' }]
    : [];

  return (
    <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-300 text-xs">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <button
            type="button"
            onClick={() => openPatientDetailModal(patientName)}
            className="font-bold text-slate-900 text-sm hover:text-teal-700 hover:underline cursor-pointer text-left"
            title="Nhấp để xem hồ sơ bệnh nhân"
          >
            {patientName}
          </button>
          <span className="text-[10px] text-slate-500">({patientAge}T - {patientGender})</span>
        </div>
        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
          {orderId}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
        <Stethoscope className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <div>
          <strong>Chẩn đoán:</strong> <span className="font-mono text-slate-900 font-semibold">{icd10}</span> - {diagnosis}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold text-slate-800 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1">
            <Pill className="w-3 h-3 text-slate-600" />
            <span>Danh mục thuốc chỉ định ({items.length} mục):</span>
          </span>
          <span className="text-slate-500 text-[10px] flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> {days} ngày
          </span>
        </div>

        {items.length > 0 ? (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden">
            {items.map((it, idx) => (
              <div key={idx} className="p-2 bg-white flex items-center justify-between text-2xs">
                <div>
                  <strong className="text-slate-900 block">{it.medicationName}</strong>
                  <span className="text-slate-500">{it.frequency || 'Y lệnh'}</span>
                </div>
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                  {it.quantity} {it.unit}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-2xs text-slate-500 italic p-2 bg-slate-50 rounded border border-slate-200">
            Xem chi tiết đơn thuốc trên hệ thống Kê đơn CPOE
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#cpoe';
          }}
          className="w-full py-1.5 px-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
        >
          <span>Xem chi tiết đơn thuốc trên Kê đơn CPOE →</span>
        </button>
      </div>
    </div>
  );
};
