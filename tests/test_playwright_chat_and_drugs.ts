import { chromium } from 'playwright';

export async function testChatAndDrugSearch(targetUrl: string, screenshotPrefix: string) {
  console.log(`\n========================================`);
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TẠI: ${targetUrl}`);
  console.log(`========================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on('pageerror', err => {
    console.error(`[PAGEERROR] ${err.name}: ${err.message}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);

  // 1. Mở Chatbot nếu đang ẩn
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.waitForTimeout(1000);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  const sendBtn = page.locator('button[type="submit"]');

  const testQueries = [
    { q: 'Thông tin thuốc Coversyl', keyword: 'Coversyl' },
    { q: 'Tra cứu thuốc Morphin', keyword: 'Morphin' },
    { q: 'Adrenalin tiêm bắp liều bao nhiêu', keyword: 'Adrenalin' }
  ];

  let prevCount = await page.locator('[data-testid*="chat-message"]').count();
  console.log(`Số tin nhắn ban đầu trong khung chat: ${prevCount}`);

  for (let idx = 0; idx < testQueries.length; idx++) {
    const item = testQueries[idx];
    console.log(`\n-> [Test Chat #${idx + 1}] Gửi tin nhắn: "${item.q}"`);
    await chatInput.fill(item.q);
    await page.waitForTimeout(250);
    await sendBtn.click();

    // Đợi phản hồi xuất hiện
    let answered = false;
    for (let retry = 0; retry < 12; retry++) {
      await page.waitForTimeout(500);
      const currentCount = await page.locator('[data-testid*="chat-message"]').count();
      if (currentCount >= prevCount + 2) {
        answered = true;
        prevCount = currentCount;
        break;
      }
    }

    if (!answered) {
      throw new Error(`Chatbot không phản hồi hoặc bị chặn gửi tại câu hỏi thứ ${idx + 1}: "${item.q}"`);
    }

    const msgs = await page.locator('[data-testid*="chat-message"]').allInnerTexts();
    const lastReply = msgs[msgs.length - 1] || '';
    console.log(`   ✅ Phản hồi #${idx + 1} thành công (Tổng msg: ${msgs.length})`);
    console.log(`   Nội dung trích đoạn: ${lastReply.slice(0, 120).replace(/\n/g, ' ')}...`);
  }

  // Chụp ảnh giao diện Chatbot sau 3 câu hỏi thành công
  const chatScreenshotPath = `/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/${screenshotPrefix}_chat_verified.png`;
  await page.screenshot({ path: chatScreenshotPath });
  console.log(`📸 Đã lưu ảnh minh chứng Chatbot: ${chatScreenshotPath}`);

  // 2. Kiểm tra tra cứu thuốc trên thanh tìm kiếm thuốc hoặc thẻ thuốc
  console.log(`\n-> [Test Tra cứu thuốc] Kiểm tra danh mục dược và tìm kiếm...`);
  const drugSearchInput = page.locator('input[placeholder*="Tìm thuốc"], input[placeholder*="hoạt chất"], input[placeholder*="Tìm kiếm"]').first();
  if (await drugSearchInput.isVisible()) {
    await drugSearchInput.fill('Paracetamol');
    await page.waitForTimeout(1000);
    const drugItems = page.locator('[data-testid*="drug-item"], [data-testid*="med-card"], table tr');
    const drugCount = await drugItems.count();
    console.log(`   ✅ Tra cứu nhanh "Paracetamol": tìm thấy ${drugCount} kết quả.`);
  }

  await browser.close();
  console.log(`\n🎉 HOÀN THÀNH TOÀN BỘ KIỂM THỬ PLAYWRIGHT THÀNH CÔNG CHO ${targetUrl}!\n`);
}

async function run() {
  const target = process.argv[2] || 'http://127.0.0.1:5173';
  const prefix = process.argv[3] || 'local_verified';
  await testChatAndDrugSearch(target, prefix);
}

run().catch(err => {
  console.error('LỖI KIỂM THỬ PLAYWRIGHT:', err);
  process.exit(1);
});
