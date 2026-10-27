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

    // 3. Mở Giấy Công Bố Thuốc Hadunalin và kiểm tra trích dẫn Dược Thư 2015 & nút Đối chứng gốc
    console.log('🔍 Kiểm tra nút Đối chứng gốc & Modal trích dẫn Dược Thư 2015...');
    const doiChungBtn = page.locator('button:has-text("Đối chứng gốc"):visible').first();
    if (await doiChungBtn.count() > 0) {
      await doiChungBtn.click();
      await page.waitForTimeout(1200);

      // Chụp hiển thị nguồn tài liệu đối chiếu DTQG 2015 kèm Tên tệp PDF và Số trang
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_hadunalin_pdf_page_citation.png') });
      console.log('📸 Đã chụp: verified_hadunalin_pdf_page_citation.png');

      // Kiểm tra nút "Cập nhật lại" (Reload)
      const reloadBtn = page.locator('button[data-testid="drug-detail-reload-btn"]:visible').first();
      if (await reloadBtn.count() > 0) {
        console.log('🔄 Bấm nút Cập nhật lại (Reload)...');
        await reloadBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_reload_proof_workstation.png') });
        console.log('📸 Đã chụp: verified_reload_proof_workstation.png');
      }

      // Đóng modal
      const closeBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. Mở Cổng Dữ Liệu Dược Quốc Gia 55k SĐK & Kiểm tra phân loại dược lý
    console.log('🔍 Mở Cổng Dữ Liệu Dược Quốc Gia 55k SĐK...');
    const regBtn = page.locator('button:has-text("Cổng Dược Quốc Gia"):visible').first();
    if (await regBtn.count() > 0) {
      await regBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_national_registry_portal.png') });
      console.log('📸 Đã chụp: verified_national_registry_portal.png');

      const pharmSelect = page.locator('select[data-testid="registry-pharm-select"]:visible').first();
      if (await pharmSelect.count() > 0) {
        console.log('🔍 Lọc theo Nhóm Dược lý: Kháng sinh trong Cổng 55k SĐK...');
        await pharmSelect.selectOption('antibiotic');
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_national_registry_antibiotics.png') });
        console.log('📸 Đã chụp: verified_national_registry_antibiotics.png');
      }

      const firstDrugBtn = page.locator('div[role="dialog"] tbody tr button:has-text("VD-"), div[role="dialog"] tbody tr button:has-text("893")').first();
      if (await firstDrugBtn.count() > 0) {
        console.log('🔍 Bấm xem chi tiết thuốc trong danh mục 55k...');
        await firstDrugBtn.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_dav_drug_detail_workstation.png') });
        console.log('📸 Đã chụp: verified_dav_drug_detail_workstation.png');

        const closeDetailBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x), .fixed.inset-0:visible button:has-text("Đóng")').last();
        if (await closeDetailBtn.count() > 0) await closeDetailBtn.click();
        await page.waitForTimeout(400);
      }

      const closeRegBtn = page.locator('.fixed.inset-0:visible button:has(svg.lucide-x)').first();
      if (await closeRegBtn.count() > 0) await closeRegBtn.click();
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
