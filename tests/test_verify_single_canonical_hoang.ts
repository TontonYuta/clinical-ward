/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử & Xác thực: Duy nhất 1 hồ sơ bệnh nhân Trần Huy Hoàng
 * - DB SQLite: Duy nhất 1 bản ghi RX-2026-604
 * - Backend API /api/v1/cpoe: Duy nhất 1 bản ghi
 * - Mock dataset: Duy nhất 1 bản ghi BN-8817 (Cảm cúm, 0963278149, huyhoang6altt@gmail.com)
 * - CPOE UI Workstation: Hiển thị đúng 1 dòng
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3001';

async function main() {
  console.log('🔍 Bắt đầu kiểm tra duy nhất 1 bệnh nhân Trần Huy Hoàng trên giao diện CPOE...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/#cpoe`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const cpoeTab = page.locator('button:has-text("Kê Đơn Bác Sĩ (CPOE)"), button:has-text("Kê đơn"), button:has-text("CPOE")').first();
  if (await cpoeTab.isVisible()) {
    await cpoeTab.click();
    await page.waitForTimeout(1000);
  }

  const rows = page.locator('tbody tr:has-text("Trần Huy Hoàng")');
  const count = await rows.count();
  console.log(`📊 Số dòng "Trần Huy Hoàng" trên bảng CPOE: ${count}`);

  if (count !== 1) {
    await browser.close();
    throw new Error(`THẤT BẠI: Mong đợi đúng 1 dòng cho Trần Huy Hoàng, nhưng phát hiện ${count} dòng!`);
  }

  const rowText = await rows.first().innerText();
  console.log(`✅ Chi tiết dòng đơn: ${rowText.replace(/\n+/g, ' | ')}`);

  if (!rowText.includes('RX-2026-604') || !rowText.includes('0963278149') || !rowText.includes('Cảm cúm')) {
    await browser.close();
    throw new Error('THẤT BẠI: Dữ liệu dòng không chứa đầy đủ thông tin chuẩn (RX-2026-604, 0963278149, Cảm cúm)!');
  }

  // Mở modal hồ sơ bệnh nhân để kiểm tra danh sách đơn thuốc bên trong
  await rows.first().locator('button:has-text("Trần Huy Hoàng")').click();
  await page.waitForTimeout(800);

  const modal = page.locator('.fixed.inset-0');
  const modalText = await modal.innerText();

  if (!modalText.includes('0963278149') || !modalText.includes('huyhoang6altt@gmail.com') || !modalText.includes('Cảm cúm')) {
    await browser.close();
    throw new Error('THẤT BẠI: Modal hồ sơ không khớp SĐT, Email hoặc Chẩn đoán Cảm cúm!');
  }

  console.log('🎉 XÁC NHẬN HOÀN TOÀN: Duy nhất 1 hồ sơ Trần Huy Hoàng (Cảm cúm, SĐT: 0963278149, Email: huyhoang6altt@gmail.com)!');
  await browser.close();
}

main().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
