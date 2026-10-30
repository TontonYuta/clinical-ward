import { chromium } from 'playwright';
import path from 'path';

const VERCEL_URL = 'https://clinical-ward.vercel.app';
const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function verifyLiveVercel() {
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ TRỰC TIẾP TRÊN PRODUCTION VERCEL: ${VERCEL_URL}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // ==========================================
    // 1. MOBILE VIEW (iPhone 14: 390x844)
    // ==========================================
    console.log('\n📱 --- KIỂM THỬ MOBILE VIEWPORT (390 x 844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mobileContext.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'doctor');
    });

    const page = await mobileContext.newPage();
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${VERCEL_URL}/#cpoe`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(1000);

    // 1. CPOE Mobile View & Header Ribbon
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_01_cpoe_list.png') });
    console.log('✅ [Mobile 1] Đã chụp vercel_live_mobile_01_cpoe_list.png');

    // 2. Open Order Detail Modal
    const orderCardBtn = page.locator('[data-testid="cpoe-order-id-btn"]').first();
    await orderCardBtn.waitFor({ state: 'visible', timeout: 8000 });
    await orderCardBtn.click();
    await page.waitForTimeout(600);

    const orderDetailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
    await orderDetailModal.waitFor({ state: 'visible', timeout: 8000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_02_order_detail.png') });
    console.log('✅ [Mobile 2] Đã chụp vercel_live_mobile_02_order_detail.png');

    // 3. Open Send SMS/Email Modal from Order Detail
    const openSmsBtn = orderDetailModal.locator('[data-testid="btn-open-sms-from-order"]');
    await openSmsBtn.click();
    await page.waitForTimeout(600);

    const smsModal = page.locator('[data-testid="send-sms-modal"]');
    await smsModal.waitFor({ state: 'visible', timeout: 8000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_03_notification_sms.png') });
    console.log('✅ [Mobile 3] Đã chụp vercel_live_mobile_03_notification_sms.png');

    // 4. Scroll SMS tab to verify composer & TT26 chips
    const formElement = smsModal.locator('form');
    await formElement.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_04_notification_sms_scrolled.png') });
    console.log('✅ [Mobile 4] Đã chụp vercel_live_mobile_04_notification_sms_scrolled.png');

    // 5. Email Tab
    const emailTab = smsModal.locator('[data-testid="tab-email"]');
    await emailTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_05_notification_email.png') });
    console.log('✅ [Mobile 5] Đã chụp vercel_live_mobile_05_notification_email.png');

    // 6. Settings Tab
    const settingsTab = smsModal.locator('[data-testid="tab-settings"]');
    await settingsTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_06_notification_settings.png') });
    console.log('✅ [Mobile 6] Đã chụp vercel_live_mobile_06_notification_settings.png');

    // 7. SMS History Tab
    const historySmsTab = smsModal.locator('[data-testid="tab-history-sms"]');
    await historySmsTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_07_notification_history_sms.png') });
    console.log('✅ [Mobile 7] Đã chụp vercel_live_mobile_07_notification_history_sms.png');

    // 8. Close SMS modal via mobile close button or Escape
    const closeSmsBtn = page.locator('[data-testid="btn-close-sms-modal-mobile"]');
    if (await closeSmsBtn.isVisible()) {
      await closeSmsBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);

    // Close Order Detail modal via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Open Patient Detail Modal directly by clicking patient name
    const patientNameLink = page.locator('[data-testid="cpoe-patient-name-btn"]').first();
    if (await patientNameLink.isVisible()) {
      await patientNameLink.click();
      await page.waitForTimeout(600);
      const patientModal = page.locator('[data-testid="patient-detail-modal"]');
      if (await patientModal.isVisible()) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_mobile_08_patient_detail.png') });
        console.log('✅ [Mobile 8] Đã chụp vercel_live_mobile_08_patient_detail.png');
      }
    }

    await mobileContext.close();

    // ==========================================
    // 2. DESKTOP VIEW (1440x900) - INVARIANCE CHECK
    // ==========================================
    console.log('\n💻 --- KIỂM THỬ DESKTOP VIEWPORT (1440 x 900) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    });
    await desktopContext.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'doctor');
    });

    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`${VERCEL_URL}/#cpoe`, { waitUntil: 'networkidle', timeout: 35000 });
    await desktopPage.waitForTimeout(1000);

    // Desktop CPOE Ribbon and Table
    await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_desktop_01_cpoe.png') });
    console.log('✅ [Desktop 1] Đã chụp vercel_live_desktop_01_cpoe.png');

    // Open Desktop Modal
    const desktopOrderBtn = desktopPage.locator('[data-testid="cpoe-order-id-btn"]:visible').first();
    await desktopOrderBtn.click();
    await desktopPage.waitForTimeout(500);

    const desktopOrderDetailModal = desktopPage.locator('[data-testid="cpoe-order-detail-modal"]');
    const desktopOpenSmsBtn = desktopOrderDetailModal.locator('[data-testid="btn-open-sms-from-order"]:visible');
    await desktopOpenSmsBtn.click();
    await desktopPage.waitForTimeout(600);

    const desktopSmsModal = desktopPage.locator('[data-testid="send-sms-modal"]');
    await desktopSmsModal.waitFor({ state: 'visible', timeout: 8000 });
    await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_desktop_02_notification_modal.png') });
    console.log('✅ [Desktop 2] Đã chụp vercel_live_desktop_02_notification_modal.png');

    await desktopContext.close();

    console.log('\n==================================================');
    console.log('🎉 TẤT CẢ KIỂM THỬ TRỰC TIẾP TRÊN VERCEL HOÀN TOÀN THÀNH CÔNG!');
    console.log(`Số lỗi Console phát sinh: ${consoleErrors.length}`);
    console.log('==================================================\n');
  } finally {
    await browser.close();
  }
}

verifyLiveVercel().catch(err => {
  console.error('❌ Thất bại trong kiểm thử Vercel:', err);
  process.exit(1);
});
