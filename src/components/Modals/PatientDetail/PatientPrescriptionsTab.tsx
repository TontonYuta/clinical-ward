/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tab Danh Sách Đơn Thuốc CPOE & Sổ Nợ Vỏ Thuốc (<=200 LOC)
 */

import React from 'react';
import { PrescriptionOrder } from '../../../types/cpoe';

interface PatientPrescriptionsTabProps {
  relatedPrescriptions: PrescriptionOrder[];
  relatedDebts: any[];
}

export const PatientPrescriptionsTab: React.FC<PatientPrescriptionsTabProps> = ({
  relatedPrescriptions,
  relatedDebts,
}) => {
  return (
    <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
      <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Chi Tiết Đơn Thuốc Đã Kê ({relatedPrescriptions.length})
          </h3>
          {relatedPrescriptions.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có đơn thuốc nào được ghi nhận cho bệnh nhân này.</p>
          ) : (
            <div className="space-y-4">
              {relatedPrescriptions.map((order) => (
                <div key={order.id} className="space-y-2 pb-4 border-b border-slate-100 last:border-b-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-mono font-bold text-slate-900 text-sm">{order.id}</span>
                    <span className="font-medium text-slate-600">{order.doctorName} · {order.prescribedAt}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-800">
                    Chẩn đoán: <span className="font-mono font-bold text-slate-900">[{order.diagnosisIcd10}]</span> {order.diagnosisText}
                  </p>
                  <div className="space-y-1 text-xs text-slate-700">
                    {order.items.map((it, idx) => (
                      <div key={it.id || idx} className="flex items-center justify-between">
                        <span>{idx + 1}. {it.medicationName}</span>
                        <span className="font-mono font-bold text-slate-900">{it.quantity} {it.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Phiếu Nợ Vỏ Thuốc Cấp Cứu ({relatedDebts.length})</h3>
        {relatedDebts.length === 0 ? (
          <p className="text-xs text-slate-500">Không có phiếu nợ vỏ thuốc gây nghiện.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {relatedDebts.map((debt) => (
              <div key={debt.id} className="space-y-0.5 pb-2 border-b border-slate-100 last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{debt.code}</span>
                  <span className="text-slate-500">{debt.borrowTime}</span>
                </div>
                <p className="font-semibold text-slate-800">{debt.itemName} ({debt.quantity})</p>
                <p className="text-2xs text-slate-500">Buồng: {debt.patientRoom}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
