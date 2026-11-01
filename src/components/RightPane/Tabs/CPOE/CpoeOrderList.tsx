/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Danh Sách Đơn Thuốc Bác Sĩ CPOE chuẩn hành chính Kho Dược (<=200 LOC)
 */

import React, { useMemo } from 'react';
import { PrescriptionOrder } from '../../../../types/cpoe';
import { CpoeOrderCard } from './CpoeOrderCard';

interface CpoeOrderListProps {
  orders: PrescriptionOrder[];
  searchQuery?: string;
  filterType?: 'all' | 'outpatient' | 'inpatient_daily';
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
}

function normalizeSearch(str: string): string {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').trim();
}

function formatDoctorDisplay(name?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  return /^(bs[\.:\s]|bác sĩ|dr\.)/i.test(trimmed) ? trimmed : `BS. ${trimmed}`;
}

export const CpoeOrderList: React.FC<CpoeOrderListProps> = ({
  orders,
  searchQuery = '',
  filterType = 'all',
  onSelectOrder,
  onOpenSafetyGuide,
  onOpenAdvice,
  onSelectPatient,
}) => {
  const filteredOrders = useMemo(() => {
    const qRaw = searchQuery.trim().toLowerCase();
    const qNorm = normalizeSearch(searchQuery);

    return orders.filter((o) => {
      if (filterType !== 'all' && o.prescriptionType !== filterType) return false;
      if (!qRaw) return true;

      return (
        o.id.toLowerCase().includes(qRaw) ||
        o.patientName.toLowerCase().includes(qRaw) || normalizeSearch(o.patientName).includes(qNorm) ||
        o.patientId.toLowerCase().includes(qRaw) ||
        (o.patientCccd || '').toLowerCase().includes(qRaw) ||
        o.diagnosisIcd10.toLowerCase().includes(qRaw) ||
        o.diagnosisText.toLowerCase().includes(qRaw) || normalizeSearch(o.diagnosisText).includes(qNorm) ||
        o.doctorName.toLowerCase().includes(qRaw) || normalizeSearch(o.doctorName).includes(qNorm) ||
        o.items.some((it) => it.medicationName.toLowerCase().includes(qRaw) || normalizeSearch(it.medicationName).includes(qNorm))
      );
    });
  }, [orders, filterType, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
      {/* Mobile View: Danh sách phẳng hành chính */}
      <div className="md:hidden flex-1 overflow-y-auto px-1 pb-8">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
            Không tìm thấy đơn thuốc nào phù hợp với tiêu chí tra cứu.
          </div>
        ) : (
          filteredOrders.map((order, idx) => (
            <CpoeOrderCard
              key={order.id}
              index={idx}
              order={order}
              onSelectOrder={onSelectOrder}
              onOpenSafetyGuide={onOpenSafetyGuide}
              onOpenAdvice={onOpenAdvice}
              onSelectPatient={onSelectPatient}
            />
          ))
        )}
      </div>

      {/* Desktop View: Bảng đơn thuốc điện tử hành chính (Chuẩn TT 26/2025/TT-BYT) */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white border-y border-slate-200 overflow-hidden flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
          <table className="w-full min-w-[1150px] table-fixed text-left text-sm border-collapse">
            <colgroup>
              <col style={{ width: '50px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '180px' }} />
              <col className="w-[32%]" style={{ minWidth: '260px' }} />
              <col style={{ width: '120px' }} />
              <col className="w-[48%]" style={{ minWidth: '380px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-sm tracking-normal">
                <th className="py-3 px-3 text-center border-r border-slate-200">STT</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Mã đơn &amp; Thời gian</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Người bệnh</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Chẩn đoán ICD-10</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Loại đơn</th>
                <th className="py-3 px-3.5">Danh mục thuốc kê</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium text-sm">
                    Không tìm thấy đơn thuốc khớp với tiêu chí tra cứu.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const isOutpatient = order.prescriptionType === 'outpatient';
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50 transition-colors border-b border-slate-200 text-slate-800 text-sm"
                    >
                      {/* 1. STT */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 font-medium whitespace-nowrap text-sm border-r border-slate-100">
                        {idx + 1}
                      </td>

                      {/* 2. Mã đơn & Thời gian */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono border-r border-slate-100">
                        <button
                          type="button"
                          data-testid="cpoe-order-id-btn"
                          onClick={() => onSelectOrder?.(order)}
                          className="font-medium text-slate-700 hover:text-slate-950 hover:underline cursor-pointer text-sm transition underline-offset-2"
                          title="Bấm để xem chi tiết đơn thuốc điện tử & ký duyệt"
                        >
                          {order.id}
                        </button>
                        <div className="text-xs text-slate-500 mt-1 font-mono">{order.prescribedAt}</div>
                      </td>

                      {/* 3. Người bệnh & Mã BN */}
                      <td className="py-3 px-3.5 border-r border-slate-100">
                        <button
                          type="button"
                          data-testid="patient-name-btn"
                          onClick={() => onSelectPatient?.(order.patientName)}
                          className="font-semibold text-slate-900 leading-snug hover:text-slate-700 hover:underline cursor-pointer text-left transition underline-offset-2 block"
                          title="Bấm để xem hồ sơ bệnh nhân, dị ứng và chức năng thận"
                        >
                          {order.patientName}
                        </button>
                        <span className="text-xs text-slate-500 font-mono mt-0.5 inline-block">
                          {order.patientId}
                        </span>
                      </td>

                      {/* 4. Chẩn đoán ICD-10 */}
                      <td className="py-3 px-3.5 border-r border-slate-100">
                        <div className="font-medium text-slate-900 leading-snug" title={order.diagnosisText}>
                          <span className="font-mono text-slate-700 font-semibold">[{order.diagnosisIcd10}]</span> {order.diagnosisText}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="text-slate-700">{formatDoctorDisplay(order.doctorName)}</span>
                        </div>
                      </td>

                      {/* 5. Phân loại đơn */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap border-r border-slate-100">
                        <span className={`text-xs font-semibold ${isOutpatient ? 'text-slate-700' : 'text-slate-900'}`}>
                          {isOutpatient ? 'Ngoại trú' : 'Nội trú'}
                        </span>
                        {order.isChronicDisease && (
                          <div className="text-2xs font-semibold text-amber-800 mt-0.5">
                            Mạn ({order.daysPrescribed}d)
                          </div>
                        )}
                      </td>

                      {/* 6. Danh mục thuốc kê */}
                      <td className="py-3 px-3.5">
                        <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed" title={order.items.map(i => `${i.medicationName} (${i.quantity} ${i.unit})`).join(', ')}>
                          {order.items.map((it, iIdx) => (
                            <span key={it.id || iIdx}>
                              {it.medicationName} ({it.quantity} {it.unit})
                              {iIdx < order.items.length - 1 ? '; ' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
