import { mockClinicalReads } from './helpers/mockClinicalReads.mjs';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await mockDemoAuth(context);
  await mockClinicalReads(context);
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
    localStorage.setItem('clinical_audio_muted', 'true');
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/#cpoe');
  await page.locator('[data-testid="cpoe-order-id-btn"]:visible').first().click();
  await page.getByRole('button', { name: 'An toàn', exact: true }).click();
  await page.getByRole('tab', { name: 'Thẩm định', exact: false }).click();
  await page.waitForTimeout(250);
  assert.ok(
    (await page.getByTestId('cpoe-order-detail-modal').innerText()).includes(
      'Chưa có kết quả thẩm định',
    ),
    'API failure must show unavailable audit, not successful score',
  );
  await page.getByTestId('btn-close-cpoe-detail').click();
  await page.locator('[data-testid="cpoe-order-id-btn"]:visible').nth(1).click();
  await page.getByRole('button', { name: 'Theo dõi', exact: true }).click();
  await page.getByRole('tab', { name: 'Thực hiện y lệnh', exact: true }).click();
  assert.equal(
    await page.getByTestId('cpoe-order-detail-modal').getByText('Đã dùng', { exact: true }).count(),
    0,
    'MAR must not fabricate previous administrations',
  );
  await page.getByTestId('btn-close-cpoe-detail').click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('open_patient_detail', { detail: { patientId: 'UNKNOWN-NOT-A-PATIENT' } }),
    ),
  );
  const patient = page.getByTestId('patient-detail-modal');
  await patient.waitFor();
  assert.ok(
    (await patient.innerText()).includes('Không tìm thấy hồ sơ'),
    'unknown identity cannot fall back to another patient',
  );
  await page.getByTestId('btn-close-patient-detail').click();
  await page.locator('[data-testid="patient-name-btn"]:visible').nth(1).click();
  await page.getByTestId('btn-open-sms-from-patient').click();
  await page.getByTestId('tab-history-email').click();
  await page.waitForTimeout(250);
  const notification = page.locator('[aria-labelledby="notification-modal-title"]');
  assert.ok(
    !(await notification.innerText()).includes('Trần Huy Hoàng'),
    'empty notification logs cannot show another patient',
  );
  await context.close();
  const nurseContext = await browser.newContext();
  await nurseContext.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await mockDemoAuth(nurseContext);
  await mockClinicalReads(nurseContext);
  await nurseContext.addInitScript(() => localStorage.setItem('clinical_audio_muted', 'true'));
  const nurse = await nurseContext.newPage();
  await nurse.goto('http://localhost:3000/#cpoe');
  await nurse.locator('[data-testid="patient-name-btn"]:visible').first().click();
  assert.equal(
    await nurse
      .getByTestId('patient-detail-modal')
      .getByRole('button', { name: 'Kê đơn thuốc mới', exact: true })
      .count(),
    0,
    'nurse cannot start prescription from patient',
  );
  console.log('Workspace integrity checks passed');
} finally {
  await browser.close();
}
