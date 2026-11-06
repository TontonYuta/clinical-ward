/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân Hệ Bác Sĩ CPOE: Đơn Thuốc Điện Tử & Kê Đơn Điều Trị chuẩn Kho Dược (<=200 LOC)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PrescriptionOrder } from '../../../types/cpoe';
import { UserRole } from '../../../types/clinical';
import { USER_PROFILES } from '../../../data/initialData';
import type { PatientProfile } from '../../../services/patientService';
import { cpoeApi } from '../../../services/api/cpoeApi';
import { CpoeHeaderRibbon } from './CPOE/CpoeHeaderRibbon';
import { CpoeOrderList } from './CPOE/CpoeOrderList';
import { CpoeOrderModal } from './CPOE/CpoeOrderModal';
import { CpoeOrderDetailModal } from './CPOE/CpoeOrderDetailModal';
import { PrescriptionAdviceModal } from '../../Modals/PrescriptionAdviceModal';
import { PatientDetailModal } from '../../Modals/PatientDetailModal';

interface CpoePrescriptionTabProps {
  patients?: PatientProfile[];
  doctorName?: string;
  currentUserRole?: UserRole;
  onOpenSafetyGuide?: (medName?: string) => void;
}

/** Chuẩn hóa an toàn dữ liệu đơn thuốc, chống crash khi bị chỉnh sửa bất thường qua DevTools/Network */
function sanitizeCpoeOrder(raw: any): PrescriptionOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const id = raw.id.trim();
  const patientName = typeof raw.patientName === 'string' ? raw.patientName.trim() : '';
  const patientId = typeof raw.patientId === 'string' ? raw.patientId.trim() : '';
  const diagnosisIcd10 = typeof raw.diagnosisIcd10 === 'string' ? raw.diagnosisIcd10.trim() : '';
  const diagnosisText = typeof raw.diagnosisText === 'string' ? raw.diagnosisText.trim() : '';
  const doctorName = typeof raw.doctorName === 'string' ? raw.doctorName.trim() : '';

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map((it: any, idx: number) => ({
    id: typeof it?.id === 'string' ? it.id : `rxi-${idx + 1}`,
    medicationName: typeof it?.medicationName === 'string' ? it.medicationName.trim() : '',
    activeIngredient: typeof it?.activeIngredient === 'string' ? it.activeIngredient : '',
    dosage: typeof it?.dosage === 'string' ? it.dosage : '',
    frequency: typeof it?.frequency === 'string' ? it.frequency : '',
    route: typeof it?.route === 'string' ? it.route : '',
    quantity: typeof it?.quantity === 'number' && Number.isFinite(it.quantity) ? it.quantity : 0,
    unit: typeof it?.unit === 'string' ? it.unit.trim() : '',
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
    status: raw.status || 'draft',
  };
}

export const CpoePrescriptionTab: React.FC<CpoePrescriptionTabProps> = ({
  patients = [],
  doctorName = 'BS. Trần Văn Hùng',
  currentUserRole = 'doctor',
  onOpenSafetyGuide,
}) => {
  const [orders, setOrders] = useState<PrescriptionOrder[]>(() => {
    try {
      const cached = localStorage.getItem('clinical_cached_cpoe');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map(sanitizeCpoeOrder)
            .filter((o): o is PrescriptionOrder => o !== null);
          return sanitized;
        }
      }
    } catch {
      try { localStorage.removeItem('clinical_cached_cpoe'); } catch {}
    }
    return [];
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
  const [adviceError, setAdviceError] = useState('');
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const canPrescribe = currentUserRole === 'doctor';
  const roleName = USER_PROFILES[currentUserRole]?.roleName || 'Điều Dưỡng';

  useEffect(() => {
    let isMounted = true;
    cpoeApi.fetchCpoeOrders()
      .then((live) => {
        if (isMounted && Array.isArray(live)) {
          const validLive = live.map(sanitizeCpoeOrder)
            .filter((o): o is PrescriptionOrder => o !== null)
            .filter((o, index, all) => all.findIndex(candidate => candidate.id === o.id) === index);
          setOrders(validLive);
          try { localStorage.setItem('clinical_cached_cpoe', JSON.stringify(validLive)); } catch {}
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
      if (canPrescribe) setIsModalOpen(true);
    };

    const handleOpenAdviceModal = (e: any) => {
      const orderId = e?.detail?.order?.id || e?.detail?.orderId || e?.detail?.prescriptionId;
      const targetOrder = ordersRef.current.find(order => order.id === orderId);
      if (targetOrder) {
        setAdviceError('');
        setAdviceOrder(targetOrder);
      } else {
        setAdviceError('Chọn một đơn thuốc cụ thể và kiểm tra người nhận trước khi mở phiếu dặn dò.');
      }
    };

    if (canPrescribe && sessionStorage.getItem('trigger_open_cpoe_modal') === 'true') {
      sessionStorage.removeItem('trigger_open_cpoe_modal');
      setIsModalOpen(true);
    }
    if (sessionStorage.getItem('trigger_open_advice_modal') === 'true') {
      sessionStorage.removeItem('trigger_open_advice_modal');
      setAdviceError('Chọn một đơn thuốc cụ thể và kiểm tra người nhận trước khi mở phiếu dặn dò.');
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
  }, [canPrescribe]);

  useEffect(() => { if (!canPrescribe) setIsModalOpen(false); }, [canPrescribe]);

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
    <div className="workspace-page">
      {adviceError && <p role="alert" className="px-4 py-3 border border-amber-300 bg-amber-50 text-amber-950 text-sm">{adviceError}</p>}
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
        patients={patients}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveOrder={handleSaveOrder}
        doctorName={doctorName}
        onOpenSafetyGuide={onOpenSafetyGuide}
      />

      {/* Modal Xem Chi Tiết Đơn Thuốc & Ký Số */}
      <CpoeOrderDetailModal
        patients={patients}
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
        patients={patients}
        isOpen={!!adviceOrder}
        onClose={() => setAdviceOrder(null)}
        order={adviceOrder}
      />

      {/* Modal Chi Tiết Bệnh Nhân & An Toàn Lâm Sàng Chuẩn Kho Dược */}
      <PatientDetailModal
        patients={patients}
        isOpen={!!selectedPatientForDetail}
        onClose={() => setSelectedPatientForDetail(null)}
        patientIdOrName={selectedPatientForDetail || ''}
        onOpenPrescriptionOrder={canPrescribe ? () => {
          setSelectedPatientForDetail(null);
          setIsModalOpen(true);
        } : undefined}
      />
    </div>
  );
};
