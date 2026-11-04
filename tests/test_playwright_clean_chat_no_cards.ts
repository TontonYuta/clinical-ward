import { chromium } from 'playwright';

async function runCleanChatTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT CHATBOT LOCAL KHÔNG THẺ THÔNG TIN & CHIPS TẠI: ${targetUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
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

  // Làm sạch chat nếu có nút làm mới
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }

  let prevCount = await page.locator('[data-testid*="chat-message"]').count();
  console.log(`Số tin nhắn ban đầu trong khung chat: ${prevCount}`);

  const testQueries = [
    { q: 'Thông tin về thuốc hạ sốt', desc: 'Tra cứu tài liệu thuốc hạ sốt qua SOTA RAG' },
    { q: 'Tôi bị sốt, tôi nên uống thuốc nào nhỉ', desc: 'Tư vấn triệu chứng sốt trực tiếp qua RAG' },
    { q: 'Tài liệu tham khảo chung: xử trí người bệnh sốt cao', desc: 'Tài liệu phác đồ xử trí sốt cao từ RAG' }
  ];

  for (let idx = 0; idx < testQueries.length; idx++) {
    const item = testQueries[idx];
    console.log(`\n-> [Test Chat #${idx + 1}] (${item.desc})`);
    console.log(`   Gửi prompt: "${item.q}"`);
    await chatInput.fill(item.q);
    await page.waitForTimeout(250);
    await sendBtn.click();

    // Đợi phản hồi xuất hiện
    let answered = false;
    for (let retry = 0; retry < 35; retry++) {
      await page.waitForTimeout(600);
      const currentCount = await page.locator('[data-testid*="chat-message"]').count();
      if (currentCount >= prevCount + 2) {
        answered = true;
        prevCount = currentCount;
        break;
      }
    }

    if (!answered) {
      throw new Error(`Timeout chờ phản hồi cho câu hỏi: "${item.q}"`);
    }

    // Lấy tin nhắn mới nhất
    const lastAgentMsg = page.locator('[data-testid="chat-message-agent"]').last();
    const textContent = await lastAgentMsg.innerText();
    console.log(`   ✅ Phản hồi #${idx + 1} thành công (Tổng msg: ${prevCount})`);
    console.log(`   Nội dung phản hồi: ${textContent.slice(0, 150).replace(/\n/g, ' ')}...`);

    // 1. Kiểm tra không có Action Card
    const hasCard = await lastAgentMsg.locator('button:has-text("Mở")').count();
    console.log(`   Action card count trong phản hồi: ${hasCard}`);
    if (hasCard > 0) {
      throw new Error(`Phát hiện Action Card trong tin nhắn!`);
    }

    // 2. Kiểm tra không có Suggested Chips
    const hasChips = await lastAgentMsg.locator('text=Gợi ý hỏi tiếp:').count();
    console.log(`   Suggested chips header count: ${hasChips}`);
    if (hasChips > 0) {
      throw new Error(`Phát hiện Suggested Chips trong tin nhắn!`);
    }

    // 3. Kiểm tra không có CDSS Alert Banner
    const hasCdssAlert = await lastAgentMsg.locator('[data-testid*="cdss-alert"]').count();
    console.log(`   CDSS Alert banner count: ${hasCdssAlert}`);
    if (hasCdssAlert > 0) {
      throw new Error(`Phát hiện CDSS Alert Banner trong tin nhắn!`);
    }
  }

  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_clean_chat_no_cards_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n📸 Đã lưu ảnh minh chứng: ${screenshotPath}`);

  await browser.close();
  console.log('\n🎉 HOÀN THÀNH TOÀN BỘ KIỂM THỬ: KHÔNG CÒN BẤT KỲ THẺ THÔNG TIN HAY CHIPS NÀO TRONG CHATBOT!');
}

runCleanChatTest().catch(err => {
  console.error('\n❌ Thất bại:', err);
  process.exit(1);
});
