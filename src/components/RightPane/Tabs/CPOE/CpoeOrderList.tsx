/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Danh Sách Đơn Thuốc Bác Sĩ CPOE (<=200 LOC)
 */

import React, { useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { PrescriptionOrder } from '../../../../types/cpoe';
import { CpoeOrderCard } from './CpoeOrderCard';

interface CpoeOrderListProps {
  orders: PrescriptionOrder[];
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
}

export const CpoeOrderList: React.FC<CpoeOrderListProps> = ({ orders, onSelectOrder, onOpenSafetyGuide, onOpenAdvice }) => {
  const [filterType, setFilterType] = useState<'all' | 'outpatient' | 'inpatient_daily'>('all');

  const filteredOrders = orders.filter((o) => {
    if (filterType === 'all') return true;
    return o.prescriptionType === filterType;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
      {/* Table Filters Header */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterType === 'all'
                ? 'bg-blue-700 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Tất cả đơn ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('inpatient_daily')}
            className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterType === 'inpatient_daily'
                ? 'bg-blue-700 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            🏥 Đơn thuốc Nội trú (Y lệnh ngày)
          </button>
          <button
            type="button"
            onClick={() => setFilterType('outpatient')}
            className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterType === 'outpatient'
                ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            🏪 Đơn thuốc Ngoại trú (Xuất viện)
          </button>
        </div>
      </div>

      {/* Mobile Card List (md:hidden) */}
      <div className="md:hidden divide-y divide-slate-100">
        {filteredOrders.length === 0 ? (
          <div className="py-8 text-center text-slate-400 italic text-xs">
            Chưa có đơn thuốc nào trong danh mục này.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <CpoeOrderCard key={order.id} order={order} onSelectOrder={onSelectOrder} onOpenSafetyGuide={onOpenSafetyGuide} onOpenAdvice={onOpenAdvice} />
          ))
        )}
      </div>

      {/* Desktop Orders Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-semibold text-xs">
              <th className="py-2.5 px-3 border-r border-slate-200">Mã đơn</th>
              <th className="py-2.5 px-3 border-r border-slate-200">Người bệnh</th>
              <th className="py-2.5 px-3 border-r border-slate-200">Chẩn đoán</th>
              <th className="py-2.5 px-3 border-r border-slate-200">Loại đơn</th>
              <th className="py-2.5 px-3 border-r border-slate-200">Thuốc</th>
              <th className="py-2.5 px-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                  Chưa có đơn thuốc nào trong danh mục này.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder?.(order)}
                  className="even:bg-slate-50/70 hover:bg-slate-100/60 transition cursor-pointer"
                >
                  <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-xs">
                    <span className="font-bold text-teal-900 block">{order.id}</span>
                    <span className="text-slate-400 text-[11px]">{order.prescribedAt}</span>
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <div className="font-bold text-slate-900">{order.patientName}</div>
                    <div className="text-slate-500 text-xs">
                      {order.patientId} • CCCD: <span className="font-mono">{order.patientCccd}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-xs mr-1">
                      {order.diagnosisIcd10}
                    </span>
                    <span className="text-slate-700 text-xs">{order.diagnosisText}</span>
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                          order.prescriptionType === 'outpatient'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {order.prescriptionType === 'outpatient' ? 'Ngoại trú' : 'Nội trú'}
                      </span>
                      {order.isChronicDisease && (
                        <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                          Mạn tính ({order.daysPrescribed} ngày)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <div className="space-y-0.5">
                      {order.items.map((it) => (
                        <div key={it.id} className="text-xs text-slate-800 flex items-center justify-between gap-1">
                          <span>• <strong>{it.medicationName}</strong>: {it.quantity} {it.unit}</span>
                          {onOpenSafetyGuide && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenSafetyGuide(it.medicationName); }}
                              className="text-teal-700 hover:text-teal-900 text-[10.5px] font-bold underline cursor-pointer shrink-0"
                              title="Tra cứu thông tin thuốc & Dược thư"
                            >
                              Thông tin thuốc
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{order.doctorName}</span>
                    </div>
                    {onOpenAdvice && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenAdvice(order); }}
                        className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-2xs font-bold cursor-pointer transition shadow-2xs"
                        title="Dặn dò uống thuốc hàng ngày & gửi mail qua Google Script"
                      >
                        <Clock className="w-3 h-3 text-teal-700" />
                        <span>Dặn dò & Nhắc thuốc</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
