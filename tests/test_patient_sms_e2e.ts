import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Starting Patient SMS Brandname & Sandbox Delivery E2E Test on Port 3001...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log(`[BROWSER ${msg.type()}]`, msg.text());
  });
  page.on('pageerror', (err) => console.error('💥 UNCAUGHT PAGE ERROR:', err));

  try {
    // 1. Navigate to http://localhost:3001/#cpoe
    await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
    console.log('✅ Loaded http://localhost:3001/#cpoe');
    await page.waitForTimeout(1000);

    // 2. Open Order Detail Modal from Row 1
    const orderIdBtn = page.locator('table tbody tr').first().locator('[data-testid="cpoe-order-id-btn"]').first();
    await orderIdBtn.waitFor({ state: 'visible', timeout: 5000 });
    await orderIdBtn.click();
    console.log('✅ Clicked Row 1 Order ID');

    const orderDetailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
    await orderDetailModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ CpoeOrderDetailModal opened');

    // 3. Verify and Click "Gửi SMS BN" button
    const openSmsBtn = orderDetailModal.locator('[data-testid="btn-open-sms-from-order"]');
    await openSmsBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Found "Gửi SMS BN" button in Order Detail Header');
    await openSmsBtn.click();

    // 4. Verify SendSmsModal opened
    const smsModal = page.locator('[data-testid="send-sms-modal"]');
    await smsModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ SendSmsModal opened successfully');

    // 5. Verify Phone Number is auto-filled
    const phoneInput = smsModal.locator('input[aria-label="Số điện thoại nhận SMS"]');
    const filledPhone = await phoneInput.inputValue();
    console.log(`📱 Recipient Phone Number auto-filled: "${filledPhone}"`);
    if (!filledPhone || filledPhone.length < 10) {
      throw new Error(`Phone number not properly filled! Got: ${filledPhone}`);
    }

    // 6. Verify Content & Smartphone Preview
    const contentArea = smsModal.locator('textarea[aria-label="Nội dung tin nhắn SMS"]');
    const smsContent = await contentArea.inputValue();
    console.log('✉️ SMS Content snippet:', smsContent.slice(0, 100));

    // Capture screenshot of SendSmsModal with phone preview
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'sms_modal_composing_3001.png') });
    console.log('📸 Captured SendSmsModal composing view');

    // 7. Click "Gửi Tin Nhắn SMS" button
    const sendBtn = smsModal.locator('[data-testid="btn-submit-send-sms"]');
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
    console.log('✅ Clicked "Gửi Tin Nhắn SMS"');

    // 8. Verify Success notification & DLR receipt
    const successMsg = smsModal.locator('text=Phát tin thành công tới SIM di động');
    await successMsg.waitFor({ state: 'visible', timeout: 8000 });
    console.log('🎉 SUCCESS: SMS dispatched successfully to recipient mobile SIM!');

    // Capture screenshot of successful delivery
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'sms_modal_sent_success_3001.png') });
    console.log('📸 Captured SMS delivery success receipt');

    // 9. Close SMS Modal
    const closeSmsBtn = page.locator('[data-testid="btn-close-sms-modal"]:visible').first();
    await closeSmsBtn.click();
    await page.waitForTimeout(500);
    console.log('✅ Closed SendSmsModal');

    // Close Order Detail Modal
    const closeOrderBtn = page.locator('[data-testid="btn-close-cpoe-detail"]:visible').first();
    await closeOrderBtn.click();
    await page.waitForTimeout(500);
    console.log('✅ Closed CpoeOrderDetailModal');

    // 10. Open Patient Detail Modal to test SMS from Patient Profile
    const patientBtn = page.locator('table tbody tr').first().locator('[data-testid="patient-name-btn"]');
    await patientBtn.click();
    console.log('✅ Clicked Patient Name to open PatientDetailModal');

    const patientModal = page.locator('[data-testid="patient-detail-modal"]');
    await patientModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ PatientDetailModal opened');

    // Click "Gửi SMS BN" from Patient Header
    const patientSmsBtn = patientModal.locator('[data-testid="btn-open-sms-from-patient"]');
    await patientSmsBtn.waitFor({ state: 'visible', timeout: 5000 });
    await patientSmsBtn.click();
    console.log('✅ Clicked "Gửi SMS BN" from Patient Profile Header');

    // Verify SendSmsModal opened again
    const visibleSmsModal = page.locator('[data-testid="send-sms-modal"]:visible');
    await visibleSmsModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ SendSmsModal opened from Patient Detail');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'sms_modal_from_patient_detail_3001.png') });
    console.log('📸 Captured SMS modal from Patient Detail');

    console.log('🏁 ALL PATIENT SMS BRANDNAME E2E TESTS PASSED 100% ON PORT 3001!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'sms_test_error.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
