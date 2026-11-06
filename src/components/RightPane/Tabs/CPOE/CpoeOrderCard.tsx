import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { prescriptionState } from '../../../ui/workspaceStatus';
import { PrescriptionOrder } from '../../../../types/cpoe';
interface CpoeOrderCardProps {
  index: number;
  order: PrescriptionOrder;
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
}
export const CpoeOrderCard: React.FC<CpoeOrderCardProps> = ({
  order,
  onSelectOrder,
  onSelectPatient,
}) => (
  <article className="mobile-record" data-testid="cpoe-order-card" data-workspace-record>
    <div className="mobile-record-heading">
      <div>
        <button
          type="button"
          className="record-link"
          data-testid="patient-name-btn"
          onClick={() => onSelectPatient?.(order.patientId)}
        >
          {order.patientName || 'Chưa ghi nhận'}
        </button>
        <span className="record-sub record-mono">
          {order.patientId} · {order.diagnosisIcd10}
        </span>
      </div>
      <span className={`status-pill ${prescriptionState(order).tone}`}>
        {prescriptionState(order).label}
      </span>
    </div>
    <p className="record-sub mt-3">{order.diagnosisText || 'Chưa ghi nhận chẩn đoán'}</p>
    <div className="mobile-record-meta">
      <div>
        <button
          type="button"
          className="record-link record-mono"
          data-testid="cpoe-order-id-btn"
          onClick={() => onSelectOrder?.(order)}
        >
          {order.id}
        </button>
        <span className="record-sub">
          {order.prescriptionType === 'outpatient' ? 'Ngoại trú' : 'Nội trú'} · {order.items.length}{' '}
          thuốc · {order.prescribedAt}
        </span>
      </div>
      <button
        type="button"
        className="icon-action shrink-0"
        aria-label={`Xem đơn ${order.id}`}
        onClick={() => onSelectOrder?.(order)}
      >
        <ArrowUpRight size={17} />
      </button>
    </div>
  </article>
);
