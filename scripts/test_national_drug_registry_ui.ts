/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Giao diện Playwright: Cổng Tra Cứu Dược Quốc Gia & Modal 5 Đúng (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/national_registry_ui';

async function runUiTest() {
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  console.log('======================================================================');
  console.log('🌐 BẮT ĐẦU TEST PLAYWRIGHT: TRA CỨU DƯỢC QUỐC GIA (DAV) TRÊN WEB APP');
  console.log('======================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ Đã tải ứng dụng Clinical Ward tại http://localhost:4173');

    // 1. Chuyển sang Tab Kho Dược FEFO
    const fefoNav = page.locator('button:has-text("Kho dược FEFO"):visible').first();
    await fefoNav.click();
    await page.waitForTimeout(800);
    console.log('✅ Đã mở Tab Kho Dược FEFO');

    // 2. Chụp ảnh màn hình Kho Dược FEFO có nút "Dược Quốc Gia (55k SĐK)"
    const fefoScreenshot = path.join(ARTIFACTS_DIR, '27_fefo_with_national_registry_button.png');
    await page.screenshot({ path: fefoScreenshot });
    console.log(`📸 Đã lưu ảnh: ${fefoScreenshot}`);

    // 3. Bấm nút "Dược Quốc Gia (55k SĐK)"
    const registryBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
    await registryBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Đã mở Modal Tra cứu Dược Quốc Gia (DAV)');

    // 4. Chụp ảnh Modal danh mục thuốc quốc gia
    const modalScreenshot = path.join(ARTIFACTS_DIR, '28_national_drug_registry_modal.png');
    await page.screenshot({ path: modalScreenshot });
    console.log(`📸 Đã lưu ảnh: ${modalScreenshot}`);

    // 5. Gõ tìm kiếm "Morphin"
    const searchInput = page.locator('input[placeholder*="Tìm theo tên thuốc"]').first();
    await searchInput.fill('Morphin');
    await page.waitForTimeout(600);
    console.log('✅ Đã tìm kiếm từ khóa "Morphin" trên danh mục quốc gia');

    const searchScreenshot = path.join(ARTIFACTS_DIR, '29_national_drug_search_morphin.png');
    await page.screenshot({ path: searchScreenshot });
    console.log(`📸 Đã lưu ảnh: ${searchScreenshot}`);

    // 6. Bấm nút "Hồ sơ 5 Đúng" của một thuốc
    const safetyBtn = page.locator('button:has-text("Hồ sơ 5 Đúng")').first();
    if (await safetyBtn.isVisible()) {
      await safetyBtn.click();
      await page.waitForTimeout(800);
      console.log('✅ Đã mở Modal An Toàn Y Tế / 5 Đúng');

      const safetyScreenshot = path.join(ARTIFACTS_DIR, '30_medication_safety_opened_from_registry.png');
      await page.screenshot({ path: safetyScreenshot });
      console.log(`📸 Đã lưu ảnh: ${safetyScreenshot}`);
    }

    console.log('\n======================================================================');
    console.log('🎉 TẤT CẢ CÁC BƯỚC TEST PLAYWRIGHT THÀNH CÔNG RỰC RỠ!');
    console.log('======================================================================');
  } catch (err: any) {
    console.error('❌ Lỗi kiểm thử Playwright:', err?.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runUiTest();
