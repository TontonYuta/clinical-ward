import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function verifyMobileResponsive() {
  console.log('📱 Starting comprehensive mobile responsiveness verification on 390x844 (iPhone 14)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();

  // 1. CPOE Mobile View
  await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_01_cpoe_list.png') });
  console.log('✅ Captured mobile_01_cpoe_list.png');

  // 2. Open Order Detail Modal via mobile order card button
  const orderCardBtn = page.locator('[data-testid="cpoe-order-id-btn"]').first();
  await orderCardBtn.waitFor({ state: 'visible', timeout: 5000 });
  await orderCardBtn.click();
  await page.waitForTimeout(500);

  const orderDetailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
  await orderDetailModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_02_order_detail_modal.png') });
  console.log('✅ Captured mobile_02_order_detail_modal.png');

  // 3. Open Notification Modal from Order Detail
  const openSmsBtn = orderDetailModal.locator('[data-testid="btn-open-sms-from-order"]');
  await openSmsBtn.click();
  await page.waitForTimeout(500);

  const smsModal = page.locator('[data-testid="send-sms-modal"]');
  await smsModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_03_notification_sms_tab.png') });
  console.log('✅ Captured mobile_03_notification_sms_tab.png');

  // Scroll down to check Column 2 (Nhập tin nhắn riêng) on mobile
  const formElement = smsModal.locator('form');
  await formElement.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_04_notification_sms_tab_scrolled.png') });
  console.log('✅ Captured mobile_04_notification_sms_tab_scrolled.png');

  // 4. Switch to Email Channel Tab
  const emailTab = smsModal.locator('[data-testid="tab-email"]');
  await emailTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_05_notification_email_tab.png') });
  console.log('✅ Captured mobile_05_notification_email_tab.png');

  // 5. Switch to Settings Tab
  const settingsTab = smsModal.locator('[data-testid="tab-settings"]');
  await settingsTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_06_notification_settings_tab.png') });
  console.log('✅ Captured mobile_06_notification_settings_tab.png');

  // 6. Switch to SMS History Tab
  const historySmsTab = smsModal.locator('[data-testid="tab-history-sms"]');
  await historySmsTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_07_notification_history_sms.png') });
  console.log('✅ Captured mobile_07_notification_history_sms.png');

  // 7. Close SMS Modal
  const closeSmsBtn = smsModal.locator('[data-testid="btn-close-sms-modal-mobile"]').first();
  await closeSmsBtn.click();
  await page.waitForTimeout(400);

  // Close Order Detail Modal
  const closeOrderBtn = orderDetailModal.locator('[data-testid="btn-close-cpoe-detail"]').first();
  await closeOrderBtn.click();
  await page.waitForTimeout(400);

  // 8. Open Patient Detail Modal from Mobile Card Patient Name
  const patientNameBtn = page.locator('article[data-testid="cpoe-order-card"] button').nth(1);
  await patientNameBtn.click();
  await page.waitForTimeout(500);

  const patientModal = page.locator('[data-testid="patient-detail-modal"]');
  await patientModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_08_patient_detail_modal.png') });
  console.log('✅ Captured mobile_08_patient_detail_modal.png');

  await browser.close();
  console.log('🎉 ALL MOBILE RESPONSIVENESS VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

verifyMobileResponsive().catch((err) => {
  console.error('❌ Error during mobile verification:', err);
  process.exit(1);
});
