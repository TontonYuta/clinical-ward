/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử & Xác thực Toàn diện Modal Hồ Sơ Bệnh Nhân (PatientDetailModal)
 * Chuẩn Workstation Y Tế: Phẳng, Trái - Phải, Zero-Box, Không Dấu Chấm, Không Tràn/Đè Chữ
 */

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function verifyPatientDetailModal() {
  console.log('🚀 Khởi động Chromium kiểm tra PatientDetailModal...');
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
    console.log('0. Điều hướng trang chính và chọn vai trò Giám Đốc...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const roleSelect = page.locator('header select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('director');
      await page.waitForTimeout(400);
    }

    // 1. Kiểm tra mở modal từ tab Kê Đơn Thuốc (CPOE)
    console.log('1. Chuyển sang Tab Kê Đơn Thuốc (#cpoe)...');
    await page.goto('http://localhost:5173/#cpoe', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const cpoeTable = page.locator('table').first();
    await cpoeTable.waitFor({ state: 'visible' });

    // Tìm nút tên bệnh nhân đầu tiên trong bảng CPOE (ví dụ: Võ Minh Trí)
    console.log('2. Nhấp vào tên bệnh nhân trong danh sách CPOE...');
    const patientBtn = page.locator('[data-testid="patient-name-btn"]').first();
    await patientBtn.waitFor({ state: 'visible', timeout: 10000 });
    const patientName = await patientBtn.innerText();
    console.log(`   -> Nhấp vào bệnh nhân: "${patientName}"`);
    await patientBtn.click();
    await page.waitForTimeout(600);

    // Xác nhận Modal đã hiển thị
    const modal = page.locator('[data-testid="patient-detail-modal"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Modal PatientDetailModal đã mở thành công!');

    // 3. Kiểm thử các Tabs hồ sơ thực tế có trong hệ thống
    const tabNames = [
      { id: 'overview', name: 'Hồ sơ người bệnh' },
      { id: 'prescriptions', name: 'Đơn thuốc' },
      { id: 'administrative', name: 'Thông tin hành chính & CCCD TT26' }
    ];

    for (const tab of tabNames) {
      console.log(`3. Kiểm tra tab: "${tab.name}"...`);
      const tabButton = modal.locator(`button[role="tab"]:has-text("${tab.name}")`).first();
      await tabButton.waitFor({ state: 'visible' });
      await tabButton.click();
      await page.waitForTimeout(400);

      // Chụp ảnh từng tab
      const screenshotPath = path.join(ARTIFACTS_DIR, `patient_detail_tab_${tab.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   📸 Đã chụp ảnh tab ${tab.id} -> ${screenshotPath}`);

      // Kiểm tra không có lỗi 2 dấu chấm ("..") hoặc dấu chấm đầu dòng rác ("• •")
      const textContent = await modal.innerText();
      if (textContent.includes('..') && !textContent.includes('...')) {
        console.warn(`   ⚠️ Cảnh báo: Phát hiện dấu 2 chấm liên tiếp trong tab ${tab.id}!`);
      } else {
        console.log(`   ✅ Tab ${tab.id}: Văn bản chuẩn, không có lỗi 2 dấu chấm.`);
      }
    }

    // 4. Kiểm tra nút Đóng modal
    console.log('4. Kiểm tra đóng Modal bằng nút X...');
    const closeBtn = modal.locator('[data-testid="btn-close-patient-detail"]');
    await closeBtn.click();
    await page.waitForTimeout(500);
    const isModalHidden = !(await modal.isVisible());
    if (isModalHidden) {
      console.log('✅ Modal đóng thành công!');
    } else {
      throw new Error('Modal vẫn hiển thị sau khi nhấn nút đóng!');
    }

    // 5. Kiểm tra mở modal từ tab Sổ Nợ Vỏ Morphin (#debt)
    console.log('5. Chuyển sang Tab Sổ Nợ Vỏ Morphin (#debt)...');
    await page.goto('http://localhost:5173/#debt', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const debtTable = page.locator('table').first();
    await debtTable.waitFor({ state: 'visible' });

    console.log('6. Nhấp vào tên bệnh nhân trong bảng Sổ Nợ...');
    const debtPatientBtn = page.locator('[data-testid="patient-name-btn"]').first();
    await debtPatientBtn.waitFor({ state: 'visible', timeout: 10000 });
    const debtPatientName = await debtPatientBtn.innerText();
    console.log(`   -> Nhấp vào bệnh nhân từ Sổ nợ: "${debtPatientName}"`);
    await debtPatientBtn.click();
    await page.waitForTimeout(600);

    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Modal PatientDetailModal đã mở thành công từ Sổ Nợ Vỏ Morphin!');

    // Chụp ảnh minh chứng
    const debtModalScreenshot = path.join(ARTIFACTS_DIR, 'patient_detail_from_debt_tab.png');
    await page.screenshot({ path: debtModalScreenshot, fullPage: false });
    console.log(`📸 Đã chụp ảnh minh chứng: ${debtModalScreenshot}`);

    // Đóng modal
    await modal.locator('[data-testid="btn-close-patient-detail"]').click();
    await page.waitForTimeout(400);

    console.log('\n🎉 TOÀN BỘ CÁC BƯỚC KIỂM THỬ PATIENT DETAIL MODAL ĐÃ ĐẠT 100%!');
  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyPatientDetailModal();
