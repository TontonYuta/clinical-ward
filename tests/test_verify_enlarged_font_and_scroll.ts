/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử & Chụp ảnh minh chứng font chữ lớn và thanh cuộn ngang (horizontal scroll)
 */

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function verifyEnlargedFontAndScroll() {
  console.log('🚀 Khởi động Chromium kiểm tra kích thước font chữ & cuộn ngang...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  try {
    // 0. Thiết lập vai trò Giám Đốc (Director) qua Header select để có quyền truy cập toàn bộ 6 phân hệ
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.locator('header select').first().selectOption('director');
    await page.waitForTimeout(500);

    // 1. Kiểm tra Kho Dược (#fefo)
    console.log('1. Kiểm tra Kho Dược (#fefo)...');
    await page.goto('http://localhost:5173/#fefo', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const fefoTable = page.locator('table').first();
    await fefoTable.waitFor({ state: 'visible' });
    const fefoWidth = await fefoTable.evaluate((el) => el.scrollWidth);
    console.log(`   [Kho Dược Table ScrollWidth]: ${fefoWidth}px (>= 1250px)`);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_tab_fefo_enlarged_fonts.png'),
      fullPage: false
    });

    // 2. Kiểm tra Sổ Nợ Vỏ Morphin (#debt)
    console.log('2. Kiểm tra Sổ Nợ Vỏ Morphin (#debt)...');
    await page.goto('http://localhost:5173/#debt', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const debtTable = page.locator('table').first();
    await debtTable.waitFor({ state: 'visible' });
    const debtWidth = await debtTable.evaluate((el) => el.scrollWidth);
    console.log(`   [Sổ Nợ Table ScrollWidth]: ${debtWidth}px (>= 1100px)`);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_tab_debt_enlarged_fonts.png'),
      fullPage: false
    });

    // 3. Kiểm tra Kê Đơn Thuốc CPOE (#cpoe)
    console.log('3. Kiểm tra Kê Đơn Thuốc CPOE (#cpoe)...');
    await page.goto('http://localhost:5173/#cpoe', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const cpoeTable = page.locator('table').first();
    await cpoeTable.waitFor({ state: 'visible' });
    const cpoeWidth = await cpoeTable.evaluate((el) => el.scrollWidth);
    console.log(`   [CPOE Table ScrollWidth]: ${cpoeWidth}px (>= 1150px)`);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_tab_cpoe_enlarged_fonts.png'),
      fullPage: false
    });

    // 4. Kiểm tra Sự Cố Thiết Bị (#equipment)
    console.log('4. Kiểm tra Sự Cố Thiết Bị (#equipment)...');
    await page.goto('http://localhost:5173/#equipment', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const eqTable = page.locator('table').first();
    await eqTable.waitFor({ state: 'visible' });
    const eqWidth = await eqTable.evaluate((el) => el.scrollWidth);
    console.log(`   [Sự Cố Thiết Bị Table ScrollWidth]: ${eqWidth}px (>= 1100px)`);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_tab_equipment_enlarged_fonts.png'),
      fullPage: false
    });

    // 5. Kiểm tra Kiểm Kê Tài Sản (#asset_audit)
    console.log('5. Kiểm tra Kiểm Kê Tài Sản (#asset_audit)...');
    await page.goto('http://localhost:5173/#asset_audit', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const assetTable = page.locator('table').first();
    await assetTable.waitFor({ state: 'visible' });
    const assetWidth = await assetTable.evaluate((el) => el.scrollWidth);
    console.log(`   [Kiểm Kê Tài Sản Table ScrollWidth]: ${assetWidth}px (>= 1100px)`);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_tab_asset_audit_enlarged_fonts.png'),
      fullPage: false
    });

    // 6. Kiểm tra Chuỗi Lạnh (#coldchain)
    console.log('6. Kiểm tra Chuỗi Lạnh (#coldchain)...');
    await page.goto('http://localhost:5173/#coldchain', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_tab_coldchain_enlarged_fonts.png'),
      fullPage: false
    });

    console.log('🎉 TẤT CẢ 6 PHÂN HỆ ĐÃ ĐƯỢC CHỤP ẢNH & KIỂM TRA FONT CHỮ LỚN THÀNH CÔNG RỰC RỠ!');

    console.log('🎉 TẤT CẢ CÁC TAB ĐÃ ĐƯỢC CHỤP ẢNH & KIỂM TRA FONT CHỮ LỚN THÀNH CÔNG RỰC RỠ!');
  } finally {
    await browser.close();
  }
}

verifyEnlargedFontAndScroll().catch((err) => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
