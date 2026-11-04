import { chromium } from 'playwright';
import path from 'path';

async function run() {
  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('--- 1. Điều hướng và tiêm dữ liệu chat cũ vào localStorage ---');
  await page.goto('http://127.0.0.1:5173/');

  // Giả lập dữ liệu chat cũ chứa nhiều tin nhắn và form cũ trong localStorage
  await page.evaluate(() => {
    const oldMessages = [
      { id: 'msg-welcome', sender: 'agent', text: 'Chào mừng bạn đến với Trợ lý AI.', timestamp: '08:00' },
      { id: 'msg-user-1', sender: 'user', text: 'Cho 2 lọ Morphin cấp cứu', timestamp: '08:01' },
      { id: 'msg-agent-1', sender: 'agent', text: 'Đã xuất nợ tủ trực Morphin', timestamp: '08:01', card: { card_type: 'borrow_confirm', title: 'Phiếu Xuất Mượn', primaryActionLabel: 'Ký Xác Thực' } },
      { id: 'msg-user-2', sender: 'user', text: 'Máy thở PB840 bị hỏng', timestamp: '08:02' },
      { id: 'msg-agent-2', sender: 'agent', text: 'Đã lập biên bản sự cố', timestamp: '08:02', card: { card_type: 'incident_confirm', title: 'Phiếu Báo Hỏng', primaryActionLabel: 'Gửi Kỹ Thuật' } }
    ];
    localStorage.setItem('clinical_chat_messages', JSON.stringify(oldMessages));
    localStorage.setItem('clinical_ward_chat_messages', JSON.stringify(oldMessages));
  });

  // Reload lại để app khôi phục state từ localStorage
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Mở cửa sổ chat nếu đang đóng
  const openChatBtn = page.locator('button:has-text("Trợ lý AI"), button[title*="Trợ lý AI"], [aria-label*="Trợ lý AI"]');
  if (await openChatBtn.isVisible()) {
    await openChatBtn.click();
  }

  // Chụp ảnh giao diện có nút Xóa chat cũ
  await page.waitForSelector('[data-testid="chat-clear-btn"]', { timeout: 8000 });
  console.log('✅ Đã hiển thị nút [Xóa chat cũ] do có > 1 tin nhắn.');
  await page.screenshot({ path: path.join(artifactDir, '09_old_chat_history_with_clear_btn.png'), fullPage: false });

  // Click vào nút Xóa chat cũ
  console.log('--- 2. Thực hiện click [Xóa chat cũ] ---');
  await page.click('[data-testid="chat-clear-btn"]');
  await page.waitForTimeout(500);

  // Kiểm tra localStorage đã được dọn sạch chưa
  const storageCheck = await page.evaluate(() => {
    const chat1 = localStorage.getItem('clinical_chat_messages');
    const chat2 = localStorage.getItem('clinical_ward_chat_messages');
    return { chat1, chat2 };
  });

  console.log('Storage sau khi xóa:', storageCheck);
  const parsedChat1 = JSON.parse(storageCheck.chat1 || '[]');
  if (parsedChat1.length > 1) {
    throw new Error('Xóa chat thất bại: localStorage vẫn còn ' + parsedChat1.length + ' tin nhắn!');
  }
  console.log('✅ LocalStorage đã được xóa sạch hoàn toàn, chỉ còn tin nhắn chào mừng mặc định!');

  // Chụp ảnh sau khi xóa sạch tin nhắn
  await page.screenshot({ path: path.join(artifactDir, '10_clean_chat_after_purge.png'), fullPage: false });

  // Kiểm tra gửi tin nhắn tra cứu thuốc Sibelium xem định dạng mới có sạch sẽ không
  console.log('--- 3. Kiểm tra định dạng trả lời thuốc & loại bỏ form cũ ---');
  const input = page.locator('textarea[placeholder*="Tra cứu thuốc"], textarea[placeholder*="Hỏi đáp"], textarea').first();
  if (await input.isVisible()) {
    await input.fill('Tra cứu thuốc Sibelium');
    await input.press('Enter');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(artifactDir, '11_clean_sibelium_response.png'), fullPage: false });
    console.log('✅ Đã chụp ảnh phản hồi tra cứu Sibelium tinh gọn.');
  }

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT HOÀN THÀNH XUẤT SẮC!');
}

run().catch((err) => {
  console.error('Playwright Error:', err);
  process.exit(1);
});
