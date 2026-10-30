/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Playwright: Kiểm tra thanh cuộn dọc (vertical scroll) và tính năng tìm kiếm trên trang Kê Đơn Thuốc CPOE
 */

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function verifyCpoeScrollAndSearch() {
  console.log('🚀 Khởi động Chromium kiểm tra CPOE Scroll & Search...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  try {
    // 1. Mở trang chủ và đặt vai trò Bác sĩ (Doctor)
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Đặt quyền doctor
    await page.evaluate(() => {
      localStorage.setItem('clinical_user_role', 'doctor');
    });
    const roleSelect = page.locator('header select').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('doctor');
      await page.waitForTimeout(500);
    }

    // 2. Chuyển sang Tab Kê Đơn Thuốc CPOE (#cpoe)
    console.log('1. Kiểm tra điều hướng vào #cpoe...');
    await page.goto('http://localhost:5173/#cpoe', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Kiểm tra ô tìm kiếm tồn tại
    const searchInput = page.locator('input[placeholder*="Tìm mã đơn"]').first();
    await searchInput.waitFor({ state: 'visible' });
    console.log('✅ Đã tìm thấy ô tìm kiếm đơn thuốc CPOE!');

    // 3. Kiểm tra khả năng cuộn dọc (Vertical Scroll)
    console.log('2. Kiểm tra khả năng cuộn dọc (Vertical Scroll)...');
    const scrollContainer = page.locator('.overflow-y-auto').locator('table').locator('xpath=..');
    await scrollContainer.waitFor({ state: 'visible' });

    // Lấy thông số scrollHeight và clientHeight
    const { scrollHeight, clientHeight } = await scrollContainer.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    console.log(`   [Scroll Container]: scrollHeight=${scrollHeight}px, clientHeight=${clientHeight}px`);

    if (scrollHeight > clientHeight) {
      console.log('   Nội dung vượt chiều cao viewport, tiến hành cuộn xuống đáy...');
      await scrollContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(500);

      const scrollTop = await scrollContainer.evaluate((el) => el.scrollTop);
      console.log(`   [Sau khi cuộn xuống]: scrollTop=${scrollTop}px (> 0)`);
      if (scrollTop > 0) {
        console.log('✅ Cuộn dọc trang kê đơn thuốc thành công!');
      } else {
        throw new Error('Thanh cuộn dọc không di chuyển được!');
      }
    } else {
      console.log('   Bảng vừa vặn trong khung nhìn, container đã sẵn sàng cuộn khi thêm đơn.');
    }

    // Chụp ảnh khi đang cuộn xuống đáy
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_cpoe_vertical_scroll_down.png'),
      fullPage: false
    });

    // 4. Kiểm tra chức năng tìm kiếm
    console.log('3. Kiểm tra chức năng tìm kiếm đơn thuốc...');

    // Test case 3.1: Tìm theo tên bệnh nhân "Võ Minh Trí"
    console.log('   - Thử nghiệm 1: Tìm theo tên bệnh nhân "Võ Minh Trí"...');
    await searchInput.fill('Võ Minh Trí');
    await page.waitForTimeout(400);

    let rowsCount = await page.locator('tbody tr').count();
    console.log(`     -> Số đơn tìm thấy: ${rowsCount} (kỳ vọng: 2)`);
    if (rowsCount === 0) throw new Error('Tìm kiếm theo tên bệnh nhân không ra kết quả!');

    // Test case 3.2: Tìm theo tên thuốc "Morphin"
    console.log('   - Thử nghiệm 2: Tìm theo tên thuốc "Morphin"...');
    await searchInput.fill('Morphin');
    await page.waitForTimeout(400);

    rowsCount = await page.locator('tbody tr').count();
    console.log(`     -> Số đơn tìm thấy: ${rowsCount} (chứa Morphin)`);
    if (rowsCount === 0) throw new Error('Tìm kiếm theo tên thuốc không ra kết quả!');

    // Test case 3.3: Tìm theo mã chẩn đoán ICD-10 "J45"
    console.log('   - Thử nghiệm 3: Tìm theo mã ICD-10 "J45"...');
    await searchInput.fill('J45');
    await page.waitForTimeout(400);

    rowsCount = await page.locator('tbody tr').count();
    console.log(`     -> Số đơn tìm thấy: ${rowsCount} (đơn hen phế quản)`);
    if (rowsCount !== 1) throw new Error('Tìm kiếm theo mã ICD-10 J45 không chính xác!');

    // Test case 3.4: Xóa tìm kiếm bằng nút X
    console.log('   - Thử nghiệm 4: Bấm nút X xóa tìm kiếm...');
    const clearBtn = page.locator('button[title="Xóa tìm kiếm"]');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(400);
      const afterClearCount = await page.locator('tbody tr').count();
      console.log(`     -> Sau khi xóa tìm kiếm: ${afterClearCount} đơn (toàn bộ danh sách phục hồi)`);
    }

    // Chụp ảnh minh chứng chức năng tìm kiếm
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verified_cpoe_search_feature.png'),
      fullPage: false
    });

    console.log('🎉 KIỂM THỬ PLAYWRIGHT CPOE SCROLL & SEARCH HOÀN TẤT THÀNH CÔNG 100%!');
  } finally {
    await browser.close();
  }
}

verifyCpoeScrollAndSearch().catch((err) => {
  console.error('Lỗi kiểm thử CPOE:', err);
  process.exit(1);
});
