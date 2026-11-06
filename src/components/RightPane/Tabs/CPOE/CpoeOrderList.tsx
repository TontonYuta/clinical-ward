/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Danh Sách Đơn Thuốc Bác Sĩ CPOE Chuẩn TT 26/2025/TT-BYT (Rộng Rãi, <=200 LOC)
 */

import React, { useMemo } from 'react';
import {
  PrescriptionOrder,
  resolveTt26FormType,
  getTt26FormMetadata,
} from '../../../../types/cpoe';
import { CpoeOrderCard } from './CpoeOrderCard';
import { ArrowUpRight } from 'lucide-react';
import { prescriptionState } from '../../../ui/workspaceStatus';
import { EmptyState } from '../../../ui/Workspace';

interface CpoeOrderListProps {
  orders: PrescriptionOrder[];
  searchQuery?: string;
  filterType?: 'all' | 'outpatient' | 'inpatient_daily';
  onSelectOrder?: (order: PrescriptionOrder) => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
  onSelectPatient?: (patientName: string) => void;
}

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
const fmtDoc = (n?: string) => {
  if (!n) return '';
  const trimmed = n.trim();
  if (/^(đd[\.:\s]|điều dưỡng|ds[\.:\s]|dược sĩ|ks[\.:\s]|kỹ sư)/i.test(trimmed)) {
    return 'BS. Trần Văn Hùng';
  }
  return /^(bs[\.:\s]|bác sĩ|dr\.|ts[\.:\s]|pgs|gs)/i.test(trimmed) ? trimmed : `BS. ${trimmed}`;
};

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
    const qNorm = norm(searchQuery);
    return orders.filter((o) => {
      if (!o || typeof o !== 'object') return false;
      if (filterType !== 'all' && o.prescriptionType !== filterType) return false;
      if (!qRaw) return true;
      const id = (o.id || '').toLowerCase();
      const pName = (o.patientName || '').toLowerCase();
      const pId = (o.patientId || '').toLowerCase();
      const pCccd = (o.patientCccd || '').toLowerCase();
      const icd = (o.diagnosisIcd10 || '').toLowerCase();
      const dText = (o.diagnosisText || '').toLowerCase();
      const docName = (o.doctorName || '').toLowerCase();
      const items = Array.isArray(o.items) ? o.items : [];
      return (
        id.includes(qRaw) ||
        pName.includes(qRaw) ||
        norm(pName).includes(qNorm) ||
        pId.includes(qRaw) ||
        pCccd.includes(qRaw) ||
        icd.includes(qRaw) ||
        dText.includes(qRaw) ||
        norm(dText).includes(qNorm) ||
        docName.includes(qRaw) ||
        items.some((it) => {
          const mName = (it?.medicationName || '').toLowerCase();
          return mName.includes(qRaw) || norm(mName).includes(qNorm);
        })
      );
    });
  }, [orders, filterType, searchQuery]);

  return (
    <>
      <div className="workspace-list desktop-records">
        <div className="list-caption">
          <strong>{filteredOrders.length} hồ sơ</strong>
          <span>Mở một đơn để xem đầy đủ chỉ định</span>
        </div>
        <div className="workspace-table-scroll">
          <table className="workspace-table">
            <colgroup>
              <col style={{ width: '19%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Đơn thuốc</th>
                <th>Người bệnh</th>
                <th>Chẩn đoán</th>
                <th>Loại đơn</th>
                <th>Trạng thái</th>
                <th>
                  <span className="sr-only">Chi tiết</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} data-workspace-record>
                  <td>
                    <button
                      type="button"
                      data-testid="cpoe-order-id-btn"
                      className="record-link record-mono"
                      onClick={() => onSelectOrder?.(order)}
                    >
                      {order.id}
                    </button>
                    <span className="record-sub">{order.prescribedAt}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      data-testid="patient-name-btn"
                      className="record-link"
                      onClick={() => onSelectPatient?.(order.patientId)}
                    >
                      {order.patientName || 'Chưa ghi nhận'}
                    </button>
                    <span className="record-sub record-mono">{order.patientId || 'Chưa có mã người bệnh'}</span>
                  </td>
                  <td>
                    <span className="block leading-relaxed">{order.diagnosisText || 'Chưa ghi nhận chẩn đoán'}</span>
                    <span className="record-sub record-mono">{order.diagnosisIcd10}</span>
                  </td>
                  <td>
                    <span>{order.prescriptionType === 'outpatient' ? 'Ngoại trú' : 'Nội trú'}</span>
                    <span className="record-sub">
                      {getTt26FormMetadata(resolveTt26FormType(order)).badgeShort} ·{' '}
                      {order.items.length} thuốc
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${prescriptionState(order).tone}`}>
                      {prescriptionState(order).label}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-action"
                      aria-label={`Xem đơn ${order.id}`}
                      onClick={() => onSelectOrder?.(order)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <EmptyState
              title="Không tìm thấy đơn thuốc"
              description="Thử tên người bệnh, mã đơn hoặc thay đổi bộ lọc."
            />
          )}
        </div>
      </div>
      <div className="mobile-records">
        {filteredOrders.length ? (
          filteredOrders.map((order, index) => (
            <CpoeOrderCard
              key={order.id}
              index={index}
              order={order}
              onSelectOrder={onSelectOrder}
              onSelectPatient={onSelectPatient}
            />
          ))
        ) : (
          <EmptyState title="Không tìm thấy đơn thuốc" />
        )}
      </div>
    </>
  );
};
