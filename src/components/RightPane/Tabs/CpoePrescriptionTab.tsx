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
import { PrescriptionAdviceModal } from '../../Modals/PrescriptionAdviceModal';
import { PatientDetailModal } from '../../Modals/PatientDetailModal';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../services/patientService';

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
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((o: any) => o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604');
        }
      }
    } catch {}
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
        if (isMounted && live && live.length > 0) {
          setOrders((prev) => {
            const liveIds = new Set(live.map((o) => o.id));
            const enrichedLive = live.map((o) => {
              if (!o.patientPhone) {
                const p = findPatientByNameOrQuery(o.patientName, INITIAL_PATIENTS);
                if (p?.phone) {
                  return { ...o, patientPhone: p.phone, patientEmail: o.patientEmail || p.email };
                }
              }
              return o;
            });
            const localOnly = prev.filter(
              (o) => !liveIds.has(o.id) && (o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604')
            );
            const merged = [...localOnly, ...enrichedLive]
              .filter((o, idx, arr) => arr.findIndex((item) => item.id === o.id) === idx)
              .filter((o) => o.patientName !== 'Trần Huy Hoàng' || o.id === 'RX-2026-604');
            try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      })
      .catch((err) => console.warn('CPOE API offline:', err));

    const handleCpoeCreated = (e: any) => {
      if (e.detail) {
        setOrders((prev) => {
          const next = [e.detail, ...prev.filter((o) => o.id !== e.detail.id)];
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
      />

      {/* Modal Hướng Dẫn Dặn Dò Bệnh Nhân */}
      <PrescriptionAdviceModal
        isOpen={!!adviceOrder}
        onClose={() => setAdviceOrder(null)}
        order={adviceOrder}
      />

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
