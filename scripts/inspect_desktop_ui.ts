/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kịch bản kiểm định toàn diện chức năng & giao diện Desktop bằng Playwright
 */

import { chromium, Page } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/screenshots';

async function startServer(): Promise<any> {
  const server = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: '/home/tontonyuta/Downloads/DoAn2',
    stdio: 'pipe',
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 3000);
    server.stdout.on('data', (data) => {
      if (data.toString().includes('http://localhost:4173')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (err) => console.error('Server err:', err.toString()));
  });

  return server;
}

async function auditTab(page: Page, tabName: string, screenshotName: string) {
  console.log(`🔍 Kiểm tra tab: ${tabName}...`);
  const btn = page.locator(`button:has-text("${tabName}")`).first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screenshotName}.png`), fullPage: false });
}

async function run() {
  console.log('🚀 Khởi động Vite Preview Server...');
  const server = await startServer();

  console.log('🌐 Mở Playwright Chromium (Desktop 1440x900)...');
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Initial Desktop View (Default Tab: Sổ Nợ Vỏ)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_initial.png') });
    console.log('📸 Đã chụp: 01_desktop_initial.png');

    // 2. Chuyển sang vai trò Bác sĩ & Kê đơn CPOE
    console.log('🔄 Đổi vai trò sang Bác sĩ Điều trị...');
    const roleSelect = page.locator('select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('doctor');
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_doctor_cpoe_tab.png') });
      console.log('📸 Đã chụp: 02_doctor_cpoe_tab.png');

      // Mở modal Kê đơn
      const newOrderBtn = page.locator('button:has-text("+ Kê Đơn Mới")');
      if (await newOrderBtn.isVisible()) {
        await newOrderBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_cpoe_modal_open.png') });
        console.log('📸 Đã chụp: 03_cpoe_modal_open.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }

    // 3. Chuyển sang vai trò Dược sĩ & Kho FEFO
    console.log('🔄 Đổi vai trò sang Dược sĩ...');
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('pharmacist');
      await page.waitForTimeout(800);
      await auditTab(page, 'Kho Dược & Tủ Trực', '04_pharmacist_fefo_tab');

      // Test chuyển sang Kho Ngoại Trú BHYT
      const outpatientBtn = page.locator('button:has-text("Kho Ngoại Trú BHYT")');
      if (await outpatientBtn.isVisible()) {
        await outpatientBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_pharmacy_outpatient_view.png') });
        console.log('📸 Đã chụp: 05_pharmacy_outpatient_view.png');
      }

      // Test mở Modal Dự trù bù
      const restockBtn = page.locator('button:has-text("Dự trù bù")').first();
      if (await restockBtn.isVisible()) {
        await restockBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_restock_modal_open.png') });
        console.log('📸 Đã chụp: 06_restock_modal_open.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }

    // 4. Chuyển sang vai trò Kỹ sư BME & Sự cố thiết bị
    console.log('🔄 Đổi vai trò sang Kỹ sư Y sinh BME...');
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('biomedical_engineer');
      await page.waitForTimeout(800);
      await auditTab(page, 'Sự Cố Thiết Bị', '07_bme_equipment_tab');

      // Mở modal Báo hỏng
      const reportIncidentBtn = page.locator('button:has-text("+ Báo Hỏng")');
      if (await reportIncidentBtn.isVisible()) {
        await reportIncidentBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_manual_incident_modal.png') });
        console.log('📸 Đã chụp: 08_manual_incident_modal.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }

    // 5. Test Tủ lạnh vắc xin chuỗi lạnh
    await auditTab(page, 'Chuỗi Lạnh Vắc Xin', '09_coldchain_tab');

    // 6. Test Kiểm kê tài sản công
    await auditTab(page, 'Kiểm Kê Tài Sản', '10_asset_audit_tab');

    // 7. Test Mở AI Copilot Chat Window
    console.log('🤖 Mở Trợ lý Lâm Sàng AI...');
    const copilotBtn = page.locator('button:has-text("Trợ Lý AI")').or(page.locator('button[title*="AI"]')).first();
    if (await copilotBtn.isVisible()) {
      await copilotBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_copilot_window_open.png') });
      console.log('📸 Đã chụp: 11_copilot_window_open.png');
    }

    // 8. Test Văn bản pháp lý
    console.log('📜 Mở Văn bản Pháp lý Modal...');
    const legalBtn = page.locator('button:has-text("Văn bản pháp lý")').first();
    if (await legalBtn.isVisible()) {
      await legalBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_legal_docs_modal.png') });
      console.log('📸 Đã chụp: 12_legal_docs_modal.png');
      await page.keyboard.press('Escape');
    }

    console.log('==============================================');
    console.log(`✅ Hoàn thành chụp 12 màn hình giao diện Desktop!`);
    console.log(`Console Errors detected: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Lỗi console:', consoleErrors);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error('Lỗi chạy audit UI:', err);
  process.exit(1);
});
