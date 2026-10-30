import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Capturing High-Res Screenshots of Left-Right Split Notification Modal...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Open Row 1
    const orderIdBtn = page.locator('table tbody tr').first().locator('[data-testid="cpoe-order-id-btn"]').first();
    await orderIdBtn.click();
    await page.waitForTimeout(500);

    // Open notification modal
    const openBtn = page.locator('[data-testid="btn-open-sms-from-order"]');
    await openBtn.click();
    await page.waitForTimeout(500);

    // 1. Screenshot SMS Channel Left-Right Split
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'split_modal_sms_channel.png') });
    console.log('📸 Captured split_modal_sms_channel.png');

    // 2. Switch to Email Channel
    const emailTabBtn = page.locator('button:has-text("Thư điện tử (Email)"):visible');
    await emailTabBtn.click();
    await page.waitForTimeout(500);

    // Screenshot Email Channel Left-Right Split
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'split_modal_email_channel.png') });
    console.log('📸 Captured split_modal_email_channel.png');

    console.log('🎉 Screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

main();
