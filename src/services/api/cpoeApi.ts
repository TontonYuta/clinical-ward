/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Doctor CPOE Prescriptions (TT 26/2025/TT-BYT)
 */

import { apiRequest } from './client';
import { PrescriptionOrder } from '../../types/cpoe';

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
        patientPhone: order.patientPhone,
        patientEmail: order.patientEmail,
        patientAddress: order.patientAddress || '',
        guardianName: order.guardianName || '',
        patientDob: order.patientDob || '',
        patientGender: order.patientGender || '',
        department: order.department,
        diagnosisIcd10: order.diagnosisIcd10,
        diagnosisText: order.diagnosisText,
        isChronicDisease: order.isChronicDisease,
        daysPrescribed: order.daysPrescribed,
        doctorName: order.doctorName,
        doctorCertificate: order.doctorCertificate,
        prescribedAt: order.prescribedAt,
        digitalSignature: order.digitalSignature,
        status: order.status || 'draft',
        tt26FormType: order.tt26FormType,
        receiverCccd: order.receiverCccd,
        receiverName: order.receiverName,
        treatmentBatch1: order.treatmentBatch1,
        treatmentBatch2: order.treatmentBatch2,
        treatmentBatch3: order.treatmentBatch3,
        facilityName: order.facilityName,
        facilityAddress: order.facilityAddress,
        facilityPhone: order.facilityPhone,
        items: order.items,
      }),
    });
  },
};
