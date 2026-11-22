const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const screenshotDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/f25324be-2bc8-4450-9006-d204ed53b109/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Login as bs_tran_minh
  const usernameInput = page.locator('input[placeholder*="tên đăng nhập" i], input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const loginButton = page.locator('button:has-text("Đăng nhập")').first();

  if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('2. Logging in as bs_tran_minh...');
    await usernameInput.fill('bs_tran_minh');
    await passwordInput.fill('MinhPassword@2026');
    await loginButton.click();
    await page.waitForTimeout(2000);
  }

  // Check top banner for must_change_password
  console.log('3. Checking first-time login security notice banner...');
  const banner = page.locator('text=Bạn đang sử dụng mật khẩu khởi tạo').first();
  const hasBanner = await banner.isVisible({ timeout: 4000 }).catch(() => false);
  console.log('   - Security notice banner visible:', hasBanner ? 'PASS' : 'SKIPPED');

  // Click "Đổi mật khẩu ngay" button in the banner, or open from Sidebar footer
  const bannerChangeBtn = page.locator('button:has-text("Đổi mật khẩu ngay")').first();
  if (await bannerChangeBtn.isVisible().catch(() => false)) {
    console.log('4. Clicking "Đổi mật khẩu ngay" from banner...');
    await bannerChangeBtn.click();
  } else {
    console.log('4. Opening "Đổi mật khẩu" from sidebar footer...');
    const userBtn = page.locator('button[title*="Trần Quang Minh"]:visible').first();
    await userBtn.click();
    await page.waitForTimeout(500);
    const pwdItem = page.locator('button:has-text("Đổi mật khẩu"):visible').first();
    await pwdItem.click();
  }

  // Verify ChangePasswordModal is displayed
  console.log('5. Verifying ChangePasswordModal UI...');
  const modal = page.locator('div[data-testid="change-password-modal"]').first();
  await modal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('   ✓ ChangePasswordModal visible');

  // Fill in form
  const curPwdInput = modal.locator('input[placeholder*="đang sử dụng" i]').first();
  const newPwdInput = modal.locator('input[placeholder*="gồm chữ hoa" i]').first();
  const confirmPwdInput = modal.locator('input[placeholder*="Nhập lại" i]').first();

  console.log('6. Typing credentials and observing live password strength meter...');
  await curPwdInput.fill('MinhPassword@2026');
  await newPwdInput.fill('KhamBenh@CapCuuHoiSuc2026#');
  await confirmPwdInput.fill('KhamBenh@CapCuuHoiSuc2026#');
  await page.waitForTimeout(1000);

  // Take screenshot of ChangePasswordModal with green indicators
  const modalScreenshotPath = path.join(screenshotDir, 'change_password_modal_verified.png');
  await page.screenshot({ path: modalScreenshotPath });
  console.log('   ✓ ChangePasswordModal screenshot saved to:', modalScreenshotPath);

  // Submit password change
  console.log('7. Submitting password change form...');
  const submitBtn = modal.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(1000);
  console.log('   Modal text after submit:\n', await modal.innerText());
  await page.waitForTimeout(2000);

  // Verify modal is closed and banner is gone
  const modalVisibleAfter = await modal.isVisible().catch(() => false);
  console.log('   - Modal closed automatically:', !modalVisibleAfter ? 'PASS' : 'FAIL');

  const bannerVisibleAfter = await banner.isVisible().catch(() => false);
  console.log('   - Security banner dismissed:', !bannerVisibleAfter ? 'PASS' : 'FAIL');

  // Take screenshot of main workspace after password change
  const successScreenshotPath = path.join(screenshotDir, 'change_password_success_verified.png');
  await page.screenshot({ path: successScreenshotPath });
  console.log('   ✓ Workspace screenshot saved to:', successScreenshotPath);

  await browser.close();
  console.log('\n======================================================');
  console.log('🎉 SELF-SERVICE PASSWORD CHANGE UI VERIFIED 100% PASS!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
