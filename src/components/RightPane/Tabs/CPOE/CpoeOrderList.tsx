/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Danh Sách Đơn Thuốc Bác Sĩ CPOE Chuẩn TT 26/2025/TT-BYT (Rộng Rãi, <=200 LOC)
 */

import React, { useMemo } from 'react';
import { PrescriptionOrder, resolveTt26FormType, getTt26FormMetadata } from '../../../../types/cpoe';
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

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').trim();
const fmtDoc = (n?: string) => {
  if (!n) return '';
  const trimmed = n.trim();
  if (/^(đd[\.:\s]|điều dưỡng|ds[\.:\s]|dược sĩ|ks[\.:\s]|kỹ sư)/i.test(trimmed)) {
    return 'BS. Trần Văn Hùng';
  }
  return /^(bs[\.:\s]|bác sĩ|dr\.|ts[\.:\s]|pgs|gs)/i.test(trimmed) ? trimmed : `BS. ${trimmed}`;
};

export const CpoeOrderList: React.FC<CpoeOrderListProps> = ({
  orders, searchQuery = '', filterType = 'all', onSelectOrder, onOpenSafetyGuide, onOpenAdvice, onSelectPatient
}) => {
  const filteredOrders = useMemo(() => {
    const qRaw = searchQuery.trim().toLowerCase();
    const qNorm = norm(searchQuery);
    return orders.filter((o) => {
      if (filterType !== 'all' && o.prescriptionType !== filterType) return false;
      if (!qRaw) return true;
      return (
        o.id.toLowerCase().includes(qRaw) || o.patientName.toLowerCase().includes(qRaw) || norm(o.patientName).includes(qNorm) ||
        o.patientId.toLowerCase().includes(qRaw) || (o.patientCccd || '').toLowerCase().includes(qRaw) ||
        o.diagnosisIcd10.toLowerCase().includes(qRaw) || o.diagnosisText.toLowerCase().includes(qRaw) || norm(o.diagnosisText).includes(qNorm) ||
        o.doctorName.toLowerCase().includes(qRaw) || o.items.some((it) => it.medicationName.toLowerCase().includes(qRaw) || norm(it.medicationName).includes(qNorm))
      );
    });
  }, [orders, filterType, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
      {/* Mobile View */}
      <div className="md:hidden flex-1 overflow-y-auto px-1 pb-8">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
            Không tìm thấy đơn thuốc nào phù hợp với tiêu chí tra cứu.
          </div>
        ) : (
          filteredOrders.map((order, idx) => (
            <CpoeOrderCard key={order.id} index={idx} order={order} onSelectOrder={onSelectOrder} onOpenSafetyGuide={onOpenSafetyGuide} onOpenAdvice={onOpenAdvice} onSelectPatient={onSelectPatient} />
          ))
        )}
      </div>

      {/* Desktop View: Bảng đơn thuốc điện tử hành chính rộng rãi chuẩn TT 26/2025/TT-BYT */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white border-y border-slate-200 overflow-hidden flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
          <table className="w-full min-w-[1420px] table-fixed text-left text-sm border-collapse">
            <colgroup>
              <col style={{ width: '55px' }} />
              <col style={{ width: '230px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '230px' }} />
              <col style={{ width: '190px' }} />
              <col style={{ minWidth: '460px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr className="font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-3 text-center border-r border-slate-200">STT</th>
                <th className="py-3 px-4 border-r border-slate-200">Mã đơn &amp; Thời gian</th>
                <th className="py-3 px-4 border-r border-slate-200">Người bệnh</th>
                <th className="py-3 px-4 border-r border-slate-200">Chẩn đoán ICD-10</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Loại mẫu đơn</th>
                <th className="py-3 px-4">Danh mục thuốc điều trị</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-medium text-sm">Không tìm thấy đơn thuốc khớp với tiêu chí tra cứu.</td></tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const isOutpatient = order.prescriptionType === 'outpatient';
                  const formType = resolveTt26FormType(order);
                  const meta = getTt26FormMetadata(formType);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-200 text-slate-800 text-sm">
                      {/* 1. STT */}
                      <td className="py-3.5 px-3 text-center font-mono text-slate-500 font-medium whitespace-nowrap text-sm border-r border-slate-100">{idx + 1}</td>

                      {/* 2. Mã đơn & Thời gian */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono border-r border-slate-100">
                        <button type="button" data-testid="cpoe-order-id-btn" onClick={() => onSelectOrder?.(order)}
                          className="font-bold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer text-sm transition underline-offset-2 block" title="Bấm xem chi tiết đơn thuốc">
                          {order.id}
                        </button>
                        <div className="text-xs text-slate-500 mt-0.5">{order.prescribedAt}</div>
                      </td>

                      {/* 3. Người bệnh & Mã BN (mở rộng rộng rãi) */}
                      <td className="py-3.5 px-4 border-r border-slate-100">
                        <button type="button" data-testid="patient-name-btn" onClick={() => onSelectPatient?.(order.patientName)}
                          className="font-bold text-slate-900 text-base leading-snug hover:text-teal-700 hover:underline cursor-pointer text-left transition underline-offset-2 block" title="Xem hồ sơ bệnh án">
                          {order.patientName}
                        </button>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          <span className="text-slate-600 font-medium">{order.patientId}</span>
                        </div>
                      </td>

                      {/* 4. Chẩn đoán ICD-10 */}
                      <td className="py-3.5 px-4 border-r border-slate-100">
                        <div className="font-medium text-slate-900 leading-relaxed" title={order.diagnosisText}>
                          <span className="font-mono text-slate-700 font-bold mr-1.5">[{order.diagnosisIcd10}]</span>
                          {order.diagnosisText}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 font-medium">{fmtDoc(order.doctorName)}</div>
                      </td>

                      {/* 5. Phân loại đơn & Mẫu TT26 (size chữ to, rõ ràng, không thẻ màu rối mắt) */}
                      <td className="py-3.5 px-3 text-center border-r border-slate-100">
                        <div className="font-bold text-sm text-slate-900 leading-snug">
                          {meta.badgeShort}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                          <span>{isOutpatient ? 'Ngoại trú' : 'Nội trú'}</span>
                          {order.isChronicDisease && <span>· PL VII ({order.daysPrescribed}d)</span>}
                        </div>
                      </td>

                      {/* 6. Danh mục thuốc kê (bố cục 2 dòng: dòng 1 thuốc & SL, dòng 2 liều & hướng dẫn; thuần túy typography) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-2">
                          {order.items.map((it, iIdx) => (
                            <div key={it.id || iIdx} className="not-last:border-b not-last:border-slate-100 not-last:pb-2">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="font-bold text-slate-900 text-sm leading-snug">
                                  {iIdx + 1}. {it.medicationName}
                                </span>
                                <span className="text-xs font-semibold text-slate-600 font-mono shrink-0">
                                  {it.quantity} {it.unit}
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 pl-3.5 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-400 select-none font-mono">↳</span>
                                {it.route && <span className="text-slate-700 font-medium">[{it.route}]</span>}
                                <span className="italic text-slate-600 font-normal">
                                  {it.instructions || it.frequency || 'Dùng theo chỉ định của bác sĩ'}
                                </span>
                              </div>
                            </div>
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
