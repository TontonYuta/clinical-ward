import assert from 'node:assert/strict';
import { sendMedicationAdviceEmail, buildDefaultTimeSlots, fetchSavedPrescriptionAdvices } from '../src/services/prescriptionAdviceService';
import type { PatientPrescriptionAdvice } from '../src/types/medicationSchedule';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });
const advice: PatientPrescriptionAdvice = {
  id: 'test', patientName: 'Test Patient', patientEmail: 'test@example.invalid',
  doctorName: 'Test Doctor', createdAt: '', startDate: '', endDate: '',
  generalDoctorAdvice: '', medications: [], notificationStatus: 'idle',
  gasWebhookUrl: 'https://example.invalid/script',
};
let directRequests = 0;
globalThis.fetch = async (url) => {
  if (String(url).startsWith('https://example.invalid')) {
    directRequests++;
    return { type: 'opaque', ok: false, status: 0 } as Response;
  }
  if (String(url).endsWith('/send-email')) return new Response(JSON.stringify({ detail: 'Provider unavailable' }), { status: 502 });
  return new Response('{}', { status: 201 });
};
await assert.rejects(sendMedicationAdviceEmail(advice), /Provider unavailable|xác nhận|không/i);
assert.equal(directRequests, 0, 'An unverified fallback must not send a second notification');
assert.equal(JSON.parse(storage.get('clinical_saved_advices_v1')!)[0].notificationStatus, 'error');
assert.deepEqual(buildDefaultTimeSlots('mỗi tuần một lần'), [], 'Unknown schedules must not invent twice-daily tablets');
assert.deepEqual(buildDefaultTimeSlots('Ngày 3 lần'), [], 'Frequency alone supplies no per-dose amount, clock time or meal instructions');
storage.set('clinical_saved_advices_v1', JSON.stringify([advice]));
globalThis.fetch = async () => new Response('[]', { status: 200 });
assert.deepEqual(await fetchSavedPrescriptionAdvices(), [], 'Authoritative empty lists must clear stale advice');
storage.set('clinical_saved_advices_v1', JSON.stringify([advice]));
globalThis.fetch = async () => new Response('{}', { status: 401 });
assert.deepEqual(await fetchSavedPrescriptionAdvices(), [], 'Expired authentication must not expose prior cached patient advice');
globalThis.fetch = async (url) => String(url).endsWith('/send-email')
  ? new Response(JSON.stringify({ success: false, message: 'Provider rejected' }), { status: 200 })
  : new Response('{}', { status: 201 });
await assert.rejects(sendMedicationAdviceEmail(advice), /Provider rejected|xác nhận|không/i);
assert.equal(JSON.parse(storage.get('clinical_saved_advices_v1')!)[0].notificationStatus, 'error');
console.log('Prescription advice delivery regressions passed.');
let sendsAfterSaveConflict = 0;
globalThis.fetch = async url => {
  if (String(url).endsWith('/send-email')) sendsAfterSaveConflict++;
  return new Response(JSON.stringify({detail:'Identity conflict'}),{status:409});
};
await assert.rejects(sendMedicationAdviceEmail(advice), /lưu|hồ sơ|conflict/i);
assert.equal(sendsAfterSaveConflict, 0, 'failed save prevents any notification dispatch');
