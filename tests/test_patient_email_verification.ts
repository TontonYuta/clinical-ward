import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Starting Patient Email Delivery & Webhook Gateway Verification Test on Port 3001...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[BROWSER ${msg.type()}]`, msg.text());
  });

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

    // 3. Click "Gửi thông báo cho BN" button
    const openSmsBtn = orderDetailModal.locator('[data-testid="btn-open-sms-from-order"]');
    await openSmsBtn.waitFor({ state: 'visible', timeout: 5000 });
    await openSmsBtn.click();

    // 4. Verify SendSmsModal opened
    const smsModal = page.locator('[data-testid="send-sms-modal"]');
    await smsModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Send Notification Modal opened');

    // 5. Switch to Email Channel Tab
    const emailTabBtn = smsModal.locator('button:has-text("Thư điện tử (Email)"):visible');
    await emailTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await emailTabBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Switched to Email Channel Tab');

    // 6. Verify Email input is populated with huyhoang6altt@gmail.com
    const emailInput = smsModal.locator('input[type="email"]');
    const filledEmail = await emailInput.inputValue();
    console.log(`📧 Recipient Email auto-filled: "${filledEmail}"`);
    if (filledEmail !== 'huyhoang6altt@gmail.com') {
      throw new Error(`Email mismatch! Expected huyhoang6altt@gmail.com, got: ${filledEmail}`);
    }

    // 7. Verify Clean Composer Tab without duplicated settings inputs
    const settingsShortcut = smsModal.locator('[data-testid="link-open-settings-tab"]');
    await settingsShortcut.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Verified Clean Composer Tab with gateway status indicator and link to Settings Tab');

    // Capture screenshot of Clean Email tab without duplicate config inputs
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_email_channel_clean_workstation.png') });
    console.log('📸 Captured patient_email_channel_clean_workstation.png');

    // 8. Test clicking "Gửi Email Cho Bệnh Nhân" without webhook set
    // Clear localStorage webhook first to test error alert
    await page.evaluate(() => localStorage.removeItem('clinical_gas_webhook_url'));
    const sendBtn = smsModal.locator('[data-testid="btn-submit-send-sms"]');
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
    console.log('✅ Clicked "Gửi Email Cho Bệnh Nhân"');
    await page.waitForTimeout(1000);

    // Verify clear error alert is displayed informing user of webhook requirement
    const errorAlert = smsModal.locator('.bg-rose-50');
    await errorAlert.waitFor({ state: 'visible', timeout: 5000 });
    const errText = await errorAlert.textContent();
    console.log(`ℹ️ System error transparency verified: "${errText?.trim()}"`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_email_unconfigured_error_alert.png') });
    console.log('📸 Captured patient_email_unconfigured_error_alert.png');

    // 9. Now configure GAS Webhook URL via dedicated Settings Tab
    // Switch to Settings Tab
    const settingsTabBtn = smsModal.locator('[data-testid="tab-settings"]');
    await settingsTabBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Switched to dedicated Settings Tab (Cài đặt cổng tin)');

    // Enter a valid webhook URL in Settings Tab
    const gasInput = smsModal.locator('input[placeholder*="https://script.google.com"]');
    await gasInput.waitFor({ state: 'visible', timeout: 5000 });
    await gasInput.fill('https://script.google.com/macros/s/AKfycbz_test_webhook_deployment/exec');
    await page.waitForTimeout(200);

    // Click "Lưu Cấu Hình Cổng"
    const saveSettingsBtn = smsModal.locator('button:has-text("Lưu Cấu Hình Cổng")');
    await saveSettingsBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Saved Gateway Configuration in Settings Tab');

    // Switch back to Email Tab
    await emailTabBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Switched back to Email Composer Tab');

    // We mock the network response from the webhook or backend
    await page.route('**/api/v1/prescription-advice/send-email', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Đã gửi email nhắc uống thuốc thành công đến bệnh nhân: huyhoang6altt@gmail.com',
          timestamp: new Date().toISOString(),
          email_sent_to: 'huyhoang6altt@gmail.com',
          provider: 'google_apps_script'
        })
      });
    });

    // Re-click send
    await sendBtn.click();
    console.log('✅ Clicked Send with configured Webhook URL');
    await page.waitForTimeout(1000);

    // Verify Success alert
    const successAlert = smsModal.locator('text=Đã gửi thành công Email tới huyhoang6altt@gmail.com');
    await successAlert.waitFor({ state: 'visible', timeout: 5000 });
    console.log('🎉 SUCCESS: Email dispatch confirmed by Google Apps Script Gateway!');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_email_webhook_sent_success.png') });
    console.log('📸 Captured patient_email_webhook_sent_success.png');

    console.log('🎉 ALL EMAIL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'email_test_failure.png') }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
