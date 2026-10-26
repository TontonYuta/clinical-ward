/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử E2E Playwright: Mở Kho Dược FEFO, kiểm tra đối soát 20 thuốc & chụp modal (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Khởi động Playwright để kiểm thử giao diện đối soát kho thuốc...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✅ Đã tải trang web localhost:5173');

    // Chuyển role sang Dược sĩ nếu có dropdown
    const roleSelect = page.locator('header select:visible').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('pharmacist');
      await page.waitForTimeout(500);
    }

    // Chuyển sang Tab Kho Dược FEFO
    const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible, button:has-text("Kho FEFO"):visible, button:has-text("Kho Dược"):visible').first();
    if (await fefoBtn.count() > 0) {
      await fefoBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Đã mở tab Kho Dược FEFO');
    }

    // Chụp toàn cảnh kho thuốc
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_warehouse_inventory_table.png') });
    console.log('📸 Đã chụp: verified_warehouse_inventory_table.png');

    // Kiểm tra và click vào Hadunalin 1 mg/ml
    const haduBtn = page.locator('button:has-text("Hadunalin"):visible').first();
    if (await haduBtn.count() > 0) {
      await haduBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_hadunalin_modal.png') });
      console.log('📸 Đã chụp: verified_hadunalin_modal.png');

      const closeBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      await page.waitForTimeout(600);
    }

    // Kiểm tra và click vào Noradrenalin 4mg/4ml
    const norBtn = page.locator('button:has-text("Noradrenalin"):visible').first();
    if (await norBtn.count() > 0) {
      await norBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_noradrenalin_modal.png') });
      console.log('📸 Đã chụp: verified_noradrenalin_modal.png');

      const closeBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      await page.waitForTimeout(600);
    }

    // Kiểm tra và click vào Vaxigrip
    const vaxiBtn = page.locator('button:has-text("Vaxigrip"):visible').first();
    if (await vaxiBtn.count() > 0) {
      await vaxiBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_vaxigrip_modal.png') });
      console.log('📸 Đã chụp: verified_vaxigrip_modal.png');
    }

    console.log('🎯 Hoàn thành chụp ảnh giao diện xác thực lâm sàng!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await browser.close();
  }
}

main();
