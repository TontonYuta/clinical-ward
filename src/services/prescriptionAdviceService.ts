/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dịch Vụ Dặn Dò Bác Sĩ & Lưu Trữ Đơn Thuốc Bệnh Nhân (<=180 LOC)
 */

import {
  PatientPrescriptionAdvice,
  SendAdviceEmailResponse,
  MedicationTimeSlot
} from '../types/medicationSchedule';
import { API_BASE_URL } from './api';
import { generateMedicationHtmlEmail } from './prescriptionHtmlGenerator';

export { generateMedicationHtmlEmail };

const STORAGE_KEY_GAS_URL = 'clinical_gas_reminder_webhook_url';
const STORAGE_KEY_SAVED_ADVICES = 'clinical_saved_advices_v1';

export function getStoredGasWebhookUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GAS_URL) || '';
  } catch {
    return '';
  }
}

export function setStoredGasWebhookUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GAS_URL, url.trim());
  } catch {}
}

export function buildDefaultTimeSlots(_frequency: string = ''): MedicationTimeSlot[] {
  // Frequency alone does not specify a dose, clock time, or relation to meals.
  // A reminder schedule must be explicitly supplied and reviewed.
  return [];
}

export function saveAdviceLocally(advice: PatientPrescriptionAdvice): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ADVICES);
    const list: PatientPrescriptionAdvice[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.id === advice.id);
    if (idx >= 0) list[idx] = advice;
    else list.unshift(advice);
    localStorage.setItem(STORAGE_KEY_SAVED_ADVICES, JSON.stringify(list));
  } catch {}
}

export async function savePrescriptionAdviceToDb(advice: PatientPrescriptionAdvice): Promise<boolean> {
  saveAdviceLocally(advice);
  try {
    const res = await fetch(`${API_BASE_URL}/prescription-advice`, { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(advice)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchSavedPrescriptionAdvices(): Promise<PatientPrescriptionAdvice[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/prescription-advice`, { credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      try { localStorage.setItem(STORAGE_KEY_SAVED_ADVICES, '[]'); } catch {}
      return [];
    }
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        try { localStorage.setItem(STORAGE_KEY_SAVED_ADVICES, JSON.stringify(data)); } catch {}
        return data;
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ADVICES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function sendMedicationAdviceEmail(
  advice: PatientPrescriptionAdvice,
  options: { sendEmail?: boolean; sendSms?: boolean } = {}
): Promise<SendAdviceEmailResponse> {
  const webhookUrl = advice.gasWebhookUrl || getStoredGasWebhookUrl();
  const payload = {
    ...advice,
    gasWebhookUrl: webhookUrl || undefined,
    sendEmail: options.sendEmail !== false,
    sendSms: options.sendSms === true
  };

  // Lưu lịch dặn dò vào CSDL vĩnh viễn
  if (!await savePrescriptionAdviceToDb(advice)) {
    throw new Error('Không lưu được hồ sơ dặn dò; chưa gửi thông báo. Kiểm tra định danh và kết nối.');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/prescription-advice/send-email`, { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success !== true) throw new Error(data.message || 'Không xác nhận được việc gửi thông báo');
      saveAdviceLocally({ ...advice, notificationStatus: 'success', emailSentAt: data.timestamp });
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Không thể gửi thông báo');
  } catch (err) {
    saveAdviceLocally({ ...advice, notificationStatus: 'error' });
    throw err;
  }
}

export function printMedicationAdvice(advice: PatientPrescriptionAdvice): void {
  const html = generateMedicationHtmlEmail(advice, true);
  let frame = document.getElementById('clinical-advice-print-frame') as HTMLIFrameElement;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'clinical-advice-print-frame';
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
  }
  const doc = frame.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Phiếu dặn dò - ${advice.patientName}</title><style>@page{size:A4 portrait;margin:15mm}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;padding:0}</style></head><body>${html}</body></html>`);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    }, 200);
  }
}
