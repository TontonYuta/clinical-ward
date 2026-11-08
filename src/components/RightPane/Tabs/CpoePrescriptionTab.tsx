/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân Hệ Bác Sĩ CPOE: Đơn Thuốc Điện Tử & Kê Đơn Điều Trị chuẩn Kho Dược (<=200 LOC)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { PrescriptionOrder } from '../../../types/cpoe';
import { UserRole } from '../../../types/clinical';
import { USER_PROFILES } from '../../../data/initialData';
import { INITIAL_PRESCRIPTIONS } from '../../../data/mockCpoeData';
import { cpoeApi } from '../../../services/api/cpoeApi';
import { CpoeHeaderRibbon } from './CPOE/CpoeHeaderRibbon';
import { CpoeOrderList } from './CPOE/CpoeOrderList';
import { CpoeOrderModal } from './CPOE/CpoeOrderModal';
import { CpoeOrderDetailModal } from './CPOE/CpoeOrderDetailModal';
import { SendSmsModal } from '../../Modals/SendSmsModal';
import { PatientDetailModal } from '../../Modals/PatientDetailModal';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../services/patientService';
import { buildDefaultTimeSlots } from '../../../services/prescriptionAdviceService';

interface CpoePrescriptionTabProps {
  doctorName?: string;
  currentUserRole?: UserRole;
  onOpenSafetyGuide?: (medName?: string) => void;
}

/** Chuẩn hóa an toàn dữ liệu đơn thuốc, chống crash khi bị chỉnh sửa bất thường qua DevTools/Network */
function sanitizeCpoeOrder(raw: any): PrescriptionOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `RX-${Date.now()}`;
  const patientName = typeof raw.patientName === 'string' && raw.patientName.trim() ? raw.patientName.trim() : 'Bệnh nhân chưa định danh';
  const patientId = typeof raw.patientId === 'string' && raw.patientId.trim() ? raw.patientId.trim() : 'BN-0000';
  const diagnosisIcd10 = typeof raw.diagnosisIcd10 === 'string' && raw.diagnosisIcd10.trim() ? raw.diagnosisIcd10.trim() : 'R69';
  const diagnosisText = typeof raw.diagnosisText === 'string' && raw.diagnosisText.trim() ? raw.diagnosisText.trim() : 'Theo dõi điều trị';
  const doctorName = typeof raw.doctorName === 'string' && raw.doctorName.trim() ? raw.doctorName.trim() : 'BS. Trần Văn Hùng';

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map((it: any, idx: number) => ({
    id: typeof it?.id === 'string' ? it.id : `rxi-${idx + 1}`,
    medicationName: typeof it?.medicationName === 'string' && it.medicationName.trim() ? it.medicationName.trim() : 'Thuốc điều trị',
    activeIngredient: typeof it?.activeIngredient === 'string' ? it.activeIngredient : '',
    dosage: typeof it?.dosage === 'string' ? it.dosage : '',
    frequency: typeof it?.frequency === 'string' ? it.frequency : 'Dùng theo chỉ định',
    route: typeof it?.route === 'string' ? it.route : 'Uống',
    quantity: typeof it?.quantity === 'number' && !isNaN(it.quantity) ? it.quantity : 1,
    unit: typeof it?.unit === 'string' && it.unit.trim() ? it.unit.trim() : 'Viên',
    instructions: typeof it?.instructions === 'string' ? it.instructions : '',
    isNarcotic: Boolean(it?.isNarcotic),
    durationDays: typeof it?.durationDays === 'number' ? it.durationDays : undefined,
  }));

  return {
    ...raw,
    id,
    patientName,
    patientId,
    patientCccd: typeof raw.patientCccd === 'string' ? raw.patientCccd : '',
    diagnosisIcd10,
    diagnosisText,
    doctorName,
    prescriptionType: raw.prescriptionType === 'inpatient_daily' ? 'inpatient_daily' : 'outpatient',
    items,
    status: raw.status || 'signed',
  };
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed
            .map(sanitizeCpoeOrder)
            .filter((o): o is PrescriptionOrder => o !== null && (o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604'));
          if (sanitized.length > 0) {
            return sanitized;
          }
        }
      }
    } catch {
      try { localStorage.removeItem('clinical_cached_cpoe'); } catch {}
    }
    return INITIAL_PRESCRIPTIONS;
  });

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adviceOrder, setAdviceOrder] = useState<PrescriptionOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PrescriptionOrder | null>(null);
  const [selectedPatientForDetail, setSelectedPatientForDetail] = useState<string | null>(null);

  const canPrescribe = currentUserRole === 'doctor' || currentUserRole === 'director';
  const roleName = USER_PROFILES[currentUserRole]?.roleName || 'Điều Dưỡng';

  useEffect(() => {
    let isMounted = true;
    cpoeApi.fetchCpoeOrders()
      .then((live) => {
        if (isMounted && Array.isArray(live) && live.length > 0) {
          const validLive = live.map(sanitizeCpoeOrder).filter((o): o is PrescriptionOrder => o !== null);
          setOrders((prev) => {
            const liveIds = new Set(validLive.map((o) => o.id));
            const enrichedLive = validLive.map((o) => {
              if (!o.patientPhone) {
                const p = findPatientByNameOrQuery(o.patientName, INITIAL_PATIENTS);
                if (p?.phone) {
                  return { ...o, patientPhone: p.phone, patientEmail: o.patientEmail || p.email };
                }
              }
              return o;
            });
            const localOnly = (prev || []).filter(
              (o) => !liveIds.has(o.id) && (o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604')
            );
            const merged = [...localOnly, ...enrichedLive]
              .map(sanitizeCpoeOrder)
              .filter((o): o is PrescriptionOrder => o !== null)
              .filter((o, idx, arr) => arr.findIndex((item) => item.id === o.id) === idx)
              .filter((o) => o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604');
            try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      })
      .catch((err) => console.warn('CPOE API offline:', err));

    const handleCpoeCreated = (e: any) => {
      const sanitized = sanitizeCpoeOrder(e?.detail);
      if (sanitized) {
        setOrders((prev) => {
          const next = [sanitized, ...(prev || []).filter((o) => o.id !== sanitized.id)];
          try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(next)); } catch {}
          return next;
        });
      }
    };

    const handleOpenCpoeModal = () => {
      setIsModalOpen(true);
    };

    const handleOpenAdviceModal = (e: any) => {
      const targetOrder = e?.detail?.order || INITIAL_PRESCRIPTIONS[0];
      setAdviceOrder(targetOrder);
    };

    if (sessionStorage.getItem('trigger_open_cpoe_modal') === 'true') {
      sessionStorage.removeItem('trigger_open_cpoe_modal');
      setIsModalOpen(true);
    }
    if (sessionStorage.getItem('trigger_open_advice_modal') === 'true') {
      sessionStorage.removeItem('trigger_open_advice_modal');
      setAdviceOrder(INITIAL_PRESCRIPTIONS[0]);
    }

    window.addEventListener('cpoe_order_created', handleCpoeCreated);
    window.addEventListener('open_cpoe_prescription_modal', handleOpenCpoeModal);
    window.addEventListener('open_prescription_advice_modal', handleOpenAdviceModal);
    return () => {
      isMounted = false;
      window.removeEventListener('cpoe_order_created', handleCpoeCreated);
      window.removeEventListener('open_cpoe_prescription_modal', handleOpenCpoeModal);
      window.removeEventListener('open_prescription_advice_modal', handleOpenAdviceModal);
    };
  }, []);

  const handleSaveOrder = async (newOrder: PrescriptionOrder) => {
    // Persist first. A server DDI rejection must never look like a saved order locally.
    const saved = await cpoeApi.createCpoeOrder(newOrder);
    setOrders((prev) => {
      const next = [saved, ...prev.filter((o) => o.id !== saved.id)];
      try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(next)); } catch {}
      return next;
    });
    setFilterType('all');
    setSearchQuery('');
    try { sessionStorage.setItem('cpoe_filter_type', 'all'); sessionStorage.setItem('cpoe_search_query', ''); } catch {}
  };

  const outpatientCount = useMemo(() => orders.filter((o) => o.prescriptionType === 'outpatient').length, [orders]);
  const inpatientCount = useMemo(() => orders.filter((o) => o.prescriptionType === 'inpatient_daily').length, [orders]);

  return (
    <div className="flex flex-col h-full overflow-hidden gap-1.5 w-full">
      <CpoeHeaderRibbon
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        totalCount={orders.length}
        outpatientCount={outpatientCount}
        inpatientCount={inpatientCount}
        canPrescribe={canPrescribe}
        roleName={roleName}
        onOpenSafetyGuide={() => onOpenSafetyGuide?.()}
        onOpenNewPrescription={() => setIsModalOpen(true)}
      />

      <CpoeOrderList
        orders={orders}
        searchQuery={searchQuery}
        filterType={filterType}
        onSelectOrder={(order) => setSelectedOrder(order)}
        onOpenSafetyGuide={(medName) => onOpenSafetyGuide?.(medName)}
        onOpenAdvice={(order) => setAdviceOrder(order)}
        onSelectPatient={(name) => setSelectedPatientForDetail(name)}
      />

      {/* Modal Kê Đơn Thuốc Mới */}
      <CpoeOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveOrder={handleSaveOrder}
        doctorName={doctorName}
        onOpenSafetyGuide={onOpenSafetyGuide}
      />

      {/* Modal Xem Chi Tiết Đơn Thuốc & Ký Số */}
      <CpoeOrderDetailModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        onOpenSafetyGuide={onOpenSafetyGuide}
        onOpenAdvice={(order) => {
          setSelectedOrder(null);
          setAdviceOrder(order);
        }}
        onSelectPatient={(name) => setSelectedPatientForDetail(name)}
        onOrderUpdated={(updated) => {
          setOrders((prev) => {
            const next = prev.map((o) => (o.id === updated.id ? updated : o));
            try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(next)); } catch {}
            return next;
          });
          setSelectedOrder(updated);
        }}
      />

      {/* Modal Phát Tin Thông Báo & Dặn Dò Bệnh Nhân Chuẩn Workstation TT 26/2025/TT-BYT (Dual-Zone) */}
      {adviceOrder && (
        <SendSmsModal
          isOpen={!!adviceOrder}
          onClose={() => setAdviceOrder(null)}
          patientName={adviceOrder.patientName}
          patientPhone={adviceOrder.patientPhone || findPatientByNameOrQuery(adviceOrder.patientName.toLowerCase(), INITIAL_PATIENTS)?.phone}
          patientEmail={adviceOrder.patientEmail || findPatientByNameOrQuery(adviceOrder.patientName.toLowerCase(), INITIAL_PATIENTS)?.email}
          patientId={adviceOrder.patientId}
          orderId={adviceOrder.id}
          doctorName={adviceOrder.doctorName}
          diagnosis={adviceOrder.diagnosisText}
          medications={(adviceOrder.items || []).map((it, i) => ({
            id: `sched-${i}`,
            medicationName: it.medicationName,
            activeIngredient: it.activeIngredient,
            dosage: it.dosage,
            route: it.route || 'Đường uống',
            durationDays: adviceOrder.daysPrescribed || 7,
            specialInstructions: it.instructions || undefined,
            timeSlots: buildDefaultTimeSlots(it.frequency)
          }))}
        />
      )}

      {/* Modal Chi Tiết Bệnh Nhân & An Toàn Lâm Sàng Chuẩn Kho Dược */}
      <PatientDetailModal
        isOpen={!!selectedPatientForDetail}
        onClose={() => setSelectedPatientForDetail(null)}
        patientIdOrName={selectedPatientForDetail || ''}
        onOpenPrescriptionOrder={() => {
          setSelectedPatientForDetail(null);
          setIsModalOpen(true);
        }}
      />
    </div>
  );
};
