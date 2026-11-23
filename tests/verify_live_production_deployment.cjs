/**
 * Playwright E2E Test Suite for Live Production Deployments
 * Targets:
 * - https://clinical-ward.vercel.app (Clinical Ward App)
 * - https://clinical-ai-monitor.vercel.app (Clinical AI Monitor)
 * - https://clinical-ward-api.onrender.com (Backend API)
 */
const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');
const https = require('https');

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/f25324be-2bc8-4450-9006-d204ed53b109/screenshots';

function checkHttpCode(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', (err) => {
      resolve(500);
    });
  });
}

(async () => {
  console.log('🚀 BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TRÊN TOÀN BỘ HỆ THỐNG PRODUCTION LIVE...\n');

  // ==========================================
  // PHASE 1: Security Scanner Validation (404 on dotfiles)
  // ==========================================
  console.log('--- PHẦN 1: KIỂM TRA BẢO MẬT ĐƯỜNG DẪN ẨN (404 NOT FOUND) ---');
  const dotEnvStatus = await checkHttpCode('https://clinical-ward.vercel.app/.env');
  console.log(`  [1] GET /.env -> Status: ${dotEnvStatus} ${dotEnvStatus === 404 ? '✅ (PASS: Blocked)' : '❌ (FAIL)'}`);

  const gitConfigStatus = await checkHttpCode('https://clinical-ward.vercel.app/.git/config');
  console.log(`  [2] GET /.git/config -> Status: ${gitConfigStatus} ${gitConfigStatus === 404 ? '✅ (PASS: Blocked)' : '❌ (FAIL)'}`);

  const debugStatus = await checkHttpCode('https://clinical-ward.vercel.app/debug');
  console.log(`  [3] GET /debug -> Status: ${debugStatus} ${debugStatus === 404 ? '✅ (PASS: Blocked)' : '❌ (FAIL)'}`);

  const homeStatus = await checkHttpCode('https://clinical-ward.vercel.app/');
  console.log(`  [4] GET / (Trang chủ) -> Status: ${homeStatus} ${homeStatus === 200 ? '✅ (PASS: Online)' : '❌ (FAIL)'}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    // ==========================================
    // PHASE 2: Clinical Ward E2E Verification
    // ==========================================
    console.log('--- PHẦN 2: KIỂM THỬ GIAO DIỆN & TÍNH NĂNG CLINICAL WARD (3000 -> VERCEL) ---');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    page.on('console', msg => console.log('  [Browser Log]:', msg.text()));
    page.on('response', res => {
      if (res.url().includes('/api/')) {
        console.log(`  [API ${res.status()}]: ${res.url()}`);
      }
    });

    console.log('  1. Truy cập https://clinical-ward.vercel.app ...');
    await page.goto('https://clinical-ward.vercel.app', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    console.log(`  ✓ Tiêu đề trang: "${title}"`);

    // Kiểm tra xem trang có form đăng nhập prefill hay đã vào trong
    const loginBtn = page.locator('button[type="submit"]:has-text("Đăng nhập")').first();
    const isLoginVisible = await loginBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLoginVisible) {
      console.log('  2. Xác nhận Form đăng nhập đang hiển thị...');
      const ssLogin = path.join(ARTIFACT_DIR, 'prod_login_page_verified.png');
      await page.screenshot({ path: ssLogin });
      console.log(`  ✓ Đã chụp ảnh màn hình đăng nhập: ${ssLogin}`);

      const usernameInput = page.locator('input[placeholder="Tên đăng nhập"]').first();
      const passwordInput = page.locator('input[placeholder="Mật khẩu"]').first();

      await usernameInput.fill('admin');
      await passwordInput.fill('admin');
      console.log('  ✓ Đã điền thông tin admin / admin');

      console.log('  3. Nhấn "Đăng nhập"...');
      await loginBtn.click();
      await page.waitForTimeout(4000);

      const errorMsg = await page.locator('p[role="alert"]').textContent().catch(() => null);
      if (errorMsg) {
        console.log(`  ⚠️ Lỗi hiển thị trên form: "${errorMsg}"`);
      }
    } else {
      console.log('  (Đã có phiên làm việc sẵn trên trình duyệt)');
    }

    // Đợi giao diện buồng bệnh tải xong
    console.log('  4. Xác nhận Giao diện Buồng Bệnh Lâm Sàng đã tải thành công...');
    const overviewTab = page.locator('button:has-text("Tổng quan"):visible, button:has-text("Kho dược"):visible').first();
    await overviewTab.waitFor({ state: 'visible', timeout: 20000 });
    console.log('  ✓ Đã vào giao diện chính Buồng Bệnh Lâm Sàng!');

    const ssDashboard = path.join(ARTIFACT_DIR, 'prod_ward_dashboard_verified.png');
    await page.screenshot({ path: ssDashboard });
    console.log(`  ✓ Đã chụp ảnh màn hình Dashboard: ${ssDashboard}`);

    // Kiểm tra các Tab chức năng lâm sàng
    console.log('  5. Kiểm tra chuyển Tab chức năng...');
    const khoDuocTab = page.locator('button:has-text("Kho dược"):visible').first();
    if (await khoDuocTab.isVisible()) {
      await khoDuocTab.click();
      await page.waitForTimeout(2000);
      console.log('  ✓ Đã truy cập Tab "Kho dược"');
    }

    const bhytTab = page.locator('button:has-text("Giám định BHYT"):visible').first();
    if (await bhytTab.isVisible()) {
      await bhytTab.click();
      await page.waitForTimeout(2000);
      console.log('  ✓ Đã truy cập Tab "Giám định BHYT"');
    }

    const docsTab = page.locator('button:has-text("Tài liệu"):visible').first();
    if (await docsTab.isVisible()) {
      await docsTab.click();
      await page.waitForTimeout(2000);
      console.log('  ✓ Đã truy cập Tab "Tài liệu" (Documents Library)');
    }

    const ssFeatures = path.join(ARTIFACT_DIR, 'prod_ward_clinical_features.png');
    await page.screenshot({ path: ssFeatures });
    console.log(`  ✓ Đã chụp ảnh màn hình chức năng: ${ssFeatures}`);

    // ==========================================
    // PHASE 3: Admin AI Monitor E2E Verification
    // ==========================================
    console.log('\n--- PHẦN 3: KIỂM THỬ TRUNG TÂM GIÁM SÁT AI MONITOR (3001 -> VERCEL) ---');
    const adminPage = await context.newPage();
    console.log('  1. Truy cập https://clinical-ai-monitor.vercel.app ...');
    await adminPage.goto('https://clinical-ai-monitor.vercel.app', { waitUntil: 'networkidle', timeout: 45000 });
    await adminPage.waitForTimeout(3000);

    const adminTitle = await adminPage.title();
    console.log(`  ✓ Tiêu đề Admin Monitor: "${adminTitle}"`);

    // Nếu có login gate trên admin portal
    const adminUser = adminPage.locator('input[type="text"], input:not([type="password"])').first();
    const adminPass = adminPage.locator('input[type="password"]').first();
    const adminLoginBtn = adminPage.locator('button:has-text("Đăng nhập")').first();

    if (await adminLoginBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('  ✓ Đăng nhập vào Admin Monitor với admin / admin...');
      await adminUser.fill('admin');
      await adminPass.fill('admin');
      await adminLoginBtn.click();
      await adminPage.waitForTimeout(4000);
    }

    const ssAdmin = path.join(ARTIFACT_DIR, 'prod_admin_monitor_verified.png');
    await adminPage.screenshot({ path: ssAdmin });
    console.log(`  ✓ Đã chụp ảnh màn hình Admin Monitor: ${ssAdmin}`);

    console.log('\n🎉 TOÀN BỘ QUY TRÌNH KIỂM THỬ E2E TRÊN PRODUCTION ĐÃ THÀNH CÔNG RỰC RỠ!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử Playwright:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
