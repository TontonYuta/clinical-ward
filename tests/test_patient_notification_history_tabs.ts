import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Starting Patient SMS & Email Dedicated History Tabs E2E Test on Port 3001...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();

  try {
    // 1. Open CPOE Page
    await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
    console.log('✅ Loaded http://localhost:3001/#cpoe');
    await page.waitForTimeout(1000);

    // 2. Open Order Detail Modal from Row 1
    const orderIdBtn = page.locator('table tbody tr').first().locator('[data-testid="cpoe-order-id-btn"]').first();
    await orderIdBtn.click();
    console.log('✅ Clicked Row 1 Order ID');

    const orderDetailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
    await orderDetailModal.waitFor({ state: 'visible', timeout: 5000 });

    // 3. Open Notification Modal
    const openSmsBtn = orderDetailModal.locator('[data-testid="btn-open-sms-from-order"]');
    await openSmsBtn.click();

    const smsModal = page.locator('[data-testid="send-sms-modal"]');
    await smsModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Send Notification Modal opened');

    // 4. Switch to "Lịch sử SMS" Tab
    const smsHistoryTabBtn = smsModal.locator('[data-testid="tab-history-sms"]');
    await smsHistoryTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await smsHistoryTabBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Switched to "Lịch sử SMS" Tab');

    // Verify SMS History View
    const smsHistoryHeader = smsModal.locator('text=Nhật Ký Phát Tin Nhắn SMS');
    await smsHistoryHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Verified SMS History View Header');

    // Verify full content is displayed without truncation
    const smsFullContent = smsModal.locator('text=[BV LAM SANG] BS. Tran Van Hung da ky don thuoc ma RX-2026-604').first();
    await smsFullContent.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Verified full, untruncated SMS message text is displayed');

    // Capture screenshot of SMS History Tab
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'history_modal_sms_tab.png') });
    console.log('📸 Captured history_modal_sms_tab.png');

    // 5. Switch to "Lịch sử Email" Tab
    const emailHistoryTabBtn = smsModal.locator('[data-testid="tab-history-email"]');
    await emailHistoryTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await emailHistoryTabBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Switched to "Lịch sử Email" Tab');

    // Verify Email History View
    const emailHistoryHeader = smsModal.locator('text=Nhật Ký Thư Điện Tử Y Tế');
    await emailHistoryHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Verified Email History View Header');

    // Verify full email subject & advice content
    const emailSubject = smsModal.locator('text=[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử & Hướng dẫn điều trị').first();
    await emailSubject.waitFor({ state: 'visible', timeout: 5000 });

    const emailFullAdvice = smsModal.locator('text=Kính gửi bệnh nhân Trần Huy Hoàng').first();
    await emailFullAdvice.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Verified full, untruncated Email subject and doctor advice are displayed');

    // Capture screenshot of Email History Tab
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'history_modal_email_tab.png') });
    console.log('📸 Captured history_modal_email_tab.png');

    // 6. Test search filter in history tab
    const searchInput = smsModal.locator('input[placeholder*="Tìm theo tiêu đề"]');
    await searchInput.fill('viện phí');
    await page.waitForTimeout(300);
    const filteredNotice = smsModal.locator('text=Xác nhận viện phí & Lịch hẹn tái khám');
    await filteredNotice.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Verified live search filter in History Tab');

    // 7. Test Reloading advice into Composer
    const reloadBtn = smsModal.locator('button:has-text("Nạp vào ô gửi Email"):visible').first();
    await reloadBtn.click();
    await page.waitForTimeout(400);

    // Verify switched to Email composer tab
    const adviceTextarea = smsModal.locator('textarea[aria-label="Nội dung thư gửi bệnh nhân"]');
    await adviceTextarea.waitFor({ state: 'visible', timeout: 5000 });
    const loadedValue = await adviceTextarea.inputValue();
    if (!loadedValue.includes('hoàn tất thủ tục khám và thanh toán viện phí')) {
      throw new Error(`Failed to reload advice into composer! Got: ${loadedValue}`);
    }
    console.log('✅ Verified "Nạp vào ô gửi Email" reloads content into composer successfully');

    // Capture screenshot of composer reloaded
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'email_composer_reloaded_from_history.png') });
    console.log('📸 Captured email_composer_reloaded_from_history.png');

    console.log('🎉 ALL SMS & EMAIL HISTORY TABS TESTS PASSED 100%!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'history_test_error.png') }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
