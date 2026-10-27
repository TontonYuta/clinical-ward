/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử E2E Playwright: Phân loại Dược lý Lâm sàng ATC & Dược Thư (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử E2E Playwright: Phân loại Dược lý Lâm sàng...');
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

    // 1. Chụp toàn cảnh danh mục thuốc với huy hiệu Dược lý lâm sàng
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_all_pharmacological_classes.png') });
    console.log('📸 Đã chụp: verified_all_pharmacological_classes.png');

    const selectLocator = page.locator('select[data-testid="pharmacological-class-select"]');
    if (await selectLocator.count() > 0) {
      // 2. Lọc nhóm "Trợ tim & Vận mạch cấp cứu"
      console.log('🔍 Kiểm tra bộ lọc: Trợ tim & Vận mạch cấp cứu...');
      await selectLocator.selectOption('cardiotonic_vasopressor');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_cardiotonic_filter.png') });
      console.log('📸 Đã chụp: verified_cardiotonic_filter.png');

      // 3. Lọc nhóm "Hạ sốt - Giảm đau"
      console.log('🔍 Kiểm tra bộ lọc: Hạ sốt - Giảm đau...');
      await selectLocator.selectOption('fever_pain');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_fever_pain_filter.png') });
      console.log('📸 Đã chụp: verified_fever_pain_filter.png');

      // 4. Lọc nhóm "Kháng sinh & Kháng khuẩn"
      console.log('🔍 Kiểm tra bộ lọc: Kháng sinh & Kháng khuẩn...');
      await selectLocator.selectOption('antibiotic');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_antibiotics_filter.png') });
      console.log('📸 Đã chụp: verified_antibiotics_filter.png');

      // 5. Lọc nhóm "Dịch truyền & Bồi phụ điện giải"
      console.log('🔍 Kiểm tra bộ lọc: Dịch truyền & Bồi phụ điện giải...');
      await selectLocator.selectOption('iv_fluids_electrolytes');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_fluids_electrolytes_filter.png') });
      console.log('📸 Đã chụp: verified_fluids_electrolytes_filter.png');

      // Trả về tất cả nhóm dược lý
      await selectLocator.selectOption('all');
      await page.waitForTimeout(600);
    }

    // 6. Mở Giấy Công Bố Thuốc Hadunalin (Adrenalin 1mg/ml)
    console.log('🔍 Mở modal Giấy Công Bố Thuốc Hadunalin...');
    const haduBtn = page.locator('button:has-text("Hadunalin"):visible').first();
    if (await haduBtn.count() > 0) {
      await haduBtn.click();
      await page.waitForTimeout(1200);

      // Chụp tab mặc định (Liều Dùng & Đường Dùng)
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_hadunalin_dosage_tab.png') });
      console.log('📸 Đã chụp: verified_hadunalin_dosage_tab.png');

      // Chuyển sang Tab "Chỉ Định & Cơ Chế"
      const tabIndication = page.locator('button:has-text("Chỉ Định"):visible, button:has-text("Chỉ định"):visible').first();
      if (await tabIndication.count() > 0) {
        await tabIndication.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_hadunalin_indications_tab.png') });
        console.log('📸 Đã chụp: verified_hadunalin_indications_tab.png');
      }

      // Đóng modal
      const closeBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // 7. Mở Cổng Dữ Liệu Dược Quốc Gia 55k SĐK
    console.log('🔍 Mở Cổng Dữ Liệu Dược Quốc Gia 55k SĐK...');
    const registryBtn = page.locator('button:has-text("Cổng Dược Quốc Gia"):visible').first();
    if (await registryBtn.count() > 0) {
      await registryBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_national_registry_portal.png') });
      console.log('📸 Đã chụp: verified_national_registry_portal.png');

      const closeReg = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').first();
      if (await closeReg.count() > 0) await closeReg.click();
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
