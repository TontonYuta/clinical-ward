/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử & Chụp ảnh minh chứng giao diện Chatbot Lâm Sàng đã được làm sạch,
 * gỡ bỏ toàn bộ thẻ mẫu (ShiftBriefingEmptyState) và cập nhật chức năng vào HDSD.
 */

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function verifyCleanChatbotUI() {
  console.log('🚀 Khởi động Chromium kiểm tra UI Chatbot tinh gọn & chuẩn hóa...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  try {
    // 0. Truy cập ứng dụng
    console.log('0. Điều hướng trang chính...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // 1. Kiểm tra cửa sổ Chatbot (nếu chưa mở thì bấm nút mở Copilot)
    const chatHandle = page.locator('[data-testid="chat-window-drag-handle"]');
    if (!(await chatHandle.isVisible())) {
      console.log('1. Nhấp nút mở Trợ Lý AI...');
      const openBtn = page.locator('button[title*="Trợ lý AI"], button[aria-label*="Trợ lý AI"]').first();
      await openBtn.click();
      await page.waitForTimeout(600);
    }
    await chatHandle.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Cửa sổ Chatbot đang hiển thị!');

    // Làm mới tin nhắn (bấm nút RotateCcw) để về trạng thái ban đầu sạch sẽ
    const resetBtn = page.locator('button[title="Làm mới phiên hội thoại"]');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(400);
    }

    // 2. Chụp ảnh màn hình Chatbot sạch (Không có thẻ mẫu)
    const cleanChatScreenshot = path.join(ARTIFACTS_DIR, 'clean_chatbot_initial_view.png');
    await page.screenshot({ path: cleanChatScreenshot, fullPage: false });
    console.log(`📸 Đã chụp ảnh Chatbot tinh gọn -> ${cleanChatScreenshot}`);

    // Kiểm tra xem thẻ mẫu cũ ("Kịch bản kiểm chứng từ CSDL") có còn xuất hiện không
    const chatText = await page.locator('.flex-1.overflow-y-auto').first().innerText();
    if (chatText.includes('Kịch bản kiểm chứng từ CSDL') || chatText.includes('Thẩm Định Đơn Thuốc & Dị Ứng')) {
      throw new Error('❌ Vẫn còn phát hiện thẻ mẫu (ShiftBriefingEmptyState) trong Chatbot!');
    } else {
      console.log('✅ ĐÃ XÓA TOÀN BỘ CÁC THẺ MẪU KHỎI CHATBOT THÀNH CÔNG!');
    }

    // 3. Kiểm tra nút HDSD trên Header Chatbot
    console.log('3. Nhấp nút HDSD trên thanh tiêu đề Chatbot...');
    const hdsdBtn = page.locator('[data-testid="chat-hdsd-btn"]');
    await hdsdBtn.waitFor({ state: 'visible', timeout: 5000 });
    await hdsdBtn.click();
    await page.waitForTimeout(600);

    // Chọn tab "9. Trợ lý AI" trong HDSD
    console.log('4. Kiểm tra mục "9. Trợ lý AI" trong Hướng Dẫn Sử Dụng...');
    const userGuideDialog = page.locator('div.fixed.inset-0.z-50:has-text("Hướng Dẫn Vận Hành")');
    await userGuideDialog.waitFor({ state: 'visible', timeout: 5000 });
    const aiGuideTab = userGuideDialog.locator('button:has-text("Trợ lý AI")').last();
    await aiGuideTab.click();
    await page.waitForTimeout(500);

    const hdsdScreenshot = path.join(ARTIFACTS_DIR, 'user_guide_ai_functions_tab.png');
    await page.screenshot({ path: hdsdScreenshot, fullPage: false });
    console.log(`📸 Đã chụp ảnh HDSD chức năng Trợ Lý AI -> ${hdsdScreenshot}`);

    // Đóng HDSD
    const closeHdsdBtn = page.locator('button[title="Đóng cửa sổ"]').first();
    await closeHdsdBtn.click();
    await page.waitForTimeout(500);

    // 4. Kiểm tra gửi một câu lệnh và hiển thị Action Card chuẩn hóa
    console.log('5. Nhập yêu cầu lâm sàng vào khung chat...');
    const chatInput = page.locator('input[placeholder*="Nhập câu hỏi hoặc yêu cầu lâm sàng"]').first();
    await chatInput.fill('Cho 1 lọ morphin');
    await page.locator('button[title="Gửi yêu cầu"]').click();
    await page.waitForTimeout(1000);

    const activeChatScreenshot = path.join(ARTIFACTS_DIR, 'clean_chatbot_action_card_view.png');
    await page.screenshot({ path: activeChatScreenshot, fullPage: false });
    console.log(`📸 Đã chụp ảnh Chatbot kèm Action Card chuẩn hóa -> ${activeChatScreenshot}`);

    console.log('\n🎉 TOÀN BỘ CÁC BƯỚC KIỂM THỬ GIAO DIỆN CHATBOT ĐÃ ĐẠT 100%!');
  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyCleanChatbotUI();
