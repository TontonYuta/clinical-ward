/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service cho Phân hệ Gửi Tin Nhắn SMS Bệnh Nhân (TT 26/2025/TT-BYT)
 */

import { apiRequest } from './client';
import { SendSmsPayload, SmsDeliveryReceipt, SmsTemplateItem } from '../../types/sms';

export const smsApi = {
  async getTemplates(): Promise<SmsTemplateItem[]> {
    return apiRequest<SmsTemplateItem[]>('/sms/templates');
  },

  async getLogs(patientId?: string, recipientPhone?: string): Promise<SmsDeliveryReceipt[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    if (recipientPhone) params.append('recipient_phone', recipientPhone);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<SmsDeliveryReceipt[]>(`/sms/logs${query}`);
  },

  async sendSms(payload: SendSmsPayload): Promise<SmsDeliveryReceipt> {
    return apiRequest<SmsDeliveryReceipt>('/sms/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelScheduledSms(smsId: string): Promise<SmsDeliveryReceipt> {
    return apiRequest<SmsDeliveryReceipt>(`/sms/cancel/${encodeURIComponent(smsId)}`, {
      method: 'POST',
    });
  },
};
