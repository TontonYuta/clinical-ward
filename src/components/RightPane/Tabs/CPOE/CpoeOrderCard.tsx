/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị đơn thuốc bác sĩ CPOE trên Mobile chuẩn Kho Dược (<=200 LOC)
 */

import React from 'react';
import { PrescriptionOrder } from '../../../../types/cpoe';

interface CpoeOrderCardProps {
  index: number;
  order: PrescriptionOrder;
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
}

export const CpoeOrderCard: React.FC<CpoeOrderCardProps> = ({
  index,
  order,
  onSelectOrder,
  onSelectPatient,
}) => {
  const isOutpatient = order.prescriptionType === 'outpatient';

  return (
    <article
      data-testid="cpoe-order-card"
      onClick={() => onSelectOrder?.(order)}
      className="bg-white border-b border-slate-200 px-3 py-2.5 space-y-1.5 text-xs sm:text-sm cursor-pointer hover:bg-slate-50 transition"
    >
      {/* Hàng 1: STT, Mã đơn & Phân loại đơn */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs text-slate-500 font-bold w-5">#{index + 1}</span>
          <button
            type="button"
            data-testid="cpoe-order-id-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder?.(order);
            }}
            className="font-mono text-xs font-bold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer"
          >
            {order.id}
          </button>
          <span className="text-2xs text-slate-400 font-mono">
            {order.prescribedAt}
          </span>
          {order.isChronicDisease && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
              Mạn ({order.daysPrescribed}d)
            </span>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isOutpatient ? 'bg-slate-100 text-slate-700' : 'bg-teal-50 text-teal-800'}`}>
          {isOutpatient ? 'Ngoại trú' : 'Nội trú'}
        </span>
      </div>

      {/* Hàng 2: Tên người bệnh & Chẩn đoán */}
      <div>
        <div className="flex items-baseline justify-between gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPatient?.(order.patientName);
            }}
            className="font-bold text-slate-900 text-xs sm:text-sm leading-snug hover:text-teal-700 hover:underline text-left cursor-pointer"
            title="Nhấp để xem hồ sơ bệnh nhân"
          >
            {order.patientName}
          </button>
          <span className="text-2xs text-slate-500 font-mono shrink-0">
            {order.patientId}
          </span>
        </div>
        <div className="text-2xs sm:text-xs text-slate-600 mt-0.5 truncate">
          <span className="font-mono font-bold text-slate-800">[{order.diagnosisIcd10}]</span> {order.diagnosisText}
        </div>
      </div>

      {/* Hàng 3: Danh mục thuốc & Trạng thái */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-2xs sm:text-xs">
        <div className="text-slate-600 font-medium truncate max-w-[72%]">
          {order.items.length} khoản: <span className="text-slate-800 font-medium">{order.items.map((i) => i.medicationName.split(' ')[0]).join(', ')}</span>
        </div>
        <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
          {order.status === 'signed' ? '✓ Đã ký số' : 'Bản thảo'}
        </span>
      </div>
    </article>
  );
};
