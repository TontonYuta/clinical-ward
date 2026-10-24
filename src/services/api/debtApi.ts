/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Ward Debts & Morphin Ampoules (TT 18/2026/TT-BYT)
 */

import { apiRequest } from './client';
import { DebtRecord } from '../../types/clinical';

interface BackendDebtRecord {
  id: string;
  code: string;
  item_name: string;
  item_type: string;
  quantity: number | string;
  patient_name: string;
  patient_room: string;
  borrow_time: string;
  borrower: string;
  clinical_reason?: string;
  status: string;
  ampoule_returned?: boolean;
  ampoule_destroyed?: boolean;
  settled_at?: string;
  settler?: string;
}

function mapBackendToDebtRecord(b: BackendDebtRecord): DebtRecord {
  return {
    id: b.id,
    code: b.code,
    itemName: b.item_name,
    itemType: b.item_type as DebtRecord['itemType'],
    quantity: typeof b.quantity === 'number' ? `${b.quantity} ống` : b.quantity,
    patientName: b.patient_name,
    patientRoom: b.patient_room,
    borrowTime: b.borrow_time || '08:00 AM',
    borrowDate: 'Hôm nay',
    borrowerName: b.borrower || 'ĐD. Ca trực',
    status: b.status === 'settled' ? 'settled' : 'debt',
    note: b.clinical_reason || 'Mượn khẩn tủ trực',
    legalBasis: b.item_type === 'Thuốc gây nghiện'
      ? 'Thông tư 18/2026/TT-BYT & VBHN 07/VBHN-BYT'
      : 'Văn bản hợp nhất 07/VBHN-BYT & TT 22/2011',
    ampouleReturned: b.ampoule_returned,
    ampouleDestroyed: b.ampoule_destroyed,
    settledAt: b.settled_at,
  };
}

export const debtApi = {
  async fetchDebts(): Promise<DebtRecord[]> {
    const raw = await apiRequest<BackendDebtRecord[]>('/debts');
    return raw.map(mapBackendToDebtRecord);
  },

  async borrowItem(payload: {
    itemName: string;
    itemType: string;
    quantity: string | number;
    patientName: string;
    patientRoom: string;
    borrowerName: string;
    clinicalReason?: string;
  }): Promise<DebtRecord> {
    const qtyNum = parseInt(String(payload.quantity).replace(/\D/g, ''), 10) || 1;
    const res = await apiRequest<BackendDebtRecord>('/debts/borrow', {
      method: 'POST',
      body: JSON.stringify({
        item_name: payload.itemName,
        item_type: payload.itemType,
        quantity: qtyNum,
        patient_name: payload.patientName,
        patient_room: payload.patientRoom,
        borrower: payload.borrowerName,
        clinical_reason: payload.clinicalReason || 'Cấp cứu buồng bệnh',
        auth_method: 'PASSWORD',
      }),
    });
    return mapBackendToDebtRecord(res);
  },

  async returnAmpoule(debtId: string): Promise<DebtRecord> {
    const res = await apiRequest<BackendDebtRecord>(`/debts/${debtId}/return-ampoule`, {
      method: 'PUT',
    });
    return mapBackendToDebtRecord(res);
  },

  async settleDebt(debtId: string, prescriptionCode: string, settlerName: string): Promise<DebtRecord> {
    const res = await apiRequest<BackendDebtRecord>(`/debts/${debtId}/settle`, {
      method: 'PUT',
      body: JSON.stringify({
        prescription_code: prescriptionCode,
        settler_name: settlerName,
        auth_method: 'PIN',
      }),
    });
    return mapBackendToDebtRecord(res);
  },
};
