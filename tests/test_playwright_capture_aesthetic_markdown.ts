import { chromium } from 'playwright';

async function captureAestheticMarkdown() {
  const localUrl = 'http://127.0.0.1:5173';
  const artifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_aesthetic_markdown_presentation.png';

  console.log('Capturing aesthetic markdown presentation screenshot...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  await page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Mở Chatbot
  const copilotAside = page.locator('aside[aria-label="Trợ lý AI Lâm Sàng"]');
  const toggleBtn = page.locator('[data-testid="copilot-toggle-btn"]');

  if (!await copilotAside.isVisible().catch(() => false)) {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);
    if (!await copilotAside.isVisible().catch(() => false) && await toggleBtn.isVisible().catch(() => false)) {
      await toggleBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });

  // Gửi câu hỏi
  await chatInput.fill('Paracetamol 500mg uống thế nào?');
  await page.waitForTimeout(200);
  await page.locator('button[type="submit"]').click();

  // Chờ câu trả lời hoàn tất
  await page.waitForFunction(() => {
    const msgs = document.querySelectorAll('[data-testid="chat-message-agent"]');
    if (!msgs.length) return false;
    const lastMsg = msgs[msgs.length - 1];
    return lastMsg.textContent && lastMsg.textContent.length > 500;
  }, { timeout: 15000 });

  await page.waitForTimeout(1200);

  // Chụp ảnh khu vực Chat Window rõ nét
  const chatWindow = page.locator('aside[aria-label="Trợ lý AI Lâm Sàng"]');
  if (await chatWindow.isVisible()) {
    await chatWindow.screenshot({ path: artifactPath });
    console.log(`✅ Đã chụp cận cảnh Chat Window: ${artifactPath}`);
  } else {
    await page.screenshot({ path: artifactPath });
    console.log(`✅ Đã chụp toàn màn hình: ${artifactPath}`);
  }

  await browser.close();
  console.log('🎉 Capture completed!');
}

captureAestheticMarkdown().catch(err => {
  console.error(err);
  process.exit(1);
});
