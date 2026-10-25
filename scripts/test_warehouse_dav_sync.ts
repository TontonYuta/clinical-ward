/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Tự Động Playwright: Đồng Bộ 100% Kho Dược & Dược Quốc Gia (DAV) (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/warehouse_dav_sync_ui';

async function runWarehouseDavSyncTest() {
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  console.log('======================================================================');
  console.log('🔬 BẮT ĐẦU TEST PLAYWRIGHT: ĐỒNG BỘ KHO DƯỢC & DƯỢC QUỐC GIA (DAV)');
  console.log('======================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ 1. Đã tải ứng dụng tại http://localhost:4173');

    // 1. Mở Tab Kho Dược FEFO
    const fefoNav = page.locator('button:has-text("Kho dược FEFO"):visible').first();
    await fefoNav.click();
    await page.waitForTimeout(600);
    console.log('✅ 2. Đã chuyển sang Tab Kho Dược FEFO');

    // Kiểm tra các nhãn SĐK trong bảng Kho Dược
    const sdkBadges = page.locator('text=SĐK:');
    const sdkCount = await sdkBadges.count();
    console.log(`✅ 3. Tìm thấy ${sdkCount} huy hiệu SĐK hiển thị trực tiếp trên dòng lô hàng`);
    if (sdkCount < 5) throw new Error(`Số lượng badge SĐK trong kho dược quá ít: ${sdkCount}`);

    const fefoScreenshot = path.join(ARTIFACTS_DIR, '01_kho_duoc_with_sdk_badges.png');
    await page.screenshot({ path: fefoScreenshot });
    console.log(`📸 Lưu ảnh: ${fefoScreenshot}`);

    // Test tìm kiếm theo SĐK trong Kho Dược
    const fefoSearch = page.locator('input[placeholder*="Tìm tên thuốc"]:visible').first();
    await fefoSearch.fill('VN-17036-13');
    await page.waitForTimeout(500);
    const ceftriaxoneBatch = page.locator('tr:has-text("Ceftriaxone"):visible').first();
    if (!(await ceftriaxoneBatch.isVisible())) throw new Error('Tìm kiếm theo SĐK VN-17036-13 không hiển thị Ceftriaxone!');
    console.log('✅ 4. Tìm kiếm theo SĐK VN-17036-13 trong Kho Dược thành công');

    const searchSdkScreenshot = path.join(ARTIFACTS_DIR, '02_kho_duoc_search_by_sdk.png');
    await page.screenshot({ path: searchSdkScreenshot });
    console.log(`📸 Lưu ảnh: ${searchSdkScreenshot}`);

    // Xóa tìm kiếm để khôi phục danh sách
    await fefoSearch.fill('');
    await page.waitForTimeout(400);

    // 2. Mở Cổng Dữ Liệu Dược Quốc Gia
    const registryBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
    await registryBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ 5. Đã mở Cổng Dữ Liệu Dược Quốc Gia');

    // Kiểm tra đồng bộ Kho BV hiển thị trên header
    const syncHeader = page.locator('text=Đồng bộ Kho BV').first();
    if (!(await syncHeader.isVisible())) throw new Error('Không thấy nhãn Đồng bộ Kho BV trong header modal!');
    console.log('✅ 6. Header hiển thị đúng: Đồng bộ Kho BV');

    // Bấm nút lọc "Kho Dược BV"
    const inWarehouseTab = page.locator('button:has-text("Kho Dược BV"):visible').first();
    await inWarehouseTab.click();
    await page.waitForTimeout(500);
    console.log('✅ 7. Đã bấm bộ lọc "Kho Dược BV"');

    const inWarehouseScreenshot = path.join(ARTIFACTS_DIR, '03_dav_filtered_in_warehouse.png');
    await page.screenshot({ path: inWarehouseScreenshot });
    console.log(`📸 Lưu ảnh: ${inWarehouseScreenshot}`);

    // Kiểm tra Morphin và Ceftriaxone trong Modal Cổng Dược Quốc Gia
    const morphinRow = page.locator('[role="dialog"] tr:has-text("Morphin sulfat")').first();
    const morphinStockText = await morphinRow.innerText();
    console.log('Morphin Row Text in Modal:', morphinStockText.replace(/\n/g, ' '));
    if (!morphinStockText.includes('VD-28087-17') || !morphinStockText.includes('398 Ống') || !morphinStockText.includes('2 lô')) {
      throw new Error(`Morphin tồn kho hoặc SĐK không khớp! Nhận được: ${morphinStockText}`);
    }
    console.log('✅ 8. Morphin khớp 100%: SĐK VD-28087-17, Tồn 398 Ống (2 lô)');

    const ceftriaxoneRow = page.locator('[role="dialog"] tr:has-text("Ceftriaxone")').first();
    const ceftriaxoneStockText = await ceftriaxoneRow.innerText();
    console.log('Ceftriaxone Row Text in Modal:', ceftriaxoneStockText.replace(/\n/g, ' '));
    if (!ceftriaxoneStockText.includes('VN-17036-13') || !ceftriaxoneStockText.includes('465 Lọ') || !ceftriaxoneStockText.includes('2 lô')) {
      throw new Error(`Ceftriaxone tồn kho hoặc SĐK không khớp! Nhận được: ${ceftriaxoneStockText}`);
    }
    console.log('✅ 9. Ceftriaxone khớp 100%: SĐK VN-17036-13, Tồn 465 Lọ (2 lô)');

    // 3. Test xuất kho FEFO và kiểm tra tính Đồng bộ Thời gian thực (Dynamic Sync)
    const closeBtn = page.locator('[role="dialog"] button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await page.waitForTimeout(400);

    // Chuyển vai trò sang Dược sĩ (DS. Ngọc) để có thẩm quyền ký lệnh xuất kho
    const roleSelect = page.locator('header select').first();
    await roleSelect.selectOption('pharmacist');
    await page.waitForTimeout(400);

    // Xuất 10 lọ Ceftriaxone theo FEFO
    const dispatchCefrBtn = page.locator('table tbody tr:has-text("Kháng sinh Ceftriaxone 1g") button:has-text("Xuất FEFO"):visible').first();
    await dispatchCefrBtn.click();
    await page.waitForTimeout(600);

    // Xác thực ký số lâm sàng (Clinical Auth)
    const quickFillBtn = page.locator('button:has-text("Điền nhanh PIN demo"):visible').first();
    if (await quickFillBtn.isVisible()) {
      await quickFillBtn.click();
      await page.waitForTimeout(300);
      const authSubmitBtn = page.locator('button[type="submit"]:visible').first();
      await authSubmitBtn.click();
      await page.waitForTimeout(1200);
    }
    console.log('✅ 10. Đã ký xác thực xuất kho FEFO 10 lọ Ceftriaxone (lô cận hạn từ 65 -> 55)');

    // Mở lại Dược Quốc Gia và kiểm tra số tồn đã tự động giảm xuống 455 Lọ!
    await registryBtn.click();
    await page.waitForTimeout(600);
    const inWarehouseTabAgain = page.locator('[role="dialog"] button:has-text("Kho Dược BV")').first();
    await inWarehouseTabAgain.click();
    await page.waitForTimeout(400);

    const ceftriaxoneRowAfter = page.locator('[role="dialog"] tr:has-text("Ceftriaxone")').first();
    const ceftriaxoneStockAfterText = await ceftriaxoneRowAfter.innerText();
    console.log('Ceftriaxone Row Sau Khi Xuất FEFO:', ceftriaxoneStockAfterText.replace(/\n/g, ' '));
    if (!ceftriaxoneStockAfterText.includes('455 Lọ')) {
      throw new Error(`Tồn kho sau khi xuất FEFO không tự động đồng bộ (Kỳ vọng 455 Lọ)! Nhận được: ${ceftriaxoneStockAfterText}`);
    }
    console.log('✅ 11. ĐỒNG BỘ THỜI GIAN THỰC HOÀN HẢO: Ceftriaxone tự động cập nhật còn 455 Lọ!');

    const dynamicSyncScreenshot = path.join(ARTIFACTS_DIR, '04_dynamic_sync_after_dispatch.png');
    await page.screenshot({ path: dynamicSyncScreenshot });
    console.log(`📸 Lưu ảnh: ${dynamicSyncScreenshot}`);

    console.log('\n======================================================================');
    console.log('🎉 TOÀN BỘ KIỂM THỬ ĐỒNG BỘ KHO DƯỢC & DƯỢC QUỐC GIA 100% THÀNH CÔNG!');
    console.log('======================================================================');
  } catch (err: any) {
    console.error('❌ Lỗi kiểm thử Playwright:', err?.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runWarehouseDavSyncTest();
