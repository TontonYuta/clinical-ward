import { chromium } from 'playwright';

async function testAutoOpenCpoeHideChat() {
  const localUrl = 'http://127.0.0.1:5173';
  const artifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_auto_open_cpoe_modal_hide_chat.png';
  const reOpenArtifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_reopen_chat_history_preserved.png';

  console.log('======================================================');
  console.log(`KIỂM THỬ PLAYWRIGHT E2E: YÊU CẦU MỞ FORM KÊ ĐƠN THÌ ẨN CHAT VÀ HIỆN FORM KÊ ĐƠN NGAY LẬP TỨC`);
  console.log(`Mục tiêu URL: ${localUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Kịch bản 1: Mở Chatbot và gõ "mở form kê đơn"
  const copilotAside = page.locator('aside[aria-label="Trợ lý AI Lâm Sàng"]');
  const toggleBtn = page.locator('[data-testid="copilot-toggle-btn"]');

  const isAlreadyOpen = await copilotAside.isVisible().catch(() => false);
  if (!isAlreadyOpen) {
    console.log('1. Nhấn nút mở Trợ Lý AI Lâm Sàng (Ctrl+K)...');
    await toggleBtn.click();
    await page.waitForTimeout(600);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Chatbot đã mở và sẵn sàng nhận lệnh.');

  const commandText = 'mở form kê đơn';
  console.log(`2. Nhập lệnh người dùng: "${commandText}"`);
  await chatInput.fill(commandText);
  await page.waitForTimeout(300);

  const sendBtn = page.locator('button[type="submit"]');
  await sendBtn.click();
  console.log('3. Đã gửi lệnh, kiểm tra trạng thái Chatbot và Form Kê Đơn CPOE...');

  // Xác nhận Chatbot đã biến mất/ẩn đi
  await page.waitForTimeout(400);
  const isChatVisible = await copilotAside.isVisible().catch(() => false);
  console.log(`4. Trạng thái hiển thị Chatbot: ${isChatVisible ? 'VẪN MỞ (LỖI)' : 'ĐÃ ẨN HOÀN TOÀN (ĐẠT ✅)'}`);
  if (isChatVisible) {
    throw new Error('THẤT BẠI: Chatbot không ẩn đi khi người dùng yêu cầu mở form kê đơn!');
  }

  // Xác nhận Form kê đơn CPOE (CpoeOrderModal) đã hiện lên ngay lập tức
  const cpoeModal = page.locator('[data-testid="cpoe-order-modal"]');
  await cpoeModal.waitFor({ state: 'visible', timeout: 5000 });
  const isModalVisible = await cpoeModal.isVisible();
  console.log(`5. Trạng thái hiển thị Form Kê Đơn CPOE: ${isModalVisible ? 'ĐÃ HIỆN LÊN TRỰC TIẾP (ĐẠT ✅)' : 'KHÔNG HIỆN (LỖI)'}`);
  if (!isModalVisible) {
    throw new Error('THẤT BẠI: Form kê đơn CPOE không hiện lên khi được yêu cầu!');
  }

  const modalHeader = await cpoeModal.locator('h3').first().innerText();
  console.log(`Tiêu đề Form kê đơn: "${modalHeader}"`);

  // Chụp ảnh bằng chứng 1
  await page.screenshot({ path: artifactPath, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình Form Kê Đơn lưu tại: ${artifactPath}`);

  // Kịch bản 2: Đóng form kê đơn và mở lại Chatbot để kiểm tra lịch sử trò chuyện
  console.log('6. Đóng form kê đơn bằng nút Hủy/Đóng...');
  const closeBtn = cpoeModal.locator('button:has-text("Đóng"), button[title="Đóng"], button:has-text("Hủy")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('7. Nhấn nút mở lại Chatbot để kiểm tra lịch sử tin nhắn...');
  await toggleBtn.waitFor({ state: 'visible', timeout: 5000 });
  await toggleBtn.click();
  await page.waitForTimeout(600);

  const messagesCount = await page.locator('[data-testid*="chat-message"]').count();
  console.log(`Số lượng tin nhắn trong phiên hội thoại: ${messagesCount}`);
  if (messagesCount < 2) {
    throw new Error('THẤT BẠI: Lịch sử tin nhắn không được bảo toàn khi mở lại Chatbot!');
  }
  console.log('✅ Lịch sử tin nhắn và câu trả lời của trợ lý đã được bảo toàn đầy đủ.');

  // Chụp ảnh bằng chứng 2
  await page.screenshot({ path: reOpenArtifactPath, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình Re-open Chat lưu tại: ${reOpenArtifactPath}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT E2E ĐÃ ĐẠT 100% GREEN!');
  console.log('======================================================');
}

testAutoOpenCpoeHideChat().catch(err => {
  console.error('LỖI KIỂM THỬ PLAYWRIGHT:', err);
  process.exit(1);
});
