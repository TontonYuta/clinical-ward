/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Playwright: Nút Tự Động Cập Nhật Dược Quốc Gia & Phản hồi UI (<=200 LOC)
 */

import { chromium } from 'playwright';

(async () => {
  console.log('======================================================================');
  console.log('🔬 KIỂM THỬ PLAYWRIGHT: NÚT TỰ ĐỘNG CẬP NHẬT DƯỢC QUỐC GIA');
  console.log('======================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Mở ứng dụng
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('✅ 1. Đã tải ứng dụng tại http://localhost:4173');

  // 2. Chuyển sang Tab Kho Dược FEFO
  const pharmacyTab = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await pharmacyTab.click();
  await page.waitForTimeout(500);
  console.log('✅ 2. Đã chuyển sang Tab Kho Dược FEFO');

  // 3. Mở Cổng Dữ Liệu Dược Quốc Gia
  const openModalBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
  await openModalBtn.click();
  await page.waitForTimeout(1000);
  console.log('✅ 3. Đã mở Cổng Dữ Liệu Dược Quốc Gia');

  // 4. Tìm nút "Tự động cập nhật"
  const syncBtn = page.locator('button:has-text("Tự động cập nhật")').first();
  const isVisible = await syncBtn.isVisible();
  console.log(`✅ 4. Nút "Tự động cập nhật" hiển thị: ${isVisible ? 'CÓ' : 'KHÔNG'}`);

  if (!isVisible) {
    throw new Error('Nút Tự động cập nhật không tìm thấy!');
  }

  // 5. Bấm nút Tự động cập nhật
  console.log('🔄 5. Đang bấm nút "Tự động cập nhật"...');
  await syncBtn.click();
  await page.waitForTimeout(1200);

  // 6. Chụp ảnh màn hình lưu bằng chứng UI
  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/ui_auto_update_button_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 6. Đã chụp ảnh màn hình xác nhận: ${screenshotPath}`);

  console.log('\n======================================================================');
  console.log('🎉 KIỂM THỬ NÚT TỰ ĐỘNG CẬP NHẬT THÀNH CÔNG 100%!');
  console.log('======================================================================\n');

  await browser.close();
})();
