import { chromium } from 'playwright';

async function verifyCleanUserBubble() {
  const localUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`KIỂM THỬ GIAO DIỆN BONG BÓNG TIN NHẮN ĐÃ GỬI (LOCAL): ${localUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Mở Chatbot nếu đang ẩn
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.waitForTimeout(1000);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  const sendBtn = page.locator('button[type="submit"]');

  // Làm sạch chat nếu có nút làm mới
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }

  let prevCount = await page.locator('[data-testid*="chat-message"]').count();
  const testQuery = 'Paracetamol 500mg uống thế nào?';
  console.log(`Gửi tin nhắn: "${testQuery}"`);
  await chatInput.fill(testQuery);
  await sendBtn.click();

  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(2500);

  // Kiểm tra bong bóng tin nhắn của User
  const userMessage = page.locator('[data-testid="chat-message-user"]').first();
  const bubbleDiv = userMessage.locator('div.rounded-xl').first();
  const bubbleClass = (await bubbleDiv.getAttribute('class')) || '';
  console.log(`Class của bong bóng tin nhắn User: "${bubbleClass}"`);

  if (bubbleClass.includes('bg-slate-900')) {
    throw new Error('THẤT BẠI: Bong bóng tin nhắn đã gửi vẫn còn màu đen bg-slate-900!');
  }
  if (!bubbleClass.includes('bg-teal-50')) {
    throw new Error('THẤT BẠI: Bong bóng tin nhắn đã gửi chưa nhận class bg-teal-50!');
  }
  console.log('✅ Bong bóng tin nhắn đã gửi đã chuyển sang màu xanh ngọc nhạt bg-teal-50 sáng sủa, hoàn toàn hết đen!');

  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_clean_user_message_bubble.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình lưu tại: ${screenshotPath}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 XÁC THỰC BONG BÓNG TIN NHẮN MỚI THÀNH CÔNG 100%!');
  console.log('======================================================');
}

verifyCleanUserBubble().catch((err) => {
  console.error('LỖI TEST BUBBLE:', err);
  process.exit(1);
});
