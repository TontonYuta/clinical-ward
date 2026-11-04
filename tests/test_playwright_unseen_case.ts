import { chromium } from 'playwright';

async function runUnseenPlaywrightTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU TEST PLAYWRIGHT PROMPT MỚI 100% TẠI: ${targetUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);

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

  // PROMPT MỚI 100% CHƯA TỪNG SỬ DỤNG TRONG QUÁ KHỨ (Case 3: Clopidogrel + Omeprazol -> Pantoprazol)
  const unseenQuery = 'Bệnh nhân đặt stent mạch vành đang uống Clopidogrel, bị viêm loét dạ dày có dùng chung với Omeprazol được không và nên đổi sang thuốc gì?';
  const expectedKeywords = [
    'Clopidogrel',
    'Omeprazol',
    'CYP2C19',
    'Pantoprazol'
  ];

  console.log(`Gửi prompt mới: "${unseenQuery}"`);
  await chatInput.fill(unseenQuery);
  await sendBtn.click();

  // Đợi phản hồi xuất hiện
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(3000);

  const messages = page.locator('[data-testid*="chat-message"]');
  const count = await messages.count();
  const latestMessage = messages.nth(count - 1);
  const textContent = (await latestMessage.textContent()) || '';

  console.log(`Phản hồi nhận được (${textContent.length} ký tự):\n${textContent.slice(0, 300)}...`);

  for (const kw of expectedKeywords) {
    if (textContent.includes(kw)) {
      console.log(`  ✅ Tìm thấy từ khóa mong đợi: "${kw}"`);
    } else {
      console.error(`  ❌ KHÔNG tìm thấy từ khóa: "${kw}"`);
      throw new Error(`Thiếu từ khóa: ${kw}`);
    }
  }

  // Chụp ảnh bằng chứng
  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/unseen_prompt_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n📸 Đã chụp ảnh màn hình lưu tại: ${screenshotPath}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 KIỂM THỬ PLAYWRIGHT PROMPT MỚI THÀNH CÔNG 100%!');
  console.log('======================================================');
}

runUnseenPlaywrightTest().catch((err) => {
  console.error('LỖI TEST PLAYWRIGHT:', err);
  process.exit(1);
});
