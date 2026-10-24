/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân Hệ Bác Sĩ CPOE: Đơn Thuốc Điện Tử & Chỉ Định Y Lệnh (<=200 LOC)
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
}

export const CpoePrescriptionTab: React.FC<CpoePrescriptionTabProps> = ({
  doctorName = 'BS. Trần Văn Hùng',
  currentUserRole = 'doctor'
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
    <div className="p-4 sm:p-6 space-y-4">
      {/* Top Banner: Legal Framework & Regulatory Compliance */}
      <div className="bg-slate-900 text-white rounded-lg p-3.5 sm:p-4 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-teal-800 text-teal-100 uppercase tracking-wide border border-teal-700/60">
              TT 26/2025/TT-BYT
            </span>
            <span className="text-xs text-slate-300">Luật Khám bệnh, chữa bệnh 2023</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
            Phân Hệ Chỉ Định &amp; Kê Đơn Điện Tử (CPOE)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Quy tắc 1 đơn thuốc duy nhất khi khám nhiều chuyên khoa • Tích hợp CDSS cảnh báo tương tác thuốc • Áp dụng kê đơn mạn tính tối đa 90 ngày.
          </p>
        </div>

        {/* New Order Button or Read-Only Role Badge */}
        {canPrescribe ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs sm:text-sm transition shrink-0 cursor-pointer shadow-xs active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Kê Đơn / Y Lệnh Mới</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 shrink-0">
            <ShieldAlert className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Xem y lệnh thực hiện ({roleName})</span>
          </div>
        )}
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Tổng Đơn Đã Ban Hành</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono">{orders.length} đơn</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Đơn Ngoại Trú (BHYT)</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono">{outpatientCount} đơn</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Y Lệnh Nội Trú (Ngày)</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono">{inpatientCount} y lệnh</div>
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      <CpoeOrderList orders={orders} />

      {/* Prescription Creation Modal */}
      {canPrescribe && (
        <CpoeOrderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaveOrder={handleSaveOrder}
          doctorName={doctorName}
        />
      )}
    </div>
  );
};
