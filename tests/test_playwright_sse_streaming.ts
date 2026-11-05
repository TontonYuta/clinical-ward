import { chromium } from 'playwright';

async function testSseStreaming() {
  const localUrl = 'http://127.0.0.1:5173';
  const streamingArtifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_sse_streaming_in_progress.png';
  const completedArtifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_sse_streaming_completed.png';

  console.log('======================================================');
  console.log(`KIỂM THỬ PLAYWRIGHT E2E: SERVER-SENT EVENTS (SSE) TOKEN STREAMING`);
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

  // 1. Mở Chatbot
  const copilotAside = page.locator('aside[aria-label="Trợ lý AI Lâm Sàng"]');
  const toggleBtn = page.locator('[data-testid="copilot-toggle-btn"]');

  if (!await copilotAside.isVisible().catch(() => false)) {
    console.log('1. Mở Trợ Lý AI Lâm Sàng (Ctrl+K)...');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);
    if (!await copilotAside.isVisible().catch(() => false) && await toggleBtn.isVisible().catch(() => false)) {
      await toggleBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Chatbot đã mở và sẵn sàng nhận lệnh.');

  // 2. Gửi câu hỏi lâm sàng
  const testQuery = 'Paracetamol 500mg uống thế nào?';
  console.log(`2. Nhập câu hỏi: "${testQuery}"`);
  await chatInput.fill(testQuery);
  await page.waitForTimeout(200);

  const sendBtn = page.locator('button[type="submit"]');
  await sendBtn.click();
  console.log('3. Đã nhấn gửi, theo dõi luồng truyền phát token (Token Streaming)...');

  // 3. Đo lường TTFT (Time To First Token) và bắt trạng thái đang stream
  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let capturedMidStream = false;

  const agentMessage = page.locator('[data-testid="chat-message-agent"]').last();

  // Polling nhanh mỗi 40ms để bắt thời điểm ký tự đầu tiên xuất hiện
  for (let i = 0; i < 75; i++) {
    const text = await agentMessage.innerText().catch(() => '');
    if (text.length > 10 && !firstTokenTime) {
      firstTokenTime = Date.now() - startTime;
      console.log(`⚡ [TTFT ĐẠT CHUẨN] Token đầu tiên xuất hiện sau: ${firstTokenTime}ms! Nội dung khởi đầu: "${text.slice(0, 40)}..."`);
    }

    if (text.length > 50 && text.length < 800 && !capturedMidStream) {
      capturedMidStream = true;
      console.log(`📸 Chụp ảnh màn hình trong quá trình truyền phát token (Đang stream: ${text.length} ký tự)...`);
      await page.screenshot({ path: streamingArtifactPath, fullPage: false });
    }

    if (firstTokenTime && capturedMidStream) break;
    await page.waitForTimeout(40);
  }

  if (!firstTokenTime) {
    throw new Error('THẤT BẠI: Không nhận được token stream trong vòng 3 giây!');
  }

  // 4. Chờ hoàn tất toàn bộ câu trả lời
  console.log('4. Chờ hoàn tất toàn bộ nội dung y văn...');
  await page.waitForFunction(() => {
    const msgs = document.querySelectorAll('[data-testid="chat-message-agent"]');
    if (!msgs.length) return false;
    const lastMsg = msgs[msgs.length - 1];
    return lastMsg.textContent && lastMsg.textContent.length > 400;
  }, { timeout: 15000 });

  await page.waitForTimeout(1000);
  const finalText = await agentMessage.innerText();
  console.log(`✅ Toàn bộ nội dung đã hoàn tất: ${finalText.length} ký tự.`);

  // Chụp ảnh bằng chứng hoàn tất
  await page.screenshot({ path: completedArtifactPath, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình hoàn tất: ${completedArtifactPath}`);

  await browser.close();
  console.log('======================================================');
  console.log(`🎉 KIỂM THỬ PLAYWRIGHT SSE TOKEN STREAMING HOÀN TẤT THÀNH CÔNG! (TTFT: ${firstTokenTime}ms)`);
  console.log('======================================================');
}

testSseStreaming().catch(err => {
  console.error('LỖI KIỂM THỬ STREAMING:', err);
  process.exit(1);
});
