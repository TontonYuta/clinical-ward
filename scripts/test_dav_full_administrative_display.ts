/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E Test: Toàn diện thông tin hành chính Cục QLD (Quy cách, Tiêu chuẩn, Tuổi thọ, NSX, Cty ĐK) (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử Playwright hiển thị toàn diện thông tin hành chính DAV...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Mở ứng dụng
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ Đã tải trang web thành công');

    // 2. Chuyển sang tab Kho Dược FEFO
    const fefoTab = page.locator('button:has-text("Kho dược FEFO"):visible').first();
    await fefoTab.click();
    await page.waitForTimeout(600);
    console.log('✅ Đã chuyển sang tab Kho Dược FEFO');

    // 3. Mở Giấy công bố thuốc từ Kho Dược BV (PARACETAMOL 500mg)
    console.log('📋 Kiểm tra Modal Công bố Thuốc từ Kho Dược BV...');
    const detailBtn = page.locator('tbody tr:has-text("PARACETAMOL 500mg"):visible button:has-text("Chi tiết")').first();
    await detailBtn.click();
    await page.waitForSelector('text=Thông Tin Công Bố Thuốc Lưu Hành', { timeout: 5000 });

    // Kiểm tra các trường thông tin hành chính mới
    const modal = page.locator('.fixed.inset-0:visible').last();
    await modal.locator('text=Tiêu chuẩn & Tuổi thọ lưu hành').waitFor({ state: 'visible', timeout: 3000 });
    await modal.locator('text=Doanh nghiệp đăng ký').waitFor({ state: 'visible', timeout: 3000 });
    await modal.locator('text=Cơ sở sản xuất').waitFor({ state: 'visible', timeout: 3000 });
    await modal.locator('text=Căn cứ cấp phép').waitFor({ state: 'visible', timeout: 3000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'playwright_dav_full_paracetamol_modal.png'),
      fullPage: false,
    });
    console.log('📸 Đã chụp: playwright_dav_full_paracetamol_modal.png');

    // Đóng modal
    await modal.locator('button:has(svg.lucide-x)').first().click();
    await page.waitForTimeout(400);

    // 4. Mở Cổng Dữ Liệu Dược Quốc Gia 55.000 SĐK
    console.log('🏛️ Mở Cổng Dữ Liệu Dược Quốc Gia 55k...');
    const registryBtn = page.locator('button:has-text("Cổng Dược Quốc Gia"):visible').first();
    await registryBtn.click();
    await page.waitForSelector('text=Cổng Dữ Liệu Dược Quốc Gia', { timeout: 6000 });

    // Tìm kiếm thuốc Venclexta
    const searchInput = page.locator('input[placeholder*="Tìm trên 55.000"]:visible').first();
    await searchInput.fill('Venclexta');
    await page.waitForTimeout(800);

    // Bấm xem chi tiết công bố của thuốc Venclexta trong bảng 55k
    const venclextaDetailBtn = page.locator('tbody tr:has-text("Venclexta"):visible button:has-text("Chi tiết")').first();
    await venclextaDetailBtn.click();
    await page.waitForSelector('text=Thông Tin Công Bố Thuốc Lưu Hành', { timeout: 5000 });

    // Kiểm tra thông tin hành chính Venclexta trong modal
    const venclextaModal = page.locator('.fixed.inset-0:visible').last();
    await venclextaModal.locator('text=Hộp 1 Túi x 1 vỉ x 14 viên').first().waitFor({ state: 'visible', timeout: 3000 });
    await venclextaModal.locator('text=24 tháng').first().waitFor({ state: 'visible', timeout: 3000 });
    await venclextaModal.locator('text=AbbVie Ireland NL B.V').first().waitFor({ state: 'visible', timeout: 3000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'playwright_dav_55k_venclexta_detail.png'),
      fullPage: false,
    });
    console.log('📸 Đã chụp: playwright_dav_55k_venclexta_detail.png');

    console.log('🎉 100% CÁC KIỂM THỬ PLAYWRIGHT HOÀN THÀNH XUẤT SẮC!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'playwright_dav_test_error.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

main();
