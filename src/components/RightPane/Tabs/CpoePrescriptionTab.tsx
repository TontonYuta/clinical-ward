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
import { PrescriptionAdviceModal } from '../../Modals/PrescriptionAdviceModal';

interface CpoePrescriptionTabProps {
  doctorName?: string;
  currentUserRole?: UserRole;
  onOpenSafetyGuide?: (medName?: string) => void;
}

export const CpoePrescriptionTab: React.FC<CpoePrescriptionTabProps> = ({
  doctorName = 'BS. Trần Văn Hùng',
  currentUserRole = 'doctor',
  onOpenSafetyGuide,
}) => {
  const [orders, setOrders] = useState<PrescriptionOrder[]>(() => {
    try {
      const cached = localStorage.getItem('clinical_cached_cpoe');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PRESCRIPTIONS;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adviceOrder, setAdviceOrder] = useState<PrescriptionOrder | null>(null);

  const canPrescribe = currentUserRole === 'doctor' || currentUserRole === 'director';
  const roleName = USER_PROFILES[currentUserRole]?.roleName || 'Điều Dưỡng';

  useEffect(() => {
    let isMounted = true;
    cpoeApi.fetchCpoeOrders()
      .then((live) => {
        if (isMounted && live && live.length > 0) {
          setOrders(live);
          try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(live)); } catch {}
        }
      })
      .catch((err) => console.warn('CPOE API offline:', err));

    const handleCpoeCreated = (e: any) => {
      if (e.detail) {
        setOrders((prev) => {
          const next = [e.detail, ...prev];
          try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(next)); } catch {}
          return next;
        });
      }
    };
    window.addEventListener('cpoe_order_created', handleCpoeCreated);
    return () => {
      isMounted = false;
      window.removeEventListener('cpoe_order_created', handleCpoeCreated);
    };
  }, []);

  const handleSaveOrder = (newOrder: PrescriptionOrder) => {
    setOrders((prev) => {
      const next = [newOrder, ...prev];
      try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(next)); } catch {}
      return next;
    });
    cpoeApi.createCpoeOrder(newOrder).catch((err) => console.warn('Could not persist CPOE order:', err));
  };

  const outpatientCount = orders.filter((o) => o.prescriptionType === 'outpatient').length;
  const inpatientCount = orders.filter((o) => o.prescriptionType === 'inpatient_daily').length;

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-2.5 w-full">
      {/* Top Action Bar: Clean & Minimal */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
            Kê đơn thuốc
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Đơn thuốc nội trú theo ngày &amp; đơn thuốc ngoại trú (Thông tư 52/2017 &amp; TT 26/2025/TT-BYT)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenSafetyGuide?.()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer border border-slate-200 shadow-2xs"
            title="Tra cứu Dược thư & Thông tin thuốc"
          >
            <Stethoscope className="w-4 h-4 text-teal-700" />
            <span>Thông tin thuốc</span>
          </button>
          {canPrescribe ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-2xs active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Kê đơn mới</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200">
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Xem ({roleName})</span>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards Summary - Ergonomic 3-col Grid */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-center gap-2 sm:gap-3.5 shadow-2xs text-center sm:text-left">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-500 font-semibold truncate">Tổng số đơn</div>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono">{orders.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-center gap-2 sm:gap-3.5 shadow-2xs text-center sm:text-left">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-500 font-semibold truncate">Đơn ngoại trú</div>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono">{outpatientCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-center gap-2 sm:gap-3.5 shadow-2xs text-center sm:text-left">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-500 font-semibold truncate">Đơn nội trú</div>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono">{inpatientCount}</div>
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      <CpoeOrderList orders={orders} onOpenSafetyGuide={onOpenSafetyGuide} onOpenAdvice={(ord) => setAdviceOrder(ord)} />

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

      {/* Prescription Advice & Daily Medication Schedule Modal */}
      <PrescriptionAdviceModal
        isOpen={!!adviceOrder}
        onClose={() => setAdviceOrder(null)}
        order={adviceOrder}
      />
    </div>
  );
};
