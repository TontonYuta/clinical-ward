/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Doctor CPOE Prescriptions (TT 26/2025/TT-BYT)
 */

import { apiRequest } from './client';
import { PrescriptionOrder } from '../../types/clinical';

export const cpoeApi = {
  async fetchCpoeOrders(): Promise<PrescriptionOrder[]> {
    return apiRequest<PrescriptionOrder[]>('/cpoe');
  },

  async createCpoeOrder(order: PrescriptionOrder): Promise<PrescriptionOrder> {
    return apiRequest<PrescriptionOrder>('/cpoe', {
      method: 'POST',
      body: JSON.stringify({
        id: order.id,
        prescriptionType: order.prescriptionType,
        patientId: order.patientId,
        patientName: order.patientName,
        patientCccd: order.patientCccd,
        patientDob: order.patientDob || '1980-01-01',
        patientGender: order.patientGender || 'Nam',
        department: order.department,
        diagnosisIcd10: order.diagnosisIcd10,
        diagnosisText: order.diagnosisText,
        isChronicDisease: order.isChronicDisease,
        daysPrescribed: order.daysPrescribed,
        doctorName: order.doctorName,
        doctorCertificate: order.doctorCertificate,
        prescribedAt: order.prescribedAt,
        digitalSignature: order.digitalSignature,
        status: order.status || 'signed',
        items: order.items,
      }),
    });
  },
};
