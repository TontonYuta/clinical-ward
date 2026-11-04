import { chromium } from 'playwright';

async function testTypographyRevamp() {
  const localUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TYPOGRAPHY MỚI TẠI: ${localUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Xóa font scale cũ lưu trong localStorage để nạp mặc định 'standard' (16px)
  await page.evaluate(() => {
    localStorage.removeItem('clinical_ward_font_scale');
    localStorage.removeItem('clinical_font_scale');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Kiểm tra kích thước root font
  const rootFontSize = await page.evaluate(() => document.documentElement.style.fontSize);
  console.log(`Root font-size sau khi chuẩn hóa: "${rootFontSize}"`);
  if (rootFontSize !== '16px') {
    throw new Error(`THẤT BẠI: Root font-size kỳ vọng là 16px, thực tế là ${rootFontSize}`);
  }
  console.log('✅ Root font-size đã được đưa về chuẩn công thái học 16px!');

  // 2. Chụp ảnh màn hình Tổng Quan Trạm Làm Việc (Dashboard Overview)
  const screenshotOverview = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_clean_typography_overview.png';
  await page.screenshot({ path: screenshotOverview, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình Tổng quan lưu tại: ${screenshotOverview}`);

  // 3. Chuyển sang Tab Kê đơn thuốc CPOE
  console.log('Chuyển sang Tab Kê đơn thuốc CPOE...');
  const cpoeTabBtn = page.locator('button[title*="Kê đơn thuốc"], button:has-text("Kê đơn thuốc")').first();
  if (await cpoeTabBtn.isVisible()) {
    await cpoeTabBtn.click();
    await page.waitForTimeout(1500);
  }

  const screenshotCpoe = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_clean_typography_cpoe.png';
  await page.screenshot({ path: screenshotCpoe, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình CPOE lưu tại: ${screenshotCpoe}`);

  // 4. Mở Chatbot và kiểm tra Typography trong hội thoại
  console.log('Mở Chatbot lâm sàng...');
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
  const testQuery = 'Tương tác giữa Clopidogrel và Omeprazol';
  console.log(`Gửi câu hỏi: "${testQuery}"`);
  await chatInput.fill(testQuery);
  await sendBtn.click();

  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(2500);

  const screenshotChat = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/local_clean_typography_chatbot.png';
  await page.screenshot({ path: screenshotChat, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình Chatbot lưu tại: ${screenshotChat}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 KIỂM THỬ PLAYWRIGHT TYPOGRAPHY THÀNH CÔNG 100%!');
  console.log('======================================================');
}

testTypographyRevamp().catch((err) => {
  console.error('LỖI KIỂM THỬ TYPOGRAPHY:', err);
  process.exit(1);
});
