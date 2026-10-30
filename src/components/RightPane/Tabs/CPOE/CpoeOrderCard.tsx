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
      className="bg-white border-b border-slate-200 px-2 py-3 space-y-2 text-sm cursor-pointer hover:bg-slate-50 transition"
    >
      {/* Hàng 1: STT, Mã đơn & Phân loại đơn */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs text-slate-500 font-bold w-6">#{index + 1}</span>
          <button
            type="button"
            data-testid="cpoe-order-id-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder?.(order);
            }}
            className="font-mono text-sm font-semibold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer"
          >
            {order.id}
          </button>
          <span className="text-xs text-slate-500 font-mono">
            {order.prescribedAt}
          </span>
          {order.isChronicDisease && (
            <span className="text-xs font-semibold text-amber-800">
              Mạn ({order.daysPrescribed}d)
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold ${isOutpatient ? 'text-slate-700' : 'text-slate-900'}`}>
          {isOutpatient ? 'Ngoại trú' : 'Nội trú'}
        </span>
      </div>

      {/* Hàng 2: Tên người bệnh & Chẩn đoán */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPatient?.(order.patientName);
            }}
            className="font-semibold text-slate-900 leading-snug hover:text-teal-700 hover:underline text-left cursor-pointer"
            title="Nhấp để xem hồ sơ bệnh nhân"
          >
            {order.patientName}
          </button>
          <div className="text-xs text-slate-500 font-mono shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
            <span>CCCD: {order.patientCccd}</span>
            {order.patientPhone && (
              <>
                <span>·</span>
                <span className="text-slate-700 font-medium">SĐT: {order.patientPhone}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-600 mt-1">
          <span className="font-mono font-semibold text-slate-800">[{order.diagnosisIcd10}]</span> {order.diagnosisText}
        </div>
      </div>

      {/* Hàng 3: Danh mục thuốc & Trạng thái */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <div className="text-slate-600 font-medium truncate max-w-[70%]">
          {order.items.length} thuốc · {order.items.map((i) => i.medicationName.split(' ')[0]).join(', ')}
        </div>
        <span className="text-xs font-medium text-slate-500 font-mono">
          {order.status === 'signed' ? 'Đã ký số' : 'Bản thảo'}
        </span>
      </div>
    </article>
  );
};
