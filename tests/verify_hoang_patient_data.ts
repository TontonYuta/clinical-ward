import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Checking Patient Trần Huy Hoàng data on Port 3001...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
    console.log('✅ Loaded http://localhost:3001/#cpoe');
    await page.waitForTimeout(1000);

    // Capture CPOE list
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_hoang_cam_cum_3001.png') });
    console.log('📸 Captured CPOE prescription list screenshot');

    // Click on Patient Name button for Trần Huy Hoàng
    const patientBtn = page.locator('[data-testid="patient-name-btn"]:visible').filter({ hasText: 'Trần Huy Hoàng' }).first();
    await patientBtn.waitFor({ state: 'visible', timeout: 5000 });
    await patientBtn.click();
    console.log('✅ Clicked patient name "Trần Huy Hoàng"');

    const patientModal = page.locator('[data-testid="patient-detail-modal"]');
    await patientModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ PatientDetailModal opened');

    // Verify Phone 0963278149
    const modalText = await patientModal.innerText();
    if (!modalText.includes('0963278149')) {
      throw new Error('Phone 0963278149 not found in PatientDetailModal!');
    }
    console.log('✅ Verified Phone: 0963278149');

    // Verify Email huyhoang6altt@gmail.com
    if (!modalText.includes('huyhoang6altt@gmail.com')) {
      throw new Error('Email huyhoang6altt@gmail.com not found in PatientDetailModal!');
    }
    console.log('✅ Verified Email: huyhoang6altt@gmail.com');

    // Verify Diagnosis Cảm cúm
    if (!modalText.includes('Cảm cúm')) {
      throw new Error('Diagnosis "Cảm cúm" not found in PatientDetailModal!');
    }
    console.log('✅ Verified Diagnosis / Condition: "Cảm cúm"');

    // Capture screenshot of Patient Detail Modal
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_hoang_cam_cum_3001.png') });
    console.log('📸 Captured PatientDetailModal for Trần Huy Hoàng');

    console.log('🏁 ALL PATIENT DATA VERIFICATIONS FOR TRẦN HUY HOÀNG PASSED 100%!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
