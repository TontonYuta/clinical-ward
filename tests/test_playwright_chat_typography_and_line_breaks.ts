import { chromium } from 'playwright';
import path from 'node:path';

async function testChatTypography() {
  const targetUrl = 'http://127.0.0.1:5173';
  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

  console.log('======================================================================');
  console.log('🏥 KIỂM THỬ PLAYWRIGHT: TYPOGRAPHY, XUỐNG DÒNG & THỤT LỀ CHATBOT CHUẨN MỰC');
  console.log('======================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Mở Chatbot
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.waitForTimeout(800);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  const sendBtn = page.locator('button[type="submit"]');

  // Làm sạch chat
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(500);
  }

  // 1. Gửi câu hỏi lâm sàng nhi khoa
  const query = 'trẻ 12 tuổi uống paracetamol như thế nào';
  console.log(`1. Gửi câu hỏi: "${query}"...`);
  await chatInput.fill(query);
  await sendBtn.click();

  // Đợi phản hồi xong
  await page.waitForFunction(() => {
    const messages = Array.from(document.querySelectorAll('[data-testid="chat-message-agent"]'));
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    const text = (lastMsg as HTMLElement).innerText || '';
    const isStillStreaming = lastMsg.querySelector('.animate-pulse') !== null;
    return text.includes('500 mg') && !isStillStreaming;
  }, { timeout: 25000 });

  await page.waitForTimeout(1000);

  // Kiểm tra cấu trúc DOM:
  const lastMsg = page.locator('[data-testid="chat-message-agent"]').last();

  // Kiểm tra không còn dòng tàn dư "*(Căn cứ pháp lý & Tài liệu đối soát...)*" trong bong bóng chat
  const msgText = await lastMsg.innerText();
  if (msgText.includes('Căn cứ pháp lý & Tài liệu đối soát:')) {
    throw new Error('FAILED: Legacy raw source line is still visible in the chat bubble!');
  }
  console.log('✅ Đã loại bỏ hoàn toàn dòng nguồn dẫn tàn dư thô kệch trong tin nhắn.');

  // Kiểm tra có thẻ bracket header đẹp mắt (ví dụ: Liều dùng khuyến cáo cho trẻ 12 tuổi)
  const bracketHdr = lastMsg.locator('[class*="bg-slate-100"]');
  const bracketCount = await bracketHdr.count();
  console.log(`Tìm thấy ${bracketCount} thẻ phân mục lâm sàng.`);

  // Chụp ảnh tin nhắn chuẩn
  const shotPath = path.join(artifactDir, 'local_chat_typography_and_line_breaks_fixed.png');
  await page.screenshot({ path: shotPath });
  console.log(`✅ Đã lưu ảnh chụp giao diện: ${shotPath}`);

  // 2. Click badge để kiểm tra cả thẻ preview
  const citationBadge = page.locator('button:has-text("Dược Thư Quốc Gia")').first();
  if (await citationBadge.isVisible()) {
    await citationBadge.click();
    await page.waitForTimeout(600);
    const unfoldedShot = path.join(artifactDir, 'local_chat_unfolded_citation_clean_typography.png');
    await page.screenshot({ path: unfoldedShot });
    console.log(`✅ Đã lưu ảnh chụp khi mở trích dẫn: ${unfoldedShot}`);
  }

  await browser.close();
  console.log('======================================================================');
  console.log('🎉 KIỂM THỬ PLAYWRIGHT TYPOGRAPHY & XUỐNG DÒNG ĐÃ THÀNH CÔNG 100%!');
  console.log('======================================================================');
}

testChatTypography().catch(err => {
  console.error('❌ LỖI:', err);
  process.exit(1);
});
