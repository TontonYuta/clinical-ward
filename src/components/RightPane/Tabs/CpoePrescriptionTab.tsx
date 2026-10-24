/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân Hệ Bác Sĩ CPOE: Đơn Thuốc Điện Tử & Kê Đơn Điều Trị (<=200 LOC)
 */

import React, { useState, useEffect } from 'react';
import { Plus, Stethoscope, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PrescriptionOrder } from '../../../types/cpoe';
import { UserRole } from '../../../types/clinical';
import { USER_PROFILES } from '../../../data/initialData';
import { INITIAL_PRESCRIPTIONS } from '../../../data/mockCpoeData';
import { cpoeApi } from '../../../services/api/cpoeApi';
import { CpoeOrderList } from './CPOE/CpoeOrderList';
import { CpoeOrderModal } from './CPOE/CpoeOrderModal';

interface CpoePrescriptionTabProps {
  doctorName?: string;
  currentUserRole?: UserRole;
  onOpenSafetyGuide?: (medName: string) => void;
}

export const CpoePrescriptionTab: React.FC<CpoePrescriptionTabProps> = ({
  doctorName = 'BS. Trần Văn Hùng',
  currentUserRole = 'doctor',
  onOpenSafetyGuide,
}) => {
  const [orders, setOrders] = useState<PrescriptionOrder[]>(INITIAL_PRESCRIPTIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canPrescribe = currentUserRole === 'doctor' || currentUserRole === 'director';
  const roleName = USER_PROFILES[currentUserRole]?.roleName || 'Điều Dưỡng';

  useEffect(() => {
    let isMounted = true;
    cpoeApi.fetchCpoeOrders()
      .then((live) => {
        if (isMounted && live && live.length > 0) setOrders(live);
      })
      .catch((err) => console.warn('CPOE API offline:', err));
    return () => { isMounted = false; };
  }, []);

  const handleSaveOrder = (newOrder: PrescriptionOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    cpoeApi.createCpoeOrder(newOrder).catch((err) => console.warn('Could not persist CPOE order:', err));
  };

  const outpatientCount = orders.filter((o) => o.prescriptionType === 'outpatient').length;
  const inpatientCount = orders.filter((o) => o.prescriptionType === 'inpatient_daily').length;

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Top Action Bar: Clean & Minimal */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
            Kê đơn thuốc điện tử (CPOE)
          </h2>
          <p className="text-xs text-slate-500">
            Đơn thuốc liên thông quốc gia • Cảnh báo an toàn tương tác thuốc
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenSafetyGuide?.('Morphin')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer border border-slate-200 shadow-2xs"
            title="Tra cứu Dược thư & Quy chuẩn 5 Đúng"
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
            <span>Dược thư &amp; 5 Đúng</span>
          </button>
          {canPrescribe ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs transition cursor-pointer shadow-2xs active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Kê đơn mới</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Xem ({roleName})</span>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards Summary - Ergonomic 3-col Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-3 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 shadow-2xs text-center sm:text-left">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <Stethoscope className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Tổng số đơn</div>
            <div className="text-sm sm:text-lg font-bold text-slate-900 font-mono">{orders.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-3 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 shadow-2xs text-center sm:text-left">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Đơn ngoại trú</div>
            <div className="text-sm sm:text-lg font-bold text-slate-900 font-mono">{outpatientCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-3 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 shadow-2xs text-center sm:text-left">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Đơn nội trú</div>
            <div className="text-sm sm:text-lg font-bold text-slate-900 font-mono">{inpatientCount}</div>
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      <CpoeOrderList orders={orders} onOpenSafetyGuide={onOpenSafetyGuide} />

      {/* Prescription Creation Modal */}
      {canPrescribe && (
        <CpoeOrderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaveOrder={handleSaveOrder}
          doctorName={doctorName}
          onOpenSafetyGuide={onOpenSafetyGuide}
        />
      )}
    </div>
  );
};
