import { chromium } from 'playwright';

export async function testStage2PaperQAPlaywright(targetUrl: string, screenshotPath: string) {
  console.log(`\n======================================================`);
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT E2E GIAI ĐOẠN 2 TẠI: ${targetUrl}`);
  console.log(`======================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 850 }
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
    { q: 'Thông tin thuốc Coversyl', desc: 'Tra cứu hồ sơ phối hợp Coversyl' },
    { q: 'Liều dùng của Coversyl như thế nào?', desc: 'PaperQA2 hỏi liều dùng dạng đàm thoại' },
    { q: 'Kháng sinh Zithromax nên uống trước hay sau ăn?', desc: 'PaperQA2 đối soát thời điểm dùng thuốc' },
    { q: 'lấy ví dụ cho tôi 3 cặp tương tác thuốc chống chỉ định', desc: 'CRAG tra cứu DDI catalog đợt 1' },
    { q: 'lấy 4 cặp nữa', desc: 'CRAG Contextual Rewriter phân giải đa lượt đợt 2' }
  ];

  let prevCount = await page.locator('[data-testid*="chat-message"]').count();
  console.log(`Số tin nhắn ban đầu trong khung chat: ${prevCount}`);

  for (let idx = 0; idx < testQueries.length; idx++) {
    const item = testQueries[idx];
    console.log(`\n-> [Test Chat #${idx + 1}] (${item.desc})`);
    console.log(`   Gửi prompt: "${item.q}"`);
    await chatInput.fill(item.q);
    await page.waitForTimeout(250);
    await sendBtn.click();

    // Đợi phản hồi xuất hiện
    let answered = false;
    for (let retry = 0; retry < 30; retry++) {
      await page.waitForTimeout(600);
      const currentCount = await page.locator('[data-testid*="chat-message"]').count();
      if (currentCount >= prevCount + 2) {
        answered = true;
        prevCount = currentCount;
        break;
      }
    }

    if (!answered) {
      throw new Error(`Chatbot không phản hồi hoặc timeout tại câu hỏi thứ ${idx + 1}: "${item.q}"`);
    }

    const msgs = await page.locator('[data-testid*="chat-message"]').allInnerTexts();
    const lastReply = msgs[msgs.length - 1] || '';
    console.log(`   ✅ Phản hồi #${idx + 1} thành công (Tổng msg: ${msgs.length})`);
    console.log(`   Nội dung: ${lastReply.slice(0, 140).replace(/\n/g, ' ')}...`);
  }

  // Chụp ảnh giao diện Chatbot sau chuỗi câu hỏi thành công
  await page.screenshot({ path: screenshotPath });
  console.log(`\n📸 Đã lưu ảnh minh chứng Chatbot Stage 2: ${screenshotPath}`);

  await browser.close();
  console.log(`\n🎉 HOÀN THÀNH TOÀN BỘ KIỂM THỬ PLAYWRIGHT GIAI ĐOẠN 2 THÀNH CÔNG!\n`);
}

async function run() {
  const target = process.argv[2] || 'http://127.0.0.1:5173';
  const outPath = process.argv[3] || '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/stage2_paperqa_verified_chat_verified.png';
  await testStage2PaperQAPlaywright(target, outPath);
}

run().catch(err => {
  console.error('LỖI KIỂM THỬ PLAYWRIGHT GIAI ĐOẠN 2:', err);
  process.exit(1);
});
