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

export function buildDefaultTimeSlots(frequency: string = ''): MedicationTimeSlot[] {
  const norm = frequency.toLowerCase();
  if (norm.includes('3 lần') || norm.includes('sáng, trưa, tối') || norm.includes('sáng trưa tối')) {
    return [
      { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
      { id: 'noon', label: 'Trưa', time: '11:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
      { id: 'evening', label: 'Tối', time: '19:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
    ];
  }
  if (norm.includes('1 lần') || (norm.includes('sáng') && !norm.includes('tối'))) {
    return [
      { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
    ];
  }
  if (norm.includes('tối trước khi ngủ') || norm.includes('trước khi đi ngủ')) {
    return [
      { id: 'evening', label: 'Tối', time: '21:00', dosageText: '1 viên', mealRelation: 'Trước khi ngủ 30 phút' },
    ];
  }
  return [
    { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
    { id: 'evening', label: 'Tối', time: '19:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
  ];
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
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_SAVED_ADVICES, JSON.stringify(data));
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
  savePrescriptionAdviceToDb(advice);

  try {
    const res = await fetch(`${API_BASE_URL}/prescription-advice/send-email`, { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      saveAdviceLocally({ ...advice, notificationStatus: 'success', emailSentAt: data.timestamp });
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    let errorMsg = 'Không thể gửi thông báo';
    if (typeof errData.detail === 'string') {
      errorMsg = errData.detail;
    } else if (Array.isArray(errData.detail)) {
      errorMsg = errData.detail
        .map((d: any) => (d.msg ? `${d.loc ? d.loc.slice(1).join(' -> ') + ': ' : ''}${d.msg}` : JSON.stringify(d)))
        .join('; ');
    } else if (errData.detail && typeof errData.detail === 'object') {
      errorMsg = JSON.stringify(errData.detail);
    }
    throw new Error(errorMsg);
  } catch (err) {
    if (options.sendSms || !webhookUrl) throw err;
    console.warn('Backend relay unavailable, trying direct GAS webhook:', err);
  }

  if (!options.sendSms && webhookUrl && webhookUrl.startsWith('http')) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advice: payload })
      });
      const sentTime = new Date().toISOString();
      saveAdviceLocally({ ...advice, notificationStatus: 'success', emailSentAt: sentTime });
      return {
        success: true,
        message: `Đã gửi thông báo nhắc uống thuốc thành công qua Google Apps Script tới: ${advice.patientEmail}`,
        timestamp: sentTime,
        emailSentTo: advice.patientEmail,
        provider: 'google_apps_script'
      };
    } catch (gasErr) {
      console.error('Lỗi khi gửi trực tiếp tới Google Apps Script:', gasErr);
    }
  }

  // SMS is delivered only by a configured provider. Never report a simulated
  // notification as sent to a patient's phone.
  if (options.sendSms) {
    saveAdviceLocally({ ...advice, notificationStatus: 'error' });
    throw new Error('Backend chưa khả dụng; không thể xác nhận gửi SMS. Không gửi email thay thế một cách âm thầm.');
  }

  throw new Error('Không gửi được email: backend không khả dụng và chưa cấu hình Google Apps Script. Lịch đã được lưu nháp.');
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
