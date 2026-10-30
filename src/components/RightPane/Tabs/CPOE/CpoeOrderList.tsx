/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Danh Sách Đơn Thuốc Bác Sĩ CPOE chuẩn hành chính Kho Dược (<=200 LOC)
 */

import React, { useMemo } from 'react';
import { Eye, FileText } from 'lucide-react';
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
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

function formatDoctorDisplay(name?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (/^(bs[\.:\s]|bác sĩ|dr\.)/i.test(trimmed)) {
    return trimmed;
  }
  return `BS. ${trimmed}`;
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
      // 1. Lọc theo loại đơn
      if (filterType !== 'all' && o.prescriptionType !== filterType) return false;

      // 2. Tìm kiếm từ khóa
      if (!qRaw) return true;

      const idMatch = o.id.toLowerCase().includes(qRaw);
      const nameMatch = o.patientName.toLowerCase().includes(qRaw) || normalizeSearch(o.patientName).includes(qNorm);
      const patientIdMatch = o.patientId.toLowerCase().includes(qRaw);
      const cccdMatch = (o.patientCccd || '').toLowerCase().includes(qRaw);
      const icdMatch = o.diagnosisIcd10.toLowerCase().includes(qRaw);
      const diagMatch = o.diagnosisText.toLowerCase().includes(qRaw) || normalizeSearch(o.diagnosisText).includes(qNorm);
      const docMatch = o.doctorName.toLowerCase().includes(qRaw) || normalizeSearch(o.doctorName).includes(qNorm);
      const medMatch = o.items.some(
        (it) =>
          it.medicationName.toLowerCase().includes(qRaw) ||
          normalizeSearch(it.medicationName).includes(qNorm)
      );

      return idMatch || nameMatch || patientIdMatch || cccdMatch || icdMatch || diagMatch || docMatch || medMatch;
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
          <table className="w-full min-w-[1400px] table-fixed text-left text-sm border-collapse">
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col className="w-[24%]" style={{ minWidth: '260px' }} />
              <col className="w-[24%]" style={{ minWidth: '260px' }} />
              <col style={{ width: '140px' }} />
              <col className="w-[32%]" style={{ minWidth: '320px' }} />
              <col style={{ width: '130px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-sm tracking-normal">
                <th className="py-3 px-3 text-center border-r border-slate-200">STT</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Mã đơn &amp; Thời gian</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Người bệnh, CCCD &amp; SĐT</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Chẩn đoán ICD-10</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Loại đơn</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Danh mục thuốc kê</th>
                <th className="py-3 px-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-medium text-sm">
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
                        >
                          {order.id}
                        </button>
                        <div className="text-xs text-slate-500 mt-1 font-mono">{order.prescribedAt}</div>
                      </td>

                      {/* 3. Người bệnh & CCCD */}
                      <td className="py-3 px-3.5 border-r border-slate-100">
                        <button
                          type="button"
                          data-testid="patient-name-btn"
                          onClick={() => onSelectPatient?.(order.patientName)}
                          className="font-semibold text-slate-900 leading-snug hover:text-slate-700 hover:underline cursor-pointer text-left transition underline-offset-2"
                          title="Bấm để xem hồ sơ bệnh nhân, dị ứng và chức năng thận"
                        >
                          {order.patientName}
                        </button>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{order.patientId}</span>
                          <span>·</span>
                          <span>CCCD: {order.patientCccd}</span>
                          {order.patientPhone && (
                            <>
                              <span>·</span>
                              <span className="text-slate-800 font-medium">SĐT: {order.patientPhone}</span>
                            </>
                          )}
                        </div>
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
                      <td className="py-3 px-3.5 border-r border-slate-100">
                        <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed" title={order.items.map(i => `${i.medicationName} (${i.quantity} ${i.unit})`).join(', ')}>
                          {order.items.map((it, iIdx) => (
                            <span key={it.id || iIdx}>
                              {it.medicationName} ({it.quantity} {it.unit})
                              {iIdx < order.items.length - 1 ? '; ' : ''}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* 7. Thao tác */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectOrder?.(order)}
                          className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer active:scale-98 transition shadow-xs"
                          title="Xem chi tiết đơn thuốc điện tử & ký duyệt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
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
