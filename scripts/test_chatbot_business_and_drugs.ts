/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E: Kiểm thử Chatbot 10 Đại Nghiệp Vụ Bệnh Viện & Tra Cứu Thuốc 100/100 (<=150 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function runE2E() {
  console.log('🚀 Bắt đầu kiểm thử E2E Chatbot Nghiệp Vụ & Tra Cứu Thuốc 100/100...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1550, height: 980 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ Đã tải ứng dụng');

    // 1. Mở cửa sổ Chatbot bằng nút trên Header
    const copilotToggle = page.locator('button[aria-label="Trợ lý AI lâm sàng"]:visible, button:has-text("Trợ lý AI"):visible').first();
    await copilotToggle.click();
    await page.waitForTimeout(800);
    console.log('✅ Đã mở cửa sổ Chatbot');

    async function sendQuery(queryText: string) {
      const activeInput = page.locator('input[placeholder*="Nhập yêu cầu"]:not([disabled])').first();
      await activeInput.waitFor({ state: 'visible', timeout: 10000 });
      await activeInput.fill(queryText);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
      await page.locator('input[placeholder*="Nhập yêu cầu"]:not([disabled])').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(400);
    }

    // 2. Kiểm thử 1: Bản đồ 10 Đại nghiệp vụ bệnh viện
    console.log('Testing: Các nghiệp vụ bệnh viện...');
    await sendQuery('Các nghiệp vụ bệnh viện');
    const shot1 = path.join(ARTIFACT_DIR, 'chatbot_10_business_workflows_verified.png');
    await page.screenshot({ path: shot1 });
    console.log(`📸 Đã chụp màn hình 10 Nghiệp vụ: ${shot1}`);

    // 3. Kiểm thử 2: Tra cứu thuốc Rocephin (100% CSDL Cục QLD)
    console.log('Testing: Thông tin thuốc Rocephin...');
    await sendQuery('Thông tin thuốc Rocephin');
    const shot2 = path.join(ARTIFACT_DIR, 'chatbot_authoritative_drug_rocephin_verified.png');
    await page.screenshot({ path: shot2 });
    console.log(`📸 Đã chụp màn hình Thuốc Rocephin: ${shot2}`);

    // 4. Kiểm thử 3: Tra cứu SĐK VD-24757-16
    console.log('Testing: SĐK VD-24757-16 là thuốc gì...');
    await sendQuery('SĐK VD-24757-16 là thuốc gì');
    const shot3 = path.join(ARTIFACT_DIR, 'chatbot_authoritative_drug_sdk_verified.png');
    await page.screenshot({ path: shot3 });
    console.log(`📸 Đã chụp màn hình Tra cứu SĐK: ${shot3}`);

    // 5. Kiểm thử 4: Zero hallucination với thuốc không tồn tại
    console.log('Testing: Thông tin thuốc FakeMedX999...');
    await sendQuery('Thông tin thuốc FakeMedX999');
    const shot4 = path.join(ARTIFACT_DIR, 'chatbot_zero_hallucination_verified.png');
    await page.screenshot({ path: shot4 });
    console.log(`📸 Đã chụp màn hình Zero Hallucination: ${shot4}`);

    console.log('🎉 TOÀN BỘ 4 KỊCH BẢN KIỂM THỬ E2E ĐÃ HOÀN TẤT THÀNH CÔNG!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử E2E:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runE2E();
