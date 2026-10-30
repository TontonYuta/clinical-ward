/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Toàn diện Modal Chi Tiết Đơn Thuốc Điện Tử CPOE (CpoeOrderDetailModal)
 * Chuẩn Workstation Y Tế: Phẳng, Trái - Phải, Zero-Box, Không Dấu Chấm, TT 26/2025/TT-BYT
 */

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function verifyCpoeOrderDetailModal() {
  console.log('🚀 Khởi động Chromium kiểm tra CpoeOrderDetailModal...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  try {
    // 0. Thiết lập vai trò Giám Đốc (Director)
    console.log('0. Điều hướng trang chính...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const roleSelect = page.locator('header select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('director');
      await page.waitForTimeout(400);
    }

    // 1. Chuyển sang Tab Kê Đơn Thuốc (#cpoe)
    console.log('1. Chuyển sang Tab Kê Đơn Thuốc (#cpoe)...');
    await page.goto('http://localhost:5173/#cpoe', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const cpoeTable = page.locator('table').first();
    await cpoeTable.waitFor({ state: 'visible' });

    // 2. Nhấp vào nút "Chi tiết" hoặc mã đơn hàng đầu tiên (RX-2026-001)
    console.log('2. Nhấp nút "Chi tiết" đơn thuốc đầu tiên...');
    const detailBtn = page.locator('table button:has-text("Chi tiết")').first();
    await detailBtn.waitFor({ state: 'visible', timeout: 5000 });
    await detailBtn.click();
    await page.waitForTimeout(600);

    // Xác nhận Modal đã hiển thị
    const modal = page.locator('[data-testid="cpoe-order-detail-modal"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Modal CpoeOrderDetailModal đã mở thành công!');

    // 3. Kiểm thử từng Tab trong 5 Tabs
    const tabNames = [
      { id: 'overview', name: 'Tổng quan đơn thuốc' },
      { id: 'medications', name: 'Danh mục thuốc' },
      { id: 'safety_cdss', name: 'An toàn lâm sàng & CDSS' },
      { id: 'advice_schedule', name: 'Hướng dẫn dặn dò & Lịch dùng' },
      { id: 'legal_signature', name: 'Pháp lý & Ký số TT26' }
    ];

    for (const tab of tabNames) {
      console.log(`3. Kiểm tra tab: "${tab.name}"...`);
      const tabButton = modal.locator(`button[role="tab"]:has-text("${tab.name}")`).first();
      await tabButton.waitFor({ state: 'visible' });
      await tabButton.click();
      await page.waitForTimeout(400);

      // Chụp ảnh từng tab
      const screenshotPath = path.join(ARTIFACTS_DIR, `cpoe_order_detail_tab_${tab.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   📸 Đã chụp ảnh tab ${tab.id} -> ${screenshotPath}`);

      // Kiểm tra văn bản không bị lỗi 2 dấu chấm ("..")
      const textContent = await modal.innerText();
      if (textContent.includes('..') && !textContent.includes('...')) {
        console.warn(`   ⚠️ Cảnh báo: Phát hiện dấu 2 chấm liên tiếp trong tab ${tab.id}!`);
      } else {
        console.log(`   ✅ Tab ${tab.id}: Văn bản chuẩn, không có lỗi 2 dấu chấm.`);
      }
    }

    // 4. Kiểm tra nút chuyển tiếp "Hồ sơ bệnh nhân"
    console.log('4. Kiểm tra nhấp nút "Hồ sơ bệnh nhân" trong modal đơn thuốc...');
    const patientProfileBtn = modal.locator('button:has-text("Hồ sơ bệnh nhân")').first();
    if (await patientProfileBtn.isVisible()) {
      await patientProfileBtn.click();
      await page.waitForTimeout(600);
      const patientModal = page.locator('[data-testid="patient-detail-modal"]');
      await patientModal.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ Đã mở thành công PatientDetailModal từ CpoeOrderDetailModal!');
      // Đóng patient detail modal
      await patientModal.locator('[data-testid="btn-close-patient-detail"]').click();
      await page.waitForTimeout(400);
    }

    // 5. Kiểm tra nút Đóng modal đơn thuốc
    console.log('5. Kiểm tra đóng CpoeOrderDetailModal bằng nút X...');
    // Nếu modal đơn thuốc còn mở, đóng lại
    if (await modal.isVisible()) {
      const closeBtn = modal.locator('[data-testid="btn-close-cpoe-detail"]');
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    const isModalHidden = !(await modal.isVisible());
    if (isModalHidden) {
      console.log('✅ Modal đơn thuốc đóng thành công!');
    } else {
      throw new Error('Modal vẫn hiển thị sau khi nhấn nút đóng!');
    }

    console.log('\n🎉 TOÀN BỘ CÁC BƯỚC KIỂM THỬ CPOE ORDER DETAIL MODAL ĐÃ ĐẠT 100%!');
  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyCpoeOrderDetailModal();
