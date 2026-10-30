/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Định nghĩa Type cho Phân Hệ SMS Brandname Bệnh Nhân (TT 26/2025/TT-BYT & NĐ 91/2020)
 */

export type SmsProviderType = 'sandbox' | 'esms' | 'speedsms' | 'twilio';
export type SmsMessageType = 'cpoe_prescription' | 'medication_advice' | 'hospital_notice';
export type SmsDeliveryStatus = 'idle' | 'sending' | 'delivered' | 'failed';

export interface SmsTemplateItem {
  id: string;
  title: string;
  category: string;
  template: string;
  description: string;
}

export interface SendSmsPayload {
  recipientPhone: string;
  patientId: string;
  patientName: string;
  messageType: SmsMessageType;
  content: string;
  referenceId?: string;
  provider?: SmsProviderType;
}

export interface SmsDeliveryReceipt {
  id: string; // SMS-20261030-xxxx
  recipientPhone: string;
  patientId: string;
  patientName: string;
  messageType: string;
  content: string;
  charactersCount: number;
  smsSegments: number;
  provider: SmsProviderType;
  status: string;
  referenceId?: string;
  deliveryReceipt?: string;
  errorDetail?: string;
  createdAt?: string;
}
