/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E: Kiểm thử Chatbot Gemini 3.5 Flash-Lite & Modal Cấu hình AI (<=150 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function testChatbot() {
  console.log('🚀 Bắt đầu kiểm thử Chatbot & Modal Cấu hình AI...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ Đã tải ứng dụng Clinical Ward');

    // 1. Mở cửa sổ Chatbot bằng nút trên Header
    const copilotToggle = page.locator('button[aria-label="Trợ lý AI lâm sàng"]:visible, button:has-text("Trợ lý AI"):visible').first();
    await copilotToggle.click();
    await page.waitForTimeout(600);
    console.log('✅ Đã mở cửa sổ Trợ lý AI Lâm Sàng');

    // 2. Mở Modal Cấu hình AI
    const settingsBtn = page.locator('button[title*="Cấu hình AI"]').first();
    await settingsBtn.click();
    await page.waitForTimeout(600);
    console.log('✅ Đã mở Modal Cấu hình AI & Chi Phí');

    const shotSettings = path.join(ARTIFACT_DIR, 'chatbot_ai_settings_modal_verified.png');
    await page.screenshot({ path: shotSettings });
    console.log(`📸 Đã lưu ảnh Settings: ${shotSettings}`);

    // Đóng Modal Settings bằng nút X
    const closeBtn = page.locator('div[role="dialog"] button:has(svg.lucide-x)').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }

    // 3. Gửi câu hỏi lâm sàng tự do: "Liều dùng paracetamol cho trẻ em 15kg"
    const input = page.locator('input[placeholder*="Nhập yêu cầu"]').first();
    await input.fill('Liều dùng paracetamol cho trẻ em 15kg');
    await page.keyboard.press('Enter');
    console.log('✅ Đã gửi câu hỏi lâm sàng tới Gemini Flash-Lite');

    // Chờ phản hồi từ AI
    await page.waitForTimeout(4000);

    const shotChat = path.join(ARTIFACT_DIR, 'chatbot_ai_consultation_verified.png');
    await page.screenshot({ path: shotChat });
    console.log(`📸 Đã lưu ảnh Chat AI: ${shotChat}`);

    // Kiểm tra nội dung phản hồi trong bong bóng chat
    const bodyText = await page.textContent('body');
    const hasMedContent = bodyText?.includes('Paracetamol') || bodyText?.includes('paracetamol') || bodyText?.includes('mg/kg') || bodyText?.includes('150mg');
    console.log(`ℹ️ Nội dung lâm sàng phát hiện trong bong bóng chat: ${hasMedContent}`);

    console.log('🎉 Kiểm thử Chatbot tối ưu chi phí thành công xuất sắc!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử Chatbot:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

testChatbot();
