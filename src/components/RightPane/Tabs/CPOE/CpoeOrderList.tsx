/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Danh Sách Đơn Thuốc Bác Sĩ CPOE (<=200 LOC)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Clock, Search, X } from 'lucide-react';
import { PrescriptionOrder } from '../../../../types/cpoe';
import { CpoeOrderCard } from './CpoeOrderCard';

interface CpoeOrderListProps {
  orders: PrescriptionOrder[];
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
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

export const CpoeOrderList: React.FC<CpoeOrderListProps> = ({ orders, onSelectOrder, onOpenSafetyGuide, onOpenAdvice }) => {
  const [filterType, setFilterType] = useState<'all' | 'outpatient' | 'inpatient_daily'>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('cpoe_filter_type') as any) || 'all';
    }
    return 'all';
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('cpoe_search_query') || '';
    }
    return '';
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('cpoe_filter_type', filterType);
      sessionStorage.setItem('cpoe_search_query', searchQuery);
    } catch {}
  }, [filterType, searchQuery]);

  const outpatientCount = useMemo(() => orders.filter((o) => o.prescriptionType === 'outpatient').length, [orders]);
  const inpatientCount = useMemo(() => orders.filter((o) => o.prescriptionType === 'inpatient_daily').length, [orders]);

  const filteredOrders = useMemo(() => {
    const qRaw = searchQuery.trim().toLowerCase();
    const qNorm = normalizeSearch(searchQuery);

    return orders.filter((o) => {
      // 1. Lọc theo loại đơn
      if (filterType !== 'all' && o.prescriptionType !== filterType) {
        return false;
      }

      // 2. Lọc theo từ khóa tìm kiếm
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
    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs flex flex-col">
      {/* Table Filters & Search Header */}
      <div className="shrink-0 px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-80 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã đơn, tên BN, CCCD, chẩn đoán, thuốc..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-slate-900 placeholder-slate-400 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5 bg-slate-100 p-1 rounded-md">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                filterType === 'all'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
              }`}
            >
              Tất cả ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('inpatient_daily')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                filterType === 'inpatient_daily'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
              }`}
            >
              🏥 Nội trú ({inpatientCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('outpatient')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                filterType === 'outpatient'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
              }`}
            >
              🏪 Ngoại trú ({outpatientCount})
            </button>
          </div>
        </div>

        {searchQuery && (
          <div className="text-xs text-slate-500 font-medium shrink-0">
            Tìm thấy <strong className="text-slate-900 font-bold">{filteredOrders.length}</strong> kết quả
          </div>
        )}
      </div>

      {/* Mobile Card List (md:hidden) */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2 pb-8">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs sm:text-sm italic space-y-2">
            <div>Không tìm thấy đơn thuốc nào phù hợp với bộ lọc hiện tại.</div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-teal-700 font-bold text-xs underline cursor-pointer"
              >
                Xóa từ khóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <CpoeOrderCard key={order.id} order={order} onSelectOrder={onSelectOrder} onOpenSafetyGuide={onOpenSafetyGuide} onOpenAdvice={onOpenAdvice} />
          ))
        )}
      </div>

      {/* Desktop Orders Table with Horizontal & Vertical Scroll */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-x-auto overflow-y-auto w-full">
        <table className="w-full min-w-[1150px] text-left text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-700 shadow-2xs">
            <tr>
              <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">Mã đơn</th>
              <th className="py-3 px-3.5 border-r border-slate-200">Người bệnh</th>
              <th className="py-3 px-3.5 border-r border-slate-200">Chẩn đoán</th>
              <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">Loại đơn</th>
              <th className="py-3 px-3.5 border-r border-slate-200">Thuốc</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-medium italic text-sm">
                  <div className="space-y-1.5">
                    <div>Không tìm thấy đơn thuốc nào phù hợp với điều kiện tìm kiếm.</div>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-teal-700 font-bold text-xs underline cursor-pointer"
                      >
                        Xóa từ khóa tìm kiếm "{searchQuery}"
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder?.(order)}
                  className="even:bg-slate-50/70 hover:bg-slate-100/60 transition cursor-pointer"
                >
                  <td className="py-3 px-3.5 border-r border-slate-200 font-mono">
                    <span className="font-bold text-teal-900 block text-xs sm:text-sm">{order.id}</span>
                    <span className="text-slate-500 font-mono text-xs mt-1 block">{order.prescribedAt}</span>
                  </td>
                  <td className="py-3 px-3.5 border-r border-slate-200">
                    <div className="font-bold text-slate-900 text-sm sm:text-base">{order.patientName}</div>
                    <div className="text-slate-600 text-xs sm:text-sm font-medium mt-0.5">
                      {order.patientId} • CCCD: <span className="font-mono">{order.patientCccd}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 border-r border-slate-200">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-200 text-slate-900 font-mono font-bold text-xs sm:text-sm mr-1.5">
                      {order.diagnosisIcd10}
                    </span>
                    <span className="text-slate-800 text-xs sm:text-sm font-medium">{order.diagnosisText}</span>
                  </td>
                  <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs sm:text-sm font-bold ${
                          order.prescriptionType === 'outpatient'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {order.prescriptionType === 'outpatient' ? 'Ngoại trú' : 'Nội trú'}
                      </span>
                      {order.isChronicDisease && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900">
                          Mạn tính ({order.daysPrescribed} ngày)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3.5 border-r border-slate-200">
                    <div className="space-y-1">
                      {order.items.map((it) => (
                        <div key={it.id} className="text-xs sm:text-sm text-slate-800 font-medium flex items-center justify-between gap-1.5">
                          <span>• <strong className="font-bold text-slate-900">{it.medicationName}</strong>: {it.quantity} {it.unit}</span>
                          {onOpenSafetyGuide && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenSafetyGuide(it.medicationName); }}
                              className="text-teal-700 hover:text-teal-900 text-xs font-bold underline cursor-pointer shrink-0 ml-2"
                              title="Tra cứu thông tin thuốc & Dược thư"
                            >
                              Thông tin thuốc
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{order.doctorName}</span>
                    </div>
                    {onOpenAdvice && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenAdvice(order); }}
                        className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold cursor-pointer transition shadow-2xs"
                        title="Dặn dò uống thuốc hàng ngày & gửi mail qua Google Script"
                      >
                        <Clock className="w-3.5 h-3.5 text-teal-700" />
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
