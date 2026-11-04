import { chromium } from 'playwright';

async function runParacetamolSotaRagTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU TEST PLAYWRIGHT LOCAL PARACETAMOL SOTA RAG: ${targetUrl}`);
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
    { q: 'paracetamol', desc: 'Tra cứu tổng quan Paracetamol qua PaperQA2 RAG' },
    { q: 'paracetamol liều trẻ em', desc: 'Tra cứu liều trẻ em Paracetamol qua PaperQA2 Synthesis' }
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

    // Lấy tin nhắn mới nhất của trợ lý
    const lastAgentMsg = page.locator('[data-testid="chat-message-agent"]').last();
    const textContent = await lastAgentMsg.innerText();
    console.log(`   ✅ Phản hồi #${idx + 1} thành công (Tổng msg: ${prevCount})`);
    console.log(`   Nội dung: ${textContent.slice(0, 160).replace(/\n/g, ' ')}...`);

    // Kiểm tra không dùng template cứng cũ
    if (textContent.includes('### 📋 Tổng Quan Dược Lâm Sàng & An Toàn Thuốc')) {
      throw new Error(`Phát hiện template tĩnh cũ trong câu trả lời!`);
    }

    // Kiểm tra có cấu trúc PaperQA2
    if (!textContent.includes('Kết luận lâm sàng chính') && !textContent.includes('Chi Tiết Hướng Dẫn')) {
      throw new Error(`Phản hồi thiếu cấu trúc PaperQA2 Evidence Synthesis!`);
    }

    // Kiểm tra không có Action Card hay Suggested Chips
    const hasCard = await lastAgentMsg.locator('button:has-text("Mở")').count();
    if (hasCard > 0) {
      throw new Error(`Phát hiện Action Card trong tin nhắn!`);
    }
  }

  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/paracetamol_sota_rag_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n📸 Đã chụp ảnh màn hình minh chứng tại: ${screenshotPath}`);

  await browser.close();
  console.log('\n🎉 TẤT CẢ TEST PLAYWRIGHT CHO PARACETAMOL SOTA RAG ĐÃ THÀNH CÔNG 100%!');
}

runParacetamolSotaRagTest().catch(err => {
  console.error('❌ LỖI PLAYWRIGHT:', err);
  process.exit(1);
});
