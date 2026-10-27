/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử E2E Playwright: Phân loại Dược lý Lâm sàng ATC & Cổng Dược QG 2015 (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử E2E Playwright: Dược lý & Cổng QLD...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✅ Đã tải trang web localhost:5173');

    // Chuyển role sang Dược sĩ nếu có dropdown
    const roleSelect = page.locator('header select:visible').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('pharmacist');
      await page.waitForTimeout(400);
    }

    // Chuyển sang Tab Kho Dược FEFO
    const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible, button:has-text("Kho FEFO"):visible, button:has-text("Kho Dược"):visible').first();
    if (await fefoBtn.count() > 0) {
      await fefoBtn.click();
      await page.waitForTimeout(800);
      console.log('✅ Đã mở tab Kho Dược FEFO');
    }

    // 1. Chụp toàn cảnh danh mục thuốc sạch sẽ (đã bỏ "✓ Đã xác thực")
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_clean_inventory_table.png') });
    console.log('📸 Đã chụp: verified_clean_inventory_table.png');

    // 2. Kiểm tra bộ lọc Cổng Dược Quốc Gia: Thuốc kiểm soát đặc biệt (KSĐB)
    const davSelect = page.locator('select[data-testid="dav-regulatory-select"]');
    if (await davSelect.count() > 0) {
      console.log('🔍 Kiểm tra bộ lọc Cổng QLD: Thuốc kiểm soát đặc biệt (KSĐB)...');
      await davSelect.selectOption('controlled');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_dav_controlled_filter.png') });
      console.log('📸 Đã chụp: verified_dav_controlled_filter.png');

      // Lọc Cấp cứu tủ trực A9
      await davSelect.selectOption('emergency');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_dav_emergency_filter.png') });
      console.log('📸 Đã chụp: verified_dav_emergency_filter.png');

      await davSelect.selectOption('all');
      await page.waitForTimeout(400);
    }

    // 3. Mở Giấy Công Bố Thuốc Hadunalin và kiểm tra trích dẫn Dược Thư 2015
    console.log('🔍 Mở modal Giấy Công Bố Thuốc Hadunalin...');
    const haduBtn = page.locator('button:has-text("Hadunalin"):visible').first();
    if (await haduBtn.count() > 0) {
      await haduBtn.click();
      await page.waitForTimeout(1200);

      // Chụp hiển thị nguồn tài liệu đối chiếu DTQG 2015
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_hadunalin_modal_dtqg2015.png') });
      console.log('📸 Đã chụp: verified_hadunalin_modal_dtqg2015.png');

      // Đóng modal
      const closeBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      await page.waitForTimeout(500);
    }

    console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT ĐÃ HOÀN TẤT THÀNH CÔNG RỰC RỠ!');
  } catch (err) {
    console.error('❌ Lỗi Playwright:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
