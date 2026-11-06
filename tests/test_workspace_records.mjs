import { mockClinicalReads } from './helpers/mockClinicalReads.mjs';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c.route(
    (u) => u.pathname.startsWith('/api/'),
    (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await mockDemoAuth(c);
  await mockClinicalReads(c);
  await c.addInitScript(() => { localStorage.setItem('clinical_user_role','doctor'); localStorage.setItem('clinical_audio_muted','true'); });
  const p = await c.newPage();
  const fixture = [
        {
          id: 'RX-TEST-N',
          patientId: 'BN-8820',
          patientName: 'Võ Minh Trí',
          prescriptionType: 'outpatient',
          status: 'signed',
          items: [],
          clinicalNotes: 'Ghi chú cần giữ lại',
          treatmentBatch1: 'Đợt một được lưu',
          treatmentBatch2: 'Đợt hai được lưu',
          treatmentBatch3: 'Đợt ba được lưu',
          receiverCccd: 'RECEIVER-ID-ONLY',
          patientCccd: 'PATIENT-ID',
          patientInsuranceId: 'INSURANCE-ID',
        },
      ];
  await mockClinicalReads(c, {'/api/v1/cpoe': fixture});
  await p.goto('http://localhost:3000/#cpoe');
  await p.locator('[data-testid="cpoe-order-id-btn"]:visible').first().click();
  const detail = p.getByTestId('cpoe-order-detail-modal');
  const text = await detail.innerText();
  for (const field of [
    'Ghi chú cần giữ lại',
    'Đợt một được lưu',
    'Đợt hai được lưu',
    'Đợt ba được lưu',
    'RECEIVER-ID-ONLY',
    'PATIENT-ID',
    'INSURANCE-ID',
  ])
    assert.ok(text.includes(field), `record field still readable: ${field}`);
  assert.ok(text.includes('Chưa có chữ ký'), 'unsigned record cannot appear signed');
  console.log('Workspace full-record checks passed');
} finally {
  await browser.close();
}
