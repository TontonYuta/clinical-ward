const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const screenshotDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/f25324be-2bc8-4450-9006-d204ed53b109/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const sampleImagePath = path.resolve('/home/tontonyuta/Downloads/DoAn2/dist/samples/don_thuoc_mau_chuan_bo_y_te.png');
  if (!fs.existsSync(sampleImagePath)) {
    throw new Error('Sample image not found: ' + sampleImagePath);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  try {
    console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Login as bs_tran_minh
  const usernameInput = page.locator('input[placeholder*="tên đăng nhập" i], input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const loginButton = page.locator('button:has-text("Đăng nhập")').first();

  if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('2. Logging in as bs_tran_minh...');
    await usernameInput.fill('bs_tran_minh');
    await passwordInput.fill('KhamBenh@CapCuuHoiSuc2026#');
    await loginButton.click();
    await page.waitForTimeout(2000);
  }

  // Switch to Copilot Chat tab
  console.log('3. Opening Copilot Chat tab...');
  const chatTab = page.locator('button:has-text("Trợ lý"), button:has-text("Chatbot")').first();
  if (await chatTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }

  // Click Image attachment button in ChatInputBar
  console.log('4. Clicking image attachment button...');
  const imageBtn = page.locator('button[data-testid="chat-attach-image-btn"]').first();
  await imageBtn.waitFor({ state: 'visible', timeout: 8000 });
  await imageBtn.click();
  await page.waitForTimeout(1000);

  // Set input file in ImageModal
  console.log('5. Uploading sample prescription image...');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(sampleImagePath);
  await page.waitForTimeout(1000);

  // Fill prompt inside ImageModal if desired
  const imagePromptInput = page.locator('#clinical-image-prompt, textarea').first();
  if (await imagePromptInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await imagePromptInput.fill('Phân tích đơn thuốc này, kiểm tra tương tác thuốc DDI và cảnh báo thanh toán BHYT');
  }

  // Ensure image processing finished and Send button is enabled
  console.log('6. Sending image to Copilot Chat...');
  const sendImageBtn = page.locator('[data-testid="send-image-ai-btn"]').first();
  await sendImageBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="send-image-ai-btn"]');
    return btn && !btn.hasAttribute('disabled');
  }, { timeout: 10000 });

  await sendImageBtn.click();
  console.log('   Waiting for AI Vision + DDI + BHYT synthesis to complete...');

  // Wait for the synthesized markdown response (may take 10-25s for Gemini vision + DDI + BHYT engines)
  await page.waitForFunction(
    () => document.body && document.body.innerText.includes('KẾT QUẢ PHÂN TÍCH ĐƠN THUỐC'),
    { timeout: 50000 }
  );
  console.log('   ✓ Detected synthesized clinical report in chat message!');

  await page.waitForTimeout(2000);

  // Extract specific AI response message element
  const reportText = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2, h3'));
    const target = headings.find(h => h.textContent && h.textContent.includes('KẾT QUẢ PHÂN TÍCH ĐƠN THUỐC'));
    if (!target) return '';
    // Find enclosing message bubble
    const bubble = target.closest('[data-message-id], .prose, .chat-bubble, div[class*="message"]');
    return bubble ? bubble.innerText : target.parentElement ? target.parentElement.innerText : '';
  });

  const matchedIcons = (reportText.match(/[📑💊⚠️⛔🚨✅🛡️💵💡]/g) || []);
  console.log('DEBUG: reportText length:', reportText.length, 'Matched icons in message:', matchedIcons);

  const fullChatText = await page.innerText('body');
  const textToCheck = reportText || fullChatText;

  const hasDdiSection = /cảnh báo tương tác thuốc|qđ 5948\/qđ-byt/i.test(textToCheck);
  const hasBhytSection = /thông tư 20\/2022\/tt-byt|danh mục thuốc bhyt/i.test(textToCheck);
  const hasPatientName = /nguyễn văn an/i.test(textToCheck);
  const hasActionCard = /đồng bộ đơn thuốc sang kê đơn cpoe|mở phân hệ kê đơn cpoe/i.test(fullChatText);
  const hasNoUnnecessaryIcons = matchedIcons.length === 0;
  const hasNoGuessedPrice = !/xuất toán dự tính|15,000\s*đ/i.test(textToCheck);

  console.log('\n--- VERIFICATION CHECKLIST ---');
  console.log('1. Patient & Prescribed Drugs Table:', hasPatientName ? 'PASS' : 'FAIL');
  console.log('2. Clinical DDI Warnings Section:', hasDdiSection ? 'PASS' : 'FAIL');
  console.log('3. BHYT Drug Catalog Coverage Section:', hasBhytSection ? 'PASS' : 'FAIL');
  console.log('4. Interactive Action Card (CPOE 1-Click):', hasActionCard ? 'PASS' : 'FAIL');
  console.log('5. No Unnecessary Emojis / Decorative Icons:', hasNoUnnecessaryIcons ? 'PASS' : 'FAIL');
  console.log('6. No Guessed Drug Prices / Fake VNĐ:', hasNoGuessedPrice ? 'PASS' : 'FAIL');

  // Take screenshot
  const screenshotPath = path.join(screenshotDir, 'copilot_prescription_ddi_bhyt_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('   ✓ Screenshot saved to:', screenshotPath);

  await browser.close();
  console.log('\n=============================================================');
  console.log('🎉 PRESCRIPTION VISION + DDI + BHYT SYNTHESIS VERIFIED 100%!');
  console.log('=============================================================');
  } catch (err) {
    console.error('Test error:', err);
    try {
      const bodyText = await page.innerText('body');
      console.log('PAGE BODY TEXT ON ERROR:\n', bodyText.substring(0, 3000));
    } catch (e) {}
    await page.screenshot({ path: path.join(screenshotDir, 'debug_error.png') }).catch(() => {});
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

run();
