import { chromium } from 'playwright';

async function runSelfRagPlaywrightTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT SELF-RAG REFLECTIVE VERIFICATION TẠI: ${targetUrl}`);
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
    {
      q: 'Kháng sinh nhóm Macrolid phối hợp với Statin có nguy cơ gì?',
      expectedSubstrings: [
        'Macrolid', 'Statin', 'CYP3A4', 'Tiêu cơ vân',
        'Kiểm định phản tư Self-RAG (ICLR 2024)', 'ĐÃ XÁC THỰC', 'Độ trung thực'
      ],
      desc: 'Self-RAG Verification on High-Level DDI (Macrolid + Statin)'
    },
    {
      q: 'Bệnh nhân bị ho khan do dùng Coversyl thì đổi sang nhóm nào?',
      expectedSubstrings: [
        'Perindopril', 'ARB', 'Bradykinin',
        'Kiểm định phản tư Self-RAG (ICLR 2024)', 'ĐÃ XÁC THỰC'
      ],
      desc: 'Self-RAG Verification on Therapeutic Substitution (Coversyl ho khan -> ARB)'
    }
  ];

  for (let idx = 0; idx < testQueries.length; idx++) {
    const item = testQueries[idx];
    console.log(`\n-> [Test #${idx + 1}] (${item.desc})`);
    console.log(`   Gửi prompt: "${item.q}"`);
    await chatInput.fill(item.q);
    await page.waitForTimeout(250);
    await sendBtn.click();

    // Đợi phản hồi xuất hiện
    let answered = false;
    for (let retry = 0; retry < 40; retry++) {
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

    const lastAgentMsg = page.locator('[data-testid="chat-message-agent"]').last();
    const textContent = await lastAgentMsg.innerText();
    console.log(`   ✅ Phản hồi #${idx + 1} thành công (Tổng msg: ${prevCount})`);
    console.log(`   Nội dung: ${textContent.slice(0, 160).replace(/\n/g, ' ')}...`);

    for (const exp of item.expectedSubstrings) {
      if (!textContent.includes(exp)) {
        throw new Error(`Thiếu từ khóa mong đợi "${exp}" trong phản hồi!`);
      }
    }
    console.log(`   ✅ Đã xác minh đầy đủ: ${item.expectedSubstrings.join(', ')}`);
  }

  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/self_rag_verification_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n📸 Đã lưu ảnh minh chứng: ${screenshotPath}`);

  await browser.close();
  console.log('\n🎉 HOÀN THÀNH TOÀN BỘ KIỂM THỬ PLAYWRIGHT SELF-RAG REFLECTIVE VERIFICATION!');
}

runSelfRagPlaywrightTest().catch(err => {
  console.error('\n❌ Thất bại:', err);
  process.exit(1);
});
